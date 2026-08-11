// ai-gateway — סכמות JSON (input_schema, דיאלקט Anthropic) + מגבלות טוקנים לכל action.
// הסכמה היא קו ההגנה הראשון — אין לסמוך על הפרומפט שיאכוף "בדיוק 4 קלפים".
// שלב 1: quartets.plan_game בלבד. שאר ה-actions מהאפיון (suggest_series/fill_series/
// improve_series/card_text) יתווספו כאן בהמשך, אחרי שהאקשן הזה עובד end-to-end.

export const MAX_TOKENS: Record<string, number> = {
  'quartets.plan_game': 3000,
};

// חוזה הנתונים המשותף לכל המחוללים (schemaVersion 1). imageRef לא נכלל כאן בכוונה —
// ה-AI לא יכול ליצור תמונות, השדה הזה מתמלא בצד הלקוח כשמשתמש מצרף/חותך תמונה.
const CARD_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^s[0-9]+c[0-9]+$' },
    name: { type: 'string', maxLength: 40 },
    text: { type: 'string', maxLength: 140 },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    imagePrompt: { type: 'string', maxLength: 200 },
  },
  required: ['id', 'name', 'text', 'difficulty', 'imagePrompt'],
  additionalProperties: false,
};

const SERIES_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^s[0-9]+$' },
    name: { type: 'string', maxLength: 40 },
    topic: { type: 'string', maxLength: 200 },
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    cards: { type: 'array', minItems: 4, maxItems: 4, items: CARD_SCHEMA },
  },
  required: ['id', 'name', 'topic', 'color', 'cards'],
  additionalProperties: false,
};

export const QUARTETS_PLAN_GAME_SCHEMA = {
  type: 'object',
  properties: {
    schemaVersion: { type: 'integer', enum: [1] },
    meta: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 60 },
        topic: { type: 'string', maxLength: 200 },
        audience: { type: 'string', enum: ['age_4_6', 'age_7_9', 'age_10_12', 'teen_adult', 'mixed'] },
        language: { type: 'string', enum: ['he'] },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        gameType: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 20 } },
      },
      required: ['name', 'topic', 'audience', 'language', 'difficulty', 'gameType'],
      additionalProperties: false,
    },
    series: { type: 'array', minItems: 2, maxItems: 16, items: SERIES_SCHEMA },
  },
  required: ['schemaVersion', 'meta', 'series'],
  additionalProperties: false,
};

export const SCHEMAS: Record<string, Record<string, unknown>> = {
  'quartets.plan_game': QUARTETS_PLAN_GAME_SCHEMA,
};
