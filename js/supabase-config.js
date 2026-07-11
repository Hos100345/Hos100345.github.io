// =====================================================
// הגדרות Supabase למחולל הדאבל
// אלה ערכים ציבוריים (URL + anon key) — מותר שיהיו בקוד הלקוח.
// האבטחה נשענת על RLS בצד Supabase, לא על הסתרת המפתח הזה.
// ⛔ לעולם לא לשים כאן את מפתח service_role או סיסמת ה-DB.
// =====================================================

window.SUPABASE_CONFIG = {
  url:     "https://xkvmwtolbquzydgshnfa.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrdm13dG9sYnF1enlkZ3NobmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODg4MDAsImV4cCI6MjEwMjE2NDgwMH0.4eR-9_UXn3z8WxK2L4d8kF9_v8Z7J-mN4vX2P1Q3b5c"
};
