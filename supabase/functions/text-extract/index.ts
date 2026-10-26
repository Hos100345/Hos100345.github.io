// ============================================================
// סטודיו — Edge Function: text-extract (S-86)
// מחלץ טקסט מתמונה (גם כתב יד בעברית) דרך מודל הראייה של Anthropic.
// מנהל בלבד — שער אמיתי בצד שרת לפי ADMIN_EMAILS (כמו image-gateway).
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
      ? '- If a word is unclear, give your best reading followed by [?]. If it is unreadable, write [לא ברור].'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !user) return json({ error: 'צריך להיכנס כמנהל' }, 401);
    if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return json({ error: 'זמין למנהל בלבד' }, 403);
    if (!ANTHROPIC_API_KEY) return json({ error: 'חסר ANTHROPIC_API_KEY ב-Secrets' }, 500);

    const body = await req.json().catch(() => ({}));
    const b64 = String(body.image || '').replace(/^data:[^,]*,/, '');
    const mediaType = String(body.media_type || 'image/jpeg');
    if (!b64) return json({ error: 'לא נשלחה תמונה' }, 400);
    if (b64.length > MAX_B64) return json({ error: 'התמונה גדולה מדי' }, 413);
    if (!TYPES.has(mediaType)) return json({ error: 'סוג תמונה לא נתמך' }, 400);

    const t0 = Date.now();
    const { text, model } = await extract(b64, mediaType, body.mark_unclear !== false, body.layout === 'flow' ? 'flow' : 'lines');
    return json({ text, model, ms: Date.now() - t0 });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 502);
  }
});
