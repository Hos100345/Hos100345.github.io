// ai-gateway — מתאם Anthropic. תבנית tool-use כפוי: הפלט תמיד JSON תקין לפי סכמה, לא טקסט חופשי לפרסור.
import type { AIRequest, AIResponse, Provider } from '../types.ts';
import { ProviderError } from '../types.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const CALL_TIMEOUT_MS = 60000; // כלל timeout — שום קריאת רשת בלי הגבלת זמן (ראו CLAUDE.md)

// מחירים לכל מיליון טוקנים (USD) — עדכן אם Anthropic משנים
const PRICES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-sonnet-5': { in: 2, out: 10 }, // מחיר מבצע עד 31.8.2026, אח"כ 3/15
  'claude-opus-5': { in: 5, out: 25 },
};

export const anthropic: Provider = {
  id: 'anthropic',
  envKey: 'ANTHROPIC_API_KEY',
  priceFor: (m) => PRICES[m] ?? { in: 0, out: 0 },

  async call(req: AIRequest): Promise<AIResponse> {
    const t0 = Date.now();
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new ProviderError('no_api_key', 'anthropic');

    const body = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.userPrompt }],
      tools: [{ name: 'emit', description: 'החזר את התוצאה', input_schema: req.schema }],
      tool_choice: { type: 'tool', name: 'emit' },
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
    let r: Response;
    try {
      r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') {
        throw new ProviderError('timeout', 'anthropic');
      }
      throw new ProviderError('network_error', 'anthropic', String(e));
    } finally {
      clearTimeout(timer);
    }

    if (r.status === 429) throw new ProviderError('rate_limit', 'anthropic');
    if (!r.ok) throw new ProviderError('http_' + r.status, 'anthropic', await r.text());

    const data = await r.json();

    if (data.stop_reason === 'max_tokens') {
      throw new ProviderError('finish_MAX_TOKENS', 'anthropic');
    }

    const block = data.content?.find((c: { type: string }) => c.type === 'tool_use');
    if (!block) throw new ProviderError('no_tool_use', 'anthropic');

    return {
      result: block.input,
      usage: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
      provider: 'anthropic',
      model: req.model,
      latencyMs: Date.now() - t0,
    };
  },
};
