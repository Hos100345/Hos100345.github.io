// create-payment — SHIM לתאימות לאחור.
//
// הפונקציה המקורית (יצירת לינק תשלום דרך Morning API) חסומה מצד Morning לצמיתות
// (errorCode 2600 — "אין מסוף סליקה פעיל"), והאתר עבר ל-4 לינקי תשלום קבועים.
//
// למה ה-shim הזה קיים: ללקוחות שהדפדפן שלהם עדיין מחזיק ב-cache גרסה ישנה של
// dobble.html — אותה גרסה עדיין עושה POST לכאן ומצפה ל-{url}. במקום להחזיר שגיאה
// ולחסום להם את התשלום, מחזירים את הלינק הקבוע הנכון לאותה מדרגה — כך דפדפן
// עם cache ישן ממשיך לעבוד בלי שהלקוח יצטרך לנקות אותו.
//
// ⚠️ CORS חובה כאן, כולל מענה ל-OPTIONS: הלקוח שולח Content-Type/apikey/Authorization,
// מה שמפעיל preflight. בלי הכותרות האלה הדפדפן חוסם את הקריאה והלקוח רואה
// "Failed to fetch" בלבד — בלי שום דרך להבין מה נכשל. זה בדיוק מה ששבר תשלום אחד
// בפועל: גרסה קודמת של הקובץ הזה החזירה 410 בלי CORS, שלושה preflight נדחו,
// וה-POST האמיתי מעולם לא נשלח.

// חייב להישאר תואם ל-window.PAYMENT_LINKS ו-window.TIER_PRICES ב-dobble.html
// ול-LINKS ב-morning-webhook (ה-allowlist שמעניק את הגישה בפועל).
const PAYMENT_LINKS: Record<number, string> = {
  13: "https://mrng.to/IC0mmKwgzj",
  21: "https://mrng.to/feHfaA6vLA",
  31: "https://mrng.to/4LjUZBvnND",
  57: "https://mrng.to/9F19TfbGTa",
};
const TIER_PRICES: Record<number, number> = { 13: 5, 21: 10, 31: 12, 57: 15 };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const tier = Number((body as Record<string, unknown>).tier);
    const url = PAYMENT_LINKS[tier];

    if (!url) {
      return json({
        error: "המדרגה שנבחרה אינה זמינה. רעננו את הדף (Ctrl+F5) ונסו שוב.",
        validTiers: Object.keys(PAYMENT_LINKS),
      }, 400);
    }

    // אותו חוזה שהלקוח הישן מצפה לו: {url, tier, price} — והוא עושה location.href = url
    return json({ url, tier, price: TIER_PRICES[tier], fixedLink: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
