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

## סטטוס עבודה נוכחי (מעודכן 2026-08-03 — עדכנו את זה בכל סבב עבודה)

### מוזג ל-main ופעיל באתר
- **מודל גישה מדורג (PR #19)** — הכניסה חסומה שוב (בטל את מודל ה-freemium הפתוח מ-PR #17/#18). שלושה מסלולים: קוד קיים / הרשמה חינם (7 קלפים, `max_order:7`) / רכישת מנוי (13/21/31/57 קלפים). ראו "מונטיזציה" למטה לפרטים המלאים.
- **תיקון גלישת IndexedDB (PR #24)** — `assetsToRows()` lean מול `assetsToRowsWithImages()` full. מתועד ב-Persistence internals למעלה.
- **fallback לענן בטעינת עיצוב מקומי (PR #29, פתוח — ממתין לאישור)** — `loadDesign()` בודק אם לשורות המקומיות יש בפועל `dataURL`; אם לא ויש סשן מחובר, מחפש התאמה בעיצובי הענן וטוען דרך `loadCloudDesign()` במקום מ-metadata ריק.
- **העלאה עמידה לענן (PR #26)** — `sbUploadRetry(path,dataURL,mime,tries=3)`: עד 3 ניסיונות עם back-off, לא מפיל את כל השמירה אם תמונה בודדת נכשלת. ב-`cloudSaveDesign` וב-`cloudAutosave`.
- **גודל ומיקום סמלים** — כוונן כמה פעמים (PR #20 → #22 מצמצם ל-10% מעל הבסיס), סליידר "חפיפה" (PR #23, `S.overlap`, מקרב סמלים בלי לשנות גודל), מרווח thumbnails גדול יותר (PR #21).
- **צורת סמל (PR #28)** — `S.symShape`, ברירת מחדל `'circle'` (חיתוך אוטומטי סביב `drawCover()`, לא שינוי שלו), אופציה `'square'`. **עיצובים ישנים בלי `symShape` נטענים כעיגול** — אם מישהו רוצה לשמר סמלים מרובעים מעיצוב ישן, צריך לפתוח, לשנות ידנית ל-square, לשמור מחדש.
- **תיקון טעינת JPG/HEIC מוסווה (PR #30, פתוח — ממתין לאישור)** — `sniffHeic()` מזהה HEIC לפי magic bytes (תיבת `ftyp`) גם כשהסיומת `.jpg` שגויה (נפוץ מאייפון); `convertHeicAndLoad()` מרכז את נתיב ה-heic2any כדי לא לשכפל קוד; `loadImg`'s `onerror` מחזיר `Error` אמיתי במקום Event גולמי.
- **CLAUDE.md** ו**בורר קבצים שני להעלאה מרובה ב-Xiaomi/MIUI** (PR #27) — לא ממני, נמזגו כבר.

### פתוח / ממתין (טרם מוזג)
- **PR #29** — fallback לענן בטעינת עיצוב מקומי (למעלה).
- **PR #30** — תיקון JPG/HEIC מוסווה (למעלה).
- **PR #31** — הוספת `amount: price` ל-payload של `create-payment` (`supabase/functions/create-payment/index.ts`) — מתקן `errorCode 2417` מ-Morning ("סכום מסמך לא תקין"). **זו הפעם הראשונה שקוד `create-payment` נכנס לגיט** (עד עכשיו נפרס ישירות דרך Supabase MCP בלי מעקב גיט). **⚠️ מיזוג ה-PR לא מספיק — צריך redeploy מפורש דרך Supabase MCP/CLI אחרי המיזוג**, אחרת השינוי לא חי בפרודקשן.

### בעיה ידועה — מסוף סליקה Morning
`create-payment` נכשל בעבר עם `errorCode 2600` ("לא נמצא מסוף סליקה פעיל") — זו בעיה בהגדרות חשבון Morning (לא בקוד), צריך לחבר אמצעי תשלום בדשבורד של Morning. הושעיה דיווח שתיקן את זה, אבל **לא אומת עדיין בפועל** — הלוגים (`get_logs` על `edge-function`) לא הראו ניסיון חדש מאז. אם מישהו מנסה לרכוש ומקבל שגיאה — לבדוק קודם את הלוגים לפני שמניחים שזה קוד.

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

## גישה — שלושה מנגנונים (חשוב להבחין!)
1. **`dobble_access_codes` + `max_order` (נוכחי, PR #19)** — הקוד שכל משתמש חדש מקבל: `validate-code`/`register-free`/`claim-code`. `max_order` קובע איזה גודל משחק נפתח במלואו. ראו "מונטיזציה" למטה.
2. **קוד גישה מקומי (legacy)** (בקובץ `js/dobble-config.js`): קוד משותף/גלובלי, לא מזוהה ללקוח. חסימה = החלפת הקוד בקובץ. אין אכיפת תוקף אוטומטית, אין סנכרון תמונות אישי. נכנס תמיד עם `max_order:57` (גישה מלאה).
3. **מנוי Supabase Auth (legacy)** (חשבון ב-Supabase, טבלת `profiles`): קוד אישי לכל לקוח (4–20 תווים, בלי רווחים) שהוא בפועל סיסמה לחשבון עם אימייל סינתטי (`{code}@sub.hoshaya.co.il`); תוקף נאכף אוטומטית מול `profiles.subscription_expires`, תמונות מסונכרנות בין מכשירים דרך `designs`/Storage. נכנס עם `max_order:57`.
- אכיפת תוקף (מנגנון 3 בלבד): מנוי שפג/הושבת נחסם עם הודעה + קישור חידוש. **המנהל לעולם לא נחסם.** תקלת רשת רגעית = fail-open (לא חוסם בטעות). הזנת קוד קיים = חידוש/הארכה, לא כפילות.

## מונטיזציה — מודל גישה מדורג (PR #19, נוכחי; מחליף freemium פתוח מ-PR #17/#18)
**הכניסה חסומה — אין גישה למחולל בלי קוד, כולל הרמה החינמית.** מסך הכניסה: שלושה טאבים.

| מסלול | תוצאה |
|---|---|
| "יש לי קוד" | `validate-code` → `max_order` מהקוד הקיים |
| "הרשמה חינם" | `register-free` → `max_order:7`, קוד אישי שהמשתמש בוחר |
| "רכישת מנוי" | בחירת רמה (13/21/31/57 קלפים = 5/10/12/15 ₪) → `create-payment` → Morning |

- `max_order` נשמר ב-`sessionStorage` אחרי כניסה. גדלים **עד** `max_order` עובדים במלואם כולל ייצוא; גדלים **מעל** — תצוגה מקדימה עם watermark אלכסוני, והייצוא פותח חלון שדרוג (אותה טבלת מחירים).
- קודים ישנים/מנהל/מנויי Supabase Auth (מנגנון legacy, ראו "גישה" למעלה) → `max_order:57` (גישה מלאה), לא צריך הרשמה מחדש.
- אחרי תשלום: Morning מחזיר ל-`dobble.html?paid=1&tier=N` → נפתח מסך בחירת קוד אישי → `claim-code` (מאתר עסקה לפי אימייל, מחזיר `max_order` לפי הרמה ששולמה).
- תשלום: **Morning (חשבונית ירוקה)**, `create-payment` יוצר את קישור התשלום. דורש מסוף סליקה מחובר בחשבון Morning (ראו "בעיה ידועה" למעלה).

## Supabase — סכמה ופונקציות
- **טבלאות:** `profiles` (מנויי Auth legacy; כולל `subscription_expires`, `subscriber_status`, `label`) · `designs` (עיצובים שמורים, מנויי Auth) · `events` (מעקב פעילות) · `dobble_access_codes` (**המנגנון הנוכחי** — `code`, `type`, `max_order`, `expires_at`, `usage_limit`, `current_usage`, `created_for`, `is_active`) · `dobble_transactions` (עסקאות Morning — `customer_email`, `amount`, `tier`, `status`, `claimed_at`, `claimed_code`).
- **Storage bucket `symbols`:** תמונות פרטיות לכל משתמש (מנויי Auth legacy בלבד).
- **Edge Functions (המנגנון הנוכחי):** `validate-code` (בודק קוד מול `dobble_access_codes` דרך RPC `redeem_access_code`, מחזיר `max_order`) · `register-free` (RPC `register_free_code`, קוד חינמי אחד לאימייל, `max_order:7`) · `create-payment` (`{email,tier}` ← 13/21/31/57, יוצר דרישת תשלום ב-Morning, מחזיר `{url,tier,price}`) · `claim-code` (אחרי תשלום — RPC `claim_access_code`, מאתר עסקה `paid`+לא ממומשת לפי אימייל, יוצר/מחדש קוד, מחזיר `max_order`).
- **Edge Functions (legacy):** `manage-subscriber` (ניהול `profiles` — מנהל בלבד, service_role) · `morning-webhook` (`event payment/received`, `verify_jwt=false`, ללא secret — כותב ל-`dobble_transactions`).
- כל ה-SQL בריפו תחת `supabase/`. **לא כל הפונקציות מתועדות שם** — עד PR #31 אף אחת מ-`validate-code`/`register-free`/`create-payment`/`claim-code` לא הייתה בגיט, רק פרוסה ישירות דרך Supabase MCP. לפני שנוגעים בפונקציה — לבדוק קודם עם `get_edge_function` מה חי בפועל, לא לסמוך על מה שבגיט.

## 🔒 עקרונות אבטחה (קריטי)
- **אימות בצד שרת בלבד.** אסור לגזור הרשאה ממשתנה JS בדפדפן (כמו `isPaid=true`) — ניתן לעקוף ב-DevTools. שחרור ייצוא רק מול אישור שרת.
- **RLS (מאומת מול ה-DB):** `designs` — self-CRUD מלא (`auth.uid()=user_id`). `events` — כל אחד `INSERT`, `SELECT` למנהל בלבד. `profiles` — **רק `SELECT`-own; אין policies ל-`INSERT`/`UPDATE`/`DELETE` למשתמש** (כתיבה רק דרך trigger/service_role), כך שמשתמש לא יכול להאריך לעצמו מנוי. bucket `symbols` פרטי (`public=false`).
- **service_role לעולם לא בקוד/צ'אט** — רק כ-Secret בדשבורד Supabase. ב-frontend רק anon key.
- **הריפו ציבורי:** אין לבצע commit של קודי גישה, קודי ניהול, tokens או secrets לקוד המקור. סודות → Supabase secrets; קודים → DB/config לפי המנגנון.
- תמונות נשמרות ב-Storage, לא כ-base64 ב-JSONB (ב-DB רק הגדרות + נתיבים).
- מתועד כדרישה, טרם מיושם: אימות חתימת Webhook מספק הסליקה (Signature Verification).

## Edge Functions — פריסה
- **לא נפרסים אוטומטית מ-GitHub.** כל שינוי בקבצי `supabase/functions/` דורש redeploy מפורש (CLI/MCP). `verify_jwt=false` נדרש לפונקציות webhook.
- **⚠️ `create-payment` — שדה `amount` ברמת ה-payload העליונה (לצד `income[]`) חובה, אחרת Morning מחזיר `errorCode 2417`.** השדה הזה כבר נשמט פעם אחת בשכתוב קודם (כשנוסף תמיכה ב-tier) וגרם לרגרסיה שקטה — עכשיו שהקובץ בגיט (PR #31), לוודא שהוא נשאר בכל שכתוב עתידי.

## Workflow (git)
- ברנץ' ייעודי `claude/<שם-מתאר>`. לפני commit: `git diff --stat` + `node --check` על כל בלוק סקריפט.
- commit → push → פתיחת PR. **אין למזג ל-`main` בלי אישור מפורש של הושעיה.**
- פיתוח incremental — רכיב אחד עובד במלואו לפני המעבר לבא.

## Supabase (MCP)
- העדף `execute_sql` לכל DDL / שינויי schema / אימות מצב (אמין יותר בנייד מ-`apply_migration`).
- `deploy_edge_function` עובד עם מערך `files` (`name` + `content`). secrets נקבעים בדשבורד בלבד:
  supabase.com/dashboard/project/sccivxenkyzxolpraexf/functions/secrets
