// =====================================================
// הגדרות Supabase למחולל הדאבל
// אלה ערכים ציבוריים (URL + anon key) — מותר שיהיו בקוד הלקוח.
// האבטחה נשענת על RLS בצד Supabase, לא על הסתרת המפתח הזה.
// ⛔ לעולם לא לשים כאן את מפתח service_role או סיסמת ה-DB.
// =====================================================

window.SUPABASE_CONFIG = {
  url:     "https://sccivxenkyzxolpraexf.supabase.co",
  anonKey: "sb_publishable_Ctloh48bIY2Lxm_YmTiSGA_1ADr5FDz",

  // דומיין סינתטי לחשבונות מנוי (כניסה בקוד בלבד, בלי מייל אמיתי).
  // כל מנוי = חשבון עם מייל "{code}@{subEmailDomain}" וסיסמה = הקוד.
  subEmailDomain: "sub.hoshaya.co.il"
};
