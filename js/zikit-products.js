/* G-45 — דפי מוצר למתנות מזיקית (games/#gifts).
 * לכל מוצר: תמונה נקייה (ChatGPT, רקע הוסר), שטח ההדפסה האמיתי מהקטלוג כמלבן/צורה על התמונה, מחיר מ-studio_blank_prices,
 * וכפתור "לעצב את שלי" → studio/?p=subl&item=<מק"ט>. ההדפסה מודגמת בקוד (לא תמונת AI) — בדיוק במקום שהמכבש מגיע אליו.
 * area: נקודות ב-0..1 של התמונה (tl,tr,br,bl) · cyl: {cx,x0,x1,y0,y1} גליל — ההדפסה עוטפת רק את החזית · heart/ellipse/circle: תיבה.
 * הדמו: תמונת הלקוח מהעמוד (IndexedDB hoshaya-games) אם יש, אחרת תמונת חנוכה לדוגמה. */
(function () {
  'use strict';
  var SB_URL = 'https://sccivxenkyzxolpraexf.supabase.co', SB_KEY = 'sb_publishable_Ctloh48bIY2Lxm_YmTiSGA_1ADr5FDz';
  var IMG = '../images/games/zikit/';
  var P = {
    'enamel':      { sku: '8724-3', name: 'ספל אמייל ענק עם מכסה', size: '700 מ״ל · הדפסה 20×7 ס״מ', cyl: { cx: .41, x0: .10, x1: .72, y0: .44, y1: .86 } },
    'mug-neon':    { sku: '8514', name: 'ספל נאון', size: '300 מ״ל · הדפסה 20×9.5 ס״מ', cyl: { cx: .38, x0: .07, x1: .70, y0: .25, y1: .85 }, link: '../studio/?p=mug' },
    'mug-magic':   { sku: '8503-1', name: 'ספל פלא — ההדפסה מתגלה בחום', size: '300 מ״ל · הדפסה 19×8 ס״מ', cyl: { cx: .37, x0: .05, x1: .70, y0: .24, y1: .85 }, blend: 'source-over', link: '../studio/?p=mug' },
    'mug-spoon':   { sku: '8510', name: 'ספל עם כפית', size: '300 מ״ל · הדפסה 20×9.5 ס״מ', cyl: { cx: .35, x0: .08, x1: .62, y0: .27, y1: .86 }, link: '../studio/?p=mug' },
    'hugmug':      { sku: '8714-1', name: 'האג מאג טרמי', size: 'נירוסטה · הדפסה בחזית', cyl: { cx: .38, x0: .10, x1: .66, y0: .30, y1: .80 } },
    'wine':        { sku: '8714-3', name: 'גביע יין נירוסטה', size: 'הדפסה על הכוס', cyl: { cx: .50, x0: .33, x1: .68, y0: .15, y1: .45 } },
    'megamug':     { sku: '8715-1', name: 'מגה מאג טרמי עם קשית', size: '600 מ״ל · הדפסה 22×21 ס״מ', cyl: { cx: .45, x0: .30, x1: .60, y0: .30, y1: .85 } },
    'thermo':      { sku: '8706-1', name: 'ספל טרמי נירוסטה', size: '400 מ״ל · הדפסה 20×9 ס״מ', cyl: { cx: .31, x0: .10, x1: .54, y0: .25, y1: .78 } },
    'bottle':      { sku: '8703-2', name: 'בקבוק אלומיניום 600 מ״ל', size: 'הדפסה סביב הבקבוק', cyl: { cx: .50, x0: .34, x1: .65, y0: .45, y1: .88 } },
    'bottle-straw':{ sku: '8703-1', name: 'בקבוק עם קשית', size: 'הדפסה סביב הבקבוק', cyl: { cx: .53, x0: .40, x1: .66, y0: .40, y1: .85 } },
    'basalt':      { sku: '8582', name: 'אבן בזלת 12×22', size: 'אבן טבעית · הדפסה על הפן הלבן', area: [[.34, .13], [.67, .13], [.67, .85], [.34, .85]] },
    'basalt-heart':{ sku: '8589', name: 'אבן בזלת לב 20×20', size: 'אבן טבעית · הדפסה על הפן הלבן', heart: [.15, .08, .85, .78] },
    'woodphoto':   { sku: '8360-4', name: 'תמונה על עץ עם רגל ניקל', size: '15×20 ס״מ · הדפסה מלאה', area: [[.37, .08], [.69, .05], [.66, .92], [.37, .95]] },
    'glass':       { sku: '6452', name: 'תמונה על זכוכית עם מעמד', size: '18×23 ס״מ', area: [[.09, .08], [.90, .06], [.90, .71], [.12, .87]], alpha: .9 },
    'board':       { sku: '6458', name: 'לוח חיתוך זכוכית', size: '20×28 ס״מ · הדפסה מלאה', area: [[.13, .27], [.86, .27], [.96, .70], [.04, .70]] },
    'crystal':     { sku: '6424', name: 'מגן קריסטל', size: '15×20 ס״מ', area: [[.16, .13], [.78, .09], [.83, .86], [.15, .90]], alpha: .92 },
    'clock':       { sku: '8022-3', name: 'שעון עמוד LOVE', size: 'הדפסה על לוח השעון 20×20', ellipse: [.39, .37, .59, .57] },
    'woodshape':   { sku: '6101-H20', name: 'לב מעץ מבריק', size: '20 ס״מ · הדפסה מלאה', heart: [.11, .06, .95, .90] },
    'tin':         { sku: '8707-3', name: 'קופסת מתכת עגולה', size: 'קוטר 15 ס״מ · הדפסה על המכסה', ellipse: [.11, .14, .89, .60] },
    'bracelet':    { sku: '9172-1', name: 'צמיד אלומיניום', size: 'רוחב 3.5 ס״מ', cyl: { cx: .50, x0: .05, x1: .95, y0: .36, y1: .68 } },
    'hairbrush':   { sku: '8670-1', name: 'מברשת שיער', size: 'הדפסה 6.5×10.5 ס״מ', area: [[.38, .10], [.62, .10], [.62, .47], [.38, .47]], radius: .04 },
    'magnet':      { sku: '8381', name: 'מגנט עץ 10×15', size: 'הדפסה מלאה', area: [[.21, .07], [.77, .05], [.81, .92], [.21, .95]] },
    'leather':     { sku: '8609', name: 'תמונה מעור עם מעמד', size: '20×25 ס״מ', area: [[.09, .10], [.80, .08], [.80, .90], [.09, .92]] },
    'scale':       { sku: '9608', name: 'משקל זכוכית דיגיטלי', size: '26×26 ס״מ · הדפסה מלאה', area: [[.09, .07], [.91, .07], [.95, .91], [.05, .91]], radius: .06 },
    'apron':       { sku: '7603', name: 'סינר סובלימציה', size: 'הדפסה 44×33 ס״מ', area: [[.26, .36], [.74, .36], [.72, .84], [.28, .84]], alpha: .85 },
    'runner':      { sku: '7410-17', name: 'ראנר שולחן פשתן', size: '32×120 ס״מ', area: [[.07, .74], [.86, .20], [.95, .30], [.14, .84]] },
    'doormat':     { sku: '7413', name: 'שטיחון כניסה', size: 'הדפסה 25×56 ס״מ', area: [[.17, .37], [.86, .36], [.88, .60], [.13, .63]], alpha: .9 }
  };
  // תמונות הדגמה אמיתיות מ-ChatGPT (עם הדפסה מלאה) — רק למוצרים שההדפסה עוטפת אותם באמת
  var PRINT_PHOTO = { 'enamel': 1, 'mug-neon': 1, 'mug-magic': 1, 'hugmug': 1, 'wine': 1, 'megamug': 1, 'thermo': 1, 'bottle': 1, 'bottle-straw': 1 };
  var prices = {}, pricesReady = fetch(SB_URL + '/rest/v1/studio_blank_prices?select=key,price', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
    .then(function (r) { return r.json(); }).then(function (rows) { (rows || []).forEach(function (r) { if (r.price > 0) prices[r.key] = r.price; }); try { window.dispatchEvent(new Event('zk-prices')); } catch (e) {} return prices; }).catch(function () { return prices; });

  function priceKey(key) { var p = P[key]; if (!p) return null; if (/^mug/.test(key)) return 'mug-8517'; return 'subl-' + p.sku; }
  function price(key) { var k = priceKey(key); return k ? prices[k] : undefined; }
  function link(key) { var p = P[key]; return p.link || ('../studio/?p=subl&item=' + p.sku); }

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

  /* ── ציור: המוצר, ועליו ההדפסה בשטח ההדפסה בלבד ── */
  function cover(ctx, im, x, y, w, h) { var s = Math.max(w / im.width, h / im.height), sw = w / s, sh = h / s; ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h); }
  function heartPath(ctx, x0, y0, x1, y1) {
    var w = x1 - x0, h = y1 - y0, cx = x0 + w / 2;
    ctx.beginPath(); ctx.moveTo(cx, y1);
    ctx.bezierCurveTo(x0 - w * .05, y0 + h * .55, x0 + w * .02, y0 - h * .08, cx, y0 + h * .22);
    ctx.bezierCurveTo(x1 - w * .02, y0 - h * .08, x1 + w * .05, y0 + h * .55, cx, y1); ctx.closePath();
  }
  function quadPath(ctx, q, W, H, r) {
    ctx.beginPath(); if (!r) { q.forEach(function (p, i) { ctx[i ? 'lineTo' : 'moveTo'](p[0] * W, p[1] * H); }); ctx.closePath(); return; }
    var rr = r * W; q.forEach(function (p, i) { var a = q[(i + 1) % 4], b = q[(i + 2) % 4]; if (!i) ctx.moveTo((p[0] + a[0]) / 2 * W, (p[1] + a[1]) / 2 * H); ctx.arcTo(a[0] * W, a[1] * H, b[0] * W, b[1] * H, rr); }); ctx.closePath();
  }
  // ציור תמונה לתוך מרובע כללי (פרספקטיבה) — בפסים אנכיים, כל פס אפיני
  function drawQuad(ctx, im, q, W, H) {
    var N = 48, s = Math.max(1, Math.min(im.width / (q[1][0] - q[0][0]) / W, 4));
    var cw = im.width, ch = im.height;
    // חיתוך cover ליחס של המרובע
    var qw = Math.hypot((q[1][0] - q[0][0]) * W, (q[1][1] - q[0][1]) * H), qh = Math.hypot((q[3][0] - q[0][0]) * W, (q[3][1] - q[0][1]) * H);
    var sc = Math.max(qw / cw, qh / ch), sw = qw / sc, sh = qh / sc, sx = (cw - sw) / 2, sy = (ch - sh) / 2;
    for (var i = 0; i < N; i++) {
      var t0 = i / N, t1 = (i + 1) / N;
      var ax = (q[0][0] + (q[1][0] - q[0][0]) * t0) * W, ay = (q[0][1] + (q[1][1] - q[0][1]) * t0) * H;
      var bx = (q[0][0] + (q[1][0] - q[0][0]) * t1) * W, by = (q[0][1] + (q[1][1] - q[0][1]) * t1) * H;
      var dx = (q[3][0] + (q[2][0] - q[3][0]) * t0) * W, dy = (q[3][1] + (q[2][1] - q[3][1]) * t0) * H;
      // אפיני: (0,0)->a, (1,0)->b, (0,1)->d
      ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx + (bx - ax) * .02, by + (by - ay) * .02); ctx.lineTo(bx + (bx - ax) * .02 + (dx - ax), by + (by - ay) * .02 + (dy - ay)); ctx.lineTo(dx, dy); ctx.closePath(); ctx.clip();
      ctx.transform(bx - ax, by - ay, dx - ax, dy - ay, ax, ay);
      ctx.drawImage(im, sx + sw * t0, sy, sw / N, sh, 0, 0, 1, 1); ctx.restore();
    }
  }
  // גליל: ההדפסה עוטפת את החזית — כל פס זז לפי sin, מתכווץ לפי cos
  function drawCyl(ctx, im, c, W, H) {
    var R = (c.x1 - c.x0) / 2 * W, cx = c.cx * W, y0 = c.y0 * H, h = (c.y1 - c.y0) * H, N = 64;
    var span = Math.PI * .92, ar = (span * R) / h;   // רוחב "פרוש" של ההדפסה ביחס לגובה
    var sw = Math.min(im.width, im.height * ar), sh = sw / ar, sx = (im.width - sw) / 2, sy = (im.height - sh) / 2;
    for (var i = 0; i < N; i++) {
      var a0 = -span / 2 + span * i / N, a1 = -span / 2 + span * (i + 1) / N;
      var px0 = cx + R * Math.sin(a0), px1 = cx + R * Math.sin(a1);
      var w = Math.max(px1 - px0, .5), shade = .55 + .45 * Math.cos((a0 + a1) / 2);
      ctx.drawImage(im, sx + sw * i / N, sy, sw / N + 1, sh, px0, y0, w + .7, h);
      ctx.fillStyle = 'rgba(0,0,0,' + ((1 - shade) * .35).toFixed(3) + ')'; ctx.fillRect(px0, y0, w + .7, h);
    }
  }
  function render(cv, prod, im, printIm) {
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    ctx.drawImage(im, 0, 0, W, H);
    if (!printIm) return;
    ctx.save(); ctx.globalCompositeOperation = prod.blend || 'multiply'; ctx.globalAlpha = prod.alpha || 1;
    if (prod.cyl) { ctx.beginPath(); ctx.rect(prod.cyl.x0 * W - 2, prod.cyl.y0 * H, (prod.cyl.x1 - prod.cyl.x0) * W + 4, (prod.cyl.y1 - prod.cyl.y0) * H); ctx.clip(); drawCyl(ctx, printIm, prod.cyl, W, H); }
    else if (prod.area) { quadPath(ctx, prod.area, W, H, prod.radius); ctx.clip(); drawQuad(ctx, printIm, prod.area, W, H); }
    else if (prod.heart) { var b = prod.heart; heartPath(ctx, b[0] * W, b[1] * H, b[2] * W, b[3] * H); ctx.clip(); cover(ctx, printIm, b[0] * W, b[1] * H, (b[2] - b[0]) * W, (b[3] - b[1]) * H); }
    else if (prod.ellipse) { var e = prod.ellipse; ctx.beginPath(); ctx.ellipse((e[0] + e[2]) / 2 * W, (e[1] + e[3]) / 2 * H, (e[2] - e[0]) / 2 * W, (e[3] - e[1]) / 2 * H, 0, 0, Math.PI * 2); ctx.clip(); cover(ctx, printIm, e[0] * W, e[1] * H, (e[2] - e[0]) * W, (e[3] - e[1]) * H); }
    ctx.restore();
    // ברק עדין מעל ההדפסה כדי שתשב "בתוך" החומר
    if (prod.cyl) { var g = ctx.createLinearGradient(prod.cyl.x0 * W, 0, prod.cyl.x1 * W, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.3, 'rgba(255,255,255,.18)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(prod.cyl.x0 * W, prod.cyl.y0 * H, (prod.cyl.x1 - prod.cyl.x0) * W, (prod.cyl.y1 - prod.cyl.y0) * H); ctx.restore(); }
  }
  function loadImg(src) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; }); }

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
