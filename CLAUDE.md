# CLAUDE.md — מחולל משחק Dobble

## סקירה
מחולל קלפי Dobble/Spot-It אישי — אפליקציית ווב חד-קובצית ב-GitHub Pages.
- **Repo:** `github.com/Hos100345/Hos100345.github.io` (**ציבורי** — ראה כללי אבטחה)
- **Deploy:** GitHub Pages מ-`main` בלבד. push ל-`main` = לייב מיידי.
- **URLs:** `hos100345.github.io/dobble.html` == `www.hoshaya.co.il/dobble.html`. בנוסף `dobble-info.html` — עמוד שיווקי/הסבר ללקוחות (מקושר מ-`index.html` ומחלון הפתיחה של המחולל).

## Stack
- Vanilla JS + Canvas, קובץ יחיד (~4340 שורות). ללא framework, ללא build step.
- ספריות: jsPDF, JSZip, Supabase, heic2any (המרת HEIC מ-iPhone).
- Supabase: project ref `sccivxenkyzxolpraexf`, region `eu-west-2`. auth = Magic Link (מייל, בלי סיסמאות).

## סטטוס עבודה נוכחי (מעודכן 2026-08-16 — עדכנו את זה בכל סבב עבודה)

### בפיתוח (ברנץ' `claude/ai-symbols-stage-0-5h6bh5`, טרם מוזג)
- **מחולל סמלים ב-AI — שלב 0 (מנהל בלבד)** — Edge Function חדש `image-gateway` (Pollinations, קאש+מדידה ב-`ai_image_log`, בקט פרטי `ai-symbols`), שער אמיתי בצד שרת לפי `ADMIN_EMAILS`. בפרונט: `js/ai-symbols.js` + כפתור מוסתר-לגמרי ל-non-admin ליד `uz`, גשר `window.dobbleAddFiles`. **Secrets עדיין לא הוגדרו בדשבורד** (`POLLINATIONS_TOKEN`, `ADMIN_EMAILS`) — בלעדיהם הפונקציה תיכשל בזמן ריצה. ראו "Edge Functions" ו-"Supabase — סכמה" למטה.

