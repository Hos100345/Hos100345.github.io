/* print-fit.js — S-131/G-45: שטח ההדפסה האמיתי של כל מתנה מזיקית על התמונה הנקייה שלה, וההלבשה של ההדפסה עליו בקוד.
 * משותף לעמוד המשחקים (js/zikit-products.js — דף המוצר) ולסטודיו (js/subl-3d.js — המוצר למעלה עם העיצוב של הלקוח).
 * לכל מפתח: sku (מק"ט זיקית = SUB_ITEMS בסטודיו), mm = גובה המוצר בתמונה במ"מ (לקנה מידה בבמה), והצורה:
 *   area: 4 נקודות ב-0..1 של התמונה (tl,tr,br,bl) — מישור, גם בפרספקטיבה · cyl: {cx,x0,x1,y0,y1} — גליל, ההדפסה עוטפת רק את החזית הנראית
 *   heart / ellipse: תיבה [x0,y0,x1,y1] · alpha/blend: איך ההדפסה "נבלעת" בחומר (זכוכית/בד שקופים יותר; ספל פלא שחור = source-over)
 * התמונות: images/games/zikit/<key>.webp, 900×900 עם שקיפות. ⛔ שינוי כאן = להעלות ?v= בשני הדפים (games/index.html, studio/index.html).
 * PRINTFIT.render(canvas, spec, productImg, printImg|null) · PRINTFIT.load(key, base) · PRINTFIT.P · PRINTFIT.BY_SKU */
