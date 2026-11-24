# מודעות עיצובישי ← Google Drive

עורך הפרסומת (`studio/?p=ad`, מנהל) ← Edge Function `ads-drive` ← Google Apps Script (`Code.gs`, רץ בחשבון של הושעיה) ← תיקיית "מודעות עיצובישי".
למה Apps Script ולא service account: לחשבון service account אין מקום בדרייב אישי (Gmail), אז הוא לא יכול לשמור קבצים בתיקייה של הושעיה.

## התקנה חד-פעמית
1. https://script.google.com → **פרויקט חדש** → למחוק את מה שיש ולהדביק את `Code.gs`. לשמור.
2. למעלה לבחור את הפונקציה **setup** → **▶ הפעלה** → לאשר הרשאות (דרייב). ביומן מופיע הטוקן — להעתיק.
3. **פריסה (Deploy) → פריסה חדשה → Web app**: Execute as **Me**, Who has access **Anyone** → Deploy. להעתיק את ה-**Web app URL**.
4. Supabase → Edge Functions → Secrets: `DRIVE_ADS_URL` = הכתובת, `DRIVE_ADS_TOKEN` = הטוקן.

שינוי ב-`Code.gs` = לעדכן בפרויקט ב-script.google.com ו-**Deploy → Manage deployments → Edit → New version** (הכתובת נשארת).
