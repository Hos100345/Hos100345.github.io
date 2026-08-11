// ============================================================
// ai-gateway — שער AI משותף לכל המחוללים (רביעיות, דאבל, ומה שיבוא).
// שלב 1 מתוך האפיון: מתאם Anthropic בלבד + action יחיד (quartets.plan_game).
// Google/OpenAI + ניתוב DB + _compare יתווספו בהמשך דרך providers/ ו-ai_routes,
// בלי לגעת בזרימה הראשית כאן.
//
// פריסה: MCP deploy_edge_function בלבד (Claude Code לא מגיע ל-Supabase).
// verify_jwt = true. secrets: ANTHROPIC_API_KEY (Supabase Edge Functions secrets).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { AIRequest } from './types.ts';
import { ProviderError } from './types.ts';
import { PROVIDERS } from './providers/index.ts';
import { SYSTEM_PROMPTS, buildUserPrompt } from './prompts.ts';
import { SCHEMAS, MAX_TOKENS } from './schemas.ts';

const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'hoshaya@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

// מכסה יומית לפי סטטוס מנוי
const QUOTA: Record<'free' | 'subscriber' | 'admin', number> = { free: 5, subscriber: 60, admin: 1000 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function pickModel(tier = 'standard'): string {
  if (tier === 'fast') return 'claude-haiku-4-5-20251001';
  if (tier === 'deep') return 'claude-opus-5';
  return 'claude-sonnet-5';
}

const AUDIENCE_VALUES = ['age_4_6', 'age_7_9', 'age_10_12', 'teen_adult', 'mixed'];
const DIFFICULTY_VALUES = ['easy', 'medium', 'hard'];

// ולידציית payload — הגבלות קשיחות למניעת ניפוח עלויות. לכל action ולידציה משלו.
function validatePayload(action: string, payload: Record<string, unknown>): string | null {
  if (action === 'quartets.plan_game') {
    const topic = payload.topic;
    if (typeof topic !== 'string' || !topic.trim() || topic.length > 200) return 'topic חסר או ארוך מדי (עד 200 תווים)';
    const seriesCount = payload.seriesCount;
    if (typeof seriesCount !== 'number' || !Number.isInteger(seriesCount) || seriesCount < 2 || seriesCount > 16) {
      return 'seriesCount חייב להיות מספר שלם בין 2 ל-16';
    }
    if (typeof payload.audience !== 'string' || !AUDIENCE_VALUES.includes(payload.audience)) return 'audience לא תקין';
    if (typeof payload.difficulty !== 'string' || !DIFFICULTY_VALUES.includes(payload.difficulty)) return 'difficulty לא תקין';
    if (typeof payload.withText !== 'boolean') return 'withText חייב להיות boolean';
    if (payload.extraNotes != null && (typeof payload.extraNotes !== 'string' || payload.extraNotes.length > 300)) {
      return 'extraNotes ארוך מדי (עד 300 תווים)';
    }
    return null;
  }
  return 'action לא נתמך';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // ── 1. אימות המשתמש מול anon key + ה-Authorization שנשלח ──
  const authHeader = req.headers.get('Authorization') || '';
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return json({ error: 'auth', message: 'צריך להתחבר כדי להשתמש ביצירה אוטומטית.' }, 401);

  // ── לקוח נפרד ל-DB, עם service_role (עוקף RLS) ──
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userId = user.id; // הצבה מפורשת — TS לא משמר את הצרת ה-null דרך closures
  const email = (user.email || '').toLowerCase();

  // ── פענוח הבקשה ──
  let body: { action?: string; payload?: Record<string, unknown>; tier?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request', message: 'גוף הבקשה אינו JSON תקין.' }, 400);
  }
  const action = String(body.action || '');
  const payload = body.payload || {};

  // ── 4. קביעת role. שגיאת DB לא-צפויה = fail-open (לא חוסם, לא מעניק דרגה גבוהה) ──
  let role: 'free' | 'subscriber' | 'admin' = 'free';
  if (ADMIN_EMAILS.includes(email)) {
    role = 'admin';
  } else {
    try {
      const { data: prof } = await admin.from('profiles')
        .select('subscription_expires,subscriber_status').eq('id', userId).maybeSingle();
      if (prof?.subscription_expires && prof.subscriber_status !== 'blocked') {
        if (new Date(prof.subscription_expires).getTime() > Date.now()) role = 'subscriber';
      }
    } catch (e) {
      console.error('profiles lookup failed, defaulting to free:', String(e));
    }
  }

  // ── 5. מכסה יומית ──
  try {
    const { data: left, error: quotaErr } = await admin.rpc('ai_quota_left', { p_user: userId, p_limit: QUOTA[role] });
    if (!quotaErr && typeof left === 'number' && left <= 0) {
      return json({ error: 'quota', message: 'הגעת למכסת היצירות היומית. נסה שוב מחר או שדרג את המנוי.' }, 429);
    }
    if (quotaErr) console.error('ai_quota_left rpc failed, failing open:', quotaErr.message);
  } catch (e) {
    console.error('ai_quota_left rpc threw, failing open:', String(e));
  }

  // ── 6/7. ולידציית action + payload ──
  const schema = SCHEMAS[action];
  const systemPrompt = SYSTEM_PROMPTS[action];
  if (!schema || !systemPrompt) return json({ error: 'bad_action', message: 'פעולה לא מוכרת.' }, 400);
  const payloadErr = validatePayload(action, payload);
  if (payloadErr) return json({ error: 'bad_payload', message: payloadErr }, 400);

  const model = pickModel(body.tier);
  const provider = PROVIDERS.anthropic;

  async function logUsage(ok: boolean, usage: { input: number; output: number }, err?: string) {
    const price = provider.priceFor(model);
    const cost = (usage.input / 1e6) * price.in + (usage.output / 1e6) * price.out;
    try {
      await admin.from('ai_usage').insert({
        user_id: userId, action, model,
        input_tokens: usage.input, output_tokens: usage.output,
        cost_usd: cost, ok, err: err || null,
      });
    } catch (e) {
      console.error('ai_usage insert failed:', String(e));
    }
  }

  // ── 8. קריאה ל-Anthropic ──
  const aiReq: AIRequest = {
    model,
    system: systemPrompt,
    userPrompt: buildUserPrompt(action, payload),
    schema,
    maxTokens: MAX_TOKENS[action],
  };

  try {
    const res = await provider.call(aiReq);
    await logUsage(true, res.usage);
    return json({ result: res.result });
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : 'unknown_error';
    await logUsage(false, { input: 0, output: 0 }, code);
    console.error('ai-gateway call failed:', code, e);
    return json({ error: code, message: 'היצירה נכשלה. נסה שוב.' }, 502);
  }
});
