// ============================================================
// סטודיו — Edge Function: text-extract (S-86)
// מחלץ טקסט מתמונה (גם כתב יד בעברית) דרך מודל הראייה של Anthropic.
// מנהל (JWT + ADMIN_EMAILS) או לקוח עם קוד מ-studio_ocr_codes (S-87). כל דף שנקרא בהצלחה נספר לקוד.
//
// פריסה: MCP בלבד.
// Secrets (כבר קיימים בפרויקט):
//   ANTHROPIC_API_KEY — אותו מפתח של image-gateway
//   ADMIN_EMAILS      — ברירת מחדל hoshaya@gmail.com
//   TEXT_MODEL        — רשות. אם חסר: מנסים לפי הסדר ב-MODELS.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// כתב יד בעברית דורש מודל חזק. אם מודל לא זמין בחשבון — עוברים לבא בתור.
const MODELS = [Deno.env.get('TEXT_MODEL') || '', 'claude-sonnet-5-5', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001']
  .filter((m, i, a) => m && a.indexOf(m) === i);
const MAX_B64 = 6_500_000; // ~4.8MB תמונה. הדפדפן מקטין ל-2000px לפני שליחה, אז זה רק גבול ביטחון.
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function prompt(markUnclear: boolean, layout: string) {
  return [
    'Transcribe ALL the text in this image exactly as written. The text is usually Hebrew, often handwritten; it may also contain English, numbers and symbols.',
    'Rules:',
    '- Output ONLY the transcribed text. No introduction, no explanation, no translation, no markdown code fences.',
    '- Keep the original wording and spelling. Do not correct, summarize or rephrase. Keep punctuation, quotes and abbreviation marks (״ ׳ ") as written.',
    layout === 'flow'
      ? '- Join lines that belong to the same sentence or paragraph into one line. Keep a blank line between paragraphs.'
      : '- Keep the original line breaks: one output line per written line. Keep a blank line between paragraphs.',
    '- Bulleted or dashed lines stay as lines starting with "- ". Blank lines to fill in (_____) are written as ______.',
    '- Ignore crossed-out text. A word written above a line as a correction goes in its place.',
    markUnclear
      ? '- Be conservative with handwriting: after EVERY word you are not fully certain of, write your best reading followed by " [?]". Misreadings of handwriting are common, so mark generously — it is much better to mark a correct word than to leave a wrong word unmarked. If a word is unreadable, write [לא ברור].'
      : '- If a word is unclear, give your best reading without any marking.',
  ].join('\n');
}

async function extract(b64: string, mediaType: string, markUnclear: boolean, layout: string) {
  let lastErr = '';
  for (const model of MODELS) {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: prompt(markUnclear, layout) },
          ],
        }],
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok) {
      const text = (data.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
        .replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
      return { text, model };
    }
    lastErr = data?.error?.message || ('HTTP ' + resp.status);
    // מודל לא קיים/לא זמין → לנסות את הבא. כל שגיאה אחרת (מפתח, עומס, תמונה) — לעצור.
    const modelProblem = resp.status === 404 || /model/i.test(lastErr);
    if (!modelProblem) break;
  }
  throw new Error(lastErr || 'שגיאה לא ידועה');
}

const norm = (c: unknown) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');

async function codeInfo(db: any, code: string) {
  const { data } = await db.from('studio_ocr_codes').select('code,label,used,usage_limit,active,expires_at').eq('code', code).maybeSingle();
  if (!data) return null;
  const expired = !!data.expires_at && new Date(data.expires_at) <= new Date();
  const full = data.usage_limit != null && data.used >= data.usage_limit;
  return { label: data.label, used: data.used, limit: data.usage_limit, ok: data.active && !expired && !full,
    why: !data.active ? 'הקוד הושבת' : expired ? 'תוקף הקוד הסתיים' : full ? 'נגמרו הדפים בקוד הזה' : '' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const code = norm(body.code);

    // ── מי מבקש: מנהל (JWT) או לקוח עם קוד ──
    let isAdmin = false;
    if (!code) {
      const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
      const { data: { user } } = await db.auth.getUser(token).catch(() => ({ data: { user: null } }));
      isAdmin = !!user && ADMIN_EMAILS.includes((user.email || '').toLowerCase());
      if (!isAdmin) return json({ error: 'צריך קוד גישה' }, 401);
    } else {
      // הגנה מניחוש: יותר מ-20 קודים שגויים ב-15 דקות (מכל מקום) → הפסקה
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { count } = await db.from('studio_ocr_log').select('id', { count: 'exact', head: true }).eq('error', 'bad_code').gte('created_at', since);
      if ((count || 0) > 20) return json({ error: 'יותר מדי ניסיונות. נסו שוב בעוד רבע שעה' }, 429);
      const info = await codeInfo(db, code);
      if (!info) { await db.from('studio_ocr_log').insert({ code, ok: false, error: 'bad_code' }); return json({ error: 'הקוד לא נמצא' }, 403); }
      if (body.action === 'check') return json(info);
      if (!info.ok) return json({ error: info.why, ...info }, 403);
    }
    if (!ANTHROPIC_API_KEY) return json({ error: 'חסר ANTHROPIC_API_KEY ב-Secrets' }, 500);

    const b64 = String(body.image || '').replace(/^data:[^,]*,/, '');
    const mediaType = String(body.media_type || 'image/jpeg');
    if (!b64) return json({ error: 'לא נשלחה תמונה' }, 400);
    if (b64.length > MAX_B64) return json({ error: 'התמונה גדולה מדי' }, 413);
    if (!TYPES.has(mediaType)) return json({ error: 'סוג תמונה לא נתמך' }, 400);

    const t0 = Date.now();
    // לקוח עם קוד: תמיד מסמנים מילים לא בטוחות
    const mark = code ? true : body.mark_unclear !== false;
    try {
      const { text, model } = await extract(b64, mediaType, mark, body.layout === 'flow' ? 'flow' : 'lines');
      const ms = Date.now() - t0;
      let used: number | null = null;
      if (code) { // נספר רק דף שנקרא בהצלחה
        const { data } = await db.rpc('studio_ocr_consume', { p_code: code });
        used = typeof data === 'number' ? data : null;
      }
      await db.from('studio_ocr_log').insert({ code: code || 'admin', ok: true, model, ms });
      return json({ text, model, ms, used });
    } catch (e) {
      await db.from('studio_ocr_log').insert({ code: code || 'admin', ok: false, error: String((e as Error)?.message || e).slice(0, 300) });
      throw e;
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 502);
  }
});
