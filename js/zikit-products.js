/* G-45 — דפי מוצר למתנות מזיקית (games/#gifts).
 * לכל מוצר: תמונה נקייה (ChatGPT, רקע הוסר), שטח ההדפסה האמיתי מהקטלוג כמלבן/צורה על התמונה, מחיר מ-studio_blank_prices,
 * וכפתור "לעצב את שלי" → studio/?p=subl&item=<מק"ט>. ההדפסה מודגמת בקוד (לא תמונת AI) — בדיוק במקום שהמכבש מגיע אליו.
 * area: נקודות ב-0..1 של התמונה (tl,tr,br,bl) · cyl: {cx,x0,x1,y0,y1} גליל — ההדפסה עוטפת רק את החזית · heart/ellipse/circle: תיבה.
 * שטחי ההדפסה והציור — js/print-fit.js (משותף עם הסטודיו).
 * הדמו: תמונת הלקוח מהעמוד (IndexedDB hoshaya-games) אם יש, אחרת תמונת חנוכה לדוגמה. */
(function () {
  'use strict';
  var SB_URL = 'https://sccivxenkyzxolpraexf.supabase.co', SB_KEY = 'sb_publishable_Ctloh48bIY2Lxm_YmTiSGA_1ADr5FDz';
  var IMG = '../images/games/zikit/';
  var P = window.PRINTFIT.P, render = window.PRINTFIT.render;
  // תמונות הדגמה אמיתיות מ-ChatGPT (עם הדפסה מלאה) — רק למוצרים שההדפסה עוטפת אותם באמת
  var PRINT_PHOTO = { 'enamel': 1, 'mug-neon': 1, 'mug-magic': 1, 'hugmug': 1, 'wine': 1, 'megamug': 1, 'thermo': 1, 'bottle': 1, 'bottle-straw': 1 };
  var prices = {}, pricesReady = fetch(SB_URL + '/rest/v1/studio_blank_prices?select=key,price', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    .then(function (r) { return r.json(); }).then(function (rows) { (rows || []).forEach(function (r) { if (r.price > 0) prices[r.key] = r.price; }); try { window.dispatchEvent(new Event('zk-prices')); } catch (e) {} return prices; }).catch(function () { return prices; });

  function priceKey(key) { var p = P[key]; return p ? 'subl-' + p.sku : null; }
  function price(key) { var k = priceKey(key); return k ? prices[k] : undefined; }
  function link(key) { return '../studio/?p=subl&item=' + P[key].sku; }

  /* ── תמונת הדמו: תמונה של הלקוח מהעמוד (IndexedDB) או חנוכה ── */
  var sampleP = null;
  function sample() {
    if (sampleP) return sampleP;
    sampleP = new Promise(function (res) {
      var fallback = function () { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = '../images/games/hanukkah/1.webp'; };
      try {
        var rq = indexedDB.open('hoshaya-games');
        rq.onerror = fallback;
        rq.onsuccess = function () {
          try {
            var db = rq.result, names = Array.prototype.slice.call(db.objectStoreNames);
            if (!names.length) return fallback();
            var tx = db.transaction(names[0], 'readonly'), st = tx.objectStore(names[0]), all = st.getAll();
            all.onsuccess = function () {
              var rows = all.result || [], row = rows.find(function (r) { return r && (r.blob || r.dataURL || r.src); });
              if (!row) return fallback();
              var im = new Image(); im.onload = function () { res(im); }; im.onerror = fallback;
              im.src = row.dataURL || row.src || URL.createObjectURL(row.blob);
            }; all.onerror = fallback;
          } catch (e) { fallback(); }
        };
      } catch (e) { fallback(); }
    });
    return sampleP;
  }

  function loadImg(src) { return window.PRINTFIT.load(src.replace(IMG, '').replace('.webp', ''), IMG); }

  /* ── חלון המוצר ── */
  var modal, state = { key: null, mode: 'print' };
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div'); modal.className = 'zk-modal'; modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'zk-name');
    modal.innerHTML = '<div class="zk-box"><button type="button" class="zk-x" aria-label="סגירה">✕</button>' +
      '<div class="zk-media"><canvas id="zk-cv" width="900" height="900" aria-hidden="true"></canvas>' +
      '<div class="zk-seg" role="tablist"><button type="button" data-mode="blank" role="tab">המוצר</button><button type="button" data-mode="print" role="tab" aria-selected="true">עם התמונה שלכם</button></div></div>' +
      '<div class="zk-info"><h3 id="zk-name"></h3><p class="zk-size"></p><p class="zk-price"></p><p class="zk-note">ההדפסה מודגמת בדיוק בשטח ההדפסה של המוצר. התמונה שתעלו בסטודיו תופיע שם.</p>' +
      '<a class="btn zk-go" href="#">✨ לעצב את שלי</a><button type="button" class="btn ghost zk-prev">‹ הקודם</button><button type="button" class="btn ghost zk-next">הבא ›</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.classList.contains('zk-x')) close(); });
    modal.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { state.mode = b.dataset.mode; draw(); }); });
    modal.querySelector('.zk-prev').addEventListener('click', function () { step(-1); });
    modal.querySelector('.zk-next').addEventListener('click', function () { step(1); });
    document.addEventListener('keydown', function (e) { if (modal.hidden) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') step(1); if (e.key === 'ArrowRight') step(-1); });
    return modal;
  }
  function keys() { return Object.keys(P); }
  function step(d) { var ks = keys(), i = ks.indexOf(state.key); open(ks[((i + d) % ks.length + ks.length) % ks.length]); }
  var lastFocus = null;
  function open(key) {
    var prod = P[key]; if (!prod) return false;
    ensureModal(); state.key = key;
    modal.querySelector('#zk-name').textContent = prod.name; modal.querySelector('.zk-size').textContent = prod.size;
    modal.querySelector('.zk-go').href = link(key);
    var pr = modal.querySelector('.zk-price'); pr.textContent = '';
    pricesReady.then(function () { var v = price(key); pr.textContent = v ? v + ' ₪' : 'מחיר לפי בקשה'; });
    if (modal.hidden) { lastFocus = document.activeElement; modal.hidden = false; document.body.style.overflow = 'hidden'; }
    try { history.replaceState(null, '', '#gift=' + key); } catch (e) {}
    draw(); modal.querySelector('.zk-x').focus();
    return true;
  }
  function close() { if (!modal || modal.hidden) return; modal.hidden = true; document.body.style.overflow = ''; try { history.replaceState(null, '', '#gifts'); } catch (e) {} if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  var cache = {};
  function draw() {
    var key = state.key, prod = P[key], cv = modal.querySelector('#zk-cv');
    modal.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)); });
    cache[key] = cache[key] || loadImg(IMG + key + '.webp');
    Promise.all([cache[key], state.mode === 'print' ? sample() : null]).then(function (r) { if (state.key !== key) return; render(cv, prod, r[0], r[1]); }).catch(function () {});
  }

  /* ── רשת המוצרים מתחת לבמה ── */
  function grid(el) {
    var ks = keys();
    el.innerHTML = ks.map(function (k) { return '<button type="button" class="zk-card" data-key="' + k + '"><img src="' + IMG + k + '.webp" alt="" loading="lazy" width="300" height="300"><span class="zk-cn">' + P[k].name + '</span><span class="zk-cp" data-pk="' + k + '"></span></button>'; }).join('');
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-key]'); if (b) open(b.dataset.key); });
    pricesReady.then(function () { el.querySelectorAll('[data-pk]').forEach(function (s) { var v = price(s.dataset.pk); s.textContent = v ? v + ' ₪' : ''; }); });
  }
  function init() {
    var g = document.getElementById('zk-grid'); if (g) grid(g);
    var m = /#gift=([\w-]+)/.exec(location.hash); if (m && P[m[1]]) { var tab = document.getElementById('tab-gifts'); if (tab) tab.click(); setTimeout(function () { open(m[1]); }, 50); }
    window.addEventListener('hashchange', function () { var m2 = /#gift=([\w-]+)/.exec(location.hash); if (m2 && P[m2[1]]) open(m2[1]); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.ZK = { P: P, open: open, close: close, price: price, priceKey: priceKey, link: link, pricesReady: pricesReady, hasPrintPhoto: function (k) { return !!PRINT_PHOTO[k]; } };
})();
