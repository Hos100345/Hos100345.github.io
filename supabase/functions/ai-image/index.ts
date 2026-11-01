// ai-image — S-115: יצירה ועריכה של תמונות לעורך הפרסומת בסטודיו, דרך OpenRouter.
// המודל לכל משימה נקרא מהטבלה public.ai_tasks — החלפת מודל = שינוי שורה, לא קוד.
// הרשאה: מנהל (JWT + ADMIN_EMAILS) או קוד מ-studio_ai_codes (נספר רק כשהקריאה הצליחה).
// Secrets: OPENROUTER_API_KEY (חובה), ADMIN_EMAILS (ברירת מחדל hoshaya@gmail.com).
// פעולות: check {code} · codes (מנהל) · generate {task?,prompt,aspect} · edit {image,mark,prompt,aspect}
//   edit: image = התמונה המקורית, mark = אותה תמונה עם האזור צבוע באדום שקוף. הדפדפן מדביק חזרה רק את האזור —
//   כך כל השאר נשאר זהה בפיקסלים גם אם המודל צייר מחדש את כל התמונה.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com').toLowerCase().split(',').map((s) => s.trim());
const OR_KEY = Deno.env.get('OPENROUTER_API_KEY') || '';
const OR = 'https://openrouter.ai/api/v1';
const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
// S-116: שקלים. העלות מ-OpenRouter בדולרים; USD_ILS = שער לחישוב (לעדכן כשהשער זז הרבה).
// לשותף נרשם חיוב = עלות × markup של הקוד (ברירת מחדל 1.2), מעוגל למעלה ל-10 אגורות, לפחות 10 אגורות — כדי שלא ייכנס הפסד.
const USD_ILS = 3.11;
const ils = (usd: number | null) => usd == null ? null : Math.round(usd * USD_ILS * 1000) / 1000;
const charge = (costIls: number | null, markup: number) => Math.max(0.1, Math.ceil(((costIls ?? 0.25) * (markup || 1.2)) * 10 - 1e-9) / 10); // בלי עלות ידועה — 25 אג׳ כבסיס
const MAX_IMG = 6_000_000; // תו dataURL — בערך 4.5MB תמונה

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const norm = (c: unknown) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');
const isImg = (s: unknown) => typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(s) && s.length < MAX_IMG;

async function codeInfo(db: any, code: string) {
  const { data } = await db.from('studio_ai_codes').select('code,label,active,expires_at,usage_limit,used,markup').eq('code', code).maybeSingle();
  if (!data) return null;
  const { data: ch } = await db.from('studio_ai_log').select('charge_ils').eq('who', code).eq('ok', true);
  const charged = Math.round((ch || []).reduce((s: number, r: any) => s + Number(r.charge_ils || 0), 0) * 100) / 100;
  let why = '';
  if (!data.active) why = 'הקוד הושבת';
  else if (data.expires_at && new Date(data.expires_at) < new Date()) why = 'תוקף הקוד הסתיים';
  else if (data.usage_limit != null && data.used >= data.usage_limit) why = 'נגמרו היצירות בקוד הזה';
  return { ok: !why, why, label: data.label || '', used: data.used, limit: data.usage_limit, charged, markup: Number(data.markup || 1.2) };
}

