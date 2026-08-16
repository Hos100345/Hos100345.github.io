// ============================================================
// מחולל הדאבל — Edge Function: image-gateway
// שלב 0: יצירת סמלי AI, מנהל בלבד. שער אמיתי בצד שרת — לא לסמוך על
// isAdminUser() בפרונט (תצוגה בלבד, ניתן לזייף ב-DevTools).
//
// פריסה: MCP בלבד (Claude Code לא מגיע ל-Supabase).
// Secrets נדרשים (Edge Functions → Secrets):
//   POLLINATIONS_TOKEN — טוקן Pollinations
//   ADMIN_EMAILS        — מיילים מופרדים בפסיקים (ברירת מחדל: hoshaya@gmail.com)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const POLLINATIONS_TOKEN = Deno.env.get('POLLINATIONS_TOKEN') || '';
const BUCKET = 'ai-symbols';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── סגנונות זמינים לסמל ──
// השרת הוא מקור האמת: הפרונט שולח רק את שם הסגנון, לא את הפרומפט המלא.
const STYLE_SUFFIX: Record<string, string> = {
  vector: 'flat vector icon illustration, bold clean outlines, simple flat colors, minimalist design',
  cartoon: 'cute cartoon illustration, playful children\'s book style, soft shading, friendly and colorful',
  sticker: 'die-cut sticker illustration, thick white border, vibrant saturated colors, glossy finish',
  doodle: 'hand-drawn doodle illustration, simple bold line art, bright flat colors, whimsical children\'s style',
};
const DEFAULT_STYLE = 'vector';

// תוצאה חייבת להיות אובייקט בודד ומרכזי, מתאים לחיתוך עגול של קלף משחק —
// לא סצנה, לא כמה פריטים, ובלי טקסט/מסגרת שיפריעו לחיתוך.
const NEGATIVE = 'single centered object only, plain white background, no text, no watermark, '
  + 'no logo, no signature, no frame, no border, no multiple objects, no people, no realistic photo, '
  + 'no scene, no background clutter';

