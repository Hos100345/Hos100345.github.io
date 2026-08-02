# CLAUDE.md — מחולל משחק Dobble

## סקירה
מחולל קלפי Dobble/Spot-It אישי — אפליקציית ווב חד-קובצית ב-GitHub Pages.
- **Repo:** `github.com/Hos100345/Hos100345.github.io` (**ציבורי** — ראה כללי אבטחה)
- **Deploy:** GitHub Pages מ-`main` בלבד. push ל-`main` = לייב מיידי.
- **URLs:** `hos100345.github.io/dobble.html` == `www.hoshaya.co.il/dobble.html`. קיים גם `dobble-demo.html` (דמו מגודר לפיץ'/שותפויות).

## Stack
- Vanilla JS + Canvas, קובץ יחיד (~3300 שורות). ללא framework, ללא build step.
- ספריות: jsPDF, JSZip, Supabase, heic2any (המרת HEIC מ-iPhone).
- Supabase: project ref `sccivxenkyzxolpraexf`, region `eu-west-2`. auth = Magic Link (מייל, בלי סיסמאות).

## ⛔ אילוצים קריטיים בקוד הפרונט — לא לגעת
1. **מתמטיקת GF(4)** של Dobble היא load-bearing. אין לשנות אותה בשום מצב.
2. **ציור תמונה ריבועית = `drawCover()`**, לא `drawImage` מתוח. אחרת העיוות חוזר באופן גלוי.
3. **שקיפות = PNG.** תוכן canvas עם alpha (crop עגול / הסרת רקע) חייב להישמר כ-PNG ולא JPEG, אחרת הרקע יוצא שחור. קיים זיהוי alpha אוטומטי.

## ארכיטקטורת פרונט
- state מרכזי ב-`const S`. assets נושאים `{type:'image'|'crop', selected, isCropSource, srcAssetId}`.
- שמירה: IndexedDB (מקומי) + Supabase (ענן). הפרטים המדויקים ב-Persistence internals למטה.
- בחירת assets עם checkboxes + סרגל בחירה/ניקוי; דגל `selected` נשמר מקומית ובענן.

## Persistence internals (עובדות לא-טריוויאליות — מאומת מול main)

### assetsToRows — lean מול full
- `assetsToRows()` = **lean**: metadata בלבד (`id,type,name,srcAssetId,isCropSource,selected`), **בלי `dataURL`**. משמש **רק** את הכתיבה המקומית של `saveDesign()` ל-`IDB_DESIGNS` (store שמצטבר שורה לכל עיצוב שמור).
- `assetsToRowsWithImages()` = **full**: כולל `dataURL` (PNG אם `type==='crop' || canvasHasAlpha(cv)`, אחרת JPEG באיכות .82). משמש את `idbSave()` (גיבוי מאגר-העבודה ל-`IDB_STORE`) ואת `buildDesignObject()` → `cloudSaveDesign`/`cloudAutosave`.
- כלל: metadata בלבד היכן שעיצובים מצטברים; תמונות מלאות היכן שצריך לשרוד רענון או להגיע ל-Storage. **אין לאחד אותן חזרה.**

### IndexedDB overflow
- סיבה: בעבר `assetsToRows()` הטמיע `dataURL` מלא (base64), ו-`saveDesign()` כתב אותו ל-`IDB_DESIGNS` — שורה עמוסת-תמונות לכל עיצוב, עד חריגת quota.
- תיקון (חי ב-`main`, PR #24 — ברנץ' `claude/dobble-idb-overflow-fix`): `saveDesign()`→`IDB_DESIGNS` כותב lean בלבד. התמונות חיות בזיכרון (`imgEl`) למשך ה-session; store מאגר-העבודה (`IDB_STORE` דרך `idbSave`) עדיין מחזיק תמונות מלאות כדי לשחזר את הגלריה אחרי רענון.
- טעינת עיצוב lean שתמונותיו לא זמינות → מדלג ומציג toast של העלאה-מחדש; עיצובים ישנים עם `dataURL` עדיין נטענים.

### Cloud autosave (נבדל מ-`idbSave` המקומי)
- `cloudAutosave()` עושה upsert לשורה **יחידה** בשם `AUTOSAVE_NAME` (`⏳ טיוטה אוטומטית`) לכל מנוי — לעולם לא שורה חדשה. רץ רק כש-`isSignedIn()`.
- טריגר: `schedCloudAutosave()` נקרא מתוך `schedIdbSave()`. **שני debounce נפרדים:** `idbSave` מקומי = 800ms, `cloudAutosave` = 25000ms. לא לבלבל.
- Flush: `visibilitychange`(hidden) ו-`pagehide`, מוגן ע"י `_cloudAutoDirty`; best-effort בסגירה.
- מדלג על תמונות שה-`path` שלהן (`${uid}/${rowId}/${row.id}.${ext}`) כבר קיים; מוחק מ-Storage קבצים של assetים שנמחקו. השורות נבנות דרך `assetsToRowsWithImages()`.

## גישה ומנויים — שני מנגנונים (חשוב להבחין!)
1. **קוד גישה מקומי** (בקובץ `js/dobble-config.js`): קוד משותף/גלובלי, לא מזוהה ללקוח. חסימה = החלפת הקוד בקובץ. אין אכיפת תוקף אוטומטית, אין סנכרון תמונות אישי.
2. **מנוי** (חשבון ב-Supabase, טבלת `profiles`): קוד אישי לכל לקוח (4–20 תווים, בלי רווחים), תוקף נאכף אוטומטית, תמונות מסונכרנות בין מכשירים, פעילות אישית בדשבורד. **המנגנון המומלץ ללקוחות.**
- אכיפת תוקף: מנוי שפג/הושבת נחסם עם הודעה + קישור חידוש. **המנהל לעולם לא נחסם.** תקלת רשת רגעית = fail-open (לא חוסם בטעות). הזנת קוד קיים = חידוש/הארכה, לא כפילות.

## מונטיזציה (freemium)
- **חינם:** 7 סמלים, כולל ייצוא.
- **בתשלום:** 13/21/31/57 סמלים — watermark אלכסוני מונפש ("תצוגה מקדימה"); הייצוא נעול מאחורי מנוי חודשי.
- תשלום: **Morning (חשבונית ירוקה) + תוסף סליקה Meshulam** (הכרחי ליצירת קישור תשלום). אחרי תשלום הלקוח בוחר קוד גישה אישי לחודש; לקוח חוזר מזין קוד במסך הנעילה.

## Supabase — סכמה ופונקציות
- **טבלאות:** `profiles` (מנויים; כולל `subscription_expires`, `subscriber_status`, `label`) · `designs` (עיצובים שמורים) · `events` (מעקב פעילות: כניסה / יצירת משחק / הדפסה — מכל מכשיר).
- **Storage bucket `symbols`:** תמונות פרטיות לכל משתמש.
- **Edge Functions:** `manage-subscriber` (יצירה/חידוש/מחיקה/רשימה — מנהל בלבד, service_role) · `create-payment` (מאומת עובד) · `morning-webhook` (event `payment/received`, `verify_jwt=false`, ללא secret).
- כל ה-SQL והפונקציות בריפו תחת `supabase/`.

## 🔒 עקרונות אבטחה (קריטי)
- **אימות בצד שרת בלבד.** אסור לגזור הרשאה ממשתנה JS בדפדפן (כמו `isPaid=true`) — ניתן לעקוף ב-DevTools. שחרור ייצוא רק מול אישור שרת.
- **RLS (מאומת מול ה-DB):** `designs` — self-CRUD מלא (`auth.uid()=user_id`). `events` — כל אחד `INSERT`, `SELECT` למנהל בלבד. `profiles` — **רק `SELECT`-own; אין policies ל-`INSERT`/`UPDATE`/`DELETE` למשתמש** (כתיבה רק דרך trigger/service_role), כך שמשתמש לא יכול להאריך לעצמו מנוי. bucket `symbols` פרטי (`public=false`).
- **service_role לעולם לא בקוד/צ'אט** — רק כ-Secret בדשבורד Supabase. ב-frontend רק anon key.
- **הריפו ציבורי:** אין לבצע commit של קודי גישה, קודי ניהול, tokens או secrets לקוד המקור. סודות → Supabase secrets; קודים → DB/config לפי המנגנון.
- תמונות נשמרות ב-Storage, לא כ-base64 ב-JSONB (ב-DB רק הגדרות + נתיבים).
- מתועד כדרישה, טרם מיושם: אימות חתימת Webhook מספק הסליקה (Signature Verification).

## Edge Functions — פריסה
- **לא נפרסים אוטומטית מ-GitHub.** כל שינוי בקבצי `supabase/functions/` דורש redeploy מפורש (CLI/MCP). `verify_jwt=false` נדרש לפונקציות webhook.

## Workflow (git)
- ברנץ' ייעודי `claude/<שם-מתאר>`. לפני commit: `git diff --stat` + `node --check` על כל בלוק סקריפט.
- commit → push → פתיחת PR. **אין למזג ל-`main` בלי אישור מפורש של הושעיה.**
- פיתוח incremental — רכיב אחד עובד במלואו לפני המעבר לבא.

## Supabase (MCP)
- העדף `execute_sql` לכל DDL / שינויי schema / אימות מצב (אמין יותר בנייד מ-`apply_migration`).
- `deploy_edge_function` עובד עם מערך `files` (`name` + `content`). secrets נקבעים בדשבורד בלבד:
  supabase.com/dashboard/project/sccivxenkyzxolpraexf/functions/secrets