(function () {
  'use strict';
  var P = {
    'enamel':      { mm: 130, sku: '8724-3', name: 'ספל אמייל ענק עם מכסה', size: '700 מ״ל · הדפסה 20×7 ס״מ', cyl: { cx: .41, x0: .10, x1: .72, y0: .44, y1: .86 } },
    'mug-neon':    { mm: 100, sku: '8514', name: 'ספל נאון', size: '300 מ״ל · הדפסה 20×9.5 ס״מ', cyl: { cx: .38, x0: .07, x1: .70, y0: .25, y1: .85 } },
    'mug-magic':   { mm: 100, sku: '8503-1', name: 'ספל פלא — ההדפסה מתגלה בחום', size: '300 מ״ל · הדפסה 19×8 ס״מ', cyl: { cx: .37, x0: .05, x1: .70, y0: .24, y1: .85 }, blend: 'source-over' },
    'mug-spoon':   { mm: 100, sku: '8510', name: 'ספל עם כפית', size: '300 מ״ל · הדפסה 20×9.5 ס״מ', cyl: { cx: .35, x0: .08, x1: .62, y0: .27, y1: .86 } },
    'hugmug':      { mm: 150, sku: '8714-1', name: 'האג מאג טרמי', size: 'נירוסטה · הדפסה בחזית', cyl: { cx: .38, x0: .10, x1: .66, y0: .30, y1: .80 } },
    'wine':        { mm: 160, sku: '8714-3', name: 'גביע יין נירוסטה', size: 'הדפסה על הכוס', cyl: { cx: .50, x0: .33, x1: .68, y0: .15, y1: .45 } },
    'megamug':     { mm: 240, sku: '8715-1', name: 'מגה מאג טרמי עם קשית', size: '600 מ״ל · הדפסה 22×21 ס״מ', cyl: { cx: .45, x0: .30, x1: .60, y0: .30, y1: .85 } },
    'thermo':      { mm: 170, sku: '8706-1', name: 'ספל טרמי נירוסטה', size: '400 מ״ל · הדפסה 20×9 ס״מ', cyl: { cx: .31, x0: .10, x1: .54, y0: .25, y1: .78 } },
    'bottle':      { mm: 240, sku: '8703-2', name: 'בקבוק אלומיניום 600 מ״ל', size: 'הדפסה סביב הבקבוק', cyl: { cx: .50, x0: .34, x1: .65, y0: .45, y1: .88 } },
    'bottle-straw':{ mm: 250, sku: '8703-1', name: 'בקבוק עם קשית', size: 'הדפסה סביב הבקבוק', cyl: { cx: .53, x0: .40, x1: .66, y0: .40, y1: .85 } },
    'basalt':      { mm: 230, sku: '8582', name: 'אבן בזלת 12×22', size: 'אבן טבעית · הדפסה על הפן הלבן', area: [[.34, .13], [.67, .13], [.67, .85], [.34, .85]] },
    'basalt-heart':{ mm: 210, sku: '8589', name: 'אבן בזלת לב 20×20', size: 'אבן טבעית · הדפסה על הפן הלבן', heart: [.15, .08, .85, .78] },
    'woodphoto':   { mm: 220, sku: '8360-4', name: 'תמונה על עץ עם רגל ניקל', size: '15×20 ס״מ · הדפסה מלאה', area: [[.37, .09], [.68, .04], [.67, .85], [.37, .91]] },
    'glass':       { mm: 240, sku: '6452', name: 'תמונה על זכוכית עם מעמד', size: '18×23 ס״מ', area: [[.09, .08], [.90, .06], [.90, .71], [.12, .87]], alpha: .9 },
    'board':       { mm: 230, sku: '6458', name: 'לוח חיתוך זכוכית', size: '20×28 ס״מ · הדפסה מלאה', area: [[.13, .27], [.86, .27], [.96, .70], [.04, .70]] },
    'crystal':     { mm: 210, sku: '6424', name: 'מגן קריסטל', size: '15×20 ס״מ', area: [[.16, .13], [.78, .09], [.83, .86], [.15, .90]], alpha: .92 },
    'clock':       { mm: 260, sku: '8022-3', name: 'שעון עמוד LOVE', size: 'הדפסה על לוח השעון 20×20', ellipse: [.39, .37, .59, .57], stretch: true },
    'woodshape':   { mm: 210, sku: '6101-H20', name: 'לב מעץ מבריק', size: '20 ס״מ · הדפסה מלאה', heart: [.11, .06, .95, .90] },
    'tin':         { mm: 120, sku: '8707-3', name: 'קופסת מתכת עגולה', size: 'קוטר 15 ס״מ · הדפסה על המכסה', ellipse: [.11, .14, .89, .60], stretch: true },
    'bracelet':    { mm: 70, sku: '9172-1', name: 'צמיד אלומיניום', size: 'רוחב 3.5 ס״מ', cyl: { cx: .50, x0: .05, x1: .95, y0: .36, y1: .68 } },
    'hairbrush':   { mm: 230, sku: '8670-1', name: 'מברשת שיער', size: 'הדפסה 6.5×10.5 ס״מ', area: [[.38, .10], [.62, .10], [.62, .47], [.38, .47]], radius: .04 },
    'magnet':      { mm: 160, sku: '8381', name: 'מגנט עץ 10×15', size: 'הדפסה מלאה', area: [[.21, .07], [.77, .05], [.81, .92], [.21, .95]] },
    'leather':     { mm: 260, sku: '8609', name: 'תמונה מעור עם מעמד', size: '20×25 ס״מ', area: [[.23, .06], [.82, .05], [.70, .91], [.11, .82]] },
    'scale':       { mm: 280, sku: '9608', name: 'משקל זכוכית דיגיטלי', size: '26×26 ס״מ · הדפסה מלאה', area: [[.09, .07], [.91, .07], [.95, .91], [.05, .91]], radius: .06 },
    'apron':       { mm: 800, sku: '7603', name: 'סינר סובלימציה', size: 'הדפסה על כל הסינר', area: [[.21, .07], [.79, .07], [.79, .88], [.21, .88]], alpha: .9 },
    'runner':      { mm: 420, sku: '7410-17', name: 'ראנר שולחן פשתן', size: '32×120 ס״מ', area: [[.10, .73], [.85, .23], [.92, .31], [.16, .82]], stretch: true },
    'doormat':     { mm: 450, sku: '7413', name: 'שטיחון כניסה', size: 'הדפסה 25×56 ס״מ', area: [[.17, .37], [.86, .36], [.88, .60], [.13, .63]], alpha: .9 }
  };
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
  // הדף מסובב ב-90° כשהכיוון שלו הפוך מכיוון שטח ההדפסה בתמונה (לוח חיתוך 20×28 ששוכב, תמונת עץ 20×15 שעומדת)
  function orient(im, landscape) {
    var iw = im.width || im.naturalWidth, ih = im.height || im.naturalHeight; if ((iw > ih) === landscape) return im;
    var c = document.createElement('canvas'); c.width = ih; c.height = iw; var x = c.getContext('2d'); x.translate(ih / 2, iw / 2); x.rotate(-Math.PI / 2); x.drawImage(im, -iw / 2, -ih / 2); return c;
  }
  function drawQuad(ctx, im, q, W, H, stretch) {
    im = orient(im, Math.hypot((q[1][0] - q[0][0]) * W, (q[1][1] - q[0][1]) * H) > Math.hypot((q[3][0] - q[0][0]) * W, (q[3][1] - q[0][1]) * H));
    var N = 48, s = Math.max(1, Math.min(im.width / (q[1][0] - q[0][0]) / W, 4));
    var cw = im.width, ch = im.height;
    // חיתוך cover ליחס של המרובע
    var qw = Math.hypot((q[1][0] - q[0][0]) * W, (q[1][1] - q[0][1]) * H), qh = Math.hypot((q[3][0] - q[0][0]) * W, (q[3][1] - q[0][1]) * H);
    var sc = Math.max(qw / cw, qh / ch), sw = qw / sc, sh = qh / sc, sx = (cw - sw) / 2, sy = (ch - sh) / 2;
    if (stretch && Math.max(qw / qh, cw / ch) / Math.min(qw / qh, cw / ch) < 3) { sw = cw; sh = ch; sx = 0; sy = 0; }   // רק כשזה באמת הדף (לא תמונת דמו ריבועית)   // ראנר: המרובע בפרספקטיבה צר בהרבה מהדף — מועכים במקום לחתוך
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
    else if (prod.area) { quadPath(ctx, prod.area, W, H, prod.radius); ctx.clip(); drawQuad(ctx, printIm, prod.area, W, H, prod.stretch); }
    else if (prod.heart) { var b = prod.heart; heartPath(ctx, b[0] * W, b[1] * H, b[2] * W, b[3] * H); ctx.clip(); cover(ctx, printIm, b[0] * W, b[1] * H, (b[2] - b[0]) * W, (b[3] - b[1]) * H); }
    else if (prod.ellipse) { var e = prod.ellipse; ctx.beginPath(); ctx.ellipse((e[0] + e[2]) / 2 * W, (e[1] + e[3]) / 2 * H, (e[2] - e[0]) / 2 * W, (e[3] - e[1]) / 2 * H, 0, 0, Math.PI * 2); ctx.clip(); if (prod.stretch) ctx.drawImage(printIm, e[0] * W, e[1] * H, (e[2] - e[0]) * W, (e[3] - e[1]) * H); else cover(ctx, printIm, e[0] * W, e[1] * H, (e[2] - e[0]) * W, (e[3] - e[1]) * H); }
    ctx.restore();
    // ההדפסה רק איפה שיש מוצר — מחוץ לגוף (שקיפות התמונה) לא נשאר כלום
    ctx.save(); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(im, 0, 0, W, H); ctx.restore();
    // ברק עדין מעל ההדפסה כדי שתשב "בתוך" החומר
    if (prod.cyl) { var g = ctx.createLinearGradient(prod.cyl.x0 * W, 0, prod.cyl.x1 * W, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.3, 'rgba(255,255,255,.18)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(prod.cyl.x0 * W, prod.cyl.y0 * H, (prod.cyl.x1 - prod.cyl.x0) * W, (prod.cyl.y1 - prod.cyl.y0) * H); ctx.restore(); }
  }
  function loadImg(src) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; }); }
  var BY_SKU = {}; Object.keys(P).forEach(function (k) { P[k].key = k; BY_SKU[P[k].sku] = P[k]; });
  var cache = {};
  function load(key, base) { var src = (base || '../images/games/zikit/') + key + '.webp'; return cache[src] || (cache[src] = loadImg(src)); }
  window.PRINTFIT = { P: P, BY_SKU: BY_SKU, render: render, load: load };
})();
