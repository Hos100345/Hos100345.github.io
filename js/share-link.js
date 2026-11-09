/* js/share-link.js — כפתור "📤 שלחו לחבר" (W-x / G-x, 09/11/2026)
   כל אלמנט עם data-share הופך לכפתור שיתוף של הדף הנוכחי:
     data-share-text  — הטקסט שנשלח לפני הקישור (ברירת מחדל: כותרת הדף)
     data-share-text-key — מפתח במילון של הדף (window.t), גובר על data-share-text
     data-share-url   — קישור אחר במקום הדף הנוכחי (יחסי או מלא)
     data-share-keep  — פרמטרים מהכתובת שעוברים בקישור (למשל p — איזה משחק בסטודיו)
   בטלפון: חלון השיתוף של המכשיר (וואטסאפ, טלגרם, SMS…). במחשב / דפדפן בלי שיתוף: וואטסאפ.
   הקישור נשלח בלי פרמטרים ובלי #, כדי שלא יעברו קוד/פרטים אישיים מהכתובת.
   ⛔ קובץ משותף — טוענים אותו ב: index.html, card-games.html, matchito-info.html, matchito.html, games/, play/, studio/.
      שינוי = להעלות ?v= בכל הדפים האלה. */
(function () {
  'use strict';
  function urlFor(el) {
    var u = el.getAttribute('data-share-url');
    try { u = new URL(u || location.pathname, location.href); } catch (e) { return location.origin + location.pathname; }
    if (el.hasAttribute('data-share-url')) return u.origin + u.pathname + u.search;
    // data-share-keep="p,demo" — רק הפרמטרים האלה עוברים (איזה משחק), שום דבר אחר מהכתובת
    var keep = (el.getAttribute('data-share-keep') || '').split(',').filter(Boolean), q = [];
    var cur = new URLSearchParams(location.search);
    keep.forEach(function (k) { if (cur.has(k)) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(cur.get(k))); });
    return u.origin + u.pathname + (q.length ? '?' + q.join('&') : '');
  }
  function textFor(el) {
    // דף עם מילון (המחולל): data-share-text-key נקרא דרך t() — כך הטקסט בשפה שהמשתמש בחר
    var k = el.getAttribute('data-share-text-key');
    if (k && typeof window.t === 'function') { var v = window.t(k); if (v && v !== k) return v; }
    return el.getAttribute('data-share-text') || document.title || '';
  }
  function whatsapp(text, url) {
    var href = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
    // בלי 'noopener' בפרמטר — איתו window.open מחזיר תמיד null, והיינו פותחים פעמיים
    var w = window.open(href, '_blank');
    if (w) { try { w.opener = null; } catch (e) {} } else location.href = href;
  }
  function onClick(e) {
    var el = e.target.closest && e.target.closest('[data-share]');
    if (!el) return;
    e.preventDefault();
    var url = urlFor(el), text = textFor(el);
    // navigator.share חייב להיקרא ישירות מתוך הלחיצה (בלי await לפני) — אחרת iOS דוחה
    if (navigator.share) {
      navigator.share({ title: document.title, text: text, url: url }).catch(function (err) {
        if (err && err.name === 'AbortError') return;   // המשתמש סגר את החלון — לא עושים כלום
        whatsapp(text, url);
      });
      return;
    }
    whatsapp(text, url);
  }
  document.addEventListener('click', onClick);
})();