// קריאה ל-OpenRouter. מחזיר {image (dataURL), cost}
async function callModel(model: string, params: any, prompt: string, images: string[], aspect: string) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 140000);
  const h = { Authorization: `Bearer ${OR_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://www.hoshaya.co.il', 'X-Title': 'Hoshaya Studio' };
  try {
    if (params?.api === 'images') { // ה-Image API (למשל gpt-image) — רק יצירה מטקסט
      const r = await fetch(`${OR}/images`, { method: 'POST', headers: h, signal: ac.signal, body: JSON.stringify({ model, prompt, n: 1, aspect_ratio: aspect, ...(params.extra || {}) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `OpenRouter ${r.status}`);
      const d = j?.data?.[0];
      const img = d?.b64_json ? `data:image/png;base64,${d.b64_json}` : d?.url;
      if (!img) throw new Error('המודל לא החזיר תמונה');
      return { image: img, cost: j?.usage?.cost ?? null };
    }
    const content: any[] = [{ type: 'text', text: prompt }, ...images.map((u) => ({ type: 'image_url', image_url: { url: u } }))];
    const r = await fetch(`${OR}/chat/completions`, { method: 'POST', headers: h, signal: ac.signal, body: JSON.stringify({
      model, messages: [{ role: 'user', content }], modalities: ['image', 'text'], image_config: { aspect_ratio: aspect, ...(params?.image_config || {}) }, stream: false,
    }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `OpenRouter ${r.status}`);
    const msg = j?.choices?.[0]?.message;
    const img = msg?.images?.[0]?.image_url?.url;
    if (!img) throw new Error(msg?.content ? 'המודל ענה בטקסט במקום תמונה: ' + String(msg.content).slice(0, 160) : 'המודל לא החזיר תמונה');
    return { image: img, cost: j?.usage?.cost ?? null };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('המודל לא ענה בזמן — נסו שוב');
    throw e;
  } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'בקשה לא תקינה' }, 400); }
  const action = String(body.action || '');
  const code = norm(body.code);

  // ── מי שואל ──
  let isAdmin = false;
  if (!code) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await db.auth.getUser(token).catch(() => ({ data: { user: null } })) as any;
    isAdmin = !!user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());
    if (!isAdmin) return json({ error: 'צריך קוד גישה' }, 401);
  } else {
    const since = new Date(Date.now() - 15 * 60000).toISOString();
    const { count } = await db.from('studio_ai_log').select('id', { count: 'exact', head: true }).eq('error', 'bad_code').gte('created_at', since);
    if ((count || 0) > 20) return json({ error: 'יותר מדי ניסיונות — נסו שוב בעוד רבע שעה' }, 429);
    const info = await codeInfo(db, code);
    if (!info) { await db.from('studio_ai_log').insert({ who: code.slice(0, 40), ok: false, error: 'bad_code' }); return json({ error: 'הקוד לא נמצא' }, 403); }
    if (action === 'check') return json(info);
    if (!info.ok) return json({ error: info.why, ...info }, 403);
  }

  if (action === 'check') return json({ ok: true, admin: true });
  if (action === 'codes') {
    if (!isAdmin) return json({ error: 'מנהל בלבד' }, 403);
    const { data } = await db.from('studio_ai_codes').select('code,label,active,expires_at,usage_limit,used,markup,created_at').order('created_at', { ascending: false });
    const { data: spent } = await db.from('studio_ai_log').select('who,cost_ils,charge_ils').eq('ok', true);
    const cost: Record<string, number> = {}, charged: Record<string, number> = {};
    (spent || []).forEach((r: any) => { cost[r.who] = (cost[r.who] || 0) + Number(r.cost_ils || 0); charged[r.who] = (charged[r.who] || 0) + Number(r.charge_ils || 0); });
    return json({ codes: data || [], cost, charged, rate: USD_ILS });
  }
  if (action !== 'generate' && action !== 'edit') return json({ error: 'פעולה לא מוכרת' }, 400);
  if (!OR_KEY) return json({ error: 'חסר מפתח OpenRouter בשרת' }, 500);

  const prompt = String(body.prompt || '').trim().slice(0, 2000);
  if (!prompt) return json({ error: 'כתבו מה לעשות' }, 400);
  const aspect = ASPECTS.includes(body.aspect) ? body.aspect : '1:1';
  let taskId = action === 'edit' ? 'image_edit' : (body.task === 'image_with_text' ? 'image_with_text' : 'image_from_text');
  if (action === 'edit' && (!isImg(body.image) || !isImg(body.mark))) return json({ error: 'התמונה חסרה או גדולה מדי' }, 400);
  const { data: task } = await db.from('ai_tasks').select('id,model,params,active').eq('id', taskId).maybeSingle();
  if (!task || !task.active) return json({ error: 'המשימה לא פעילה בטבלת ai_tasks: ' + taskId }, 500);

  const fullPrompt = action === 'edit'
    ? 'Edit the FIRST image. The SECOND image is the same picture with the area to change highlighted in semi-transparent red. '
      + 'Apply this instruction ONLY inside the highlighted area, blending naturally with the surroundings: «' + prompt + '». '
      + 'Keep everything outside the highlighted area exactly as it is. Return the complete edited picture with the same framing, composition and aspect ratio. '
      + 'Do not draw the red highlight in the output. If the instruction contains text to write, write it exactly as given (Hebrew is right-to-left).'
    : prompt + (taskId === 'image_with_text' ? '' : '\n(If the description asks for written text, render it exactly as given; Hebrew is right-to-left.)');

  const who = isAdmin ? 'admin' : code;
  const t0 = Date.now();
  try {
    const out = await callModel(task.model, task.params || {}, fullPrompt, action === 'edit' ? [body.image, body.mark] : [], aspect);
    if (!isAdmin) { // נספר רק אחרי הצלחה, אטומית
      const { data: okc } = await db.rpc('studio_ai_consume', { p_code: code });
      if (okc === false) return json({ error: 'נגמרו היצירות בקוד הזה' }, 403);
    }
    const costIls = ils(out.cost);
    let chargeIls: number | null = null;
    if (!isAdmin) { const { data: c } = await db.from('studio_ai_codes').select('markup').eq('code', code).maybeSingle(); chargeIls = charge(costIls, Number(c?.markup || 1.2)); }
    await db.from('studio_ai_log').insert({ who, task: taskId, model: task.model, ok: true, ms: Date.now() - t0, cost_usd: out.cost, cost_ils: costIls, charge_ils: chargeIls });
    return json({ image: out.image, model: task.model, task: taskId, ...(isAdmin ? { cost_ils: costIls } : { charge_ils: chargeIls }) });
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300);
    await db.from('studio_ai_log').insert({ who, task: taskId, model: task.model, ok: false, ms: Date.now() - t0, error: msg });
    return json({ error: msg }, 502);
  }
});
