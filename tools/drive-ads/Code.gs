// ============================================================
// מודעות עיצובישי ← Google Drive (Google Apps Script, רץ בחשבון של הושעיה)
// מקבל מודעה (PNG) מהשרת שלנו (Edge Function ads-drive) ושומר אותה בתיקייה "מודעות עיצובישי".
// אין כאן סודות: הטוקן נשמר ב-Script Properties (setup), לא בקוד.
//
// התקנה חד-פעמית (מוסבר גם ב-README.md שליד הקובץ):
//   1. script.google.com → פרויקט חדש → להדביק את כל הקובץ הזה במקום מה שיש.
//   2. לבחור למעלה את הפונקציה setup → ▶ הפעלה → לאשר הרשאות (דרייב).
//      ביומן (Execution log) מופיע הטוקן — להעתיק.
//   3. Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone → Deploy.
//      להעתיק את ה-Web app URL.
//   4. ב-Supabase → Edge Functions → Secrets: DRIVE_ADS_URL = הכתובת, DRIVE_ADS_TOKEN = הטוקן.
// ============================================================
const FOLDER_ID = '1JydT_5VV_BSZYPqn9cRqofbnVdPc6Jmb'; // "מודעות עיצובישי" בדרייב של הושעיה

function setup() {
  const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('TOKEN', t);
  DriveApp.getFolderById(FOLDER_ID).getName(); // מבקש הרשאת דרייב עכשיו, לא בבקשה הראשונה
  Logger.log('הטוקן (להעתיק ל-DRIVE_ADS_TOKEN ב-Supabase): ' + t);
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const tok = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!tok || b.token !== tok) return out({ ok: false, error: 'forbidden' });
    const folder = DriveApp.getFolderById(FOLDER_ID);

    if (b.action === 'save') {
      const m = /^data:(image\/(png|jpeg));base64,(.+)$/.exec(String(b.dataUrl || ''));
      if (!m) return out({ ok: false, error: 'bad_image' });
      const name = String(b.name || 'מודעה').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) + (m[2] === 'png' ? '.png' : '.jpg');
      const blob = Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], name);
      const f = folder.createFile(blob);
      if (b.note) f.setDescription(String(b.note).slice(0, 500));
      return out({ ok: true, id: f.getId(), url: f.getUrl(), name: name });
    }

    if (b.action === 'list') {
      const it = folder.getFiles(), list = [];
      while (it.hasNext() && list.length < 200) {
        const f = it.next();
        if (!/^image\//.test(f.getMimeType())) continue;
        list.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), updated: f.getLastUpdated().toISOString() });
      }
      list.sort((a, c) => (a.updated < c.updated ? 1 : -1));
      return out({ ok: true, folder: folder.getUrl(), files: list });
    }
    return out({ ok: false, error: 'bad_action' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}
