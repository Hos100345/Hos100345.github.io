// ai-gateway — חוזה משותף לכל ספקי ה-AI (Anthropic / Google / OpenAI בהמשך).
// שכבת ה-Router (index.ts) מדברת רק מול הטיפוסים כאן, לעולם לא ישירות מול fetch של ספק ספציפי.

export interface AIRequest {
  model: string;
  system: string;
  userPrompt: string;
  schema: Record<string, unknown>; // JSON Schema קנוני (דיאלקט Anthropic)
  maxTokens: number;
}

export interface AIResponse {
  result: Record<string, unknown>;
  usage: { input: number; output: number };
  provider: string;
  model: string;
  latencyMs: number;
}

export class ProviderError extends Error {
  code: string;
  provider: string;
  detail?: string;
  constructor(code: string, provider: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ProviderError';
    this.code = code;
    this.provider = provider;
    this.detail = detail;
  }
}

export interface Provider {
  id: 'anthropic' | 'google' | 'openai';
  envKey: string;
  call(req: AIRequest): Promise<AIResponse>;
  priceFor(model: string): { in: number; out: number };
}
