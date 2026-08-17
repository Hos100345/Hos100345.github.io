// ============================================================
// מחולל הדאבל — Edge Function: image-gateway
// שלב 0: יצירת סמלי AI, מנהל בלבד. שער אמיתי בצד שרת — לא לסמוך על
// isAdminUser() בפרונט (תצוגה בלבד, ניתן לזייף ב-DevTools).
//
// פריסה: MCP בלבד (Claude Code לא מגיע ל-Supabase).
// Secrets נדרשים (Edge Functions → Secrets):
//   POLLINATIONS_TOKEN — טוקן Pollinations, ליצירת התמונות בלבד
//   ANTHROPIC_API_KEY   — לתרגום עברית→אנגלית ולמחולל הנושאים (action:'theme')
//   ADMIN_EMAILS        — מיילים מופרדים בפסיקים (ברירת מחדל: hoshaya@gmail.com)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const POLLINATIONS_TOKEN = Deno.env.get('POLLINATIONS_TOKEN') || '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const BUCKET = 'ai-symbols';

function anthropicHeaders() {
  return {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
}

// נרמול מפתח הקאש: רווחי קצה מוסרים, רצף רווחים מתכווץ לאחד
function normalizeKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

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

async function translateToEnglish(hebrew: string, admin: any): Promise<string> {
  // 1. אין תו עברי — אין מה לתרגם, ואין סיבה לשלם על קריאה
  if (!/[\u0590-\u05FF]/.test(hebrew)) return hebrew;

  const key = normalizeKey(hebrew);

  // 2. קאש
  const { data: cached } = await admin.from('ai_translation_cache')
    .select('source_he,english,hits').eq('source_he', key).maybeSingle();
  if (cached?.english) {
    await admin.from('ai_translation_cache')
      .update({ hits: (cached.hits || 0) + 1 }).eq('source_he', key);
    return cached.english;
  }

  // 3. תרגום בתשלום
  if (!ANTHROPIC_API_KEY) {
    throw new Error('חסר ANTHROPIC_API_KEY ב-Secrets — תרגום מעברית אינו זמין');
  }

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 64,
      system: 'You translate Hebrew words or short phrases into a short English noun phrase '
        + 'suitable for an image-generation prompt. Reply with ONLY the English noun phrase. '
        + 'No quotes, no punctuation, no explanation. If the input names a Jewish or Israeli '
        + 'concept with no common English word, give a short visual description of the object '
        + 'instead of transliterating it.',
      messages: [{ role: 'user', content: key }],
    }),
  });

  if (!resp.ok) {
    const body = (await resp.text().catch(() => '')).slice(0, 200);
    throw new Error(`תרגום נכשל (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  const out = String(data?.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '');
  if (!out) throw new Error('תרגום ריק');

  // 4. שמירה לקאש. כישלון כאן לא מפיל את הבקשה — התרגום כבר בידינו.
  await admin.from('ai_translation_cache')
    .upsert({ source_he: key, english: out, hits: 0 }, { onConflict: 'source_he' });

  return out;
}

async function generateImageBytes(prompt: string, seed: number): Promise<Uint8Array> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
    + `?width=768&height=768&model=flux&nologo=true&safe=true&seed=${seed}`
    + (POLLINATIONS_TOKEN ? `&token=${encodeURIComponent(POLLINATIONS_TOKEN)}` : '');
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

async function generateTheme(topic: string, count: number): Promise<Array<{he:string,en:string}>> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('חסר ANTHROPIC_API_KEY ב-Secrets — מחולל הנושאים אינו זמין');
  }

  const system = [
    'You generate item lists for a children\'s picture-matching card game (Dobble/Spot-It).',
    'Return ONLY a JSON array. No markdown fences, no prose, no explanation.',
    'Each element: {"he":"<Hebrew name>","en":"<English noun phrase for an image generator>"}',
    '',
    'HARD RULES:',
    '1. Every item must be a concrete, physical object that can be drawn as a single clear symbol.',
    '   Reject abstractions. "happiness" or "freedom" cannot be drawn as a recognizable icon.',
    '   If the topic is abstract, choose concrete objects that represent it.',
    '2. Items must be visually distinct from each other. Do not include both "cat" and "kitten",',
    '   or several items that would render as similar silhouettes.',
    '3. Hebrew names must be short and natural for young children, 1-2 words.',
    '4. English must describe the object visually, never a transliteration.',
    '   For Jewish or Israeli concepts with no common English word, describe the object.',
    '   Example: "לולב" -> "green palm frond", not "lulav".',
    '5. Return exactly the requested number of items. No duplicates.',
  ].join('\n');

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(),
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: `Topic: ${topic}\nNumber of items: ${count}` }],
    }),
  });

  if (!resp.ok) {
    const body = (await resp.text().catch(() => '')).slice(0, 200);
    throw new Error(`יצירת הנושא נכשלה (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  let raw = String(data?.content?.[0]?.text || '').trim();

  // הסרת גדרות markdown אם המודל הוסיף אותן בכל זאת
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let items: any;
  try {
    items = JSON.parse(raw);
  } catch {
    throw new Error('התשובה מהמודל אינה JSON תקין');
  }
  if (!Array.isArray(items)) throw new Error('התשובה מהמודל אינה רשימה');

  // ניקוי, סינון תוכן, והסרת כפילויות
  const seen = new Set<string>();
  const clean: Array<{he:string,en:string}> = [];
  for (const it of items) {
    const he = normalizeKey(String(it?.he || ''));
    const en = normalizeKey(String(it?.en || ''));
    if (!he || !en) continue;
    if (violatesContentPolicy(he, en)) continue;
    if (seen.has(he)) continue;
    seen.add(he);
    clean.push({ he, en });
    if (clean.length >= count) break;
  }

  if (!clean.length) throw new Error('לא התקבלו פריטים תקינים');
  return clean;
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

    if (body.action === 'theme') {
      const topic = normalizeKey(String(body.topic || ''));
      if (!topic || topic.length > 120) return json({ error: 'נושא חסר או ארוך מדי' }, 400);
      if (violatesContentPolicy(topic)) {
        return json({ error: 'הנושא אינו מתאים למשחק ילדים' }, 400);
      }
      let count = Number.isFinite(Number(body.count)) ? Math.trunc(Number(body.count)) : 12;
      count = Math.max(1, Math.min(57, count));
      const items = await generateTheme(topic, count);
      return json({ items });
    }

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
      subject = await translateToEnglish(textHe, admin);
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