// סינון תוכן בסיסי — כלי מנהל-בלבד לשלב 0, לא שכבת הגנה מול קהל רחב.
// המטרה: לתפוס בקשות בוטות שלא מתאימות למשחק ילדים, לא לצנזר כל דבר גבולי.
const BLOCKED_WORDS = [
  // אנגלית — אלימות/נשק/סמים/מיני/שנאה
  'kill', 'murder', 'blood', 'gore', 'weapon', 'gun', 'rifle', 'pistol', 'knife', 'bomb', 'explosive',
  'drug', 'cocaine', 'heroin', 'meth', 'nazi', 'terroris', 'suicide', 'porn', 'sex', 'nude', 'naked',
  'nsfw', 'rape', 'torture', 'corpse', 'dead body',
  // עברית — אלימות/נשק/סמים/מיני
  'רצח', 'הרג', 'דם', 'נשק', 'אקדח', 'רובה', 'סכין', 'פצצה', 'סם', 'סמים', 'קוקאין', 'התאבדות',
  'פורנו', 'עירום', 'ערום', 'מין', 'אונס', 'עינויים', 'גופה', 'נאצי', 'טרור',
];
function violatesContentPolicy(...texts: string[]): boolean {
  const joined = texts.filter(Boolean).join(' ').toLowerCase();
  return BLOCKED_WORDS.some((w) => joined.includes(w));
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function translateToEnglish(hebrew: string): Promise<string> {
  const prompt = `Translate this Hebrew word or short phrase to a short English noun phrase suitable for `
    + `an image generation prompt. Respond with ONLY the English translation, no punctuation, no quotes, `
    + `no explanation: "${hebrew}"`;
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`
    + `?token=${encodeURIComponent(POLLINATIONS_TOKEN)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('תרגום נכשל: ' + resp.status);
  const out = (await resp.text()).trim().replace(/^["']|["']$/g, '');
  if (!out) throw new Error('תרגום ריק');
  return out;
}

async function generateImageBytes(prompt: string, seed: number): Promise<Uint8Array> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
    + `?width=768&height=768&model=flux&nologo=true&safe=true&seed=${seed}`
    + `&token=${encodeURIComponent(POLLINATIONS_TOKEN)}`;
  const delays = [1000, 2000, 4000, 8000];
  let lastErr = '';
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const resp = await fetch(url);
    if (resp.ok) return new Uint8Array(await resp.arrayBuffer());
    lastErr = `${resp.status} ${resp.statusText}`;
    if (resp.status !== 429 && (resp.status < 500 || resp.status >= 600)) break;
    if (attempt < delays.length) await sleep(delays[attempt]);
  }
  throw new Error('יצירת התמונה נכשלה: ' + lastErr);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // ── 1. אימות JWT ──
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !user) return json({ error: 'not authorized' }, 401);

    // ── 2. שער מנהל — הבדיקה האמיתית, לא isAdminUser() בפרונט ──
    const email = (user.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return json({ error: 'בשלב זה המחולל זמין למנהל בלבד' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    if (body.action !== 'generate') return json({ error: 'unknown action' }, 400);

    const textHe = String(body.text || '').trim();
    const englishIn = String(body.english || '').trim();
    const style = STYLE_SUFFIX[body.style] ? body.style : DEFAULT_STYLE;
    const seed = Number.isFinite(Number(body.seed)) ? Math.trunc(Number(body.seed)) : 1;
    if (!textHe) return json({ error: 'חסר תיאור' }, 400);

    // ── 3. סינון תוכן ──
    if (violatesContentPolicy(textHe, englishIn)) {
      return json({ error: 'התיאור אינו מתאים למשחק ילדים' }, 400);
    }

    // ── 4. תרגום עברית→אנגלית אם לא סופק ──
    let subject = englishIn;
    if (!subject) {
      subject = await translateToEnglish(textHe);
      if (violatesContentPolicy(subject)) {
        return json({ error: 'התיאור אינו מתאים למשחק ילדים' }, 400);
      }
    }

    // ── 5. פרומפט סופי ──
    const prompt = `${subject}, ${STYLE_SUFFIX[style]}. ${NEGATIVE}`;

    // ── 6. cache key ──
    const cacheKey = (await sha256Hex(`${prompt}|${seed}|768`)).slice(0, 32);
    const storagePath = `${cacheKey}.jpg`;

    // ── 7. פגיעת קאש ──
    const { data: existing } = await admin.from('ai_image_log')
      .select('cache_key,hits,storage_path').eq('cache_key', cacheKey).maybeSingle();
    if (existing) {
      await admin.from('ai_image_log').update({ hits: (existing.hits || 0) + 1 }).eq('cache_key', cacheKey);
      const { data: signed, error: sErr } = await admin.storage.from(BUCKET)
        .createSignedUrl(existing.storage_path, 3600);
      if (sErr || !signed) return json({ error: 'יצירת קישור חתום נכשלה: ' + (sErr?.message || '') }, 500);
      return json({ url: signed.signedUrl, cached: true, cacheKey });
    }

    // ── 8. יצירה חדשה ──
    const bytes = await generateImageBytes(prompt, seed);
    const { error: upErr } = await admin.storage.from(BUCKET)
      .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: true });
    if (upErr) return json({ error: 'העלאה ל-Storage נכשלה: ' + upErr.message }, 500);

    await admin.from('ai_image_log').insert({
      cache_key: cacheKey, prompt, subject_he: textHe, style, seed,
      storage_path: storagePath, provider: 'pollinations', est_cost_usd: 0, hits: 0,
    });

    const { data: signed, error: sErr } = await admin.storage.from(BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (sErr || !signed) return json({ error: 'יצירת קישור חתום נכשלה: ' + (sErr?.message || '') }, 500);
    return json({ url: signed.signedUrl, cached: false, cacheKey });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
