/* zikit-3d.js — G-35: המוצרים שהוזמנו מזיקית (29/10/2026, "עדכון הזמנה לזיקית") כמודלים תלת־ממדיים לקרוסלה בעמוד המשחקים.
 * נטען אחרי js/showcase-3d.js ונרשם דרך window.S3D.register. כל מוצר = פונקציה שמחזירה THREE.Group בגובה ≈2 יחידות (הקרוסלה מנרמלת).
 * מידות ושטחי הדפסה — מקטלוג זיקית 2026 (ס"מ). ההדפסה לדוגמה: בלונים + כיתוב (אותה רוח כמו שאר האתר), לא תמונות של אנשים.
 * מוצר חדש מההזמנה = פונקציה כאן + שורה ב-ZIKIT (שם, מק"ט, קישור) + המפתח ב-data-items של הבמה.
 */
(function () {
  'use strict';
  if (!window.S3D) return;
  var S = window.S3D;

  /* ── עזרים ── */
  function T() { return window.THREE; }
  function mat(o) { return new (T().MeshStandardMaterial)(Object.assign({ roughness: .6, metalness: 0 }, o)); }
  function phys(o) { return new (T().MeshPhysicalMaterial)(Object.assign({ roughness: .5, metalness: 0 }, o)); }
  function texOf(c) { var t = S.tex(c); t.wrapS = t.wrapT = T().ClampToEdgeWrapping; return t; }
  function art(w, h, text, bg, y) { return S.printCanvas(w, h, text || 'באהבה', bg || '#ffffff', y || 0.88); }
  var WHITE = 0xffffff, LINEN = 0xEDE4D3, BLACK = 0x1A1733, STEEL = 0xC9CDD3, WOOD = 0xE2C9A3;
  function metal(c) { return phys({ color: c == null ? STEEL : c, metalness: .6, roughness: .35 }); }
  function glassMat(o) { return phys(Object.assign({ color: 0xffffff, transmission: .6, transparent: true, opacity: .85, roughness: .08 }, o)); }
  function rrectShape(w, h, r) { var s = new (T().Shape)(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; }
  // לוח/מגן: מלבן מעוגל עם עובי, ההדפסה מקדימה
  function plate(w, h, d, c, color, r) {
    var g = new (T().ExtrudeGeometry)(rrectShape(w, h, r == null ? Math.min(w, h) * .06 : r), { depth: d, bevelEnabled: true, bevelThickness: d * .15, bevelSize: d * .15, bevelSegments: 3 });
    g.center();
    var side = mat({ color: color == null ? WHITE : color, roughness: .5 });
    var m = new (T().Mesh)(g, side);
    if (c) {   // ההדפסה = מישור צמוד לחזית
      var pl = new (T().Mesh)(new (T().PlaneGeometry)(w * .97, h * .97), mat({ map: texOf(c), roughness: .45, polygonOffset: true, polygonOffsetFactor: -1 }));
      pl.position.z = d / 2 + d * .15 + .003; var grp = new (T().Group)(); grp.add(m); grp.add(pl); return grp;
    }
    return m;
  }
  // תמונה על מישור (למגנט/מדבקה)
  function pic(w, h, c) { return new (T().Mesh)(new (T().PlaneGeometry)(w, h), mat({ map: texOf(c), roughness: .5 })); }
  // בד "מנופח": קו מתאר (נקודות) → משטח שמתרומם לפי המרחק מהשפה, לפנים ולאחור. לתיקים, כריות, סינרים.
  function pip(p, poly) { var x = p[0], y = p[1], c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function segD(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); }
  function edgeD(p, poly) { var d = 1e9; for (var i = 0; i < poly.length; i++) { var q = segD(p, poly[i], poly[(i + 1) % poly.length]); if (q < d) d = q; } return d; }
  function puff(poly, depth, opts) {
    opts = opts || {}; var Tt = T(), xs = poly.map(function (p) { return p[0]; }), ys = poly.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys), W = x1 - x0, H = y1 - y0, step = opts.step || Math.max(W, H) / 48;
    var nx = Math.max(8, Math.round(W / step)), ny = Math.max(8, Math.round(H / step)), grp = new Tt.Group();
    // מסכה
    var mc = document.createElement('canvas'); mc.width = mc.height = 512; var mx = mc.getContext('2d'); mx.fillStyle = '#000'; mx.fillRect(0, 0, 512, 512); mx.fillStyle = '#fff'; mx.beginPath();
    poly.forEach(function (q, i) { var px = (q[0] - x0) / W * 512, py = 512 - (q[1] - y0) / H * 512; i ? mx.lineTo(px, py) : mx.moveTo(px, py); }); mx.closePath(); mx.fill();
    var am = new Tt.CanvasTexture(mc);
    [1, -1].forEach(function (sign) {
      var g = new Tt.PlaneGeometry(W, H, nx, ny), P = g.attributes.position, Z = new Float32Array(P.count), i;
      for (i = 0; i < P.count; i++) {
        var X = P.getX(i) + (x0 + x1) / 2, Y = P.getY(i) + (y0 + y1) / 2, p = [X, Y], inside = pip(p, poly), d = inside ? edgeD(p, poly) : 0;
        var z = inside ? depth * (1 - Math.exp(-d / (opts.soft || W * .12))) : 0;
        if (inside && opts.wrinkle) z += opts.wrinkle * Math.sin(X * 9 / W * 2) * Math.sin(Y * 7 / H * 2);
        Z[i] = z; P.setZ(i, sign * z);
      }
      var col = new Float32Array(P.count * 3), Wn = nx + 1;
      for (var j = 0; j <= ny; j++) for (var ii = 0; ii <= nx; ii++) { var n = j * Wn + ii, lap = (Z[j * Wn + Math.max(0, ii - 1)] + Z[j * Wn + Math.min(nx, ii + 1)] + Z[Math.max(0, j - 1) * Wn + ii] + Z[Math.min(ny, j + 1) * Wn + ii]) / 4 - Z[n]; var a = Math.max(.62, 1 - Math.max(0, Math.min(.3, lap * 40 / depth))); col[n * 3] = col[n * 3 + 1] = col[n * 3 + 2] = a; }
      g.setAttribute('color', new Tt.BufferAttribute(col, 3)); g.computeVertexNormals();
      var m = phys({ color: (sign > 0 && opts.map) ? WHITE : (opts.color == null ? WHITE : opts.color), roughness: .9, vertexColors: true, alphaMap: am, alphaTest: .5, side: sign > 0 ? Tt.FrontSide : Tt.BackSide, map: sign > 0 && opts.map ? texOf(opts.map) : null });
      if (sign > 0 && opts.map) { /* ההדפסה: UV של המלבן המודפס בלבד */ var uv = g.attributes.uv, pr = opts.printRect || [x0 + W * .15, y0 + H * .2, W * .7, H * .6]; for (i = 0; i < P.count; i++) { var ux = (P.getX(i) + (x0 + x1) / 2 - pr[0]) / pr[2], uy = (P.getY(i) + (y0 + y1) / 2 - pr[1]) / pr[3]; uv.setXY(i, ux, uy); } m.map.wrapS = m.map.wrapT = Tt.ClampToEdgeWrapping; }
      m.sheen = new Tt.Color(.3, .3, .3);
      grp.add(new Tt.Mesh(g, m));
    });
    return grp;
  }
  function rect(w, h) { return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]; }
  function transparentArt(w, h, text, bg) { return S.printCanvas(w, h, text || 'באהבה', bg || '#ffffff', 0.9); }  // צבע הבד נצרב ברקע ההדפסה (מחוץ למלבן ההדפסה הטקסטורה נמתחת מהשוליים)
  function cyl(r1, r2, h, m, open) { return new (T().Mesh)(new (T().CylinderGeometry)(r1, r2, h, 64, 1, !!open), m); }
  function wrapTex(c, offset) { var t = S.tex(c); t.wrapS = T().RepeatWrapping; t.offset.x = offset == null ? .5 : offset; return t; }
  function handle(R, size, color) { var h = new (T().Mesh)(new (T().TorusGeometry)(size, size * .25, 16, 40, Math.PI * 1.15), mat({ color: color == null ? WHITE : color, roughness: .3 })); h.rotation.z = -Math.PI * 0.575; h.position.set(R + size * .4, 0, 0); h.scale.set(.8, 1, 1); return h; }

  /* ── ספלים ── */
  function mugBase(o) {   // o: {R,H,body(color/map),inner,handle,rim,lid,straw,text}
    var Tt = T(), g = new Tt.Group(), R = o.R || .62, H = o.H || 1.4;
    var bodyMat = o.map ? mat({ map: wrapTex(o.map), roughness: o.rough == null ? .25 : o.rough, metalness: o.metal || 0 }) : mat({ color: o.color, roughness: o.rough == null ? .25 : o.rough, metalness: o.metal || 0 });
    g.add(cyl(R, R, H, bodyMat, true));
    var bottom = new Tt.Mesh(new Tt.CircleGeometry(R, 48), mat({ color: o.base || o.color || WHITE })); bottom.rotation.x = Math.PI / 2; bottom.position.y = -H / 2; g.add(bottom);
    var inner = cyl(R * .92, R * .92, H * .96, mat({ color: o.inner || 0xEDEBE7, roughness: .4, side: Tt.BackSide }), true); inner.position.y = H * .02; g.add(inner);
    var rim = new Tt.Mesh(new Tt.TorusGeometry(R * .96, R * .04, 10, 64), mat({ color: o.rimColor || o.inner || WHITE, roughness: .3 })); rim.rotation.x = Math.PI / 2; rim.position.y = H / 2; g.add(rim);
    if (o.handle !== false) g.add(handle(R, .34 * (R / .62), o.handleColor == null ? (o.inner || WHITE) : o.handleColor));
    if (o.lid) { var lid = cyl(R * 1.04, R * 1.04, .09, mat({ color: o.lid, roughness: .5 })); lid.position.y = H / 2 + .045; g.add(lid); var knob = cyl(.08, .1, .1, mat({ color: o.lid })); knob.position.y = H / 2 + .14; g.add(knob); }
    if (o.straw) { var st = cyl(.04, .04, H * .9, mat({ color: o.straw, roughness: .4 })); st.position.set(-R * .35, H * .45, 0); st.rotation.z = .25; g.add(st); }
    var w = new Tt.Group(); w.add(g); return w;
  }
  var mugPrint = function (text, bg) { return art(1024, 440, text, bg || '#ffffff'); };
  S.register('mug-color', function () { return mugBase({ map: mugPrint('סבא'), inner: 0xE11D48, handleColor: 0xE11D48 }); });          // 8506 פנים וידית בצבע
  S.register('mug-neon', function () { return mugBase({ map: mugPrint('יום הולדת', '#CCFF33'), inner: 0xCCFF33, handleColor: 0xCCFF33, base: 0xCCFF33 }); }); // 8514 נאון
  S.register('mug-magic', function () { var m = mugBase({ color: 0x111111, inner: 0x1b1b1b, handleColor: 0x111111, rough: .15 }); // 8503-1 ספל פלא — ההדפסה "מתגלה" כחלון
    var c = mugPrint('הפתעה!'); var win = new (T().Mesh)(new (T().PlaneGeometry)(.9, .9), mat({ map: texOf(c), roughness: .3 })); win.position.set(0, 0, .625); m.add(win); return m; });
  S.register('mug-spoon', function () { var g = mugBase({ map: mugPrint('בוקר טוב'), inner: 0x3B82F6, handleColor: 0x3B82F6 }); // 8510 עם כפית
    var sp = new (T().Group)(); var st = cyl(.025, .025, 1.3, metal()); st.position.y = .55; st.rotation.z = -.35; sp.add(st); var bowl = new (T().Mesh)(new (T().SphereGeometry)(.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal()); bowl.position.set(.2, -.02, 0); bowl.rotation.x = Math.PI; sp.add(bowl); sp.position.set(-.2, 0, .1); g.add(sp); return g; });
  S.register('mug-metal', function () { return mugBase({ map: mugPrint('אבא', '#dfe3ea'), color: 0xdfe3ea, inner: 0x1D4ED8, handleColor: 0x1D4ED8, metal: .6, rough: .25 }); }); // 8507-6/7 מטאלי+כחול
  S.register('enamel', function () { var g = mugBase({ R: .72, H: 1.1, map: mugPrint('קפה', '#ffffff'), inner: 0xF3F4F6, rimColor: 0x111111, lid: 0xffffff, handleColor: WHITE }); return g; }); // 8724-3 אמייל 700 עם מכסה
  S.register('hugmug', function () { var Tt = T(), g = new Tt.Group(); var m = cyl(.55, .5, 1.5, mat({ map: wrapTex(mugPrint('חיבוק חם')), roughness: .3 }), true); g.add(m); // 8714 האג מאג — בלי ידית, מכסה
    var bot = new Tt.Mesh(new Tt.CircleGeometry(.5, 48), mat({ color: WHITE })); bot.rotation.x = Math.PI / 2; bot.position.y = -.75; g.add(bot);
    var lid = cyl(.57, .55, .12, mat({ color: 0xF1F1F1, roughness: .5 })); lid.position.y = .81; g.add(lid); var knob = cyl(.1, .1, .06, mat({ color: 0xE5E7EB })); knob.position.y = .9; g.add(knob); return g; });
  S.register('wine', function () { var Tt = T(), g = new Tt.Group(); var bowl = cyl(.5, .3, 1.1, mat({ map: wrapTex(mugPrint('לחיים'), .5), roughness: .3 }), true); bowl.position.y = .5; g.add(bowl); var bb = new Tt.Mesh(new Tt.CircleGeometry(.3, 32), mat({ color: WHITE })); bb.rotation.x = Math.PI / 2; bb.position.y = -.05; g.add(bb); // 8714-3 גביע יין נירוסטה לבן
    var inner = cyl(.47, .28, 1.08, mat({ color: 0xE5E7EB, side: Tt.BackSide, roughness: .3 }), true); inner.position.y = .5; g.add(inner);
    var stem = cyl(.06, .08, .9, metal()); stem.position.y = -.35; g.add(stem); var foot = cyl(.38, .42, .06, metal()); foot.position.y = -.8; g.add(foot); return g; });
  S.register('megamug', function () { return mugBase({ R: .62, H: 1.8, map: art(1024, 900, 'קיץ', '#ffffff'), inner: 0xF472B6, handleColor: 0xF472B6, lid: 0xF472B6, straw: 0xF472B6 }); }); // 8715-1 מגה מאג עם קשית
  S.register('thermo', function () { var g = mugBase({ R: .5, H: 1.75, map: art(1024, 480, 'קפה בדרך', '#ffffff'), inner: 0x9CA3AF, handleColor: 0xB8BEC7, lid: 0x9CA3AF }); return g; }); // 8706 נירוסטה טרמי
  S.register('bottle', function () { var Tt = T(), g = new Tt.Group(); var body = cyl(.42, .42, 1.6, mat({ map: wrapTex(art(1024, 520, 'מים', '#ffffff')), roughness: .35 }), true); g.add(body); // 8703-2 בקבוק אלומיניום עם שאקל
    var bot = new Tt.Mesh(new Tt.CircleGeometry(.42, 48), mat({ color: WHITE })); bot.rotation.x = Math.PI / 2; bot.position.y = -.8; g.add(bot);
    var sh = new Tt.Mesh(new Tt.SphereGeometry(.42, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: WHITE, roughness: .35 })); sh.position.y = .8; sh.scale.y = .55; g.add(sh);
    var neck = cyl(.14, .14, .22, mat({ color: WHITE })); neck.position.y = 1.1; g.add(neck); var cap = cyl(.17, .17, .16, mat({ color: 0x111111, roughness: .5 })); cap.position.y = 1.28; g.add(cap);
    var ring = new Tt.Mesh(new Tt.TorusGeometry(.14, .02, 8, 32), metal(0x999999)); ring.position.set(.2, 1.3, 0); ring.rotation.y = Math.PI / 2; g.add(ring); g.position.y = -.2; return g; });
  S.register('bottle-straw', function () { var Tt = T(), g = new Tt.Group(); var body = cyl(.42, .42, 1.55, mat({ map: wrapTex(art(1024, 520, 'שלי!', '#ffffff')), roughness: .35 }), true); g.add(body); // 8703-1/8/9 פתח רחב עם קשית
    var bot = new Tt.Mesh(new Tt.CircleGeometry(.42, 48), mat({ color: WHITE })); bot.rotation.x = Math.PI / 2; bot.position.y = -.775; g.add(bot);
    var cap = cyl(.44, .42, .26, mat({ color: 0x2563EB, roughness: .5 })); cap.position.y = .9; g.add(cap); var spout = cyl(.06, .05, .3, mat({ color: 0x2563EB })); spout.position.set(.15, 1.15, 0); spout.rotation.z = -.5; g.add(spout); g.position.y = -.15; return g; });

  /* ── אבן, עץ, זכוכית, קריסטל ── */
  S.register('basalt', function () { var Tt = T(), g = new Tt.Group(); var sh = new Tt.Shape(); var pts = [[-1, -.7], [-.9, -.8], [.3, -.85], [.95, -.6], [1.05, .2], [.8, .75], [-.2, .85], [-1.0, .6]]; pts.forEach(function (p, i) { i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]); }); // 8580–8589 אבן בזלת
    var geo = new Tt.ExtrudeGeometry(sh, { depth: .18, bevelEnabled: true, bevelThickness: .05, bevelSize: .06, bevelSegments: 4 }); geo.center(); g.add(new Tt.Mesh(geo, mat({ color: 0x2B2B2E, roughness: .95 })));
    var p = pic(1.5, 1.1, art(900, 660, 'המשפחה', '#ffffff')); p.position.z = .14; g.add(p); g.rotation.x = -.35; return g; });
  S.register('woodphoto', function () { var Tt = T(), g = new Tt.Group(); g.add(plate(1.9, 1.4, .12, art(1024, 760, 'ביחד', '#ffffff'), 0xF5F0E6, .02)); // 8360 תמונה מעץ עם רגל ניקל
    var leg = new Tt.Mesh(new Tt.BoxGeometry(.05, 1.0, .05), metal()); leg.position.set(0, -.3, -.5); leg.rotation.x = .6; g.add(leg); return g; });
  S.register('acrylic', function () { var Tt = T(), g = new Tt.Group(); // 8193 מעמד אקריל לשתי תמונות 10×15
    [-.72, .72].forEach(function (x, i) { var pane = new Tt.Mesh(new Tt.BoxGeometry(1.3, 1.9, .07), glassMat({ opacity: .35 })); pane.position.x = x; g.add(pane); var p = pic(1.05, 1.6, art(640, 960, i ? 'אמא' : 'אבא', '#ffffff')); p.position.set(x, .05, .04); g.add(p); });
    var base = new Tt.Mesh(new Tt.BoxGeometry(3.0, .08, .9), glassMat({ opacity: .5 })); base.position.y = -.98; g.add(base); g.rotation.y = .2; g.scale.setScalar(.85); return g; });
  S.register('glass', function () { var Tt = T(), g = new Tt.Group(); var pane = new Tt.Mesh(new Tt.BoxGeometry(2.1, 1.6, .06), glassMat({ opacity: .5 })); g.add(pane); var p = pic(2.0, 1.5, art(1024, 768, 'החתונה שלנו', '#ffffff')); p.position.z = .035; g.add(p); // 6442/6451/6452 זכוכית דקה מעמד יהלום
    var stand = new Tt.Mesh(new Tt.OctahedronGeometry(.16), metal()); stand.position.set(0, -.95, -.25); g.add(stand); var arm = new Tt.Mesh(new Tt.BoxGeometry(.05, .5, .05), metal()); arm.position.set(0, -.75, -.3); arm.rotation.x = .7; g.add(arm); g.rotation.x = -.12; return g; });
  S.register('glass-mirror', function () { var Tt = T(), g = new Tt.Group(); var frame = new Tt.Mesh(new Tt.BoxGeometry(2.3, 1.8, .06), metal(0xDDE1E6)); g.add(frame); var p = pic(1.9, 1.4, art(1024, 760, 'סבתא וסבא', '#ffffff')); p.position.z = .035; g.add(p); // 6443 זכוכית עם מסגרת מראה
    var stand = new Tt.Mesh(new Tt.OctahedronGeometry(.16), metal()); stand.position.set(0, -1.0, -.25); g.add(stand); g.rotation.x = -.12; return g; });
  S.register('board', function () { var Tt = T(), g = new Tt.Group(); var c = art(900, 1260, 'המטבח של אמא', '#ffffff'); g.add(plate(1.45, 2.0, .06, c, 0xF5F5F5, .05)); var hole = new Tt.Mesh(new Tt.TorusGeometry(.08, .03, 8, 24), mat({ color: 0xE5E7EB })); hole.position.set(.55, .85, .06); g.add(hole); g.rotation.x = -.2; return g; }); // 6458 לוח חיתוך זכוכית
  S.register('crystal', function () { var Tt = T(), g = new Tt.Group(); var block = new Tt.Mesh(new Tt.BoxGeometry(1.4, 2.0, .45), glassMat({ opacity: .55, roughness: .02 })); g.add(block); var p = pic(1.2, 1.75, art(640, 920, 'אהבה', '#ffffff')); p.position.z = -.1; g.add(p); // 6422–6424 מגן קריסטל
    var p2 = pic(1.2, 1.75, art(640, 920, 'אהבה', '#ffffff')); p2.position.z = .226; p2.material.opacity = .25; p2.material.transparent = true; g.add(p2); g.rotation.y = -.25; return g; });
  S.register('clock', function () { var Tt = T(), g = new Tt.Group(); var c = art(800, 800, 'LOVE', '#ffffff', .9), x = c.getContext('2d'); x.strokeStyle = '#1A1733'; x.lineWidth = 10; for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(400 + Math.cos(a) * 340, 400 + Math.sin(a) * 340); x.lineTo(400 + Math.cos(a) * 370, 400 + Math.sin(a) * 370); x.stroke(); } // 8022-3 שעון LOVE
    x.lineWidth = 14; x.beginPath(); x.moveTo(400, 400); x.lineTo(400, 180); x.stroke(); x.lineWidth = 10; x.beginPath(); x.moveTo(400, 400); x.lineTo(560, 460); x.stroke();
    var face = cyl(.95, .95, .08, [mat({ color: WHITE }), mat({ map: texOf(c) }), mat({ color: WHITE })]); face.rotation.x = Math.PI / 2; face.position.y = .3; g.add(face);
    var post = new Tt.Mesh(new Tt.BoxGeometry(.9, 1.5, .08), mat({ color: WOOD, roughness: .8 })); post.position.set(0, -.6, -.1); g.add(post); var base = new Tt.Mesh(new Tt.BoxGeometry(2.3, .1, .6), mat({ color: WOOD })); base.position.y = -1.35; g.add(base); g.scale.setScalar(.9); return g; });
  function heartShape(s) { var h = new (T().Shape)(); h.moveTo(0, -s); h.bezierCurveTo(s * 1.4, 0, s * .9, s * 1.1, 0, s * .45); h.bezierCurveTo(-s * .9, s * 1.1, -s * 1.4, 0, 0, -s); return h; }
  S.register('woodshape', function () { var Tt = T(), g = new Tt.Group(); var geo = new Tt.ExtrudeGeometry(heartShape(.95), { depth: .08, bevelEnabled: false }); geo.center(); // 6101 עץ מבריק חתוך — לב
    var c = art(800, 800, 'ברוכים הבאים', '#ffffff', .78); var m = new Tt.Mesh(geo, [mat({ map: texOf(c), roughness: .3 }), mat({ color: WOOD })]); var uv = geo.attributes.uv, P = geo.attributes.position; for (var i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) + 1.2) / 2.4, (P.getY(i) + 1.2) / 2.4); g.add(m); return g; });
  S.register('instagram', function () { var Tt = T(), g = new Tt.Group(); var board = new Tt.Mesh(new Tt.BoxGeometry(2.3, 2.3, .07), mat({ color: WOOD, roughness: .8 })); g.add(board); // 6115-1 לוח עץ ל-9 תמונות
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) { var p = pic(.62, .62, art(400, 400, ['סבא', 'סבתא', 'אבא', 'אמא', 'נועה', 'איתי', 'טל', 'יובל', 'אורי'][r * 3 + c], '#ffffff', .9)); p.position.set((c - 1) * .72, (1 - r) * .72, .04); g.add(p); } return g; });
  S.register('keyhanger', function () { var Tt = T(), g = new Tt.Group(); var c = document.createElement('canvas'); c.width = 1024; c.height = 400; var x = c.getContext('2d'); x.fillStyle = '#111'; x.font = '900 190px Arial'; x.textAlign = 'center'; x.fillText('FAMILY', 512, 250); // 8310-4 מפתח ברכה FAMILY
    var board = new Tt.Mesh(new Tt.PlaneGeometry(2.6, 1.0), mat({ map: texOf(c), transparent: true, alphaTest: .4, roughness: .6, side: Tt.DoubleSide })); board.position.y = .25; g.add(board);
    var disc = cyl(.45, .45, .05, [mat({ color: 0x111111 }), mat({ map: texOf(art(500, 500, 'משפחת כהן', '#ffffff', .88)) }), mat({ color: 0x111111 })]); disc.rotation.x = Math.PI / 2; disc.position.set(1.05, .25, .02); g.add(disc);
    for (var i = 0; i < 3; i++) { var hook = new Tt.Mesh(new Tt.TorusGeometry(.1, .025, 8, 20, Math.PI), metal(0x777777)); hook.position.set(-.9 + i * .55, -.35, .05); hook.rotation.z = Math.PI; g.add(hook); } return g; });
  S.register('doorsign', function () { var Tt = T(), g = new Tt.Group(); var sh = rrectShape(2.0, 1.1, .3); var geo = new Tt.ExtrudeGeometry(sh, { depth: .05, bevelEnabled: false }); geo.center(); // 8201 שלט עץ דק לדלת
    var c = art(900, 500, 'החדר של נועה', '#FFF8EC', .86); var m = new Tt.Mesh(geo, [mat({ map: texOf(c), roughness: .5 }), mat({ color: WOOD })]); var uv = geo.attributes.uv, P = geo.attributes.position; for (var i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) + 1.0) / 2.0, (P.getY(i) + .55) / 1.1); g.add(m);
    var hole = new Tt.Mesh(new Tt.TorusGeometry(.06, .02, 8, 20), mat({ color: 0xA16207 })); hole.position.set(0, .62, 0); g.add(hole); var str = cyl(.015, .015, .7, mat({ color: 0xA16207 })); str.position.y = 1.0; g.add(str); g.position.y = -.2; return g; });
  S.register('tin', function () { var Tt = T(), g = new Tt.Group(); var box = cyl(.95, .95, .5, metal(0xC8CCD2), true); g.add(box); var bot = new Tt.Mesh(new Tt.CircleGeometry(.95, 48), metal(0xC8CCD2)); bot.rotation.x = Math.PI / 2; bot.position.y = -.25; g.add(bot); // 8707-3 קופסת מתכת עגולה
    var lid = cyl(.97, .97, .06, [metal(0xC8CCD2), mat({ map: texOf(art(700, 700, 'עוגיות של סבתא', '#ffffff', .88)), roughness: .35 }), metal(0xC8CCD2)]); lid.position.y = .28; g.add(lid); g.rotation.x = 1.25; return g; });
  S.register('bracelet', function () { var Tt = T(), g = new Tt.Group(); var c = art(1024, 300, 'נועה ♥', '#ffffff', .8); var band = new Tt.Mesh(new Tt.CylinderGeometry(.9, .9, .55, 64, 1, true, .3, Math.PI * 2 - .6), mat({ map: wrapTex(c, .25), roughness: .3, metalness: .4, side: Tt.DoubleSide })); g.add(band); g.rotation.x = .35; return g; }); // 9172-1 צמיד אלומיניום
  S.register('woodnum', function () { var Tt = T(), g = new Tt.Group(); var c = document.createElement('canvas'); c.width = c.height = 800; var x = c.getContext('2d'); var a = art(800, 800, '', '#ffffff', 2); x.drawImage(a, 0, 0); // 6111 ספרה מעץ + רגל ניקל
    var m = document.createElement('canvas'); m.width = m.height = 800; var mx = m.getContext('2d'); mx.fillStyle = '#fff'; mx.font = '900 760px Arial'; mx.textAlign = 'center'; mx.fillText('1', 400, 700);
    var pl = new Tt.Mesh(new Tt.PlaneGeometry(2.1, 2.1), mat({ map: texOf(c), alphaMap: new Tt.CanvasTexture(m), alphaTest: .5, transparent: true, side: Tt.DoubleSide, roughness: .5 })); g.add(pl);
    var leg = new Tt.Mesh(new Tt.BoxGeometry(.05, .9, .05), metal()); leg.position.set(0, -.5, -.4); leg.rotation.x = .6; g.add(leg); return g; });
  S.register('usb', function () { var Tt = T(), g = new Tt.Group(); var body = new Tt.Mesh(new Tt.BoxGeometry(1.0, 2.0, .35), mat({ color: WOOD, roughness: .7 })); g.add(body); var disc = cyl(.4, .4, .03, [mat({ color: WOOD }), mat({ map: texOf(art(400, 400, 'נועה', '#ffffff', .9)) }), mat({ color: WOOD })]); disc.rotation.x = Math.PI / 2; disc.position.set(0, .3, .19); g.add(disc); // 9613 דיסק און קי עץ מואר
    var plug = new Tt.Mesh(new Tt.BoxGeometry(.5, .5, .18), metal(0xB0B4BA)); plug.position.y = -1.2; g.add(plug); g.rotation.z = -.35; g.scale.setScalar(.85); return g; });
  S.register('powerbank', function () { var Tt = T(), g = new Tt.Group(); g.add(plate(1.25, 2.1, .36, art(600, 1050, 'נועה', '#ffffff', .92), 0x111111, .12)); var port = new Tt.Mesh(new Tt.BoxGeometry(.3, .08, .1), metal(0x888888)); port.position.set(0, -1.05, 0); g.add(port); g.rotation.y = -.3; return g; }); // 9609 פאוור בנק
  S.register('hairbrush', function () { var Tt = T(), g = new Tt.Group(); var head = new Tt.Mesh(new Tt.BoxGeometry(1.0, 1.55, .25), mat({ color: 0xF8FAFC, roughness: .4 })); head.position.y = .4; g.add(head); // 8670-1 מברשת שיער
    var p = pic(.8, 1.3, art(500, 820, 'יפה שלי', '#ffffff', .9)); p.position.set(0, .4, .13); g.add(p);
    var hd = cyl(.13, .17, 1.4, mat({ color: 0xF8FAFC })); hd.position.y = -1.0; g.add(hd); for (var i = 0; i < 18; i++) { var br = cyl(.02, .02, .25, mat({ color: 0x111111 })); br.position.set(-.35 + (i % 6) * .14, .0 + Math.floor(i / 6) * .4, -.25); br.rotation.x = Math.PI / 2; g.add(br); } return g; });
  S.register('snow', function () { var Tt = T(), g = new Tt.Group(); var box = new Tt.Mesh(new Tt.BoxGeometry(2.0, 1.45, .5), glassMat({ opacity: .35 })); g.add(box); var p = pic(1.75, 1.2, art(1024, 700, 'חורף', '#ffffff')); g.add(p); // 9802-4 מלבן שלג
    for (var i = 0; i < 40; i++) { var f = new Tt.Mesh(new Tt.SphereGeometry(.025, 6, 6), mat({ color: WHITE })); f.position.set((Math.random() - .5) * 1.8, (Math.random() - .5) * 1.3, (Math.random() - .5) * .4); g.add(f); } var base = new Tt.Mesh(new Tt.BoxGeometry(2.1, .18, .6), mat({ color: 0x111111 })); base.position.y = -.8; g.add(base); return g; });
  S.register('magnet', function () { var Tt = T(), g = new Tt.Group(); g.add(plate(1.45, 2.1, .06, art(600, 870, 'על המקרר', '#ffffff', .92), WOOD, .02)); g.rotation.y = .15; return g; }); // 8381 מגנט עץ 10×15
  S.register('leather', function () { var Tt = T(), g = new Tt.Group(); var m = plate(1.65, 2.05, .05, art(660, 820, 'זיכרונות', '#ffffff', .92), 0xF3F4F6, .04); g.add(m); var back = new Tt.Mesh(new Tt.BoxGeometry(.9, 1.4, .03), mat({ color: 0x111111, roughness: .8 })); back.position.set(0, -.3, -.45); back.rotation.x = .5; g.add(back); return g; }); // 8609 תמונה מעור
  S.register('scale', function () { var Tt = T(), g = new Tt.Group(); var top = plate(2.2, 2.2, .18, art(800, 800, 'בריאות', '#ffffff', .9), 0xF1F5F9, .1); top.rotation.x = -Math.PI / 2 + .55; g.add(top); var lcd = new Tt.Mesh(new Tt.PlaneGeometry(.6, .25), mat({ color: 0x111111 })); lcd.position.set(0, .75, .62); lcd.rotation.x = -Math.PI / 2 + .55; g.add(lcd); return g; }); // 9608 משקל זכוכית

  /* ── בדים: תיקים, סינר, כרית, ראנר, שטיחון ── */
  S.register('apron', function () { var poly = [[-.95, -1.2], [.95, -1.2], [.95, .1], [.55, .95], [-.55, .95], [-.95, .1]]; var g = puff(poly, .06, { map: art(800, 800, 'השף של הבית', '#ffffff', .9), printRect: [-.6, -.7, 1.2, 1.2], wrinkle: .015 }); // 7602/7603 סינר
    var Tt = T(), str = new Tt.Mesh(new Tt.TorusGeometry(.5, .02, 8, 40, Math.PI), mat({ color: WHITE })); str.position.y = .95; g.add(str); return g; });
  S.register('tote', function () { var poly = rect(1.9, 1.9); var g = puff(poly, .14, { color: 0xF5F0E6, map: art(800, 800, 'קניות', '#F5F0E6', .9), printRect: [-.7, -.75, 1.4, 1.4], wrinkle: .02 }); // 7315-9 תיק קניות קנווס
    var Tt = T(); [-.55, .55].forEach(function (x) { var h = new Tt.Mesh(new Tt.TorusGeometry(.42, .035, 8, 40, Math.PI), mat({ color: 0x9CA3AF, roughness: .9 })); h.position.set(x * 0 + x, .95, 0); h.scale.set(.5, 1.2, 1); g.add(h); }); return g; });
  S.register('drawstring', function () { var poly = [[-.95, -1.1], [.95, -1.1], [1.0, .9], [-1.0, .9]]; var g = puff(poly, .12, { map: art(800, 900, 'ספורט', '#ffffff', .9), printRect: [-.7, -.8, 1.4, 1.4], wrinkle: .02 }); var Tt = T(); // 7307-4 תיק שרוכים
    [-.9, .9].forEach(function (x) { var c = new Tt.Mesh(new Tt.TorusGeometry(.95, .02, 8, 60, Math.PI * .55), mat({ color: WHITE })); c.position.set(x * .0, -.1, .0); c.rotation.z = x < 0 ? Math.PI * .72 : -Math.PI * .27; g.add(c); }); return g; });
  S.register('backpack', function () { var poly = [[-.85, -1.0], [.85, -1.0], [.9, .6], [.6, 1.0], [-.6, 1.0], [-.9, .6]]; var g = puff(poly, .3, { color: 0xEC4899, map: transparentArt(800, 800, 'נועה', '#EC4899'), printRect: [-.55, -.7, 1.1, 1.1] }); // 7309 תיק גב לגן עם קלפה
    var Tt = T(), flap = puff([[-.9, .35], [.9, .35], [.9, 1.0], [-.9, 1.0]], .08, { color: 0xDB2777 }); flap.position.z = .22; g.add(flap); var h = new Tt.Mesh(new Tt.TorusGeometry(.25, .04, 8, 30, Math.PI), mat({ color: 0xDB2777 })); h.position.y = 1.0; g.add(h); return g; });
  S.register('luggage', function () { var poly = [[-1.0, -1.25], [1.0, -1.25], [1.0, 1.0], [.7, 1.25], [-.7, 1.25], [-1.0, 1.0]]; var g = puff(poly, .45, { map: art(800, 1000, 'טיול', '#ffffff', .9), printRect: [-.8, -1.0, 1.6, 2.0], wrinkle: .02 }); var Tt = T(); // 7300 כיסוי למזוודה
    var hd = new Tt.Mesh(new Tt.BoxGeometry(.5, .12, .25), mat({ color: 0x111111 })); hd.position.y = 1.32; g.add(hd); [-.6, .6].forEach(function (x) { var w = cyl(.14, .14, .12, mat({ color: 0x111111 })); w.rotation.x = Math.PI / 2; w.position.set(x, -1.3, .0); g.add(w); }); g.scale.setScalar(.85); return g; });
  S.register('makeup', function () { var g = puff(rect(2.0, 1.35), .25, { color: LINEN, map: transparentArt(800, 540, 'אמא', '#EDE4D3'), printRect: [-.8, -.55, 1.6, 1.1] }); var Tt = T(); var zip = new Tt.Mesh(new Tt.BoxGeometry(2.0, .06, .06), metal(0xB8860B)); zip.position.y = .68; g.add(zip); var pull = new Tt.Mesh(new Tt.BoxGeometry(.12, .2, .03), metal(0xB8860B)); pull.position.set(.9, .55, .1); g.add(pull); return g; }); // 7331-3 תיק איפור פשתן
  S.register('pencil', function () { var g = puff(rect(2.1, 1.0), .35, { color: 0x3B82F6, map: transparentArt(800, 380, 'איתי', '#3B82F6'), printRect: [-.9, -.4, 1.8, .8] }); var Tt = T(); var zip = new Tt.Mesh(new Tt.BoxGeometry(2.1, .05, .05), metal(0xC0C0C0)); zip.position.y = .5; g.add(zip); return g; }); // 7326 קלמר 3 תאים
  S.register('cushion', function () { var g = puff(rect(2.0, 2.0), .4, { map: art(800, 800, 'בית', '#ffffff', .9), printRect: [-1, -1, 2, 2], soft: .35, wrinkle: .03 }); g.rotation.x = -.25; return g; }); // 7175/7132 כרית כיסא 40×40
  S.register('runner', function () { var Tt = T(), g = new Tt.Group(); var c = art(1800, 480, 'שבת שלום', '#F1E7D4', .85); var m = new Tt.Mesh(new Tt.PlaneGeometry(3.2, .85, 40, 8), mat({ map: texOf(c), roughness: .95, side: Tt.DoubleSide })); var P = m.geometry.attributes.position; for (var i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 3) * .03); m.geometry.computeVertexNormals(); m.rotation.x = -Math.PI / 2 + .5; g.add(m); // 7410-17 ראנר פשתן
    var tbl = new Tt.Mesh(new Tt.BoxGeometry(3.6, .08, 1.5), mat({ color: 0xC8A97E, roughness: .8 })); tbl.rotation.x = -Math.PI / 2 + .5; tbl.position.z = -.05; g.add(tbl); g.position.y = .1; return g; });
  S.register('doormat', function () { var Tt = T(), g = new Tt.Group(); var rub = new Tt.Mesh(new Tt.BoxGeometry(3.0, 1.8, .12), mat({ color: 0x111111, roughness: .95 })); g.add(rub); var p = pic(2.25, 1.0, art(1120, 500, 'ברוכים הבאים', '#ffffff', .85)); p.position.z = .065; g.add(p); g.rotation.x = -.9; g.scale.setScalar(.85); return g; }); // 7413 שטיחון כניסה
  S.register('giftbag', function () { var poly = [[-.75, -1.0], [.75, -1.0], [.8, .6], [.55, 1.05], [-.55, 1.05], [-.8, .6]]; var g = puff(poly, .22, { color: 0xF3E8D2, map: transparentArt(800, 900, 'מזל טוב', '#F3E8D2'), printRect: [-.55, -.7, 1.1, 1.1], wrinkle: .02 }); var Tt = T(); var rib = new Tt.Mesh(new Tt.TorusGeometry(.42, .025, 8, 40), mat({ color: 0xD4A373 })); rib.position.y = .6; rib.scale.set(1, .25, 1); g.add(rib); return g; }); // 7361–7364 אריזת מתנה פשתן
  S.register('carcurtain', function () { var Tt = T(), g = new Tt.Group(); var c = art(1000, 850, 'יובל', '#ffffff', .9); var m = new Tt.Mesh(new Tt.PlaneGeometry(2.2, 1.85, 30, 30), mat({ map: texOf(c), roughness: .8, side: Tt.DoubleSide })); // 7611 וילון צד לרכב
    var P = m.geometry.attributes.position; for (var i = 0; i < P.count; i++) { var x = P.getX(i), y = P.getY(i), r = Math.hypot(x / 1.1, y / .925); if (r > 1) { P.setZ(i, 0); } else P.setZ(i, (1 - r) * .12); } m.geometry.computeVertexNormals();
    var mc = document.createElement('canvas'); mc.width = mc.height = 256; var mx = mc.getContext('2d'); mx.fillStyle = '#000'; mx.fillRect(0, 0, 256, 256); mx.fillStyle = '#fff'; mx.beginPath(); mx.ellipse(128, 128, 126, 126, 0, 0, Math.PI * 2); mx.fill(); m.material.alphaMap = new Tt.CanvasTexture(mc); m.material.alphaTest = .5; g.add(m);
    [[-.7, .6], [.7, .6]].forEach(function (q) { var s = cyl(.09, .09, .04, mat({ color: 0xBBBBBB, transparent: true, opacity: .7 })); s.rotation.x = Math.PI / 2; s.position.set(q[0], q[1], -.03); g.add(s); }); return g; });

  /* ── הרשימה לבמה: מפתח → שם לתגית, מק"ט, קישור לעיצוב. המחירים ללקוח עוד לא נקבעו (כלל 125) → בלי מחיר, הצעת מחיר ──
   * שלושת הראשונים (חולצה, ספל, פאזל) כבר קיימים ב-showcase-3d.js. */
  window.ZIKIT = [
    ['mug-color', '☕ ספל עם פנים וידית בצבע', '8506', '../studio/?p=mug'],
    ['mug-neon', '☕ ספל נאון', '8514', '../studio/?p=mug'],
    ['mug-magic', '🪄 ספל פלא — ההדפסה מתגלה בחום', '8503-1', '../studio/?p=mug'],
    ['mug-spoon', '🥄 ספל עם כפית', '8510', '../studio/?p=mug'],
    ['mug-metal', '✨ ספל מטאלי כחול/אדום', '8507', '../studio/?p=mug'],
    ['enamel', '🏕️ ספל אמייל ענק עם מכסה', '8724-3', '../studio/?p=subl&item=8724-3'],
    ['hugmug', '🤗 האג מאג טרמי', '8714', '../studio/?p=subl&item=8714-1'],
    ['wine', '🍷 גביע יין נירוסטה', '8714-3', '../studio/?p=subl&item=8714-3'],
    ['megamug', '🥤 מגה מאג עם קשית', '8715-1', '../studio/?p=subl&item=8715-1'],
    ['thermo', '☕ ספל טרמי נירוסטה', '8706', '../studio/?p=subl&item=8706-1'],
    ['bottle', '🚰 בקבוק אלומיניום 600 מ"ל', '8703-2', '../studio/?p=subl&item=8703-2'],
    ['bottle-straw', '🧃 בקבוק עם קשית', '8703-1', '../studio/?p=subl&item=8703-1'],
    ['basalt', '🪨 אבן בזלת עם תמונה', '8580', '../studio/?p=subl&item=8582'],
    ['woodphoto', '🖼️ תמונה על עץ עם רגל', '8360', '../studio/?p=subl&item=8360-4'],
    ['acrylic', '🖼️ מעמד אקריל לשתי תמונות', '8193', '../studio/?p=subl&item=8193'],
    ['glass', '🪟 תמונה על זכוכית עם מעמד', '6452', '../studio/?p=subl&item=6452'],
    ['glass-mirror', '🪞 זכוכית עם מסגרת מראה', '6443', '../studio/?p=subl&item=6443'],
    ['board', '🔪 לוח חיתוך זכוכית', '6458', '../studio/?p=subl&item=6458'],
    ['crystal', '💎 מגן קריסטל', '6424', '../studio/?p=subl&item=6424'],
    ['clock', '🕰️ שעון עמוד LOVE', '8022-3', '../studio/?p=subl&item=8022-3'],
    ['woodshape', '❤️ לב מעץ מבריק', '6101-H20', '../studio/?p=subl&item=6101-H20'],
    ['instagram', '🖼️ לוח עץ ל-9 תמונות', '6115-1', '../studio/?p=subl&item=6115-1'],
    ['keyhanger', '🔑 מפתח ברכה FAMILY', '8310-4', '../studio/?p=subl&item=8310-4'],
    ['doorsign', '🚪 שלט עץ לדלת', '8201', '../studio/?p=subl&item=8201'],
    ['tin', '🍪 קופסת מתכת עגולה', '8707-3', '../studio/?p=subl&item=8707-3'],
    ['bracelet', '📿 צמיד אלומיניום', '9172-1', '../studio/?p=subl&item=9172-1'],
    ['woodnum', '🔢 ספרה מעץ עם רגל', '6111', '../studio/?p=subl&item=6111'],
    ['usb', '💾 דיסק און קי מעץ מואר', '9613', '../studio/?p=subl&item=9613'],
    ['powerbank', '🔋 סוללת גיבוי עם תמונה', '9609', '../studio/?p=subl&item=9609'],
    ['hairbrush', '💇 מברשת שיער', '8670-1', '../studio/?p=subl&item=8670-1'],
    ['snow', '❄️ מלבן שלג עם תמונה', '9802-4', '../studio/?p=subl&item=9802-4'],
    ['magnet', '🧲 מגנט עץ 10×15', '8381', '../studio/?p=subl&item=8381'],
    ['leather', '📷 תמונה מעור עם מעמד', '8609', '../studio/?p=subl&item=8609'],
    ['scale', '⚖️ משקל זכוכית', '9608', '../studio/?p=subl&item=9608'],
    ['apron', '👩‍🍳 סינר', '7602', '../studio/?p=subl&item=7602'],
    ['tote', '👜 תיק קניות קנווס', '7315-9', '../studio/?p=subl&item=7315-9'],
    ['drawstring', '🎒 תיק שרוכים', '7307-4', '../studio/?p=subl&item=7307-4'],
    ['backpack', '🎒 תיק גב לגן', '7309', '../studio/?p=subl&item=7309-1'],
    ['luggage', '🧳 כיסוי למזוודה', '7300', '../studio/?p=subl&item=7300-2'],
    ['makeup', '💄 תיק איפור פשתן', '7331-3', '../studio/?p=subl&item=7331-3'],
    ['pencil', '✏️ קלמר 3 תאים', '7326', '../studio/?p=subl&item=7326-1'],
    ['cushion', '🛋️ כרית כיסא 40×40', '7175', '../studio/?p=subl&item=7175-11'],
    ['runner', '🕯️ ראנר שולחן פשתן', '7410-17', '../studio/?p=subl&item=7410-17'],
    ['doormat', '🚪 שטיחון כניסה', '7413', '../studio/?p=subl&item=7413'],
    ['giftbag', '🎁 אריזת מתנה מבד', '7362', '../studio/?p=subl&item=7362-5'],
    ['carcurtain', '🚗 וילון צד לרכב', '7611', '../studio/?p=subl&item=7611']
  ];
  // הבמה: data-items/data-names/data-links נבנים מהרשימה (אחרי חולצה/ספל/פאזל שכבר שם), כדי שלא יהיה צורך לכתוב 46 שמות ב-HTML
  document.querySelectorAll('[data-zikit]').forEach(function (st) {
    var items = (st.getAttribute('data-items') || '').split(',').filter(Boolean), names = (st.getAttribute('data-names') || '').split(',').filter(Boolean), links = (st.getAttribute('data-links') || '').split(',').filter(Boolean);
    window.ZIKIT.forEach(function (z) { items.push(z[0]); names.push(z[1]); links.push(z[3]); });
    st.setAttribute('data-items', items.join(',')); st.setAttribute('data-names', names.join(',')); st.setAttribute('data-links', links.join(','));
  });
})();
