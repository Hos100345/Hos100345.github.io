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
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    return threeP || (threeP = new Promise(function (ok, no) {
      var s = document.createElement('script');
      var t = setTimeout(function () { no(new Error('three timeout')); }, 15000);
      s.src = THREE_SRC;
      s.onload = function () { clearTimeout(t); ok(); };
      s.onerror = function () { clearTimeout(t); no(new Error('three load')); };
      document.head.appendChild(s);
    }));
  }

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

  /* ── החולצה ──
   * קו המתאר = הנקודות של shOutline בסטודיו (שרוול קצר), ביחידות מ"מ של חולצה L. הצד השמאלי = שיקוף.
   * הבד: רשת מישורית, כל נקודה מורמת לפי המרחק מהשפה (חזית קדימה, גב אחורה) + גלים עדינים = קפלים; צבע קודקוד מחשיך בעמקים.
   */
  var SH_OUT = (function () {
    var R = [], NECK = { half: 95, front: 85 };
    for (var i = 0; i <= 10; i++) { var t = i / 10 * Math.PI / 2; R.push([NECK.half * Math.sin(t), NECK.front * Math.cos(t)]); }
    R.push([235, 38], [395, 205], [318, 290], [290, 262], [268, 252], [264, 300], [268, 720]);
    for (var j = 1; j < 10; j++) { var u = j / 10; R.push([268 * (1 - u), 720 + 8 * Math.sin(u * Math.PI / 2)]); }
    R.push([0, 728]);
    var pts = R.slice();
    for (var k = R.length - 2; k > 0; k--) pts.push([-R[k][0], R[k][1]]);
    return pts;
  })();
  function pip(p, poly) {  // point in polygon
    var x = p[0], y = p[1], inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segD(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]; return Math.sqrt(x * x + y * y);
  }
  function edgeD(p, poly) { var d = 1e9; for (var i = 0; i < poly.length; i++) { var q = segD(p, poly[i], poly[(i + 1) % poly.length]); if (q < d) d = q; } return d; }

  function shirtSide(sign, decalTex) {
    var T = THREE, S = 1 / 420;                       // מ"מ → יחידות סצנה (חולצה ≈ 2.4 יח׳ גובה)
    var X0 = -400, X1 = 400, Y0 = -10, Y1 = 740, step = 9;
    var nx = Math.round((X1 - X0) / step), ny = Math.round((Y1 - Y0) / step);
    var g = new T.PlaneGeometry((X1 - X0) * S, (Y1 - Y0) * S, nx, ny), P = g.attributes.position, W = nx + 1;
    var Z = new Float32Array(P.count), IN = new Uint8Array(P.count), cy = (Y0 + Y1) / 2;
    for (var i = 0; i < P.count; i++) {
      var X = P.getX(i) / S, Y = -P.getY(i) / S + cy, p = [X, Y];
      var inside = pip(p, SH_OUT); IN[i] = inside ? 1 : 0;
      var d = edgeD(p, SH_OUT), ax = Math.abs(X);
      // ניפוח: עולה מהר ליד השפה ונשאר שטוח באמצע; הגוף עבה יותר מהשרוולים
      var body = ax < 268 && Y > 40 ? 1 : 0.62;
      var z = inside ? 60 * body * (1 - Math.exp(-d / 48)) : 0;
      // קפלים רכים: גלים אנכיים קלים בגוף + קמט מתחת לבית השחי
      if (inside) {
        z += 4 * Math.sin(X / 70) * Math.sin(Y / 150) * (Y > 120 && ax < 240 ? 1 : 0);
        z -= 10 * Math.exp(-(((ax - 262) / 34) * ((ax - 262) / 34) + ((Y - 258) / 40) * ((Y - 258) / 40)));
      }
      Z[i] = z; P.setZ(i, sign * z * S);
    }
    // הצללה בעמקים (AO) + צל צווארון; מחוץ לחולצה — שקוף דרך alphaMap
    var col = new Float32Array(P.count * 3);
    for (var j = 0; j <= ny; j++) for (var ii = 0; ii <= nx; ii++) {
      var n = j * W + ii, z = Z[n], l = Z[j * W + Math.max(0, ii - 1)], r = Z[j * W + Math.min(nx, ii + 1)], u = Z[Math.max(0, j - 1) * W + ii], dn = Z[Math.min(ny, j + 1) * W + ii];
      var lap = (l + r + u + dn) / 4 - z, a = 1 - Math.max(0, Math.min(.3, lap * .06));
      var Xn = P.getX(n) / S, Yn = -P.getY(n) / S + cy, axn = Math.abs(Xn);
      a -= .07 * Math.exp(-(((Yn - 85 * (1 - (axn / 95) * (axn / 95))) / 14) * ((Yn - 85 * (1 - (axn / 95) * (axn / 95))) / 14))) * (axn < 100 ? 1 : 0);
      col[n * 3] = col[n * 3 + 1] = col[n * 3 + 2] = Math.max(.6, a);
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    // מסכת צורה (alphaMap) — מצוירת מהמתאר, רזולוציה גבוהה כדי שהשפה תהיה חדה
    var mc = document.createElement('canvas'); mc.width = 1024; mc.height = 1024; var mx = mc.getContext('2d');
    mx.fillStyle = '#000'; mx.fillRect(0, 0, 1024, 1024); mx.fillStyle = '#fff'; mx.beginPath();
    SH_OUT.forEach(function (q, k) { var px = (q[0] - X0) / (X1 - X0) * 1024, py = (q[1] - Y0) / (Y1 - Y0) * 1024; k ? mx.lineTo(px, py) : mx.moveTo(px, py); });
    mx.closePath(); mx.fill();
    var am = new T.CanvasTexture(mc);
    var mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0, vertexColors: true, alphaMap: am, alphaTest: 0.5, side: sign > 0 ? T.FrontSide : T.BackSide });
    var m = new T.Mesh(g, mat);
    if (decalTex) {
      // ההדפסה: אותה רשת (כדי שתעקוב אחרי הקפלים), חתוכה למלבן ההדפסה, קצת מעל הבד
      var dg = g.clone(), dp = dg.attributes.position, uv = dg.attributes.uv;
      var DX0 = -150, DX1 = 150, DY0 = 150, DY1 = 450;
      for (var q = 0; q < dp.count; q++) {
        var Xq = dp.getX(q) / S, Yq = -dp.getY(q) / S + cy;
        dp.setZ(q, dp.getZ(q) + sign * 1.2 * S);
        uv.setXY(q, (Xq - DX0) / (DX1 - DX0), 1 - (Yq - DY0) / (DY1 - DY0));
      }
      decalTex.wrapS = decalTex.wrapT = T.ClampToEdgeWrapping;
      var dm = new T.Mesh(dg, new T.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: .95, vertexColors: true, alphaTest: .02, side: sign > 0 ? T.FrontSide : T.BackSide, polygonOffset: true, polygonOffsetFactor: -2 }));
      var grp = new T.Group(); grp.add(m); grp.add(dm); return grp;
    }
    return m;
  }
  function buildShirt() {
    var T = THREE, g = new T.Group();
    var pc = printCanvas(512, 512, 'יום הולדת שמח!', null, 0.84);
    // ה-UV של ההדפסה הוא רק המלבן — מחוץ לו הטקסטורה חייבת להיות שקופה
    var tx = tex(pc);
    g.add(shirtSide(1, tx));
    g.add(shirtSide(-1, null));
    // צווארון ריב: טורוס שטוח לאורך הפתח, מעט בולט לפנים ולאחור
    var collar = new T.Mesh(new T.TorusGeometry(0.23, 0.03, 10, 48, Math.PI), new T.MeshStandardMaterial({ color: 0xF3F4F6, roughness: .9 }));
    collar.rotation.z = Math.PI; collar.scale.set(1, 0.9, 1); collar.position.set(0, (370 - 85 + 20) / 420, 0.02); g.add(collar);
    g.position.y = -0.05;
    return g;
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

  var BUILD = { shirt: buildShirt, mug: buildMug, puzzle: buildPuzzle };

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
      var wrap = document.createElement('div'); wrap.className = 's3d';
      var cv = r.domElement; cv.setAttribute('role', 'img'); wrap.appendChild(cv);
      var cap = document.createElement('a'); cap.className = 's3d-cap'; wrap.appendChild(cap);
      var nav = document.createElement('div'); nav.className = 's3d-nav';
      var N = keys.length, cur = 0;
      var btns = keys.map(function (k, i) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = names[i] || k;
        b.addEventListener('click', function () { go(i, true); });
        nav.appendChild(b); return b;
      });
      var pause = document.createElement('button'); pause.type = 'button'; pause.className = 's3d-pause'; nav.appendChild(pause);
      var scene = new T.Scene(), cam = new T.PerspectiveCamera(28, 1, 0.1, 60);
      cam.position.set(0, 1.1, 11); cam.lookAt(0, -0.15, 0);
      scene.add(new T.HemisphereLight(0xffffff, 0xD6D0F0, 0.9));
      var d1 = new T.DirectionalLight(0xffffff, 0.8); d1.position.set(3, 5, 6); scene.add(d1);
      var d2 = new T.DirectionalLight(0xffffff, 0.3); d2.position.set(-4, 2, -3); scene.add(d2);
      // המעגל: כל מוצר על נקודה במעגל, המעגל עצמו מסתובב. "מקדימה" = הזווית 0 (מול המצלמה)
      var ring = new T.Group(); scene.add(ring);
      var RAD = N > 1 ? 2.4 : 0;
      var items = keys.map(function (k, i) {
        var holder = new T.Group(), o = BUILD[k]();
        holder.add(o);
        var ang = i / N * Math.PI * 2;
        holder.position.set(Math.sin(ang) * RAD, 0, Math.cos(ang) * RAD);
        ring.add(holder); return { h: holder, o: o, ang: ang };
      });
      // רצפה־צל עדינה
      var disc = new T.Mesh(new T.CircleGeometry(RAD + 0.9, 64), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.045 }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = -1.25; scene.add(disc);
      var auto = !reduced, drag = null, target = 0, rot = 0, nextAt = performance.now() + 5000, dragged = false;
      function label() {
        btns.forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur); });
        cv.setAttribute('aria-label', 'תלת־ממד מסתובב: ' + (names[cur] || keys[cur]));
        cap.textContent = names[cur] || keys[cur]; cap.href = links[cur] || '#';
        pause.textContent = auto ? '⏸' : '▶'; pause.setAttribute('aria-label', auto ? 'עצירת הסיבוב' : 'הפעלת הסיבוב');
      }
      pause.addEventListener('click', function () { auto = !auto; nextAt = performance.now() + 5000; label(); });
      function go(i, user) {
        cur = ((i % N) + N) % N;
        // הזווית שמביאה את המוצר i לחזית: סיבוב המעגל = -ang(i), בדרך הקצרה
        var want = -items[cur].ang, k = Math.round((target - want) / (Math.PI * 2));
        target = want + k * Math.PI * 2;
        if (user) nextAt = performance.now() + 9000;
        label();
      }
      label();
      cv.style.touchAction = 'pan-y';
      cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, r: rot }; dragged = false; nextAt = performance.now() + 9000; });
      window.addEventListener('pointermove', function (e) { if (drag) { rot = drag.r + (e.clientX - drag.x) * 0.008; target = rot; if (Math.abs(e.clientX - drag.x) > 6) dragged = true; } });
      window.addEventListener('pointerup', function () {
        if (!drag) return; drag = null;
        // בסוף הגרירה — נצמדים למוצר הקרוב ביותר לחזית
        var best = 0, bd = 1e9;
        items.forEach(function (it, i) { var a = ((it.ang + rot) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; if (Math.abs(a) < bd) { bd = Math.abs(a); best = i; } });
        go(best, true);
      });
      cap.addEventListener('click', function (e) { if (dragged) e.preventDefault(); });
      function size() {
        var w = wrap.clientWidth || 300, h = wrap.clientHeight || 240;
        r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
        cam.position.z = w < 420 ? 12.5 : 11; cam.lookAt(0, -0.15, 0);
      }
      var shown = false;
      function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden || !wrap.offsetParent) return;
        if (!shown) { shown = true; stage.classList.add('has-3d'); size(); }
        if (auto && !drag && now > nextAt && N > 1) { go(cur + 1); nextAt = now + 5000; }
        var dt = Math.min(100, now - (frame.last || now)); frame.last = now;
        if (!drag) rot += (target - rot) * (1 - Math.exp(-dt / 220));   // לפי זמן, לא לפי פריימים — אותה מהירות בכל טלפון
        ring.rotation.y = rot;
        items.forEach(function (it, i) {
          // המוצר שמקדימה: גדול, מסתובב סביב עצמו ומרחף; מאחור: קטן וכהה יותר
          var a = Math.cos(it.ang + rot), front = (a + 1) / 2;   // 1 מקדימה, 0 מאחור
          var s = 0.5 + 0.5 * front;
          it.h.scale.setScalar(s);
          it.h.position.y = -0.2 + 0.2 * front + Math.sin(now / 900 + i) * 0.04;
          it.h.rotation.y = -rot + (i === cur && !drag ? Math.sin(now / 1400) * 0.55 : 0);  // פונה למצלמה, ומתנדנד קלות
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
    var start = function (st) { if (!st._s3d) { st._s3d = 1; mount(st); } };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { start(e.target); io.unobserve(e.target); } }); });
      stages.forEach(function (s) { io.observe(s); });
    } else stages.forEach(start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
