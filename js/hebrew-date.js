/* ====================================================
   HEBREW ↔ GREGORIAN CALENDAR CONVERTER
   הושעיה אמן בלונים — js/hebrew-date.js

   שימוש:
     HEB.parse('כ׳ תשרי תשפ״ה')           → { year:5785, month:7, day:20 }
     HEB.toGregorian(5785, 7, 20)          → Date object (Oct 22 2024)
     HEB.fromGregorian(new Date())         → 'כ׳ בתשרי ה׳תשפ״ה'
     HEB.format(new Date())               → 'יום ג׳, כ׳ בתשרי תשפ״ה'

   initHebrewDate(hebInputId, gregInputId, displayId)
     — מחבר שני שדות HTML ומציג תצוגה בזמן אמת
   ==================================================== */

const HEB = (() => {

  /* ── חודשים ── */
  const MONTHS = {
    'תשרי':7, 'חשון':8, 'חשוון':8,
    'כסלו':9, 'כסליו':9,
    'טבת':10, 'שבט':11,
    'אדר א':12, 'אדר ב':13, 'אדר':12,
    'ניסן':1, 'נסן':1,
    'אייר':2, 'סיון':3, 'תמוז':4,
    'אב':5, 'אלול':6
  };

  const MONTH_NAMES = [
    '', 'ניסן','אייר','סיון','תמוז','אב','אלול',
    'תשרי','חשון','כסלו','טבת','שבט','אדר','אדר ב'
  ];

  /* ── גימטריה ── */
  const LETTERS = {
    'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
    'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,
    'ק':100,'ר':200,'ש':300,'ת':400
  };

  /* ── עוגן ידוע: א' תשרי תשפ"ה = 3 אוקטובר 2024 ── */
  const ANCHOR_GREG = new Date(2024, 9, 3);  // Oct 3 2024
  const ANCHOR_HEB  = { year: 5785, month: 7, day: 1 };

  /* ════════ אלגוריתם הלוח ════════ */

  function isLeap(y)  { return (7 * y + 1) % 19 < 7; }

  function elapsedDays(y) {
    const m = Math.floor((235 * y - 234) / 19);
    const p = 12084 + 13753 * m;
    let   d = m * 29 + Math.floor(p / 25920);
    if ((3 * (d + 1)) % 7 < 3) d++;
    return d;
  }

  function delay(y) {
    const d0 = elapsedDays(y - 1);
    const d1 = elapsedDays(y);
    const d2 = elapsedDays(y + 1);
    if (d2 - d1 === 356) return 2;
    if (d1 - d0 === 382) return 1;
    return 0;
  }

  function newYear(y)  { return elapsedDays(y) + delay(y); }
  function yearLen(y)  { return newYear(y + 1) - newYear(y); }

  function monthLen(y, m) {
    const yl = yearLen(y);
    if (m === 2 || m === 4 || m === 6 || m === 10) return 29; // אייר תמוז אלול טבת
    if (m === 8)  return yl % 10 === 5 ? 30 : 29;             // חשון — תלוי בשנה
    if (m === 9)  return yl % 10 === 3 ? 29 : 30;             // כסלו — תלוי בשנה
    if (m === 12) return isLeap(y) ? 30 : 29;                 // אדר א / אדר
    if (m === 13) return 29;                                   // אדר ב
    return 30;  // ניסן סיון אב תשרי שבט
  }

  function civilMonths(y) {
    return isLeap(y)
      ? [7,8,9,10,11,12,13,1,2,3,4,5,6]
      : [7,8,9,10,11,12,1,2,3,4,5,6];
  }

  function dateToElapsed(y, m, d) {
    let e = newYear(y) + (d - 1);
    for (const mo of civilMonths(y)) {
      if (mo === m) break;
      e += monthLen(y, mo);
    }
    return e;
  }

  /* עוגן מחושב */
  const ANCHOR_ELAPSED = dateToElapsed(
    ANCHOR_HEB.year, ANCHOR_HEB.month, ANCHOR_HEB.day
  );

  /* ════════ המרות ════════ */

  function toGregorian(y, m, d) {
    const diff   = dateToElapsed(y, m, d) - ANCHOR_ELAPSED;
    const result = new Date(ANCHOR_GREG);
    result.setDate(result.getDate() + diff);
    return result;
  }

  function fromGregorian(date) {
    try {
      return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        year: 'numeric', month: 'long', day: 'numeric'
      }).format(date);
    } catch (e) { return ''; }
  }

  function format(date) {
    try {
      return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }).format(date);
    } catch (e) { return ''; }
  }

  /* ════════ פענוח ════════ */

  function parseNum(s) {
    s = s.replace(/['"״׳׳״]/g, '').trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return parseInt(s);
    let v = 0;
    for (const ch of s) {
      if (!LETTERS[ch]) return null;
      v += LETTERS[ch];
    }
    if (v < 1000) v += 5000;  // קיצור שנה (תשפה → 5785)
    return v;
  }

  function parse(str) {
    if (!str) return null;
    str = str.replace(/\s+/g, ' ').trim();

    /* מוצאים את שם החודש הארוך ביותר שמתאים */
    const keys = Object.keys(MONTHS).sort((a, b) => b.length - a.length);
    let matchedMonth = null, monthStart = -1;
    for (const k of keys) {
      const i = str.indexOf(k);
      if (i !== -1) { matchedMonth = k; monthStart = i; break; }
    }
    if (!matchedMonth) return null;

    const before = str.slice(0, monthStart).replace(/^ב/, '').trim();
    const after  = str.slice(monthStart + matchedMonth.length)
                      .replace(/^\s*ה/, '').trim();

    const day  = parseNum(before.replace(/\s+/g, ''));
    const year = parseNum(after.replace(/\s+/g, ''));

    if (!day  || day  < 1  || day  > 30)   return null;
    if (!year || year < 5700 || year > 6200) return null;

    return { year, month: MONTHS[matchedMonth], day };
  }

  /* ════════ API ════════ */

  return {
    parse,
    toGregorian,
    fromGregorian,
    format,
    isLeap,
    monthLen,
    yearLen,
    MONTH_NAMES,
  };

})();

/* ════════ חיבור שדות HTML ════════
   hebInputId  — שדה טקסט לתאריך עברי
   gregInputId — <input type="date"> לתאריך לועזי
   displayId   — אלמנט להצגת תאריך מומר (אופציונלי)
   ════════════════════════════════ */
function initHebrewDate(hebInputId, gregInputId, displayId) {
  const hebIn  = document.getElementById(hebInputId);
  const gregIn = document.getElementById(gregInputId);
  const disp   = displayId ? document.getElementById(displayId) : null;
  if (!hebIn || !gregIn) return;

  hebIn.addEventListener('input', () => {
    const p = HEB.parse(hebIn.value);
    if (p) {
      const d = HEB.toGregorian(p.year, p.month, p.day);
      gregIn.value = d.toISOString().split('T')[0];
      if (disp) disp.textContent = '📅 ' + HEB.format(d);
    } else {
      if (disp) disp.textContent = '';
    }
  });

  gregIn.addEventListener('input', () => {
    if (!gregIn.value) return;
    const d = new Date(gregIn.value + 'T12:00:00');
    if (isNaN(d)) return;
    const s = HEB.fromGregorian(d);
    if (s) hebIn.value = s;
    if (disp) disp.textContent = s ? '📅 ' + HEB.format(d) : '';
  });
}