### מוזג ל-main ופעיל באתר
- **מודל גישה מדורג (PR #19)** — הכניסה חסומה. שלושה מסלולים: קוד קיים / הרשמה חינם (7 קלפים, `max_order:7`) / רכישת מנוי (13/21/31/57 קלפים). ראו "מונטיזציה" למטה.
- **מעבר ללינקי תשלום קבועים (PR #33/#34)** — `create-payment` הוחלף ב-4 לינקי Morning קבועים. ראו "מונטיזציה".
- **דשבורד מנהל מאוחד (PR #35)** — כרטיס לקוח עם שימוש/עיצובים, פעולות בלחיצה, ומצב תמיכה. ראו "מצב תמיכה" למטה.
- **מודל העלאה + תיקיות + מחיקה מרובה (PR #36)** — מודל התקדמות, `confirmDialog()` במקום `confirm()`, גלריה מקובצת בתיקיות למנוי מחובר.
- **תיקוני מצב תמיכה (PR #37/#38)** — הבאנר הצף הוחלף בכפתור קומפקטי בתוך ה-header (`#support-mini-exit`); `isWithinTier()` עוקף את מגבלת המסלול כשמנהל מייצא עבור לקוח.
- **מכסת הדפסות בשליטת מנהל (PR #40)** — ראו "מכסת הדפסות" למטה.
- **תאריך תפוגה מדויק (PR #39)** — פעולת `set_expiry` + שדה תאריך בכרטיס המנוי.
- **הקשחת timeouts (PR #41/#42)** — ראו "כלל timeout" למטה.
- **ביצועי גלריה (PR #45)** — ראו "כלל renderGallery" למטה.
- **עמוד שיווקי (PR #43/#44)** — `dobble-info.html` + הרחבות "איך משחקים" לכל אחד מ-4 המשחקים.
- קודם לכן: גלישת IndexedDB (#24), העלאה עמידה לענן (#26), fallback לענן (#29), HEIC מוסווה (#30), גודל/מיקום סמלים (#20–#23), צורת סמל (#28).

### ⚠️ כללים שנלמדו מבאגים אמיתיים — אל תחזרו עליהם

**כלל timeout — כל קריאת רשת בלולאה חייבת timeout.**
מקור: העלאה נתקעה ~15 דק' כי `ensureHeic2Any()` טענה CDN דרך תג `<script>` בלי timeout — `onload`/`onerror` לא נורו לעולם, וה-`await` נשאר תלוי. מכיוון שהלולאות מעבדות פריט-אחרי-פריט, פריט אחד תקוע עוצר את הכול בלי שום הודעה.
קיים `withTimeout(promise, ms, msg)`. עטוף בו: טעינת סקריפט מ-CDN (15s), `loadImgFile` לכל קובץ (30s), `SB.storage.upload`/`download` (20s), `loadImgUrl` בחבילות (20s). גם `fetchWithTimeout(url, ms)` לקישורים חתומים במצב תמיכה.

**כלל renderGallery — לעולם לא בתוך לולאת העלאה.**
`renderGallery()` משרטט מחדש את **כל** הגלריה (canvas לכל פריט), לא רק חדשים. קריאה לה בתוך הלולאה הופכת העלאת N תמונות עם M קיימות ל-O(N×M) — ההעלאה נעשית איטית יותר ויותר ככל שמאגר הלקוח גדל, בלי ששום דבר בקובץ השתנה. קוראים לה **פעם אחת אחרי כל האצווה** (`addFiles`, `loadPack`). `updateCropHint()` מגיע דרך `updateCounter()`, אז אין צורך לקרוא לו בנפרד.

**כלל fail-open** — תקלת רשת/שגיאת RPC לא חוסמת לקוח משלם. חוסמים רק על תשובת שרת מפורשת (`ok:false`). עקבי ב-`subscriptionGate()` וב-`consume_print_quota`.

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
| "רכישת מנוי" | בחירת רמה (13/21/31/57 קלפים = 5/10/12/15 ₪) → **לינק Morning קבוע** |

- `max_order` נשמר ב-`sessionStorage` אחרי כניסה. גדלים **עד** `max_order` עובדים במלואם כולל ייצוא; גדלים **מעל** — תצוגה מקדימה עם watermark אלכסוני, והייצוא פותח חלון שדרוג.
- קודים ישנים/מנהל/מנויי Supabase Auth (מנגנון legacy, ראו "גישה" למעלה) → `max_order:57` (גישה מלאה), לא צריך הרשמה מחדש.

### ⚠️ תשלום = 4 לינקים קבועים, לא API
`create-payment` **פרש**. יצירת לינקי תשלום דרך ה-API חסומה מצד Morning לחשבון הזה לצמיתות (`errorCode 2600` — "אין מסוף סליקה פעיל"), ותמיכת Morning אישרה שזה לא זמין. **אל תנסו להחיות את המסלול הזה.**
- `window.PAYMENT_LINKS` ב-`dobble.html` — 4 לינקים קבועים, אחד לכל מדרגה.
- `payForTier()` שומרת את האימייל ב-`localStorage` ופותחת את הלינק בכרטיסייה חדשה. לינק קבוע לא יכול להחזיר `successUrl`, לכן הכפתור הופך ל-"שילמתי — בחר קוד ✓" שמוביל ל-`showClaimScreen`.
- `morning-webhook` מזהה את התשלום לפי **allowlist של `productId` → `{amount, tier}`**. מסמן `paid` רק אם ה-productId מוכר **וגם** הסכום תואם; אחרת `pending` (לא מעניק גישה).
- **הוספת מדרגה/לינק חדש = לעדכן את `LINKS` בתוך `morning-webhook` *וגם* redeploy דרך MCP.** ה-productId מופק מכתובת היעד (`pages.greeninvoice.co.il/payments/links/<productId>`).
- **החוליה הרגישה:** `claim_access_code` מתאים לפי `customer_email`. הלקוח חייב לשלם ב-Morning עם **אותו אימייל** שהזין אצלנו, אחרת התשלום לא יימצא.

### מכסת הדפסות (ייצוא בבית) — בשליטת מנהל
- `profiles.print_limit` (`null` = ללא הגבלה, ברירת מחדל) ו-`profiles.print_count`.
- אכיפה: RPC `consume_print_quota()` — `SECURITY DEFINER`, אטומי (`FOR UPDATE`), לפי `auth.uid()`. נקרא מ-`doExport()` לפני כל PDF/ZIP/DXF. **לא נבדק בצד לקוח בלבד** — אי אפשר לעקוף מ-DevTools.
- אין שורת `profiles` (מנהל/לא-מנוי) → תמיד מותר. לא רץ במצב תמיכה.
- ניהול: פעולות `set_print_limit` / `reset_print_count` ב-`manage-subscriber`.
- **שימו לב לבלבול:** המונה "🖨️ בקשות הדפסה מקצועית" בכרטיס סופר לחיצות על כפתור הוואטסאפ (`print-order`), **לא** ייצוא בבית. שני מונים נפרדים.

### מצב תמיכה (מנהל צופה בעיצוב לקוח)
- `window.__supportMode` — דגל גלובלי. כשהוא פעיל: `schedIdbSave()` הופך ל-no-op (עיצוב הלקוח לא נשמר אצל המנהל), `isWithinTier()` מחזיר תמיד `true` (המנהל מייצא לפי המנוי של הלקוח, לא לפי הקוד שלו), ומכסת ההדפסות לא נצרכת.
- כניסה/יציאה: `enterSupportMode()`/`exitSupportMode()`. היציאה משחזרת snapshot מדויק של מצב המנהל — **`S.frame`/`S.bg` מועתקים ללא fallback ל-null**, כי הם נגישים בלי הגנה בכל קוד הציור.

## Supabase — סכמה ופונקציות
- **טבלאות:** `profiles` (מנויי Auth legacy; `subscription_expires`, `subscriber_status`, `label`, `max_order`, `print_limit`, `print_count`) · `designs` (עיצובים שמורים) · `events` (מעקב פעילות + audit של פעולות מנהל, עמודת `actor`) · `dobble_access_codes` (**המנגנון הנוכחי** — `code`, `type`, `max_order`, `expires_at`, `usage_limit`, `current_usage`, `created_for`, `is_active`) · `dobble_transactions` (עסקאות Morning — `customer_email`, `amount`, `tier`, `status`, `claimed_at`, `claimed_code`) · `ai_image_log` (חדש, שלב 0 מחולל AI — קאש+מדידה, `cache_key`/`prompt`/`storage_path`/`hits`/`est_cost_usd`, SELECT למנהל בלבד).
- **Storage bucket `symbols`:** תמונות פרטיות לכל משתמש (`public=false`). **Storage bucket `ai-symbols`** (חדש): פלט מחולל ה-AI, פרטי, נכתב רק דרך service_role מ-`image-gateway`.
- **RPC:** `redeem_access_code` · `register_free_code` · `claim_access_code` · `consume_print_quota` (מכסת הדפסות, ראו למעלה).

### Edge Functions — 6 בשימוש
| פונקציה | תפקיד |
|---|---|
| `validate-code` | בודק קוד מול `dobble_access_codes` (RPC `redeem_access_code`), מחזיר `max_order` |
| `register-free` | RPC `register_free_code` — קוד חינמי אחד לאימייל, `max_order:7` |
| `claim-code` | אחרי תשלום — RPC `claim_access_code`, מאתר עסקה `paid` לפי אימייל, מחזיר `max_order` |
| `manage-subscriber` | ניהול מנויים, **מנהל בלבד** (service_role). 11 פעולות: `create`/`delete`/`list`/`set_tier`/`extend`/`set_expiry`/`set_print_limit`/`reset_print_count`/`block`/`unblock`/`subscriber-designs`. כל פעולה נרשמת ל-audit |
| `morning-webhook` | `payment/received` מ-Morning. `verify_jwt=false` (חובה — Morning לא שולח JWT). allowlist של productId |
| `image-gateway` | (חדש, שלב 0) יצירת סמלי AI דרך Pollinations, **מנהל בלבד** לפי `ADMIN_EMAILS`. קאש+מדידה ב-`ai_image_log`, פלט ב-bucket `ai-symbols`. Secrets נדרשים: `POLLINATIONS_TOKEN`, `ADMIN_EMAILS` — **טרם הוגדרו בדשבורד**, הפונקציה תיכשל בלעדיהם |

הפרונט קורא **רק** לחמש הראשונות (`morning-webhook` נקרא מ-Morning בלבד); `image-gateway` נקרא רק מ-`js/ai-symbols.js` שגלוי למנהל בלבד.

### ⛔ Edge Functions שפרשו — אל תחזירו לשימוש
נוטרלו (מחזירות 410) ב-09/08. **עדיין קיימות בדשבורד** — MCP לא יכול למחוק פונקציות, ו-`api.supabase.com` חסום מהסביבה המרוחקת. מחיקה סופית = ידנית מהדשבורד.

| פונקציה | למה פרשה |
|---|---|
| `create-payment` | הוחלפה בלינקי Morning קבועים. **חסומה מצד Morning לצמיתות** (2600). המקור נשאר בגיט להיסטוריה |
| `create-payment-test` | עותק בדיקה חד-פעמי |
| `dynamic-worker` | **כפילות ישנה של `manage-subscriber`** (v3) שנוצרה בטעות תחת slug שגוי. הריצה קוד ניהול מורשה עם service_role שיודע ליצור/למחוק מנויים |
| `upload-design-image` | קיבלה dataURL שרירותי מ**כל** משתמש מחובר וכתבה ל-bucket ציבורי עם service_role, בלי הגבלת גודל/rate-limit. העלאות עוברות ישירות מהלקוח ל-Storage (bucket `symbols`, פרטי, תחת RLS) |

- כל ה-SQL בריפו תחת `supabase/`. **לא כל הפונקציות בגיט** — לפני שנוגעים בפונקציה, לבדוק עם `get_edge_function` מה חי בפועל, לא לסמוך על הגיט.

## 🔒 עקרונות אבטחה (קריטי)
- **אימות בצד שרת בלבד.** אסור לגזור הרשאה ממשתנה JS בדפדפן (כמו `isPaid=true`) — ניתן לעקוף ב-DevTools. שחרור ייצוא רק מול אישור שרת.
- **RLS (מאומת מול ה-DB):** `designs` — self-CRUD מלא (`auth.uid()=user_id`). `events` — כל אחד `INSERT`, `SELECT` למנהל בלבד. `profiles` — **רק `SELECT`-own; אין policies ל-`INSERT`/`UPDATE`/`DELETE` למשתמש** (כתיבה רק דרך trigger/service_role), כך שמשתמש לא יכול להאריך לעצמו מנוי. bucket `symbols` פרטי (`public=false`).
- **service_role לעולם לא בקוד/צ'אט** — רק כ-Secret בדשבורד Supabase. ב-frontend רק anon key.
- **הריפו ציבורי:** אין לבצע commit של קודי גישה, קודי ניהול, tokens או secrets לקוד המקור. סודות → Supabase secrets; קודים → DB/config לפי המנגנון.
- תמונות נשמרות ב-Storage, לא כ-base64 ב-JSONB (ב-DB רק הגדרות + נתיבים).
- מתועד כדרישה, טרם מיושם: אימות חתימת Webhook מספק הסליקה (Signature Verification).

## Edge Functions — פריסה
- **לא נפרסים אוטומטית מ-GitHub.** מיזוג PR שנוגע ב-`supabase/functions/` **לא מעלה כלום לאוויר** — צריך `deploy_edge_function` מפורש אחרי המיזוג. זו טעות שקל ליפול בה.
- `verify_jwt=false` נדרש ל-`morning-webhook` (Morning לא שולח JWT). לכל השאר `true`.
- **מגבלות סביבה מרוחקת:** `api.supabase.com` ו-`*.supabase.co` ו-`hos100345.github.io` חסומים במדיניות הרשת (403 CONNECT). לכן: אין CLI, אין מחיקת פונקציות, ואי אפשר לאמת את האתר החי מכאן — רק דרך כלי ה-MCP. לדווח, לא לעקוף.

## Workflow (git)
- ברנץ' ייעודי `claude/<שם-מתאר>`. לפני commit: `git diff --stat` + `node --check` על כל בלוק סקריפט.
- commit → push → פתיחת PR. **אין למזג ל-`main` בלי אישור מפורש של הושעיה.**
- פיתוח incremental — רכיב אחד עובד במלואו לפני המעבר לבא.

## Supabase (MCP)
- העדף `execute_sql` לכל DDL / שינויי schema / אימות מצב (אמין יותר בנייד מ-`apply_migration`).
- `deploy_edge_function` עובד עם מערך `files` (`name` + `content`). secrets נקבעים בדשבורד בלבד:
  supabase.com/dashboard/project/sccivxenkyzxolpraexf/functions/secrets
