# ייבוא עיצובים לספרייה (W-75)

מעלה תיקייה של עיצובים קיימים ל**ספריית העיצובים** (`library/`) — כל קובץ נכנס כ**ממתין לאישור**, בדיוק כמו העלאה של חבר.
לא מוגש לאתר כדף; זה כלי להרצה מקומית.

## הכנה
1. תיקייה עם התמונות (JPG / PNG / WEBP, עד 10MB לקובץ).
2. קובץ CSV ב-UTF-8 עם שורת כותרת:
   ```csv
   file,title,category,contributor,cut
   kos-savta.jpg,כוס לסבתא,כוסות,,
   mezuza-1.png,"מזוזה צבעונית, כחול",מזוזות,הושעיה,mezuza-1-cut.png
   ```
   `category` אחת מ: `כוסות` · `מזוזות` · `תמונות` · `מחזיקי מפתחות` · `אחר` (אחרת → `אחר`).
   `contributor` ו-`cut` (PNG שקוף של האלמנט החתוך) — רשות.

## הרצה
```bash
# בדיקה בלי לשלוח (סוג, גודל, קטגוריה)
node tools/library-import/import.mjs ./designs ./designs.csv --dry-run

# עם קוד השותף — עד 30 העלאות לשעה; על 429 הכלי מחכה 10 דקות וממשיך לבד
DL_CODE='<הקוד>' node tools/library-import/import.mjs ./designs ./designs.csv

# או כמנהל, בלי הגבלת קצב (מהיר ל-70+ קבצים):
DL_ADMIN_JWT='<access_token>' node tools/library-import/import.mjs ./designs ./designs.csv
```
⛔ הקוד והטוקן רק במשתני סביבה — לא בקובץ ולא בגיט. ה-`access_token`: בדף `library/` אחרי כניסת מנהל, ב-DevTools → Application → Local Storage → `sb-…-auth-token` → `access_token` (תקף כשעה).

- ממשיך מאיפה שעצר: מה שעלה נרשם ב-`designs.csv.done.json` (למחוק אותו כדי להעלות שוב).
- קובץ זהה לקובץ שכבר בספרייה עולה ומסומן "חשד לכפילות" — ההחלטה בתור האישורים.
- `DL_ENDPOINT` — כתובת אחרת לפונקציה (ברירת מחדל: `design-library` ב-Supabase של האתר).

## בדיקות
```bash
node tools/library-import/test-function.mjs   # הפונקציה עם Supabase מזויף (node 22.18+)
node tools/library-import/test-page.mjs [תיקייה-לצילומים]   # הדף ב-Playwright, השרת מוחלף ב-page.route
node tools/library-import/test-import.mjs     # כלי הייבוא מול שרת מקומי מזויף
```
