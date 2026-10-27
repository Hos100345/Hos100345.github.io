/* showcase-3d.js — G-28: במה תלת־ממדית בעמוד המשחקים (games/index.html).
 * מוצרים מתחלפים ומסתובבים: חולצה, ספל… — כל מוצר = פונקציה ב-BUILD. מוצר חדש = שורה ב-BUILD + ב-data-items של הבמה.
 * three.js מקומי (../js/vendor/three-r128.min.js — לא CDN, בגלל הסינון), נטען רק כשהבמה נראית.
 * אם WebGL או הטעינה נכשלים — התמונה הסטטית שבבמה נשארת, בלי הודעה ובלי שבירה.
 * נגיש: כפתורי בחירה לכל מוצר, "עצירה" לסיבוב, ו-prefers-reduced-motion = בלי סיבוב אוטומטי.
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

  /* ── ציור ההדפסה (אותו סגנון כמו תמונות המוצרים באתר: בלונים צבעוניים + כיתוב) ── */
  function balloon(ctx, x, y, r, col) {
    ctx.strokeStyle = 'rgba(60,60,80,.55)'; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.moveTo(x, y + r * 1.15); ctx.bezierCurveTo(x - r * .3, y + r * 1.8, x + r * .3, y + r * 2.3, x, y + r * 3); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, r * .86, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * .14, y + r * 1.12); ctx.lineTo(x + r * .14, y + r * 1.12); ctx.lineTo(x, y + r * .96); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(x - r * .3, y - r * .38, r * .2, r * .32, -.5, 0, Math.PI * 2); ctx.fill();
  }
  function printCanvas(w, h, text, bg) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    var cx = w / 2, s = Math.min(w, h * 1.1) / 1000;
    var B = [[-120, 250, 95, '#F43F5E'], [40, 200, 105, '#F59E0B'], [170, 270, 90, '#3B82F6'], [-30, 330, 85, '#22C55E'], [95, 360, 80, '#A855F7']];
    B.forEach(function (b) { balloon(x, cx + b[0] * s, b[1] * s, b[2] * s, b[3]); });
    x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = '#1E1B4B';
    x.font = '900 ' + Math.round(86 * s) + 'px Heebo, Arial, sans-serif';
    x.fillText(text, cx, h * 0.86);
    return c;
  }
  function tex(c) { var T = THREE, t = new T.CanvasTexture(c); t.anisotropy = 4; if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; return t; }

  /* ── החולצה: צללית T מוחצנת עם שוליים מעוגלים (נראית "מנופחת" כמו בד), ההדפסה = מדבקה על החזית ── */
  function buildShirt() {
    var T = THREE, g = new T.Group();
    var S = new T.Shape();
    S.moveTo(-0.42, 1.1);                       // צווארון שמאל
    S.quadraticCurveTo(0, 0.86, 0.42, 1.1);     // קשת הצווארון
    S.lineTo(0.95, 0.98);                       // כתף ימין
    S.lineTo(1.55, 0.45);                       // קצה שרוול עליון
    S.lineTo(1.2, 0.12);                        // קצה שרוול תחתון
    S.lineTo(0.88, 0.36);                       // בית שחי
    S.lineTo(0.9, -1.25);                       // צד ימין
    S.quadraticCurveTo(0, -1.33, -0.9, -1.25);  // שוליים
    S.lineTo(-0.88, 0.36);
    S.lineTo(-1.2, 0.12);
    S.lineTo(-1.55, 0.45);
    S.lineTo(-0.95, 0.98);
    S.lineTo(-0.42, 1.1);
    var geo = new T.ExtrudeGeometry(S, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.07, bevelSegments: 8, curveSegments: 24 });
    geo.center();
    var cloth = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    g.add(new T.Mesh(geo, cloth));
    // צווארון פנימי כהה (נותן עומק לפתח)
    var neck = new T.Mesh(new T.TorusGeometry(0.36, 0.045, 10, 40, Math.PI), new T.MeshStandardMaterial({ color: 0xE5E7EB, roughness: .9 }));
    neck.rotation.z = Math.PI; neck.scale.set(1, 0.55, 1); neck.position.set(0, 1.0, 0.24); g.add(neck);
    var pc = printCanvas(512, 512, 'יום הולדת שמח!');
    var decal = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), new T.MeshStandardMaterial({ map: tex(pc), transparent: true, roughness: .95 }));
    decal.position.set(0, -0.12, 0.245); g.add(decal);
    g.scale.setScalar(0.92);
    return g;
  }

  /* ── הספל: גליל עם ההדפסה מסביב, פנים כהה, ידית ── */
  function buildMug() {
    var T = THREE, g = new T.Group();
    var pc = printCanvas(1024, 440, 'באהבה', '#ffffff');
    var t = tex(pc); t.wrapS = T.RepeatWrapping; t.offset.x = 0.25;   // ההדפסה מול המצלמה, הידית בצד
    var R = 0.9, H = 2;
    var side = new T.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0 });
    var white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    g.add(new T.Mesh(new T.CylinderGeometry(R, R, H, 64, 1, true), side));
    var bottom = new T.Mesh(new T.CircleGeometry(R, 48), white); bottom.rotation.x = Math.PI / 2; bottom.position.y = -H / 2; g.add(bottom);
    var inner = new T.Mesh(new T.CylinderGeometry(R * 0.92, R * 0.92, H * 0.96, 64, 1, true), new T.MeshStandardMaterial({ color: 0xEDEBE7, roughness: .4, side: T.BackSide }));
    inner.position.y = H * 0.02; g.add(inner);
    var rim = new T.Mesh(new T.TorusGeometry(R * 0.96, R * 0.04, 10, 64), white); rim.rotation.x = Math.PI / 2; rim.position.y = H / 2; g.add(rim);
    var handle = new T.Mesh(new T.TorusGeometry(0.48, 0.11, 16, 40, Math.PI * 1.15), white);
    handle.rotation.z = -Math.PI * 0.575; handle.position.set(R + 0.18, 0.02, 0); handle.scale.set(0.8, 1, 1);
    g.add(handle);
    g.rotation.y = -Math.PI / 2;   // הידית ימינה, ההדפסה מקדימה
    var wrap = new T.Group(); wrap.add(g); wrap.scale.setScalar(0.95);
    return wrap;
  }

  var BUILD = { shirt: buildShirt, mug: buildMug };

  function mount(stage) {
    var keys = (stage.getAttribute('data-items') || '').split(',').map(function (k) { return k.trim(); }).filter(function (k) { return BUILD[k]; });
    var names = (stage.getAttribute('data-names') || '').split(',');
    if (!keys.length) return;
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    loadThree().then(function () {
      var T = THREE, r;
      try { r = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      if (T.sRGBEncoding) r.outputEncoding = T.sRGBEncoding;
      var wrap = document.createElement('div'); wrap.className = 's3d';
      var cv = r.domElement; cv.setAttribute('role', 'img');
      wrap.appendChild(cv);
      var nav = document.createElement('div'); nav.className = 's3d-nav';
      var btns = keys.map(function (k, i) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = names[i] || k;
        b.addEventListener('click', function () { go(i, true); });
        nav.appendChild(b); return b;
      });
      var pause = document.createElement('button'); pause.type = 'button'; pause.className = 's3d-pause';
      nav.appendChild(pause);
      var scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
      cam.position.set(0, 0.35, 7.2); cam.lookAt(0, 0, 0);
      scene.add(new T.HemisphereLight(0xffffff, 0xC9C3E6, 0.85));
      var d1 = new T.DirectionalLight(0xffffff, 0.75); d1.position.set(3, 4, 5); scene.add(d1);
      var d2 = new T.DirectionalLight(0xffffff, 0.3); d2.position.set(-4, 1, -3); scene.add(d2);
      var objs = keys.map(function (k) { var o = BUILD[k](); o.visible = false; scene.add(o); return o; });
      var cur = 0, t0 = performance.now(), spin = 0, auto = !reduced, drag = null, nextAt = t0 + 6000, swap = null;
      function label() {
        btns.forEach(function (b, i) { b.setAttribute('aria-pressed', i === cur); });
        cv.setAttribute('aria-label', 'תלת־ממד מסתובב: ' + (names[cur] || keys[cur]));
        pause.textContent = auto ? '⏸' : '▶'; pause.setAttribute('aria-label', auto ? 'עצירת הסיבוב' : 'הפעלת הסיבוב');
      }
      pause.addEventListener('click', function () { auto = !auto; nextAt = performance.now() + 6000; label(); });
      function go(i, user) {
        if (i === cur && !swap) return;
        swap = { from: cur, to: i, t: performance.now() };
        if (user) { nextAt = performance.now() + 9000; }
        cur = i; label();
      }
      objs[0].visible = true; label();
      // גרירה = סיבוב ידני (באצבע או בעכבר). touch-action pan-y — הגלילה בטלפון לא נחסמת.
      cv.style.touchAction = 'pan-y';
      cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, s: spin }; nextAt = performance.now() + 9000; });
      window.addEventListener('pointermove', function (e) { if (drag) spin = drag.s + (e.clientX - drag.x) * 0.012; });
      window.addEventListener('pointerup', function () { drag = null; });
      function size() {
        var w = wrap.clientWidth || 300, h = wrap.clientHeight || 240;
        r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      }
      var shown = false;
      function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden || !wrap.offsetParent) return;   // לשונית מוסתרת/דף ברקע — לא מציירים
        if (!shown) { shown = true; stage.classList.add('has-3d'); size(); }
        if (auto && !drag) spin += 0.012;
        if (auto && !drag && !swap && now > nextAt && objs.length > 1) { go((cur + 1) % objs.length); nextAt = now + 6000; }
        objs.forEach(function (o, i) { o.rotation.y = spin; });
        if (swap) {
          var p = Math.min(1, (now - swap.t) / 700), a = objs[swap.from], b = objs[swap.to];
          var e = p < .5 ? 1 - p * 2 : (p - .5) * 2;
          a.visible = p < .5; b.visible = p >= .5;
          (p < .5 ? a : b).scale.setScalar(0.0001 + e);
          if (p >= 1) { a.scale.setScalar(1); b.scale.setScalar(1); swap = null; }
        }
        objs[cur].position.y = Math.sin(now / 900) * 0.05;
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
