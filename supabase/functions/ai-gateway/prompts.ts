// ai-gateway — פרומפטים בעברית. קובץ נפרד, לא inline ב-index.ts.
// שלב 1: quartets.plan_game בלבד.

export const SYSTEM_PROMPTS: Record<string, string> = {
  'quartets.plan_game': `אתה מומחה לבניית משחקי רביעיות בעברית.

חוקי ברזל:
- כל סדרה מכילה בדיוק 4 קלפים. לא 3, לא 5.
- כל 4 הקלפים בסדרה חייבים להיות בעלי קשר סמנטי ברור וחזק לשם הסדרה.
- אסור שאותו פריט יופיע ביותר מסדרה אחת.
- אסור שיופיעו שני קלפים בעלי אותו שם באותה סדרה.
- שמות הקלפים קצרים וקונקרטיים (עד 3 מילים). לא משפטים.
- שמות הסדרות ברורים ומתארים קטגוריה, לא כותרת שיווקית.

התאמה לקהל היעד:
- גיל 4-6: מושגים מוחשיים בלבד, מילים מוכרות, בלי מספרים או תאריכים.
- גיל 7-9: מושגים יומיומיים, עובדות פשוטות במשפט אחד.
- גיל 10-12: מותר מושגים מופשטים, שמות מדעיים בסיסיים.
- נוער/מבוגרים: מותר עומק, ניואנס והומור.

שפה:
- עברית תקנית ומנוקדת-חלקית רק היכן שיש אי-בהירות בקריאה.
- אחידות בצורת פנייה ובמין הדקדוקי לאורך כל המשחק.
- אל תשתמש במילים לועזיות כשיש חלופה עברית טבעית.

אם הנושא שהתבקש רחב מדי או צר מדי למספר הסדרות שנדרש — בנה את המיטב האפשרי,
ואל תמציא סדרות מלאכותיות רק כדי להשלים מספר.

כאשר לא מתבקש טקסט לקלף, החזר את השדה text כמחרוזת ריקה — אל תשמיט אותו.
imagePrompt הוא תיאור קצר וקונקרטי לתמונה שיחפש/יעלה המשתמש, לא באנגלית אלא בעברית.`,
};

const AUDIENCE_LABELS: Record<string, string> = {
  age_4_6: 'גיל 4-6',
  age_7_9: 'גיל 7-9',
  age_10_12: 'גיל 10-12',
  teen_adult: 'נוער/מבוגרים',
  mixed: 'קהל מעורב',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'קלה',
  medium: 'בינונית',
  hard: 'קשה',
};

export interface PlanGamePayload {
  topic: string;
  audience: string;
  seriesCount: number;
  difficulty: string;
  withText: boolean;
  extraNotes?: string;
}

export function buildUserPrompt(action: string, payload: Record<string, unknown>): string {
  if (action === 'quartets.plan_game') {
    const p = payload as unknown as PlanGamePayload;
    const lines = [
      `נושא: ${p.topic}`,
      `קהל יעד: ${AUDIENCE_LABELS[p.audience] || p.audience}`,
      `מספר סדרות: ${p.seriesCount}`,
      `רמת קושי: ${DIFFICULTY_LABELS[p.difficulty] || p.difficulty}`,
      p.withText ? 'הוסף לכל קלף עובדה קצרה של משפט אחד.' : 'אל תוסיף טקסט לקלפים.',
    ];
    if (p.extraNotes) lines.push('הערות נוספות מהמשתמש: ' + p.extraNotes);
    return lines.join('\n');
  }
  throw new Error('unknown_action_for_prompt: ' + action);
}
