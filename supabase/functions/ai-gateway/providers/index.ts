// ai-gateway — רישום ספקים. שלב 1: Anthropic בלבד.
// Google/OpenAI יתווספו כאן בהמשך בלי לגעת ב-index.ts הראשי.
import type { Provider } from '../types.ts';
import { anthropic } from './anthropic.ts';

export const PROVIDERS: Record<string, Provider> = {
  anthropic,
};
