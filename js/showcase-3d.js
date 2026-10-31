/* showcase-3d.js — G-28/G-29: קרוסלה תלת־ממדית בעמוד המשחקים (games/index.html).
 * כל המוצרים עומדים על מעגל שמסתובב לאט; המוצר שמקדימה גדול ומואר, השאר קטנים מאחור. אחד מקדימה בכל רגע.
 * מוצר חדש = פונקציה ב-BUILD + שם ב-data-items/data-names של הבמה. three.js מקומי (../js/vendor), נטען רק כשהבמה נראית.
 * כשל WebGL/טעינה — התמונה הסטטית שבבמה נשארת. גרירה באצבע מסובבת את המעגל; כפתור לכל מוצר; ⏸ עוצר; reduced-motion = בלי סיבוב אוטומטי.
 * החולצה בנויה על קו המתאר של הסטודיו (shOutline, שרוול קצר) — בד "מנופח" לפי המרחק מהשפה, קפלים רכים, צווארון ריב.
 */
(function () {
  'use strict';
  var THREE_SRC = '../js/vendor/three-r128.min.js';
  var threeP = null;
  var scriptP = {};
  function loadScript(src) {   // קובץ מ-js/vendor, פעם אחת, עם timeout (כלל ה-timeout מהמחולל)
    return scriptP[src] || (scriptP[src] = new Promise(function (ok, no) {
      var s = document.createElement('script');
      var t = setTimeout(function () { no(new Error('timeout ' + src)); }, 15000);
      s.src = src; s.onload = function () { clearTimeout(t); ok(); }; s.onerror = function () { clearTimeout(t); no(new Error('load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  function loadThree() {
    if (window.THREE && THREE.RoomEnvironment) return Promise.resolve();
    return threeP || (threeP = (window.THREE ? Promise.resolve() : loadScript(THREE_SRC)).then(function () { return loadScript('../js/vendor/RoomEnvironment-r128.js'); }));
  }
  var GLB_SHIRT = '../images/games/zikit/shirt.glb';   // G-37: קובץ חולצה מוכן (Sketchfab/CGTrader) — אם קיים, נכנס לקרוסלה ליד החולצה שבקוד להשוואה
  function loadGltf() { return loadThree().then(function () { return loadScript('../js/vendor/GLTFLoader-r128.js'); }).then(function () { return loadScript('../js/vendor/DecalGeometry-r128.js'); }); }

  /* ── ציור ההדפסה: בלונים + כיתוב (אותו רוח כמו תמונות המוצרים באתר) ── */
  function balloon(ctx, x, y, r, col) {
    ctx.strokeStyle = 'rgba(60,60,80,.55)'; ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath(); ctx.moveTo(x, y + r * 1.15); ctx.bezierCurveTo(x - r * .3, y + r * 1.8, x + r * .3, y + r * 2.3, x, y + r * 3); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, r * .86, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * .14, y + r * 1.12); ctx.lineTo(x + r * .14, y + r * 1.12); ctx.lineTo(x, y + r * .96); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(x - r * .3, y - r * .38, r * .2, r * .32, -.5, 0, Math.PI * 2); ctx.fill();
  }
  function printCanvas(w, h, text, bg, textY) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    var cx = w / 2, s = Math.min(w, h * 1.1) / 1000;
    [[-120, 250, 95, '#F43F5E'], [40, 200, 105, '#F59E0B'], [170, 270, 90, '#3B82F6'], [-30, 330, 85, '#22C55E'], [95, 360, 80, '#A855F7']]
      .forEach(function (b) { balloon(x, cx + b[0] * s, b[1] * s, b[2] * s, b[3]); });
    x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = '#1E1B4B';
    x.font = '900 ' + Math.round(86 * s) + 'px Heebo, Arial, sans-serif';
    x.fillText(text, cx, h * (textY || 0.86));
    return c;
  }
  function tex(c) { var T = THREE, t = new T.CanvasTexture(c); t.anisotropy = 4; if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; return t; }

  /* ── החולצה — אותו מנוע כמו בסטודיו (S-77/S-82, studio/index.html: shOutline/shSeams/shDepth/shGeom/shCollar/shFabricMat),
   * מועתק עם מידה L (k=1) ושרוול קצר. כל הקואורדינטות במ"מ: x ממרכז, y מקו הכתפיים. שינוי בחולצה של הסטודיו → לעדכן גם כאן. ── */
  var SH_NECK = { front: 85, back: 22, half: 95 }, SH_B = { x0: -410, x1: 410, y0: -6, y1: 740 };
  function shOutline(back) {
    var d = back ? SH_NECK.back : SH_NECK.front, R = [], i, t;
    for (i = 0; i <= 10; i++) { t = i / 10 * Math.PI / 2; R.push([SH_NECK.half * Math.sin(t), d * Math.cos(t)]); }
    R.push([235, 38], [395, 205], [318, 290], [290, 262], [268, 252], [264, 300], [268, 720]);
    for (i = 1; i < 10; i++) { t = i / 10; R.push([268 * (1 - t), 720 + 8 * Math.sin(t * Math.PI / 2)]); }
    R.push([0, 728]); var pts = R.slice();
    for (i = R.length - 2; i > 0; i--) pts.push([-R[i][0], R[i][1]]);
    return pts;
  }
  function shSeams() {
    var R = [[[95, 0], [235, 38]], [[235, 38], [395, 205]], [[318, 290], [290, 262]], [[290, 262], [268, 252]], [[268, 252], [264, 300]], [[264, 300], [268, 720]]], o = [];
    R.forEach(function (ab) { var a = ab[0], b = ab[1]; o.push([[a[0], a[1]], [b[0], b[1]]]); o.push([[-a[0], a[1]], [-b[0], b[1]]]); });
    return o;
  }
  function shSegD(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); }
  function shHash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function shNoise(x, y) { var i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g), a = shHash(i, j), b = shHash(i + 1, j), c = shHash(i, j + 1), d = shHash(i + 1, j + 1); return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1; }
  function shRidge(p, a, b, amp, w) { var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L; if (t <= 0 || t >= 1) return 0; var d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.sqrt(L); return amp * Math.pow(Math.sin(Math.PI * t), .9) * Math.exp(-(d / w) * (d / w)); }
  function shSmooth(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
  function shPip(p, pts) { var c = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) { var a = pts[i], b = pts[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function shDepth(X, Y, seams, back) {
    var D = back ? 70 : 82, Rr = 125, d = 1e9, q;
    for (var i = 0; i < seams.length; i++) { q = shSegD([X, Y], seams[i][0], seams[i][1]); if (q < d) d = q; }
    var ax = Math.abs(X), y = Y, t = Math.min(1, d / Rr), base = D * Math.sqrt(1 - (1 - t) * (1 - t)), f = 0;
    if (ax < 272) {
      f += shRidge([ax, y], [268, 250], [90, 600], back ? 6 : 9, 34) + shRidge([ax, y], [262, 300], [160, 730], back ? 5 : 7, 30) + shRidge([ax, y], [262, 245], [185, 410], 4, 18) - shRidge([ax, y], [268, 275], [125, 650], back ? 3 : 5, 16);
      f += 4.5 * Math.sin(X * .032 + 1.9 * shNoise(X * .008, y * .003) + (back ? 1.3 : 0)) * shSmooth(420, 710, y);
      f -= 2.5 * shSmooth(560, 700, y) * Math.exp(-Math.pow((ax - 60) / 70, 2));
      f += 2.4 * shNoise(X * .012 + (back ? 9 : 0), y * .009);
      f += shRidge([ax, y], [120, 95], [200, 140], 1.8, 9);
    } else { var u = (ax - 262) * .72 + (y - 215) * .69; f += 4.2 * Math.sin(u * .1 + 1.2 * shNoise(ax * .02, y * .02)) * shSmooth(0, 30, u) * (1 - shSmooth(100, 160, u)); }
    return base + f * Math.min(1, t * 3.5);
  }
  function shGeom(pts, B, sign) {
    var T = THREE, step = 3.2, nx = Math.round((B.x1 - B.x0) / step), ny = Math.round((B.y1 - B.y0) / step), g = new T.PlaneGeometry(B.x1 - B.x0, B.y1 - B.y0, nx, ny), P = g.attributes.position, seams = shSeams(), back = sign < 0, cy = (B.y0 + B.y1) / 2;
    var Z = new Float32Array(P.count), i, X, Y, z, d, q;
    for (i = 0; i < P.count; i++) {
      X = P.getX(i) + (B.x0 + B.x1) / 2; Y = -P.getY(i) + cy;
      if (shPip([X, Y], pts)) z = shDepth(X, Y, seams, back);
      else { d = 1e9; for (var k = 0; k < seams.length; k++) { q = shSegD([X, Y], seams[k][0], seams[k][1]); if (q < d) d = q; } z = d < 6 ? 0 : shDepth(X, Y, seams, back); }
      Z[i] = z; P.setXYZ(i, X, -Y + cy, sign * z);
    }
    var col = new Float32Array(P.count * 3), W = nx + 1;
    for (var j = 0; j <= ny; j++) for (var ii = 0; ii <= nx; ii++) {
      var n = j * W + ii, zz = Z[n], l = Z[j * W + Math.max(0, ii - 1)], r = Z[j * W + Math.min(nx, ii + 1)], u = Z[Math.max(0, j - 1) * W + ii], dn = Z[Math.min(ny, j + 1) * W + ii];
      var lap = (l + r + u + dn) / 4 - zz, Xn = P.getX(n), Yn = -P.getY(n) + cy, ax = Math.abs(Xn), y = Yn;
      var a = 1 - Math.max(0, Math.min(.32, lap * .9)) - .16 * Math.exp(-(Math.pow((ax - 262) / 34, 2) + Math.pow((y - 258) / 40, 2)));
      a -= .06 * Math.exp(-Math.pow((y - (back ? 22 : 85) * (1 - Math.pow(ax / 95, 2))) / 14, 2)) * (ax < 100 ? 1 : 0);
      col[n * 3] = col[n * 3 + 1] = col[n * 3 + 2] = Math.max(.55, a);
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  }
  function shMask(pts, B, pp) {
    var sm = shSeams(), c = document.createElement('canvas'); c.width = Math.round((B.x1 - B.x0) * pp); c.height = Math.round((B.y1 - B.y0) * pp);
    var x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.scale(pp, pp); x.translate(-B.x0, -B.y0);
    x.fillStyle = '#fff'; x.beginPath(); pts.forEach(function (q, i) { i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); x.fill();
    x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; x.lineWidth = 5; x.beginPath(); sm.forEach(function (ab) { x.moveTo(ab[0][0], ab[0][1]); x.lineTo(ab[1][0], ab[1][1]); }); x.stroke();
    return c;
  }
  function shFabric(B, pp, back, print) {
    var c = document.createElement('canvas'); c.width = Math.round((B.x1 - B.x0) * pp); c.height = Math.round((B.y1 - B.y0) * pp); var x = c.getContext('2d');
    x.fillStyle = '#FBFBF9'; x.fillRect(0, 0, c.width, c.height); x.scale(pp, pp); x.translate(-B.x0, -B.y0);
    x.strokeStyle = 'rgba(120,120,115,.35)'; x.lineWidth = .7; x.setLineDash([2.2, 1.6]); var nd = back ? SH_NECK.back : SH_NECK.front;
    x.beginPath(); x.ellipse(0, 0, SH_NECK.half + 14, nd + 14, 0, 0, Math.PI); x.stroke();
    x.beginPath(); [-1, 1].forEach(function (s) { x.moveTo(s * 382, 219); x.lineTo(s * 305, 276); }); x.stroke();
    x.beginPath(); x.moveTo(-268, 700); x.quadraticCurveTo(0, 712, 268, 700); x.stroke(); x.setLineDash([]);
    x.globalAlpha = .06; for (var i = 0; i < 2600; i++) { x.fillStyle = i % 2 ? '#000' : '#fff'; x.fillRect(B.x0 + shHash(i, 1) * (B.x1 - B.x0), B.y0 + shHash(i, 2) * (B.y1 - B.y0), 1.2, .5); }
    x.globalAlpha = 1;
    if (print) x.drawImage(print, -140, 150, 280, 280);   // ההדפסה: 28×28 ס"מ במרכז החזה
    return c;
  }
  function shCollar(B) {
    var T = THREE, seams = shSeams(), cy = (B.y0 + B.y1) / 2, hw = SH_NECK.half, P = [], n = 28, i, t, x, y;
    for (i = 0; i <= n; i++) { t = i / n * Math.PI; x = -Math.cos(t) * hw; y = SH_NECK.front * Math.sin(t) + 3; P.push(new T.Vector3(x, -y + cy, i === 0 || i === n ? 0 : shDepth(x, y, seams, false))); }
    for (i = n - 1; i > 0; i--) { t = i / n * Math.PI; x = -Math.cos(t) * hw; y = SH_NECK.back * Math.sin(t) + 3; P.push(new T.Vector3(x, -y + cy, -shDepth(x, y, seams, true))); }
    return new T.TubeGeometry(new T.CatmullRomCurve3(P, true), 180, 5.5, 10, true);
  }
  function shFabricMat(am, map, side, inside) {
    var T = THREE, m = new T.MeshPhysicalMaterial({ color: inside ? 0xA7A49E : 0xffffff, roughness: .93, metalness: 0, side: side, alphaMap: am, alphaTest: .5, vertexColors: true, map: inside ? null : map });
    m.sheen = new T.Color(.42, .42, .42); return m;
  }
  /* ── G-37: חולצה בנפח אמיתי (במקום שני משטחים מנופחים). גוף = צינור עם חתך "סופר-אליפסה" שמשתנה לאורך הגובה (כתפיים → חזה → שוליים),
   * שרוולים = צינורות משופעים, פתח צוואר אמיתי עם צווארון ריב, קפלים (אותן נוסחאות קפלים של הסטודיו) כהזזה לאורך הנורמל, AO בקודקודים,
   * ומפת נורמלים של סריג. מ"מ של חולצה L: x ממרכז, y מקו הכתפיים (0) לשוליים (728). ── */
  function knitNormalMap() {
    var N = 256, c = document.createElement('canvas'); c.width = c.height = N; var x = c.getContext('2d'), h = new Float32Array(N * N), i, j;
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) { var u = i / N * Math.PI * 2 * 10, v = j / N * Math.PI * 2 * 16; h[j * N + i] = 0.5 + 0.08 * Math.sin(u) * Math.sin(v) + 0.07 * Math.sin(v * 1.5) + 0.3 * shNoise(i * .45, j * .45) + 0.12 * shNoise(i * 1.7, j * 1.7); }
    var img = x.createImageData(N, N), d = img.data;
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var l = h[j * N + (i + N - 1) % N], r = h[j * N + (i + 1) % N], u2 = h[((j + N - 1) % N) * N + i], dn = h[((j + 1) % N) * N + i];
      var nx = (l - r) * 2, ny = (u2 - dn) * 2, nz = 1, len = Math.hypot(nx, ny, nz), k = (j * N + i) * 4;
      d[k] = (nx / len * .5 + .5) * 255; d[k + 1] = (ny / len * .5 + .5) * 255; d[k + 2] = (nz / len * .5 + .5) * 255; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); var t = new (THREE.CanvasTexture)(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  var SH_HEM = 728;
  function shHalfW(y) { return (y < 38 ? 95 + 140 * Math.sqrt(y / 38) : y < 250 ? 235 + 35 * (y - 38) / 212 : 270 - 2 * (y - 250) / 478) * (1 - .025 * shSmooth(640, 728, y)); }
  function shHalfD(y) { return y < 40 ? 55 + 20 * (y / 40) : y < 150 ? 75 + 22 * ((y - 40) / 110) : y < 450 ? 97 : 97 - 20 * ((y - 450) / 278); }
  function shTop(x, front) { var ax = Math.abs(x); return ax < 95 ? (front ? 85 : 22) * Math.sqrt(1 - (ax / 95) * (ax / 95)) : (ax - 95) / 140 * 50; }
  function shFold(X, y, back) {   // אותם קפלים כמו shDepth בסטודיו, רק החלק של ה"קפלים" (לא הניפוח)
    var ax = Math.abs(X), f = 0;
    if (ax < 272) {
      f += shRidge([ax, y], [268, 250], [90, 600], back ? 6 : 9, 34) + shRidge([ax, y], [262, 300], [160, 730], back ? 5 : 7, 30) + shRidge([ax, y], [262, 245], [185, 410], 4, 18) - shRidge([ax, y], [268, 275], [125, 650], back ? 3 : 5, 16);
      f += 4.5 * Math.sin(X * .032 + 1.9 * shNoise(X * .008, y * .003) + (back ? 1.3 : 0)) * shSmooth(420, 710, y);
      f -= 2.5 * shSmooth(560, 700, y) * Math.exp(-Math.pow((ax - 60) / 70, 2));
      f += 2.4 * shNoise(X * .012 + (back ? 9 : 0), y * .009);
      f += shRidge([ax, y], [120, 95], [200, 140], 1.8, 9);
    }
    return f;
  }
  // גוף: חצי קדמי או אחורי. a ∈ [-π/2, π/2] סביב החצי; superellipse n=2.5
  function shBodyHalf(front, map, nmap) {
    var T = THREE, NA = 48, NY = 96, pos = [], uv = [], col = [], idx = [], n = 2.15, i, j;
    for (j = 0; j <= NY; j++) {
      var y0 = j / NY * SH_HEM;
      for (i = 0; i <= NA; i++) {
        var a = -Math.PI / 2 + i / NA * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
        var sx = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n), sz = Math.pow(Math.abs(ca), 2 / n) * (front ? 1 : -1);
        var hw = shHalfW(y0), x = hw * sx, y = Math.max(y0, shTop(x, front)), hd = shHalfD(y), z = hd * sz;
        // קפלים: הזזה רדיאלית (קירוב לנורמל) — גדולה יותר בצד שרואים
        var f = shFold(x, y, !front) * (0.35 + 0.65 * Math.abs(sz));
        var rr = Math.hypot(x / hw, z / hd) || 1;
        x += f * (x / hw) / rr * (hw / Math.max(hw, hd)); z += f * (z / hd) / rr;
        pos.push(x, -y + SH_HEM / 2, z);
        uv.push((x - SH_B.x0) / (SH_B.x1 - SH_B.x0), 1 - (y - SH_B.y0) / (SH_B.y1 - SH_B.y0));
        // AO: צווארון, בית שחי, תחתית הקפלים
        var ao = 1 - .18 * Math.exp(-Math.pow((y - shTop(x, front) - 12) / 16, 2)) - .22 * Math.exp(-(Math.pow((Math.abs(x) - 262) / 40, 2) + Math.pow((y - 258) / 45, 2))) - .35 * Math.max(0, -f) / 9;
        ao = Math.max(.55, Math.min(1, ao)); col.push(ao, ao, ao);
      }
    }
    for (j = 0; j < NY; j++) for (i = 0; i < NA; i++) { var k = j * (NA + 1) + i, k2 = k + NA + 1; if (front) idx.push(k, k2, k + 1, k + 1, k2, k2 + 1); else idx.push(k, k + 1, k2, k + 1, k2 + 1, k2); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    var m = new T.MeshPhysicalMaterial({ color: 0xF4F2EE, map: map, normalMap: nmap, normalScale: new T.Vector2(.22, .22), roughness: .92, metalness: 0, vertexColors: true, side: T.DoubleSide });
    m.sheen = new T.Color(.25, .25, .25); if (nmap) { nmap.repeat.set(40, 60); }
    return new T.Mesh(g, m);
  }
  function shSleeve(side, nmap) {   // side = ±1. ציר מ-(245,135) ל-(356,248) במ"מ; רדיוס 118 → 62, פחוס ב-z
    var T = THREE, NT = 24, NB = 36, pos = [], col = [], uv = [], idx = [], i, j;
    var P0 = [232 * side, 128], P1 = [368 * side, 232], dx = P1[0] - P0[0], dy = P1[1] - P0[1], L = Math.hypot(dx, dy), ax = dx / L, ay = dy / L;
    for (j = 0; j <= NT; j++) {
      var t = j / NT, cx = P0[0] + dx * t, cy = P0[1] + dy * t, r = 104 - 44 * t, flat = .58 + .1 * t;
      for (i = 0; i <= NB; i++) {
        var b = i / NB * Math.PI * 2, nx = -ay * Math.cos(b), ny = ax * Math.cos(b), nz = Math.sin(b) * flat;
        var fold = 4.2 * Math.sin(t * 9 + b * 2 + 1.2 * shNoise(t * 7, b)) * shSmooth(0, .2, t) * (1 - shSmooth(.75, 1, t)) + 2 * shNoise(t * 5, b * 2);
        var rr = r + fold;
        pos.push(cx + rr * nx, -(cy + rr * ny) + SH_HEM / 2, rr * nz);
        uv.push(t * 2, b / Math.PI * 2);
        var ao = 1 - .2 * shSmooth(.15, 0, t) * (Math.sin(b) < 0 ? 1 : .4) - .3 * Math.max(0, -fold) / 4; col.push(ao, ao, ao);
      }
    }
    for (j = 0; j < NT; j++) for (i = 0; i < NB; i++) { var k = j * (NB + 1) + i, k2 = k + NB + 1; idx.push(k, k + 1, k2, k + 1, k2 + 1, k2); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    var m = new T.MeshPhysicalMaterial({ color: 0xF4F2EE, normalMap: nmap, normalScale: new T.Vector2(.22, .22), roughness: .92, vertexColors: true, side: T.DoubleSide }); m.sheen = new T.Color(.25, .25, .25);
    if (nmap) nmap.repeat.set(10, 12); var mesh = new T.Mesh(g, m);
    // פתח השרוול: טבעת פנימית כהה (רואים פנימה)
    var inner = new T.Mesh(g.clone(), new T.MeshStandardMaterial({ color: 0xB9B5AE, roughness: .95, side: T.BackSide, polygonOffset: true, polygonOffsetFactor: 1 }));
    var grp = new T.Group(); grp.add(mesh); grp.add(inner); return grp;
  }
  function shCollarRib() {
    var T = THREE, P = [], n = 64, i;
    for (i = 0; i < n; i++) { var t = i / n * Math.PI * 2, x = 95 * Math.cos(t), st = Math.sin(t), front = st > 0, y = (front ? 85 : 22) * Math.abs(st) + 4, z = (front ? 1 : -1) * 62 * Math.pow(Math.abs(st), .55); P.push(new T.Vector3(x, -y + SH_HEM / 2, z)); }
    var m = new T.MeshPhysicalMaterial({ color: 0xF4F3EF, roughness: .95 }); m.sheen = new T.Color(.35, .35, .35);
    var rib = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(P, true), 200, 7, 10, true), m);
    return rib;
  }
  // G-38: החולצה של הסטודיו חזרה להיות ברירת המחדל (הושעיה: "הקודם שלך היה יותר טוב"). הוולומטרית נשארת כ-buildShirtVolume לניסויים.
  function buildShirt() {
    var T = THREE, g = new T.Group(), B = SH_B, pp = 2, print = printCanvas(512, 512, 'יום הולדת שמח!', null, 0.84);
    [false, true].forEach(function (back) {
      var pts = shOutline(back), am = new T.CanvasTexture(shMask(pts, B, pp)), sign = back ? -1 : 1;
      var map = new T.CanvasTexture(shFabric(B, pp, back, back ? null : print)); if (T.sRGBEncoding) map.encoding = T.sRGBEncoding; map.anisotropy = 4;
      var geo = shGeom(pts, B, sign), out = back ? T.BackSide : T.FrontSide, inn = back ? T.FrontSide : T.BackSide;
      g.add(new T.Mesh(geo, shFabricMat(am, map, out, false)), new T.Mesh(geo, shFabricMat(am, null, inn, true)));
    });
    var cm = new T.Mesh(shCollar(B), new T.MeshPhysicalMaterial({ color: 0xF4F3EF, roughness: .95 })); cm.material.sheen = new T.Color(.35, .35, .35); g.add(cm);
    g.scale.setScalar(1 / 330);   // מ"מ → יחידות סצנה (חולצה ≈ 2.25 יח׳ גובה)
    var wrap = new T.Group(); wrap.add(g); return wrap;
  }

  function buildShirtVolume() {
    var T = THREE, g = new T.Group(), B = SH_B, pp = 2, print = printCanvas(512, 512, 'יום הולדת שמח!', null, 0.84);
    var nmap = knitNormalMap(), nmapB = knitNormalMap(), nmapS = knitNormalMap(), nmapS2 = knitNormalMap();
    var mapF = new T.CanvasTexture(shFabric(B, pp, false, print)), mapB = new T.CanvasTexture(shFabric(B, pp, true, null));
    [mapF, mapB].forEach(function (t) { if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; t.anisotropy = 4; });
    g.add(shBodyHalf(true, mapF, nmap)); g.add(shBodyHalf(false, mapB, nmapB));
    g.add(shSleeve(1, nmapS)); g.add(shSleeve(-1, nmapS2));
    g.add(shCollarRib());
    // הצד הפנימי של הגוף (רואים דרך הצוואר והשוליים): אותו גוף, צד אחורי, כהה
    [true, false].forEach(function (front) { var inner = shBodyHalf(front, null, null); inner.material = new T.MeshStandardMaterial({ color: 0xB9B5AE, roughness: .95, side: T.BackSide, vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1 }); g.add(inner); });
    g.scale.setScalar(1 / 400); g.position.y = 0.05;
    var wrap = new T.Group(); wrap.add(g); return wrap;
  }
  // G-37: חולצה מקובץ GLB (אם הושעיה הוריד אחת) — מנורמלת לגובה 2.2, ההדפסה מוקרנת על החזה כמדבקה (DecalGeometry)
  function buildShirtGlb() {
    var T = THREE, wrap = new T.Group();
    loadGltf().then(function () {
      new T.GLTFLoader().load(GLB_SHIRT, function (gl) {
        var o = gl.scene, box = new T.Box3().setFromObject(o), size = new T.Vector3(); box.getSize(size); var c = new T.Vector3(); box.getCenter(c);
        var s = 2.2 / Math.max(size.y, 0.001); o.position.sub(c); o.scale.setScalar(s); var inner = new T.Group(); inner.add(o); wrap.add(inner);
        var big = null; o.traverse(function (m) { if (m.isMesh) { if (m.material) { m.material.side = T.DoubleSide; if (m.material.map && T.sRGBEncoding) m.material.map.encoding = T.sRGBEncoding; } if (!big || m.geometry.attributes.position.count > big.geometry.attributes.position.count) big = m; } });
        if (big && T.DecalGeometry) {
          inner.updateMatrixWorld(true);
          var bb = new T.Box3().setFromObject(inner), ctr = new T.Vector3(); bb.getCenter(ctr);
          var p = new T.Vector3(ctr.x, ctr.y + 0.15, bb.max.z + 0.2), or = new T.Euler(0, 0, 0), sz = new T.Vector3(1.0, 1.0, 0.6);
          var dm = new T.Mesh(new T.DecalGeometry(big, p, or, sz), new T.MeshStandardMaterial({ map: tex(printCanvas(512, 512, 'יום הולדת שמח!', null, 0.84)), transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: .9 }));
          wrap.add(dm);
        }
      }, undefined, function (e) { console.warn('shirt.glb', e); });
    }).catch(function (e) { console.warn('gltf', e); });
    return wrap;
  }

  /* ── הספל ── */
  function buildMug() {
    var T = THREE, g = new T.Group();
    var pc = printCanvas(1024, 440, 'באהבה', '#ffffff');
    var t = tex(pc); t.wrapS = T.RepeatWrapping; t.offset.x = 0.5;   // ההדפסה מול המצלמה, הידית ימינה
    var R = 0.62, H = 1.4;
    var white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    g.add(new T.Mesh(new T.CylinderGeometry(R, R, H, 64, 1, true), new T.MeshStandardMaterial({ map: t, roughness: 0.25 })));
    var bottom = new T.Mesh(new T.CircleGeometry(R, 48), white); bottom.rotation.x = Math.PI / 2; bottom.position.y = -H / 2; g.add(bottom);
    var inner = new T.Mesh(new T.CylinderGeometry(R * 0.92, R * 0.92, H * 0.96, 64, 1, true), new T.MeshStandardMaterial({ color: 0xEDEBE7, roughness: .4, side: T.BackSide }));
    inner.position.y = H * 0.02; g.add(inner);
    var rim = new T.Mesh(new T.TorusGeometry(R * 0.96, R * 0.04, 10, 64), white); rim.rotation.x = Math.PI / 2; rim.position.y = H / 2; g.add(rim);
    var handle = new T.Mesh(new T.TorusGeometry(0.34, 0.085, 16, 40, Math.PI * 1.15), white);
    handle.rotation.z = -Math.PI * 0.575; handle.position.set(R + 0.13, 0.02, 0); handle.scale.set(0.8, 1, 1); g.add(handle);
    var wrap = new T.Group(); wrap.add(g); return wrap;
  }

  /* ── פאזל עץ: לוח עבה עם התמונה וקווי החלקים ── */
  function buildPuzzle() {
    var T = THREE, g = new T.Group();
    var c = printCanvas(1024, 768, 'המשפחה שלנו', '#FFF7E6', 0.9), x = c.getContext('2d');
    x.strokeStyle = 'rgba(70,45,20,.55)'; x.lineWidth = 4;
    for (var i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * 256, 0); x.lineTo(i * 256, 768); x.stroke(); }
    for (var j = 1; j < 3; j++) { x.beginPath(); x.moveTo(0, j * 256); x.lineTo(1024, j * 256); x.stroke(); }
    // "אוזניים" של פאזל על הקווים
    x.fillStyle = 'rgba(70,45,20,.35)';
    for (var a = 1; a < 4; a++) for (var b = 0; b < 3; b++) { x.beginPath(); x.arc(a * 256, b * 256 + 128, 22, 0, Math.PI * 2); x.fill(); }
    for (var a2 = 0; a2 < 4; a2++) for (var b2 = 1; b2 < 3; b2++) { x.beginPath(); x.arc(a2 * 256 + 128, b2 * 256, 22, 0, Math.PI * 2); x.fill(); }
    var W = 1.9, Hh = 1.42, D = 0.1;
    var wood = new T.MeshStandardMaterial({ color: 0xD9B98A, roughness: .8 });
    var mats = [wood, wood, wood, wood, new T.MeshStandardMaterial({ map: tex(c), roughness: .6 }), wood];
    var board = new T.Mesh(new T.BoxGeometry(W, Hh, D), mats); g.add(board);
    g.rotation.x = -0.35;
    return g;
  }

  /* ── משחקים מודפסים (G-32): פרצופים מצוירים במקום תמונות לקוח ── */
  var FACES = [['#F9D5B5', '#4B2E1E', '#F43F5E'], ['#E8B894', '#1F1A17', '#3B82F6'], ['#FBE3C8', '#C2743C', '#22C55E'], ['#D9A078', '#0F0A08', '#F59E0B'], ['#F6CFB0', '#7A4A21', '#A855F7'], ['#EFC39F', '#2B1B10', '#06B6D4']];
  function face(x, cx, cy, r, i) {
    var f = FACES[i % FACES.length];
    x.fillStyle = f[2]; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();          // רקע צבעוני
    x.fillStyle = f[1]; x.beginPath(); x.arc(cx, cy - r * .12, r * .62, 0, Math.PI * 2); x.fill();   // שיער
    x.fillStyle = f[0]; x.beginPath(); x.ellipse(cx, cy + r * .05, r * .5, r * .58, 0, 0, Math.PI * 2); x.fill();  // פנים
    x.fillStyle = f[1]; x.beginPath(); x.arc(cx, cy - r * .3, r * .5, Math.PI, 0); x.fill();   // פוני
    x.fillStyle = '#1F1A17'; x.beginPath(); x.arc(cx - r * .18, cy, r * .06, 0, Math.PI * 2); x.arc(cx + r * .18, cy, r * .06, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#1F1A17'; x.lineWidth = r * .05; x.beginPath(); x.arc(cx, cy + r * .12, r * .22, .15 * Math.PI, .85 * Math.PI); x.stroke();
  }
  function cardCanvas(i, letter) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 720; var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 720); x.strokeStyle = '#1E1B4B'; x.lineWidth = 10; x.strokeRect(24, 24, 464, 672);
    face(x, 256, 330, 170, i);
    x.fillStyle = ['#DC2626', '#1F1A17'][i % 2]; x.font = '900 96px Heebo, Arial, sans-serif'; x.textAlign = 'left'; x.fillText(letter, 48, 130);
    x.save(); x.translate(464, 600); x.rotate(Math.PI); x.fillText(letter, 0, 0); x.restore();
    return c;
  }
  function cardMesh(cv, w, h) {
    var T = THREE, white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5 });
    var back = document.createElement('canvas'); back.width = 256; back.height = 360; var bx = back.getContext('2d');
    bx.fillStyle = '#4338CA'; bx.fillRect(0, 0, 256, 360); bx.strokeStyle = 'rgba(255,255,255,.35)'; bx.lineWidth = 3;
    for (var i = -360; i < 360; i += 28) { bx.beginPath(); bx.moveTo(i, 0); bx.lineTo(i + 360, 360); bx.stroke(); bx.beginPath(); bx.moveTo(i + 360, 0); bx.lineTo(i, 360); bx.stroke(); }
    var mats = [white, white, white, white, new T.MeshStandardMaterial({ map: tex(cv), roughness: .5 }), new T.MeshStandardMaterial({ map: tex(back), roughness: .6 })];
    return new T.Mesh(new T.BoxGeometry(w, h, 0.02), mats);
  }
  function buildCards() {   // מניפה של 5 קלפים
    var T = THREE, g = new T.Group(), L = ['A', 'K', 'Q', 'J', '10'];
    for (var i = 0; i < 5; i++) {
      var m = cardMesh(cardCanvas(i, L[i]), 0.95, 1.34), a = (i - 2) * 0.22;
      m.position.set(Math.sin(a) * 1.1, -1.1 + Math.cos(a) * 1.1 - 0.1, i * 0.022); m.rotation.z = -a; g.add(m);
    }
    g.position.y = 0.15; return g;
  }
  function buildMemory() {   // לוח 3×2 — שלושה פתוחים עם פרצופים, שלושה הפוכים
    var T = THREE, g = new T.Group(), W = 0.62, gap = 0.08;
    var back = document.createElement('canvas'); back.width = 256; back.height = 256; var bx = back.getContext('2d');
    bx.fillStyle = '#7C3AED'; bx.fillRect(0, 0, 256, 256); bx.fillStyle = 'rgba(255,255,255,.9)'; bx.font = '900 150px Arial'; bx.textAlign = 'center'; bx.fillText('?', 128, 182);
    var bt = tex(back), white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .5 });
    for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
      var i = r * 3 + c, open = (i % 2 === 0), fc = document.createElement('canvas'); fc.width = 256; fc.height = 256; var fx = fc.getContext('2d');
      fx.fillStyle = '#fff'; fx.fillRect(0, 0, 256, 256); face(fx, 128, 128, 100, i >> 1);
      var mats = [white, white, white, white, new T.MeshStandardMaterial({ map: open ? tex(fc) : bt, roughness: .5 }), white];
      var m = new T.Mesh(new T.BoxGeometry(W, W, 0.05), mats);
      m.position.set((c - 1) * (W + gap), (0.5 - r) * (W + gap), 0); g.add(m);
    }
    g.rotation.x = -0.45; g.position.y = 0.1; return g;
  }
  function buildDomino() {   // שלוש אבני עץ, פרצופים בשני הצדדים
    var T = THREE, g = new T.Group(), wood = new T.MeshStandardMaterial({ color: 0xE9D5B5, roughness: .75 });
    for (var i = 0; i < 3; i++) {
      var c = document.createElement('canvas'); c.width = 256; c.height = 512; var x = c.getContext('2d');
      x.fillStyle = '#F8EEDC'; x.fillRect(0, 0, 256, 512); face(x, 128, 128, 100, i); face(x, 128, 384, 100, i + 2);
      x.strokeStyle = '#8B5E34'; x.lineWidth = 8; x.beginPath(); x.moveTo(20, 256); x.lineTo(236, 256); x.stroke();
      var mats = [wood, wood, wood, wood, new T.MeshStandardMaterial({ map: tex(c), roughness: .6 }), wood];
      var m = new T.Mesh(new T.BoxGeometry(0.62, 1.24, 0.12), mats);
      m.position.set((i - 1) * 0.78, (i === 1 ? 0.08 : -0.02), 0); m.rotation.z = (i - 1) * 0.12; g.add(m);
    }
    g.rotation.x = -0.25; return g;
  }
  function buildLudo() {   // לוח "אל תכעס" עם 4 חיילים עם פרצופים
    var T = THREE, g = new T.Group();
    var c = document.createElement('canvas'); c.width = 512; c.height = 512; var x = c.getContext('2d');
    x.fillStyle = '#FFFDF7'; x.fillRect(0, 0, 512, 512);
    var cols = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B'];
    [[0, 0], [304, 0], [0, 304], [304, 304]].forEach(function (q, i) { x.fillStyle = cols[i]; x.fillRect(q[0], q[1], 208, 208); x.fillStyle = '#fff'; x.beginPath(); x.arc(q[0] + 104, q[1] + 104, 70, 0, Math.PI * 2); x.fill(); });
    x.fillStyle = '#E5E7EB'; for (var i = 0; i < 11; i++) { x.fillRect(208 + i * 0, 0, 0, 0); }
    x.strokeStyle = '#9CA3AF'; x.lineWidth = 3;
    for (var k = 0; k < 6; k++) { x.strokeRect(208, 16 + k * 32, 96, 32); x.strokeRect(208, 304 + k * 32, 96, 32); x.strokeRect(16 + k * 32, 208, 32, 96); x.strokeRect(304 + k * 32, 208, 32, 96); }
    x.fillStyle = '#1E1B4B'; x.font = '900 60px Arial'; x.textAlign = 'center'; x.fillText('★', 256, 278);
    var board = new T.Mesh(new T.BoxGeometry(2, 2, 0.08), [0, 1, 2, 3].map(function () { return new T.MeshStandardMaterial({ color: 0xE5E7EB, roughness: .7 }); }).concat([new T.MeshStandardMaterial({ map: tex(c), roughness: .6 }), new T.MeshStandardMaterial({ color: 0xE5E7EB })]));
    board.rotation.x = -Math.PI / 2 + 0.55; g.add(board);
    [[-0.7, 0.7, 0], [0.7, 0.7, 1], [-0.7, -0.7, 2], [0.7, -0.7, 3]].forEach(function (q) {
      var fc = document.createElement('canvas'); fc.width = 128; fc.height = 128; var fx = fc.getContext('2d'); fx.fillStyle = '#fff'; fx.fillRect(0, 0, 128, 128); face(fx, 64, 64, 56, q[2]);
      var pawn = new T.Group();
      pawn.add(new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 0.12, 32), new T.MeshStandardMaterial({ color: cols[q[2]], roughness: .5 })));
      var head = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.04, 32), new T.MeshStandardMaterial({ color: 0xffffff }));
      var pic = new T.Mesh(new T.CircleGeometry(0.19, 32), new T.MeshStandardMaterial({ map: tex(fc), roughness: .6 }));
      head.position.y = 0.33; head.rotation.x = Math.PI / 2; pic.position.set(0, 0.33, 0.022); head.add(pic);
      pic.rotation.x = -Math.PI / 2; pawn.add(head);
      var v = new T.Vector3(q[0], q[1], 0.06); board.localToWorld(v); pawn.position.copy(v); pawn.rotation.x = board.rotation.x + Math.PI / 2; g.add(pawn);
    });
    g.position.y = -0.1; return g;
  }
  function buildTangram() {   // ריבוע עץ עם תמונה ו-7 חלקי טנגרם
    var T = THREE, g = new T.Group(), c = printCanvas(768, 768, 'המשפחה', '#FFF7E6', 0.92), x = c.getContext('2d');
    x.strokeStyle = '#5B3A1E'; x.lineWidth = 7; x.lineCap = 'round';
    [[0, 0, 768, 768], [0, 768, 384, 384], [384, 384, 768, 0], [192, 576, 576, 576], [384, 768, 576, 576], [576, 576, 768, 384]].forEach(function (l) { x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.stroke(); });
    var wood = new T.MeshStandardMaterial({ color: 0xD9B98A, roughness: .8 });
    g.add(new T.Mesh(new T.BoxGeometry(1.7, 1.7, 0.1), [wood, wood, wood, wood, new T.MeshStandardMaterial({ map: tex(c), roughness: .6 }), wood]));
    g.rotation.x = -0.35; return g;
  }
  function buildDice() {   // קובייה עם פרצוף על כל פאה
    var T = THREE, mats = [];
    for (var i = 0; i < 6; i++) { var c = document.createElement('canvas'); c.width = 256; c.height = 256; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); face(x, 128, 128, 96, i); mats.push(new T.MeshStandardMaterial({ map: tex(c), roughness: .45 })); }
    var geo = new T.BoxGeometry(1.25, 1.25, 1.25), g = new T.Group(), m = new T.Mesh(geo, mats);
    m.rotation.set(0.5, 0.65, 0); g.add(m); return g;
  }

  function buildSnakes() {   // G-37: לוח סולמות וחבלים (ג׳ונגל) עם שני חיילים וקובייה — התמונה מהמחולל עצמו
    var T = THREE, g = new T.Group(), loader = new T.TextureLoader();
    var top = new T.MeshStandardMaterial({ color: 0xDDEFD6, roughness: .6 });
    loader.load('../images/games/snakes-board.webp', function (t) { if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; t.anisotropy = 4; top.map = t; top.color.set(0xffffff); top.needsUpdate = true; });
    var side = new T.MeshStandardMaterial({ color: 0xE5E7EB, roughness: .7 });
    var board = new T.Mesh(new T.BoxGeometry(2.1, 2.1, 0.08), [side, side, side, side, top, side]);
    board.rotation.x = -Math.PI / 2 + 0.55; g.add(board);
    var cols = [0xEF4444, 0x3B82F6];
    [[-0.65, -0.75, 0], [0.45, -0.3, 1]].forEach(function (q) {
      var pawn = new T.Group();
      pawn.add(new T.Mesh(new T.CylinderGeometry(0.11, 0.15, 0.1, 24), new T.MeshStandardMaterial({ color: cols[q[2]], roughness: .5 })));
      var body = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 0.22, 24), new T.MeshStandardMaterial({ color: cols[q[2]], roughness: .5 })); body.position.y = 0.15; pawn.add(body);
      var head = new T.Mesh(new T.SphereGeometry(0.09, 24, 16), new T.MeshStandardMaterial({ color: cols[q[2]], roughness: .45 })); head.position.y = 0.33; pawn.add(head);
      var v = new T.Vector3(q[0], q[1], 0.06); board.localToWorld(v); pawn.position.copy(v); pawn.rotation.x = board.rotation.x + Math.PI / 2; g.add(pawn);
    });
    // קובייה קטנה ליד הלוח
    var dc = document.createElement('canvas'); dc.width = 128; dc.height = 128; var dx = dc.getContext('2d'); dx.fillStyle = '#fff'; dx.fillRect(0, 0, 128, 128); dx.fillStyle = '#14294D';
    [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]].forEach(function (p) { dx.beginPath(); dx.arc(p[0], p[1], 11, 0, Math.PI * 2); dx.fill(); });
    var die = new T.Mesh(new T.BoxGeometry(0.26, 0.26, 0.26), new T.MeshStandardMaterial({ map: tex(dc), roughness: .4 }));
    var dv = new T.Vector3(0.85, -0.95, 0.2); board.localToWorld(dv); die.position.copy(dv); die.rotation.set(0.3, 0.6, 0.1); g.add(die);
    g.position.y = -0.1; return g;
  }
  var BUILD = { shirt: buildShirt, 'shirt-volume': buildShirtVolume, 'shirt-glb': buildShirtGlb, mug: buildMug, puzzle: buildPuzzle, cards: buildCards, memory: buildMemory, domino: buildDomino, ludo: buildLudo, snakes: buildSnakes, tangram: buildTangram, dice: buildDice };
  // G-35: מודלים נוספים נרשמים מבחוץ (js/zikit-3d.js — המוצרים מההזמנה מזיקית). register(key, fn) לפני שהבמה נטענת.
  window.S3D = { register: function (k, fn) { BUILD[k] = fn; }, printCanvas: printCanvas, tex: tex, face: face, balloon: balloon, has: function (k) { return !!BUILD[k]; }, build: function (k) { return BUILD[k](); } };

  function mount(stage) {
    var keys = (stage.getAttribute('data-items') || '').split(',').map(function (k) { return k.trim(); }).filter(function (k) { return BUILD[k]; });
    var names = (stage.getAttribute('data-names') || '').split(',');
    var links = (stage.getAttribute('data-links') || '').split(',');
    if (!keys.length) return;
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    loadThree().then(function () {
      var T = THREE, r;
      try { r = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      if (T.sRGBEncoding) r.outputEncoding = T.sRGBEncoding;
      if (T.ACESFilmicToneMapping) { r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; }
      var wrap = document.createElement('div'); wrap.className = 's3d';
      var cv = r.domElement; cv.setAttribute('role', 'img'); wrap.appendChild(cv);
      var cap = document.createElement('a'); cap.className = 's3d-cap'; wrap.appendChild(cap);
      var nav = document.createElement('div'); nav.className = 's3d-nav';
      var N = keys.length, cur = 0;
      // G-31: בלי כפתור לכל מוצר — רק דפדוף (◀ ▶), השם והמחיר של המוצר שמקדימה בתגית, ולחיצה על המוצר פותחת אותו בסטודיו
      var prev = document.createElement('button'), next = document.createElement('button'), pause = document.createElement('button');
      prev.type = next.type = pause.type = 'button';
      prev.className = 's3d-arrow'; next.className = 's3d-arrow'; pause.className = 's3d-pause';
      prev.textContent = '‹'; next.textContent = '›'; prev.setAttribute('aria-label', 'המוצר הקודם'); next.setAttribute('aria-label', 'המוצר הבא');
      prev.addEventListener('click', function () { go(cur - 1, true); }); next.addEventListener('click', function () { go(cur + 1, true); });
      var dots = document.createElement('div'); dots.className = 's3d-dots'; dots.setAttribute('aria-hidden', 'true');
      var dotEls = keys.map(function () { var d = document.createElement('i'); dots.appendChild(d); return d; });
      nav.appendChild(next); nav.appendChild(dots); nav.appendChild(prev); nav.appendChild(pause);   // RTL: ▶ מימין
      // G-35: מעגל "וירטואלי" — תמיד עד 7 מקומות על המעגל; ברשימה ארוכה רואים רק את השכנים של המוצר שמקדימה, והשאר ממתינים מאחור.
      var SLOTS = Math.min(N, 7), STEP = Math.PI * 2 / SLOTS, RAD = N > 1 ? 2.4 + 0.35 * (SLOTS - 3) : 0;
      var scene = new T.Scene(), cam = new T.PerspectiveCamera(28, 1, 0.1, 60);
      cam.position.set(0, 1.0, RAD + 7.8); cam.lookAt(0, -0.1, RAD * 0.25);
      // G-37: תאורת סטודיו (RoomEnvironment → PMREM) — השתקפויות רכות על בד, קרמיקה ומתכת; האורות הישירים נשארים לצל ולברק
      try { var pm = new T.PMREMGenerator(r); pm.compileEquirectangularShader(); scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; pm.dispose(); } catch (e) { console.warn('env', e); }
      scene.add(new T.HemisphereLight(0xffffff, 0x8a7f70, 0.2));
      var d1 = new T.DirectionalLight(0xffffff, 1.05); d1.position.set(-4, 4, 3); scene.add(d1);
      var d2 = new T.DirectionalLight(0xfff1e0, 0.25); d2.position.set(3.5, 0.8, -2.5); scene.add(d2);
      var d3 = new T.DirectionalLight(0xe8f0ff, 0.2); d3.position.set(3.5, -0.5, 3); scene.add(d3);
      var ring = new T.Group(); scene.add(ring);
      var items = keys.map(function (k) {
        var holder = new T.Group(), o;
        try { o = BUILD[k](); } catch (e) { console.warn('showcase-3d build', k, e); o = new T.Group(); }
        holder.add(o); holder.visible = false; ring.add(holder); return { h: holder, o: o };
      });
      ring.traverse(function (m) { if (m.isMesh && m.material && 'envMapIntensity' in m.material) m.material.envMapIntensity = 0.4; });
      var disc = new T.Mesh(new T.CircleGeometry(RAD + 0.9, 64), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.045 }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = -1.25; scene.add(disc);
      // pos = "איפה המעגל עומד" במספרים של מוצרים (0 = הראשון מקדימה). target = לאן זורמים. המוצר i יושב בזווית (i - pos) * STEP.
      var auto = !reduced, drag = null, target = 0, pos = 0, nextAt = performance.now() + 5000, dragged = false;
      function label() {
        dotEls.forEach(function (d, i) { d.className = i === cur ? 'on' : ''; });
        cv.setAttribute('aria-label', 'תלת־ממד מסתובב: ' + (names[cur] || keys[cur]) + ' — לחיצה פותחת את העיצוב');
        cap.textContent = (names[cur] || keys[cur]) + ' · לעיצוב ←'; cap.href = links[cur] || '#';
        pause.textContent = auto ? '⏸' : '▶'; pause.setAttribute('aria-label', auto ? 'עצירת הסיבוב' : 'הפעלת הסיבוב');
      }
      pause.addEventListener('click', function () { auto = !auto; nextAt = performance.now() + 5000; label(); });
      function go(i, user) {
        cur = ((i % N) + N) % N;
        var k = Math.round((target - cur) / N); target = cur + k * N;   // בדרך הקצרה (המעגל סגור)
        if (user) nextAt = performance.now() + 9000;
        label();
      }
      label();
      cv.style.touchAction = 'pan-y';
      cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, p: pos }; dragged = false; nextAt = performance.now() + 9000; });
      window.addEventListener('pointermove', function (e) { if (drag) { pos = drag.p - (e.clientX - drag.x) * 0.008 / STEP; target = pos; if (Math.abs(e.clientX - drag.x) > 6) dragged = true; } });
      window.addEventListener('pointerup', function () { if (!drag) return; drag = null; go(Math.round(pos), true); });
      cap.addEventListener('click', function (e) { if (dragged) e.preventDefault(); });
      cv.style.cursor = 'pointer';
      cv.addEventListener('click', function () { if (!dragged && links[cur]) location.href = links[cur]; });   // לחיצה על המוצר = פותחים אותו בסטודיו
      function size() {
        var w = wrap.clientWidth || 300, h = wrap.clientHeight || 240;
        r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
        cam.position.z = RAD + (w < 420 ? 8.8 : 7.8); cam.lookAt(0, -0.1, RAD * 0.25);
      }
      var shown = false;
      function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden || !wrap.offsetParent) return;
        if (!shown) { shown = true; stage.classList.add('has-3d'); size(); }
        if (auto && !drag && now > nextAt && N > 1) { go(cur + 1); nextAt = now + 5000; }
        var dt = Math.min(100, now - (frame.last || now)); frame.last = now;
        if (!drag) pos += (target - pos) * (1 - Math.exp(-dt / 220));   // לפי זמן, לא לפי פריימים — אותה מהירות בכל טלפון
        items.forEach(function (it, i) {
          var d = i - pos; d = d - Math.round(d / N) * N;              // מרחק מהחזית במספרי מוצרים, בדרך הקצרה
          var ang = d * STEP, vis = N <= SLOTS || Math.abs(d) <= SLOTS / 2;
          it.h.visible = vis; if (!vis) return;
          var front = (Math.cos(ang) + 1) / 2;                           // 1 מקדימה, 0 מאחור
          it.h.position.set(Math.sin(ang) * RAD, -0.2 + 0.2 * front + Math.sin(now / 900 + i) * 0.04, Math.cos(ang) * RAD);
          var s = 0.5 + (0.6 + (SLOTS > 4 ? 0.3 : 0)) * front;
          it.h.scale.setScalar(s);
          it.h.rotation.y = (N === 1 ? -pos * STEP : 0) + (i === cur && !drag ? Math.sin(now / 1400) * 0.55 : 0);   // פונה למצלמה, ומתנדנד קלות; מוצר יחיד — הגרירה מסובבת אותו
        });
        r.render(scene, cam);
      }
      stage.appendChild(wrap); stage.appendChild(nav);
      window.addEventListener('resize', size);
      requestAnimationFrame(frame);
    }).catch(function (e) { console.warn('showcase-3d', e); });
  }

  function init() {
    var stages = document.querySelectorAll('[data-3d-stage]');
    if (!stages.length) return;
    // G-37: יש קובץ חולצה? נכנס לקרוסלה מיד אחרי החולצה שבקוד — להשוואה
    fetch('../images/games/zikit/models.json').then(function (res) { return res.ok ? res.json() : {}; }).then(function (mf) { if (!mf || !mf.shirt) return;   // models.json: {"shirt": true} כשהקובץ shirt.glb קיים
      stages.forEach(function (st) { var it = (st.getAttribute('data-items') || '').split(','), nm = (st.getAttribute('data-names') || '').split(','), lk = (st.getAttribute('data-links') || '').split(','), i = it.indexOf('shirt');
        if (i < 0 || it.indexOf('shirt-glb') >= 0) return; it.splice(i + 1, 0, 'shirt-glb'); nm.splice(i + 1, 0, '👕 חולצה (קובץ מוכן)'); lk.splice(i + 1, 0, lk[i] || '');
        st.setAttribute('data-items', it.join(',')); st.setAttribute('data-names', nm.join(',')); st.setAttribute('data-links', lk.join(',')); });
    }).catch(function () {});
    var start = function (st) { if (!st._s3d) { st._s3d = 1; mount(st); } };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { start(e.target); io.unobserve(e.target); } }); });
      stages.forEach(function (s) { io.observe(s); });
    } else stages.forEach(start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
