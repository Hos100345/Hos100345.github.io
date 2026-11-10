/* subl-3d.js — S-94: מוצרי הסובלימציה (קטלוג זיקית) בתלת־ממד.
 * קובץ עצמאי: לא נוגע בסטודיו ולא בעמוד המשחקים. כל מוצר = פונקציה שמחזירה THREE.Group במ"מ, ממורכז, החזית ל-+z.
 *   SUBL3D.build(id, art, opt)  → {group, spin:'full'|'sway', tilt}   art(wmm,hmm,side) מחזיר קנבס של שטח ההדפסה ('front'/'back')
 *   SUBL3D.fit(group, size)      → Group מנורמל לגובה/רוחב size (לקרוסלה של עמוד המשחקים, שם מוצר ≈ 1.8 יח׳)
 *   SUBL3D.stage(el, opt)        → במה עצמאית: מצלמה, אורות, השתקפויות, צל רך, סיבוב/נדנוד, גרירה
 * עקרונות כמו בחולצה ובספל (S-77/S-91/G-28): שטח ההדפסה בגודל אמיתי במ"מ; בד "מנופח" לפי המרחק מהתפר; צבעים ב-sRGB בלי ACES
 * (ACES מכבה את צבעי ההדפסה); אור חצי־כדורי + שלושה כיווניים; מרקם אריג עדין מוכפל על ההדפסה; צל מגע רך מתחת.
 * three.js r128 — מקומי (js/vendor/three-r128.min.js) או מה שכבר נטען בדף.
 */
(function (W) {
  'use strict';
  const PI = Math.PI;
  const T = () => W.THREE;

  /* ───────── מוצרים: מידות אמיתיות (מ"מ). w/h = שטח ההדפסה כמו ב-SUB_ITEMS בסטודיו ───────── */
  const ITEMS = {
    '7318-4': { kind: 'pouch', name: 'תיק איפור בד קנבס', bw: 250, bh: 175, w: 220, h: 170, fabric: 'canvas', base: '#F4EFE4', two: true },
    '7331-3': { kind: 'pouch', name: 'תיק איפור פשתן עם רצועה', bw: 230, bh: 165, w: 200, h: 135, fabric: 'linen', base: '#EFE8DA', two: true, strap: true },
    '7331-2': { kind: 'pouch', name: 'תיק איפור בד נוצצים', bw: 230, bh: 160, w: 200, h: 120, fabric: 'sparkle', base: '#FFFFFF', two: true },
    '7318-7': { kind: 'pouch', name: 'נרתיק גליטר', bw: 235, bh: 170, w: 235, h: 170, fabric: 'glitter', base: '#C9CDD3', two: true, colors: { '7318-7': ['כסף', '#C9CDD3'], '7318-8': ['ורוד', '#E9B8C6'], '7318-9': ['שמפניה', '#E3CFA8'] } },
    '7324-1': { kind: 'tote', name: 'תיק אלבד 40×33×8', w: 400, h: 330, gusset: 80, handle: 'short' },
    '7324-2': { kind: 'tote', name: 'תיק אלבד 40×33×8 — ידיות ארוכות', w: 400, h: 330, gusset: 80, handle: 'long' },
    '7324-4': { kind: 'tote', name: 'תיק אלבד 40×33 שטוח', w: 400, h: 330, gusset: 0, handle: 'short' },
    '7324-5': { kind: 'diecut', name: 'תיק אלבד 32×39.5 — ידית חתוכה', w: 320, h: 395 },
    '7622': { kind: 'mitt', name: 'כפפת מטבח לתנור', w: 170, h: 277 },
    '7410-13': { kind: 'mat', name: 'פלייסמנט פשתן', w: 400, h: 305, shape: 'rect', fabric: 'linen', base: '#EFE8DA', t: 2.2, fray: true },
    '7410-16': { kind: 'mat', name: 'פלייסמנט פשתן עגול', w: 340, h: 340, shape: 'circle', fabric: 'linen', base: '#EFE8DA', t: 3 , two: true },
    '7410-14': { kind: 'mat', name: 'פלייסמנט קנבס עם תפר', w: 395, h: 305, shape: 'rounded', fabric: 'canvas', base: '#FFFFFF', t: 2.5, stitch: '#1A1A1A' , two: true },
    '7410-11': { kind: 'mat', name: 'פלייסמנט קנבס עבה', w: 400, h: 300, shape: 'rect', fabric: 'canvas', base: '#F4EFE4', t: 3.5 , two: true },
    '7410-23': { kind: 'coaster', name: 'תחתית פשתן 10×10', w: 100, h: 100, shape: 'rect', fabric: 'linen', base: '#EFE8DA', t: 3.5 , two: true },
    '7410-22': { kind: 'coaster', name: 'תחתית פשתן עם גב בז\'', w: 100, h: 100, shape: 'rect', fabric: 'linen', base: '#EFE8DA', t: 3.5, back: '#CDB896' },
    '7410-24': { kind: 'coaster', name: 'תחתית קנבס עם תפר', w: 108, h: 108, shape: 'rounded', fabric: 'canvas', base: '#FFFFFF', t: 3, stitch: '#1A1A1A' , two: true },
    '7410-25': { kind: 'coaster', name: 'תחתית קנבס עם גב אפור', w: 100, h: 100, shape: 'rect', fabric: 'canvas', base: '#FFFFFF', t: 3.5, back: '#8E9196' },
    '7410-32': { kind: 'coaster', name: 'תחתית פשתן עבה עגולה', w: 105, h: 105, shape: 'circle', fabric: 'linen', base: '#F6F2EA', t: 5 , two: true },
    '7410-33': { kind: 'coaster', name: 'תחתית פשתן עבה מרובעת', w: 106, h: 106, shape: 'rect', fabric: 'linen', base: '#F6F2EA', t: 5 , two: true },
    '8501': { kind: 'mug', name: 'ספל קלאסי', w: 200, h: 95, mh: 98, r: 40, top: 40 },
    '8517': { kind: 'mug', name: 'ספל בעיצוב חדש', w: 200, h: 80, mh: 95, r: 41, top: 43 },
    '8672': { kind: 'opener', name: 'פותחן מוארך בציפוי עור', w: 100, h: 40, style: 'long' },
    '8671': { kind: 'opener', name: 'פותחן מחזיק מפתחות', w: 30, h: 30, style: 'key' },
    '8678': { kind: 'opener', name: 'פותחן מלבני', w: 55, h: 55, style: 'rect' },
    '7611': { kind: 'shade', name: 'וילון צד לרכב — זוג', w: 430, h: 365 },
    // S-131: המתנות מזיקית עם תמונה נקייה (js/print-fit.js) — ההדפסה מולבשת בקוד על שטח ההדפסה האמיתי, כרטיס עם עובי במקום מודל
    '8724-3': { kind: 'mug', name: 'ספל אמייל ענק עם מכסה', w: 200, h: 70, mh: 100, r: 47, top: 48, rimColor: '#1A1A1A', lid: 'dome', knob: '#1A1A1A', hr: .26, ht: 5 },
    '8514': { kind: 'mug', name: 'ספל נאון', w: 200, h: 95, mh: 98, r: 40, top: 40, inner: '#FF6A1F', handle: '#FF6A1F', colors: { '8514-3': ['כתום', '#FF6A1F', { inner: '#FF6A1F', handle: '#FF6A1F' }], '8514-4': ['צהוב', '#FFD60A', { inner: '#FFD60A', handle: '#FFD60A' }], '8514-5': ['ירוק', '#3DBE4E', { inner: '#3DBE4E', handle: '#3DBE4E' }] } },
    '8503-1': { kind: 'mug', name: 'ספל פלא שחור סאטן', w: 190, h: 80, mh: 98, r: 40, top: 40, body: '#1C1C1E', inner: '#111', handle: '#1C1C1E', matte: true },
    '8510': { kind: 'mug', name: 'ספל עם כפית', w: 200, h: 95, mh: 98, r: 40, top: 40, spoon: '#2B5FD9', colors: { '8510-1': ['כחול', '#2B5FD9', { spoon: '#2B5FD9' }], '8510-2': ['תכלת', '#5BC0EB', { spoon: '#5BC0EB' }], '8510-3': ['אדום', '#E03131', { spoon: '#E03131' }], '8510-4': ['ורוד', '#F06595', { spoon: '#F06595' }] } },
    '8714-1': { kind: 'mug', name: 'האג מאג טרמי', w: 200, h: 90, mh: 120, r: 40, top: 43, metal: true, lid: 'clear', hr: .24 },
    '8714-3': { kind: 'vessel', style: 'goblet', name: 'גביע יין נירוסטה', w: 200, h: 70, r: 30, top: 36, bh: 100, stem: 70, metal: true },
    '8715-1': { kind: 'vessel', style: 'mega', name: 'מגה מאג טרמי עם קשית', w: 220, h: 210, r: 42, top: 46, bh: 215, metal: true },
    '8706-1': { kind: 'mug', name: 'ספל טרמי נירוסטה', w: 200, h: 90, mh: 164, r: 38, top: 42, metal: true, lid: 'dome', lidColor: '#1A1A1A', knob: '#1A1A1A', handle: '#1A1A1A', hr: .2, hy: 8 },
    '8703-2': { kind: 'vessel', style: 'bottle', name: 'בקבוק אלומיניום 600 מ״ל', w: 200, h: 110, r: 36, bh: 170, neck: 14, metal: true },
    '8703-1': { kind: 'vessel', style: 'bottle-straw', name: 'בקבוק עם קשית', w: 200, h: 110, r: 36, bh: 165, neck: 22, metal: true },
    '8582': { kind: 'panel', name: 'אבן בזלת 12×22', w: 100, h: 200, bw: 120, bh: 220, t: 10, shape: 'stone', mat: 'stone', base: '#F4F4F2', stand: 'clear', gloss: .5 },
    '8589': { kind: 'panel', name: 'אבן בזלת לב 20×20', w: 200, h: 200, bw: 210, bh: 200, t: 10, shape: 'heart', mat: 'stone', base: '#F4F4F2', stand: 'clear', gloss: .5, printClip: 'heart' },
    '8360-4': { kind: 'panel', name: 'תמונה על עץ עם רגל ניקל', w: 150, h: 200, t: 15, mat: 'wood', edge: '#F3EEE2', stand: 'nickel', radius: .01 },
    '6452': { kind: 'glass', name: 'זכוכית עם מעמד יהלום 18×23', w: 230, h: 180 },
    '6458': { kind: 'panel', name: 'לוח חיתוך זכוכית', w: 280, h: 200, t: 4, mat: 'glass', radius: .08, stand: 'feet', hole: true, spin: 'full', tilt: -1.0 },
    '6424': { kind: 'panel', name: 'מגן קריסטל', w: 150, h: 200, bw: 160, bh: 210, t: 40, mat: 'crystal', radius: .02 },
    '8022-3': { kind: 'photo', key: 'clock', w: 200, h: 200 },
    '6101-H20': { kind: 'panel', name: 'לב מעץ מבריק', w: 198, h: 198, t: 6, shape: 'heart', mat: 'wood', edge: '#E8E2D6', ribbon: '#C9A227', printClip: 'heart' },
    '8707-3': { kind: 'tin', name: 'קופסת מתכת עגולה', w: 150, h: 150, r: 78, bh: 50 },
    '9172-1': { kind: 'cuff', name: 'צמיד אלומיניום', w: 180, h: 35, r: 31 },
    '8670-1': { kind: 'brush', name: 'מברשת שיער', w: 65, h: 105 },
    '8381': { kind: 'panel', name: 'מגנט עץ 10×15', w: 100, h: 150, t: 3, mat: 'wood', edge: '#E9E2D2', gloss: .5, radius: .02 },
    '8609': { kind: 'panel', name: 'תמונה מעור עם מעמד', w: 200, h: 250, bw: 210, bh: 260, t: 8, mat: 'leather', edge: '#F3F1EC', stand: 'easel', radius: .05 },
    '9608': { kind: 'panel', name: 'משקל זכוכית דיגיטלי', w: 260, h: 260, bw: 280, bh: 280, t: 22, mat: 'glass', radius: .06, stand: 'feet', display: true, spin: 'full', tilt: -1.0 },
    '7603': { kind: 'apron', name: 'סינר סובלימציה', w: 570, h: 777 },
    '7410-17': { kind: 'panel', name: 'ראנר שולחן פשתן', w: 1200, h: 320, t: 2.5, mat: 'fabric', fabric: 'linen', base: '#EFE8DA', edge: '#EFE8DA', radius: .005, spin: 'sway', tilt: -.5 },
    '7413': { kind: 'doormat', name: 'שטיחון כניסה', w: 560, h: 250 },
    '6442': { kind: 'glass', name: 'זכוכית עם מעמד יהלום', w: 180, h: 130 },
  };
  const LEATHER = { white: ['לבן', '#F7F5F0'], pink: ['ורוד עתיק', '#D9A3A8'], turq: ['טורקיז', '#4FB3B0'], tan: ['חום בהיר', '#C49A6C'] };

  /* ───────── עזרים ───────── */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) {
    const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }
  function tex(c, srgb = true) { const t = new (T().CanvasTexture)(c); t.anisotropy = 8; if (srgb && T().sRGBEncoding) t.encoding = T().sRGBEncoding; return t; }
  const ppFor = (w, h, max = 1800) => clamp(max / Math.max(w, h), 2, 14);

  /* מרקם אריג (אפור סביב 128) — מוכפל על ההדפסה ומשמש גם כ-bumpMap. כל סוג בד עם חוטים בגודל אמיתי */
  const _weave = {};
  function weave(kind) {
    if (_weave[kind]) return _weave[kind];
    const S = 256, c = cv(S, S), x = c.getContext('2d'), id = x.createImageData(S, S), d = id.data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      let v = 0;
      if (kind === 'linen') { // חוטים עבים ולא אחידים — פשתן
        const a = Math.sin(i * PI / 2.2 + noise(i * .05, j * .3) * 2), b = Math.sin(j * PI / 2.4 + noise(i * .3, j * .05) * 2);
        v = .55 * a * b + .35 * noise(i * .04, j * 1.3) + .25 * noise(i * 1.3, j * .04) + .25 * (hash(i, j) - .5);
      } else if (kind === 'canvas') { // אריגת פשתן צפופה — קנבס
        v = .6 * Math.sin(i * PI / 1.6) * Math.sin(j * PI / 1.6) + .18 * noise(i * .08, j * .08) + .18 * (hash(i, j) - .5);
      } else if (kind === 'nonwoven') { // אלבד — סיבים אקראיים ונקודות לחיצה מעוינות
        v = .35 * noise(i * .15, j * .15) + .3 * noise(i * .6, j * .6) + .25 * (hash(i, j) - .5);
        const u = ((i + j) % 16 + 16) % 16, w2 = ((i - j) % 16 + 16) % 16; if (u < 2 || w2 < 2) v -= .25;
      } else if (kind === 'leather') {
        v = .5 * Math.abs(noise(i * .09, j * .09)) - .35 * Math.abs(noise(i * .3 + 7, j * .3)) + .1 * (hash(i, j) - .5);
      } else if (kind === 'quilt') { // תפרי מעוינים של כפפה
        const u = ((i + j) % 64 + 64) % 64, w2 = ((i - j) % 64 + 64) % 64, e = Math.min(u, 64 - u, w2, 64 - w2);
        v = -.9 * Math.exp(-e * e / 3) + .25 * Math.sin(i * PI / 1.8) * Math.sin(j * PI / 1.8) + .15 * (hash(i, j) - .5);
      } else if (kind === 'mesh') { // רשת של וילון רכב
        const a = i % 6, b = j % 6; v = (a < 2 || b < 2) ? .5 : -.8;
      } else if (kind === 'glitter' || kind === 'sparkle') {
        v = .3 * (hash(i, j) - .5) + (hash(i * 3.1, j * 7.7) > .985 ? 1 : 0) + .12 * Math.sin(i * PI / 1.6) * Math.sin(j * PI / 1.6);
      }
      const g = clamp(128 + v * 70, 0, 255), k = (j * S + i) * 4; d[k] = d[k + 1] = d[k + 2] = g; d[k + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    return (_weave[kind] = c);
  }
  function bumpTex(kind, repMm, w, h) { const t = new (T().CanvasTexture)(weave(kind)); t.wrapS = t.wrapT = T().RepeatWrapping; t.repeat.set(w / repMm, h / repMm); return t; }
  /* "צביעה" של ההדפסה על הבד: ההדפסה, מעליה האריג במצב multiply — כך התמונה נראית בתוך הבד ולא מודבקת עליו */
  function fabricize(c, kind, pp, strength) {
    if (!kind) return c;
    const x = c.getContext('2d'), wv = weave(kind), tile = Math.max(8, Math.round((kind === 'linen' ? 26 : kind === 'nonwoven' ? 40 : kind === 'quilt' ? 60 : 18) * pp / 4));
    const pat = x.createPattern(scaled(wv, tile), 'repeat');
    x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = strength == null ? .35 : strength; x.fillStyle = pat; x.fillRect(0, 0, c.width, c.height); x.restore();
    return c;
  }
  function scaled(src, s) { const c = cv(s, s); c.getContext('2d').drawImage(src, 0, 0, s, s); return c; }

  /* צורות במ"מ, y למטה (כמו בקנבס). ממורכזות סביב 0 */
  function roundRectPts(w, h, r, n = 8) {
    const P = [], cs = [[w / 2 - r, -h / 2 + r, -PI / 2], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI]];
    cs.forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * PI / 2; P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } });
    return P;
  }
  function ellipsePts(rx, ry, n = 72) { const P = []; for (let i = 0; i < n; i++) { const a = i / n * PI * 2; P.push([rx * Math.cos(a), ry * Math.sin(a)]); } return P; }
  function mittPts(w, h) { // אותו קו מתאר כמו subPts('mitt') בסטודיו, ממורכז
    const P = [];
    for (let i = 0; i <= 24; i++) { const a = PI + i / 24 * PI; P.push([w * .36 + w * .36 * Math.cos(a), w * .4 + w * .4 * Math.sin(a)]); }
    P.push([w * .72, h * .42], [w * .9, h * .3]);
    for (let i = 0; i <= 10; i++) { const a = -PI / 2 + i / 10 * PI; P.push([w * .86 + w * .12 * Math.cos(a), h * .36 + w * .12 * Math.sin(a)]); }
    P.push([w * .8, h * .55], [w * .82, h], [w * .04, h], [0, h * .55]);
    return P.map(([x, y]) => [x - w / 2, y - h / 2]);
  }
  function pip(p, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function segD(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L, 0, 1); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); }
  function polyD(p, P) { let d = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, segD(p, P[j], P[i])); return d; }
  function pathOf(x, P) { x.beginPath(); P.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); }
  function shapeOf(P) { const s = new (T().Shape)(); P.forEach((q, i) => i ? s.lineTo(q[0], -q[1]) : s.moveTo(q[0], -q[1])); s.closePath(); return s; }

  /* פנים של מוצר: רקע בצבע הבד + ההדפסה בגודל אמיתי במקום (cx,cy ממרכז), מוכפל באריג */
  function faceCanvas(bw, bh, base, print, pw, ph, fabric, opt = {}) {
    const pp = opt.pp || ppFor(bw, bh), c = cv(bw * pp, bh * pp), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, c.width, c.height);
    if (print) {
      x.save(); x.scale(pp, pp); x.translate(bw / 2 + (opt.cx || 0) - pw / 2, bh / 2 + (opt.cy || 0) - ph / 2);
      if (opt.clip) { pathOf(x, opt.clip.map(([a, b]) => [a + pw / 2, b + ph / 2])); x.clip(); }
      if (opt.alpha != null) x.globalAlpha = opt.alpha;
      x.drawImage(print, 0, 0, pw, ph); x.restore();
    }
    if (opt.after) { x.save(); x.scale(pp, pp); opt.after(x, pp); x.restore(); }
    return fabricize(c, fabric, pp, opt.weave);
  }

  /* ───────── בד "מנופח" (כמו החולצה): רשת על התיבה, עומק לפי המרחק מהתפר, מסכה לפי קו המתאר ───────── */
  function inflated(P, o) {
    const TH = T(), xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bw = x1 - x0, bh = y1 - y0, step = o.step || Math.max(1.2, Math.max(bw, bh) / 150), nx = Math.round(bw / step), ny = Math.round(bh / step);
    const g = new TH.PlaneGeometry(bw, bh, nx, ny), A = g.attributes.position, Z = new Float32Array(A.count);
    for (let i = 0; i < A.count; i++) {
      const X = A.getX(i) + (x0 + x1) / 2, Y = -A.getY(i) + (y0 + y1) / 2, p = [X, Y], inside = pip(p, P), d = polyD(p, P);
      let z = 0;
      if (inside) { const t = Math.min(1, d / o.soft); z = o.depth * Math.sqrt(1 - (1 - t) * (1 - t)); if (o.wrinkle) z += o.wrinkle * noise(X * .02, Y * .025) * Math.min(1, t * 3) + (o.ridge ? o.ridge(X, Y, t) : 0); }
      if (o.flatTop && Y < y0 + o.flatTop) z *= .25 + .75 * clamp((Y - y0) / o.flatTop, 0, 1);
      Z[i] = z; A.setXYZ(i, X, -Y, z);
    }
    // צל עדין בשקעים (כמו AO בחולצה)
    const col = new Float32Array(A.count * 3), Wn = nx + 1;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const n = j * Wn + i, l = Z[j * Wn + Math.max(0, i - 1)], r = Z[j * Wn + Math.min(nx, i + 1)], u = Z[Math.max(0, j - 1) * Wn + i], dn = Z[Math.min(ny, j + 1) * Wn + i];
      const lap = (l + r + u + dn) / 4 - Z[n], edge = clamp(Z[n] / (o.depth * .45), 0, 1), a = clamp(1 - lap * .8 - (1 - edge) * .22, .6, 1);
      col[n * 3] = col[n * 3 + 1] = col[n * 3 + 2] = a;
    }
    g.setAttribute('color', new TH.BufferAttribute(col, 3)); g.computeVertexNormals();
    // מסכה (מורחבת קצת, כדי שהתפר יכסה את השפה)
    const pp = 2, mc = cv(bw * pp, bh * pp), mx = mc.getContext('2d'); mx.fillStyle = '#000'; mx.fillRect(0, 0, mc.width, mc.height);
    mx.scale(pp, pp); mx.translate(-x0, -y0); mx.fillStyle = mx.strokeStyle = '#fff'; pathOf(mx, P); mx.fill(); mx.lineWidth = 1.2; mx.stroke();
    return { g, mask: tex(mc, false), bbox: { x0, x1, y0, y1, w: bw, h: bh } };
  }
  function fabricMat(map, mask, kind, o = {}) {
    const TH = T(), m = new TH.MeshPhysicalMaterial({ color: o.color || 0xffffff, map, alphaMap: mask, alphaTest: .5, vertexColors: true, side: o.side || TH.FrontSide,
      roughness: o.rough != null ? o.rough : .92, metalness: o.metal || 0, bumpMap: kind ? bumpTex(kind, o.rep || 6, o.bw || 100, o.bh || 100) : null, bumpScale: o.bump != null ? o.bump : .35 });
    if (o.sheen !== false) m.sheen = new TH.Color(.3, .3, .3);
    if (o.clearcoat) { m.clearcoat = o.clearcoat; m.clearcoatRoughness = .3; }
    return m;
  }
  /* צינור לאורך קו (תפר/פספול/שפה) */
  function tube(P, r, mat, closed = true, z = 0) {
    const TH = T(), pts = P.map(([x, y]) => new TH.Vector3(x, -y, z)), c = new TH.CatmullRomCurve3(pts, closed, 'centripetal');
    return new TH.Mesh(new TH.TubeGeometry(c, Math.max(32, P.length * 4), r, 10, closed), mat);
  }
  function resample(P, n) { // נקודות במרחקים שווים על מצולע סגור
    const L = [0]; for (let i = 1; i <= P.length; i++) L.push(L[i - 1] + Math.hypot(P[i % P.length][0] - P[i - 1][0], P[i % P.length][1] - P[i - 1][1]));
    const tot = L[L.length - 1], out = []; let k = 0;
    for (let i = 0; i < n; i++) { const s = i / n * tot; while (L[k + 1] < s) k++; const t = (s - L[k]) / ((L[k + 1] - L[k]) || 1), a = P[k], b = P[(k + 1) % P.length]; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    return out;
  }
  /* רצועה שטוחה (ידית של תיק): הפנים הרחבות פונות קדימה (z) */
  function ribbon(curve, width, n) {
    const TH = T(), pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPoint(t), tg = curve.getTangent(t), nx = -tg.y, ny = tg.x, L = Math.hypot(nx, ny) || 1;
      pos.push(p.x + nx / L * width / 2, p.y + ny / L * width / 2, p.z, p.x - nx / L * width / 2, p.y - ny / L * width / 2, p.z); uv.push(0, t, 1, t);
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new TH.BufferGeometry(); g.setAttribute('position', new TH.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new TH.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* שני צדדים מנופחים + תפר. front/back = קנבסים של כל התיבה */
  function pillowPair(P, o) {
    const TH = T(), grp = new TH.Group(), F = inflated(P, o), bb = F.bbox;
    [['front', 1], ['back', -1]].forEach(([side, s]) => {
      const c = o[side], map = c ? tex(c) : null;
      if (map && s < 0) { map.wrapS = TH.RepeatWrapping; map.repeat.x = -1; map.offset.x = 1; } // מאחור — כדי שהגב ייקרא נכון
      const m = fabricMat(map, F.mask, o.kind, { ...o.mat, bw: bb.w, bh: bb.h, side: TH.FrontSide });
      const mesh = new TH.Mesh(F.g, m); if (s < 0) mesh.scale.z = -1; grp.add(mesh);
      const inner = new TH.Mesh(F.g, fabricMat(null, F.mask, null, { color: 0xC9C3B8, side: TH.BackSide, sheen: false })); if (s < 0) inner.scale.z = -1; grp.add(inner);
    });
    if (o.pipe) grp.add(tube(resample(P, 220), o.pipe, o.pipeMat || new TH.MeshPhysicalMaterial({ color: o.pipeColor || 0xE8E2D6, roughness: .9 })));
    return grp;
  }

  /* ───────── לוח (פלייסמנט/תחתית/פותחן/זכוכית): גוף + פני ההדפסה ───────── */
  function slab(P, t, sideMat, o = {}) {
    const TH = T(), g = new TH.ExtrudeGeometry(shapeOf(P), { depth: t, bevelEnabled: !!o.bevel, bevelThickness: o.bevel || 0, bevelSize: o.bevel || 0, bevelSegments: 3, curveSegments: 48 });
    g.translate(0, 0, -t / 2); return new TH.Mesh(g, sideMat);
  }
  function capFace(P, map, mat, z, flip) { // פני ההדפסה: מיפוי UV לפי תיבת הצורה
    const TH = T(), g = new TH.ShapeGeometry(shapeOf(P), 64), A = g.attributes.position, uv = g.attributes.uv;
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let i = 0; i < A.count; i++) { const X = A.getX(i), Y = -A.getY(i); uv.setXY(i, flip ? 1 - (X - x0) / (x1 - x0) : (X - x0) / (x1 - x0), 1 - (Y - y0) / (y1 - y0)); }
    const m = new TH.Mesh(g, mat); m.position.z = z; if (flip) m.rotation.y = PI; return m;
  }

  /* ───────── המוצרים ───────── */
  function buildPouch(it, art, opt) {
    const TH = T(), G = new TH.Group(), bw = it.bw, bh = it.bh, P = roundRectPts(bw, bh, 16, 10);
    const base = (it.colors && opt.color && it.colors[opt.color]) ? it.colors[opt.color][1] : it.base;
    const glit = it.fabric === 'glitter' || it.fabric === 'sparkle';
    const face = side => { const c = faceCanvas(bw, bh, base, art(it.w, it.h, side), it.w, it.h, glit ? null : it.fabric, { cy: 4, weave: .3 });
      if (glit) { // נצנצים: גוון הבד עובר דרך ההדפסה + נקודות אור
        const x = c.getContext('2d'); x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = it.fabric === 'glitter' ? .45 : .12; x.fillStyle = base; x.fillRect(0, 0, c.width, c.height); x.restore();
        const n = Math.round(c.width * c.height / (it.fabric === 'glitter' ? 260 : 900)); for (let i = 0; i < n; i++) { const X = hash(i, 1.7) * c.width, Y = hash(2.3, i) * c.height, r = .6 + hash(i, i * .3) * 1.4;
          x.fillStyle = `rgba(255,255,255,${.25 + hash(i * .7, 9) * .6})`; x.fillRect(X, Y, r, r); } }
      return c; };
    const B = pillowPair(P, {
      depth: 26, soft: 70, wrinkle: 1.4, flatTop: 26, kind: it.fabric === 'glitter' ? 'glitter' : it.fabric, front: face('front'), back: face(it.two ? 'back' : null),
      mat: glit ? { rough: it.fabric === 'glitter' ? .45 : .6, metal: it.fabric === 'glitter' ? .45 : .1, bump: .6, rep: 3, clearcoat: it.fabric === 'glitter' ? .4 : 0, sheen: false } : { rep: it.fabric === 'linen' ? 9 : 5 },
      ridge: (X, Y, t) => -3 * Math.exp(-Math.pow((Y + bh / 2 - 14) / 8, 2)) * t, // קפל מתחת לרוכסן
      pipe: 2.2, pipeColor: new TH.Color(base).multiplyScalar(.93),
    });
    G.add(B);
    // רוכסן לאורך התפר העליון
    const metal = new TH.MeshStandardMaterial({ color: 0xC8C8C8, metalness: .9, roughness: .3 }), zw = bw - 34;
    const tc = cv(1024, 32), tx = tc.getContext('2d'); tx.fillStyle = '#E8E3DA'; tx.fillRect(0, 0, 1024, 32); tx.fillStyle = '#9A9A9A';
    for (let i = 0; i < 1024; i += 8) tx.fillRect(i, 10, 5, 12);
    const tape = new TH.Mesh(new TH.BoxGeometry(zw, 1.4, 9), [0, 1, 2, 3, 4, 5].map(k => new TH.MeshStandardMaterial({ color: 0xE8E3DA, roughness: .85, map: k === 2 ? tex(tc) : null })));
    tape.position.set(0, bh / 2 + .3, 0); G.add(tape);
    const pull = new TH.Group(), slider = new TH.Mesh(new TH.BoxGeometry(10, 4, 11), metal); pull.add(slider);
    const tab = new TH.Mesh(new TH.BoxGeometry(7, 20, 2), metal); tab.position.set(0, -10, 7.5); tab.rotation.x = .25; pull.add(tab);
    const ring = new TH.Mesh(new TH.TorusGeometry(3, .9, 8, 20), metal); ring.position.set(0, -22, 9.5); pull.add(ring);
    pull.position.set(zw / 2 - 8, bh / 2 + 1, 0); G.add(pull);
    if (it.strap) { // רצועת יד מהפינה
      const s = new TH.CatmullRomCurve3([new TH.Vector3(-bw / 2 + 4, bh / 2 - 6, 0), new TH.Vector3(-bw / 2 - 30, bh / 2 + 10, 8), new TH.Vector3(-bw / 2 - 70, bh / 2 - 30, 12), new TH.Vector3(-bw / 2 - 52, bh / 2 - 90, 6), new TH.Vector3(-bw / 2 - 10, bh / 2 - 40, 2), new TH.Vector3(-bw / 2 + 2, bh / 2 - 14, 0)]);
      const strap = new TH.Mesh(new TH.TubeGeometry(s, 80, 4, 8, false), new TH.MeshPhysicalMaterial({ color: new TH.Color(base).multiplyScalar(.9), roughness: .9 }));
      strap.scale.z = .45; G.add(strap);
    }
    return { group: G, spin: 'full' };
  }

  function buildTote(it, art) {
    const TH = T(), G = new TH.Group(), w = it.w, h = it.h, gd = it.gusset, white = 0xFBFBF8;
    const front = faceCanvas(w, h, '#FBFBF8', art(it.w, it.h, 'front'), w, h, 'nonwoven', { weave: .28 });
    const plain = faceCanvas(w, h, '#FBFBF8', null, w, h, 'nonwoven', { pp: 1.5 });
    const panel = (c, z, flip) => { // פאנל עם בטן קלה
      const g = new TH.PlaneGeometry(w, h, 60, 50), A = g.attributes.position;
      for (let i = 0; i < A.count; i++) { const X = A.getX(i), Y = A.getY(i), u = X / (w / 2), v = (Y + h / 2) / h; A.setZ(i, (gd ? gd * .18 : 6) * (1 - u * u) * Math.sin(PI * Math.min(1, v * 1.05)) + 1.5 * noise(X * .02, Y * .02)); }
      g.computeVertexNormals();
      const m = new TH.Mesh(g, new TH.MeshPhysicalMaterial({ map: tex(c), roughness: .95, bumpMap: bumpTex('nonwoven', 14, w, h), bumpScale: .4, side: TH.DoubleSide }));
      m.position.z = z; if (flip) m.rotation.y = PI; return m;
    };
    G.add(panel(front, gd / 2, false), panel(plain, -gd / 2, true));
    const sideMat = new TH.MeshPhysicalMaterial({ color: white, roughness: .95, bumpMap: bumpTex('nonwoven', 14, 80, h), bumpScale: .4, side: TH.DoubleSide });
    if (gd) { // צדדים מקופלים פנימה (V) + תחתית
      [-1, 1].forEach(s => {
        const g = new TH.PlaneGeometry(gd, h, 12, 30), A = g.attributes.position;
        for (let i = 0; i < A.count; i++) { const X = A.getX(i), Y = A.getY(i), f = (1 - Math.abs(X) / (gd / 2)) * 16 * clamp((Y + h / 2) / (h * .6), 0, 1); A.setZ(i, -f); }
        g.computeVertexNormals(); const m = new TH.Mesh(g, sideMat); m.rotation.y = s * PI / 2; m.position.x = s * w / 2; G.add(m);
      });
      const bot = new TH.Mesh(new TH.PlaneGeometry(w, gd), sideMat); bot.rotation.x = PI / 2; bot.position.y = -h / 2; G.add(bot);
    } else {
      G.add(tube([[-w / 2, -h / 2], [-w / 2, h / 2]], 1.2, sideMat, false), tube([[w / 2, -h / 2], [w / 2, h / 2]], 1.2, sideMat, false));
    }
    // תפר עליון מקופל
    const hem = new TH.MeshPhysicalMaterial({ color: 0xF2F2EE, roughness: .95 });
    [gd / 2, -gd / 2].forEach(z => { const b = new TH.Mesh(new TH.BoxGeometry(w, 22, 1.2), hem); b.position.set(0, h / 2 - 11, z + Math.sign(z || 1) * .8); G.add(b); });
    // ידיות: רצועות שטוחות
    const hh = it.handle === 'long' ? 300 : 150, hw = 90;
    [gd / 2, -gd / 2].forEach(z => {
      const pts = [], n = 30; for (let i = 0; i <= n; i++) { const a = i / n * PI; pts.push(new TH.Vector3(-hw * Math.cos(a), h / 2 - 18 + hh * Math.sin(a) * (1 + .1 * Math.sin(a)), z + Math.sign(z || 1) * 2.5 + 6 * Math.sin(a))); }
      G.add(new TH.Mesh(ribbon(new TH.CatmullRomCurve3(pts), 26, 80), new TH.MeshPhysicalMaterial({ color: 0xF4F4F0, roughness: .95, side: TH.DoubleSide, bumpMap: bumpTex('nonwoven', 14, 26, 600), bumpScale: .3 })));
    });
    return { group: G, spin: 'full' };
  }

  function buildDiecut(it, art) {
    const TH = T(), G = new TH.Group(), w = it.w, h = it.h;
    const holeP = roundRectPts(90, 32, 16, 8).map(([x, y]) => [x, y - h / 2 + 42]);
    const mk = (side) => faceCanvas(w, h, '#FBFBF8', side ? art(w, h, side) : null, w, h, 'nonwoven', { weave: .28, after: (x) => { x.save(); x.translate(w / 2, h / 2); x.globalCompositeOperation = 'destination-out'; pathOf(x, holeP); x.fill(); x.restore(); } });
    const mask = cv(w * 2, h * 2), mx = mask.getContext('2d'); mx.fillStyle = '#fff'; mx.fillRect(0, 0, mask.width, mask.height); mx.scale(2, 2); mx.translate(w / 2, h / 2); mx.fillStyle = '#000'; pathOf(mx, holeP); mx.fill();
    const am = tex(mask, false);
    [[mk('front'), 3], [mk(null), -3]].forEach(([c, z]) => {
      const g = new TH.PlaneGeometry(w, h, 50, 60), A = g.attributes.position;
      for (let i = 0; i < A.count; i++) { const X = A.getX(i), Y = A.getY(i); A.setZ(i, Math.sign(z) * (8 * (1 - Math.pow(X / (w / 2), 2)) * Math.sin(PI * clamp((Y + h / 2) / h, 0, 1) * .9) + 1.2 * noise(X * .02, Y * .02))); }
      g.computeVertexNormals();
      const m = new TH.Mesh(g, new TH.MeshPhysicalMaterial({ map: tex(c), alphaMap: am, alphaTest: .5, roughness: .95, bumpMap: bumpTex('nonwoven', 14, w, h), bumpScale: .4, side: z > 0 ? TH.FrontSide : TH.BackSide }));
      m.position.z = 0; G.add(m);
    });
    const edge = new TH.MeshPhysicalMaterial({ color: 0xF2F2EE, roughness: .95 });
    G.add(tube(resample(holeP, 80), 1.6, edge));
    return { group: G, spin: 'full' };
  }

  function buildMitt(it, art) {
    const TH = T(), G = new TH.Group(), w = it.w, h = it.h, P = mittPts(w, h);
    const cuff = 46;
    const face = side => faceCanvas(w, h, '#FAF9F6', side ? art(w, h, side) : null, w, h, 'quilt', { weave: .28,
      after: x => { x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(0, h - cuff, w, cuff); x.strokeStyle = 'rgba(80,80,80,.35)'; x.setLineDash([2.5, 2]); x.lineWidth = .8; x.beginPath(); x.moveTo(0, h - cuff); x.lineTo(w, h - cuff); x.stroke(); } });
    G.add(pillowPair(P, { depth: 20, soft: 40, wrinkle: 1.2, kind: 'quilt', front: face('front'), back: face(null), mat: { rep: 30, bump: .9 }, pipe: 3, pipeColor: 0xD8D6D0 }));
    // לולאת תלייה
    const loop = new TH.Mesh(new TH.TorusGeometry(14, 3, 8, 24, PI), new TH.MeshPhysicalMaterial({ color: 0xD8D6D0, roughness: .9 }));
    loop.rotation.z = PI; loop.position.set(-w / 2 + 18, -h / 2 - 0, 0); G.add(loop);
    return { group: G, spin: 'full' };
  }

  function buildFlat(it, art, kind, showBack) { // פלייסמנט / תחתית
    const TH = T(), G = new TH.Group(), w = it.w, h = it.h, t = it.t;
    const P = it.shape === 'circle' ? ellipsePts(w / 2, h / 2, 96) : it.shape === 'rounded' ? roundRectPts(w, h, Math.min(w, h) * .06, 8) : roundRectPts(w, h, Math.min(w, h) * .012, 3);
    const stitch = it.stitch ? x => { x.save(); x.translate(w / 2, h / 2); x.strokeStyle = it.stitch; x.globalAlpha = .9; x.lineWidth = Math.max(.6, w / 260); x.setLineDash([w / 90, w / 160]);
      const ins = Math.min(w, h) * .045; pathOf(x, it.shape === 'circle' ? ellipsePts(w / 2 - ins, h / 2 - ins) : roundRectPts(w - 2 * ins, h - 2 * ins, Math.max(1, Math.min(w, h) * .06 - ins * .6), 8)); x.stroke(); x.restore(); } : null;
    const fray = it.fray ? x => { x.save(); x.strokeStyle = 'rgba(160,145,120,.55)'; x.lineWidth = .35; for (let i = 0; i < w; i += .9) { const l = 2.5 + 2 * hash(i, 1); x.beginPath(); x.moveTo(i, 0); x.lineTo(i, l); x.moveTo(i, h); x.lineTo(i, h - l); x.stroke(); } x.restore(); } : null;
    const front = faceCanvas(w, h, it.base, art(w, h, 'front'), w, h, it.fabric, { weave: .32, clip: it.shape === 'circle' ? ellipsePts(w / 2, h / 2).map(([a, b]) => [a, b]) : null, after: x => { fray && fray(x); stitch && stitch(x); } });
    const sideMat = new TH.MeshPhysicalMaterial({ color: it.base, roughness: .95, bumpMap: bumpTex(it.fabric, 6, w, h), bumpScale: .3 });
    const backCol = it.back || it.base;
    G.add(slab(P, t, sideMat));
    const bc = it.two && !it.back ? faceCanvas(w, h, it.base, art(w, h, 'back'), w, h, it.fabric, { weave: .32, after: x => { fray && fray(x); stitch && stitch(x); } }) : faceCanvas(w, h, backCol, null, w, h, it.fabric, { pp: Math.min(4, ppFor(w, h)), after: x => stitch && stitch(x) });
    const top = showBack ? bc : front, under = showBack ? front : bc;
    G.add(capFace(P, null, new TH.MeshPhysicalMaterial({ map: tex(top), roughness: .9, bumpMap: bumpTex(it.fabric, it.fabric === 'linen' ? 8 : 5, w, h), bumpScale: .35 }), t / 2 + .05));
    G.add(capFace(P, null, new TH.MeshPhysicalMaterial({ map: tex(under), roughness: .9 }), -t / 2 - .05, true));
    if (it.back) { const band = slab(P, t * .45, new TH.MeshPhysicalMaterial({ color: backCol, roughness: .95 })); band.position.z = showBack ? t * .3 : -t * .3; band.scale.set(1.002, 1.002, 1); G.add(band); }
    if (it.kind === 'coaster' && !showBack) { // סט: אחת עם ההדפסה, השנייה מראה את הגב
      const B2 = buildFlat(it, art, kind, true).group; B2.position.set(w * .62, h * .16, -t * .2); B2.rotation.z = .22; G.position.x = -w * .32;
      const S2 = new TH.Group(); S2.add(G, B2); return { group: S2, spin: 'full', tilt: -1.02 };
    }
    return { group: G, spin: 'full', tilt: -1.12 };
  }

  /* ספל: גליל + ידית טורוס. S-132 — פרמטרים לכל ספלי זיקית: body/inner/handle (צבעים), matte (ספל פלא סאטן), metal (נירוסטה),
   * rimColor (אמייל — שפה שחורה), lid: 'dome' (אמייל/טרמי) | 'clear' (האג-מאג), spoon (צבע כפית בחריץ הידית), taper (טרמי צר למטה) */
  function buildMug(it, art, opt) {
    const TH = T(), G = new TH.Group(), C = 2 * PI * it.r, pp = 6, c = cv(C * pp, it.mh * pp), x = c.getContext('2d');
    const vr = (it.colors && opt && opt.color && it.colors[opt.color]) || null;   // S-133: וריאנט צבע מהמלאי (מק"ט-בן)
    if (vr) it = Object.assign({}, it, vr[2] || {});
    const bodyCol = it.body || '#FDFDFB', metal = !!it.metal, matte = !!it.matte;
    x.fillStyle = bodyCol; x.fillRect(0, 0, c.width, c.height); x.scale(pp, pp);
    const y0 = (it.mh - it.h) / 2, pr = art(it.w, it.h, 'front'), o0 = C * .75 - it.w / 2;
    [o0, o0 - C].forEach(off => x.drawImage(pr, off, y0, it.w, it.h));
    const phys = (o) => new TH.MeshPhysicalMaterial(Object.assign(matte ? { roughness: .55, clearcoat: .15, clearcoatRoughness: .5 } : metal ? { roughness: .28, metalness: .35, clearcoat: .8, clearcoatRoughness: .15 } : { roughness: .2, clearcoat: 1, clearcoatRoughness: .1 }, o));
    const side = phys({ map: tex(c) });
    const solid = phys({ color: new TH.Color(it.handle || bodyCol) });
    const innerCol = new TH.Color(it.inner || (matte ? '#222' : metal ? '#D9DCDF' : '#F2F2EE'));
    G.add(new TH.Mesh(new TH.CylinderGeometry(it.top, it.r, it.mh, 96, 1, true), side));
    const inner = new TH.Mesh(new TH.CylinderGeometry(it.top - 3, it.r - 3, it.mh - 4, 96, 1, true), new TH.MeshPhysicalMaterial({ color: innerCol, roughness: .25, side: TH.BackSide, clearcoat: .6 })); inner.position.y = 2; G.add(inner);
    const bi = new TH.Mesh(new TH.CircleGeometry(it.r - 3, 64), new TH.MeshPhysicalMaterial({ color: innerCol.clone().multiplyScalar(.96), roughness: .3 })); bi.rotation.x = -PI / 2; bi.position.y = -it.mh / 2 + 6; G.add(bi);
    const rimMat = it.rimColor ? phys({ color: new TH.Color(it.rimColor) }) : phys({ color: new TH.Color(it.inner && !it.lid ? it.inner : bodyCol) });
    const rim = new TH.Mesh(new TH.TorusGeometry(it.top - 1.5, it.rimColor ? 2.2 : 1.6, 12, 96), rimMat); rim.rotation.x = PI / 2; rim.position.y = it.mh / 2; G.add(rim);
    const base = new TH.Mesh(new TH.CircleGeometry(it.r, 64), phys({ color: new TH.Color(bodyCol) })); base.rotation.x = PI / 2; base.position.y = -it.mh / 2; G.add(base);
    const R = it.mh * (it.hr || .29), arc = PI * 1.3, hd = new TH.Mesh(new TH.TorusGeometry(R, it.ht || 5.5, 20, 48, arc), solid); hd.rotation.z = -arc / 2; hd.position.set(it.r + R * .42, it.hy || 2, 0); G.add(hd);
    if (it.lid === 'dome') {   // מכסה כיפה (אמייל / טרמי)
      const lc = new TH.Color(it.lidColor || bodyCol), lm = phys({ color: lc });
      const dome = new TH.Mesh(new TH.SphereGeometry(it.top + 1, 64, 24, 0, PI * 2, 0, PI * .42), lm); dome.scale.y = .45; dome.position.y = it.mh / 2 + 1; G.add(dome);
      const lr = new TH.Mesh(new TH.TorusGeometry(it.top + 1, 2.4, 12, 96), it.rimColor ? phys({ color: new TH.Color(it.rimColor) }) : lm); lr.rotation.x = PI / 2; lr.position.y = it.mh / 2 + 1.5; G.add(lr);
      const knob = new TH.Mesh(new TH.SphereGeometry(5, 24, 16), phys({ color: new TH.Color(it.knob || it.rimColor || '#222') })); knob.position.y = it.mh / 2 + 1 + (it.top + 1) * .45 + 2; G.add(knob);
    } else if (it.lid === 'clear') {   // מכסה שקוף (האג-מאג)
      const cm = new TH.MeshPhysicalMaterial({ color: 0xDDE8EE, roughness: .05, transparent: true, opacity: .45, clearcoat: 1, clearcoatRoughness: .03 });
      const disc = new TH.Mesh(new TH.CylinderGeometry(it.top + .5, it.top + .5, 7, 96), cm); disc.position.y = it.mh / 2 + 3.5; G.add(disc);
      const lip = new TH.Mesh(new TH.CylinderGeometry(it.top + 1.5, it.top + 1.5, 3, 96), phys({ color: new TH.Color('#EEF0F2') })); lip.position.y = it.mh / 2 + 1.5; G.add(lip);
    }
    if (it.spoon) {   // כפית עומדת בתוך לולאת הידית (כמו בצילום הקטלוג): ידית הכפית לאורך הידית, הכף מעל
      const sm = phys({ color: new TH.Color(it.spoon) });
      const L = it.mh * .78, sx = it.r + R * .30;
      const stem = new TH.Mesh(new TH.CylinderGeometry(2.6, 3.2, L, 20), sm); stem.position.set(sx, -it.mh * .1, 0); stem.rotation.z = -.06;
      const bowl = new TH.Mesh(new TH.SphereGeometry(10, 32, 24), sm); bowl.scale.set(1, 1.35, .42); bowl.position.set(sx + 4, it.mh * .29 + 13, 0); bowl.rotation.y = PI / 2; bowl.rotation.x = -.15;
      G.add(stem, bowl);
    }
    G.rotation.y = PI / 2; // ההדפסה (מול הידית) — מול המצלמה
    const wrap = new TH.Group(); wrap.add(G); return { group: wrap, spin: 'full' };
  }

  function buildOpener(it, art, opt) {
    const TH = T(), G = new TH.Group(), col = (LEATHER[opt.leather] || LEATHER.white)[1];
    const steel = new TH.MeshStandardMaterial({ color: 0xD4D6D9, metalness: 1, roughness: .22 });
    const leatherSide = new TH.MeshPhysicalMaterial({ color: col, roughness: .55, bumpMap: bumpTex('leather', 20, 100, 100), bumpScale: .5, clearcoat: .3 });
    const face = (pw, ph, P) => capFace(P, null, new TH.MeshPhysicalMaterial({ map: tex(faceCanvas(pw, ph, col, art(it.w, it.h, 'front'), it.w, it.h, 'leather', { weave: .18, pp: 16 })), roughness: .5, clearcoat: .35, bumpMap: bumpTex('leather', 20, pw, ph), bumpScale: .4 }), 0);
    if (it.style === 'long') {
      // גוף עור 130×40 עם ראש פלדה מעוגל ופתח
      const L = 130, Hh = 40, t = 7, P = roundRectPts(L, Hh, 12, 8);
      const body = slab(P, t, leatherSide, { bevel: 1 }); body.position.x = -25; G.add(body);
      const f = face(L, Hh, P); f.position.set(-25, 0, t / 2 + 1.05); G.add(f);
      const outer = new TH.Shape(); outer.absarc(0, 0, 26, -PI * .62, PI * .62, false); outer.lineTo(-6, 16); outer.lineTo(-6, -16); outer.closePath();
      const hole = new TH.Path(); hole.absellipse(4, 0, 10, 13, 0, PI * 2, false, 0); outer.holes.push(hole);
      const head = new TH.Mesh(new TH.ExtrudeGeometry(outer, { depth: 3.5, bevelEnabled: true, bevelThickness: .6, bevelSize: .6, bevelSegments: 2, curveSegments: 40 }), steel);
      head.position.set(46, 0, -1.75); G.add(head);
    } else if (it.style === 'key') {
      const P = roundRectPts(30, 30, 8, 8), t = 6, body = slab(P, t, leatherSide, { bevel: .8 }); G.add(body);
      const f = face(30, 30, P); f.position.z = t / 2 + .85; G.add(f);
      const s = new TH.Shape(); s.moveTo(-11, -15); s.lineTo(11, -15); s.lineTo(11, -26); s.absarc(0, -26, 11, 0, -PI, true); s.closePath();
      const h2 = new TH.Path(); h2.absellipse(0, -27, 6, 4.5, 0, PI * 2, false, 0); s.holes.push(h2);
      const head = new TH.Mesh(new TH.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelThickness: .4, bevelSize: .4, bevelSegments: 2 }), steel); head.position.z = -1.25; G.add(head);
      const link = new TH.Mesh(new TH.TorusGeometry(4, 1, 8, 20), steel); link.position.set(0, 18, 0); link.rotation.y = PI / 2; G.add(link);
      const ring = new TH.Mesh(new TH.TorusGeometry(13, 1.3, 10, 48), steel); ring.position.set(0, 34, 0); ring.rotation.y = .5; G.add(ring);
    } else {
      // פלטת פלדה 95×55 עם פתח, ופנים עור מרובע 55×55
      const s = new TH.Shape(); const pts = roundRectPts(95, 55, 9, 8); pts.forEach((q, i) => i ? s.lineTo(q[0], -q[1]) : s.moveTo(q[0], -q[1])); s.closePath();
      const h2 = new TH.Path(); h2.moveTo(-40, 8); h2.lineTo(-28, 8); h2.absarc(-28, 0, 8, PI / 2, -PI / 2, true); h2.lineTo(-40, -8); h2.closePath(); s.holes.push(h2);
      const plate = new TH.Mesh(new TH.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelThickness: .5, bevelSize: .5, bevelSegments: 2, curveSegments: 24 }), steel); plate.position.z = -1.25; G.add(plate);
      const P = roundRectPts(55, 55, 7, 8), pad = slab(P, 3, leatherSide, { bevel: .6 }); pad.position.set(18, 0, 3); G.add(pad);
      const f = face(55, 55, P); f.position.set(18, 0, 5.15); G.add(f);
    }
    return { group: G, spin: 'sway', tilt: -.15 };
  }

  function buildShade(it, art) {
    const TH = T(), G = new TH.Group(), w = it.w, h = it.h, P = ellipsePts(w / 2, h / 2, 120);
    const frame = new TH.MeshStandardMaterial({ color: 0x1B1B1D, roughness: .5 });
    [-1, 1].forEach(s => {
      const g = new TH.Group(), c = faceCanvas(w, h, '#FFFFFF', art(w, h, 'front'), w, h, 'mesh', { weave: .5, clip: P, pp: 3 });
      const mask = cv(w * 2, h * 2), mx = mask.getContext('2d'); mx.fillStyle = '#000'; mx.fillRect(0, 0, mask.width, mask.height); mx.scale(2, 2); mx.translate(w / 2, h / 2); mx.fillStyle = '#fff'; pathOf(mx, P); mx.fill();
      const panel = new TH.Mesh(new TH.PlaneGeometry(w, h), new TH.MeshStandardMaterial({ map: tex(c), alphaMap: tex(mask, false), transparent: true, opacity: .88, roughness: .8, side: TH.DoubleSide, depthWrite: false }));
      g.add(panel); g.add(tube(resample(P, 160), 2.6, frame));
      [-1, 1].forEach(k => { const cup = new TH.Mesh(new TH.CylinderGeometry(9, 12, 6, 24), new TH.MeshPhysicalMaterial({ color: 0xE6F2F7, roughness: .1, transparent: true, opacity: .55, clearcoat: 1 })); cup.rotation.x = PI / 2; cup.position.set(k * w * .28, h * .43, 3); g.add(cup); });
      g.position.x = s * (w / 2 + 12); g.rotation.y = -s * .12; G.add(g);
    });
    return { group: G, spin: 'sway', tilt: 0 };
  }

  function buildGlass(it, art) {
    const TH = T(), G = new TH.Group(), w = it.w, h = it.h, t = 4;
    const P = roundRectPts(w, h, 2, 2);
    const glass = new TH.MeshPhysicalMaterial({ color: 0xBFE0D8, roughness: .04, metalness: 0, transparent: true, opacity: .5, clearcoat: 1, clearcoatRoughness: .02, reflectivity: .9 });
    G.add(slab(P, t, glass, { bevel: 1.2 }));
    const pr = faceCanvas(w, h, '#FFFFFF', art(w, h, 'front'), w, h, null, { pp: 8 });
    G.add(capFace(P, null, new TH.MeshStandardMaterial({ map: tex(pr), roughness: .35 }), -t / 2 + .3)); // ההדפסה על גב הזכוכית, נראית דרכה
    // מעמד יהלום: אבן שקופה משוננת עם חריץ
    const gem = new TH.Mesh(new TH.CylinderGeometry(22, 38, 30, 8, 1), new TH.MeshPhysicalMaterial({ color: 0xF4FBFF, roughness: .02, transparent: true, opacity: .5, clearcoat: 1, flatShading: true, reflectivity: 1 }));
    gem.position.set(0, -h / 2 - 9, -1); G.add(gem);
    const crown = new TH.Mesh(new TH.CylinderGeometry(38, 30, 10, 8, 1), gem.material); crown.position.set(0, -h / 2 - 29, -1); G.add(crown);
    return { group: G, spin: 'sway', tilt: 0 };
  }

  /* S-131: מוצר מתמונה נקייה + הדפסה מולבשת בקוד (PRINTFIT). קנבס 900×900 → כרטיס עם 6 שכבות עובי מאחור (כמו photoCard בעמוד המשחקים). */
  function buildPhoto(it, art) {
    const TH = T(), G = new TH.Group(), PF = W.PRINTFIT, spec = PF && PF.P[it.key]; if (!spec) throw new Error('subl-3d: no PRINTFIT ' + it.key);
    const mm = spec.mm || 200, c = cv(900, 900), t = tex(c); t.anisotropy = 4;
    const geo = new TH.PlaneGeometry(mm, mm);
    for (let i = 6; i >= 0; i--) {
      const dark = i ? .55 + .05 * (6 - i) : 1;
      const m = new TH.Mesh(geo, new TH.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .35, roughness: .6, color: new TH.Color(dark, dark, dark), side: TH.DoubleSide }));
      m.position.z = -i * mm * .006; m.position.x = -i * mm * .002; G.add(m);
    }
    const pr = art(it.w, it.h, 'front');
    PF.load(it.key, (W.PRINTFIT_BASE || '../images/games/zikit/')).then(im => { PF.render(c, spec, im, pr); t.needsUpdate = true; }).catch(() => {});
    return { group: G, spin: 'sway', tilt: 0 };
  }

  /* ───────── S-134: שאר המתנות מזיקית — מודלים בקוד (לוחות, בקבוקים, לב, קופסה, צמיד, מברשת, סינר, שטיחון) ───────── */
  function heartPts(w, h, n = 96) { // לב ממורכז, y למטה; מתאים לתיבה w×h
    const P = []; for (let i = 0; i < n; i++) { const t = i / n * PI * 2, x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); P.push([x, y]); }
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return P.map(([x, y]) => [(x - x0) / (x1 - x0) * w - w / 2, (y - y0) / (y1 - y0) * h - h / 2]);
  }
  function stonePts(w, h) { // אבן בזלת: מתאר לא סדיר עם שוליים שבורים
    const P = roundRectPts(w, h, Math.min(w, h) * .08, 6); return P.map(([x, y], i) => { const k = 1 + .035 * noise(i * .7, 3) + .02 * (hash(i, 9) - .5); return [x * k, y * k]; });
  }
  const PHYS = (TH, o) => new TH.MeshPhysicalMaterial(o);
  function nickelFoot(TH, G, w, h, t) { // רגל ניקל מאחור (תמונת עץ)
    const m = PHYS(TH, { color: 0xD8DBDF, roughness: .2, metalness: .9 });
    const bar = new TH.Mesh(new TH.CylinderGeometry(5, 5, h * .62, 24), m); bar.rotation.x = -.55; bar.position.set(0, -h * .18, -t / 2 - h * .16); G.add(bar);
    const peg = new TH.Mesh(new TH.CylinderGeometry(4, 4, 14, 16), m); peg.rotation.x = PI / 2; peg.position.set(-w * .3, -h * .36, -t / 2 - 6); G.add(peg);
  }
  function easel(TH, G, w, h, t, col) { // רגל נפתחת מאחור (עור)
    const m = PHYS(TH, { color: col, roughness: .7 });
    const leg = new TH.Mesh(new TH.BoxGeometry(w * .42, h * .78, 2.5), m); leg.rotation.x = -.42; leg.position.set(0, -h * .1, -t / 2 - h * .16); G.add(leg);
  }
  /* לוח מודפס: פני ההדפסה בחזית, עובי, חומר לפי הסוג, מעמד לפי הסוג */
  function buildPanel(it, art) {
    const TH = T(), G = new TH.Group(), w = it.bw || it.w, h = it.bh || it.h, t = it.t || 6, mat = it.mat || 'wood';
    const P = it.shape === 'heart' ? heartPts(w, h) : it.shape === 'stone' ? stonePts(w, h) : it.shape === 'circle' ? ellipsePts(w / 2, h / 2, 96) : roundRectPts(w, h, Math.min(w, h) * (it.radius != null ? it.radius : .04), 8);
    const base = it.base || '#FFFFFF', edge = it.edge || base;
    const front = faceCanvas(w, h, base, art(it.w, it.h, 'front'), it.w, it.h, it.fabric || null, { pp: ppFor(w, h, 1600), cx: it.cx || 0, cy: it.cy || 0, clip: it.printClip === 'heart' ? heartPts(it.w, it.h) : (it.printClip || null), after: it.after ? x => it.after(x, w, h) : null });
    const gloss = it.gloss == null ? .25 : it.gloss;
    if (mat === 'glass' || mat === 'crystal') {
      const glass = PHYS(TH, { color: mat === 'crystal' ? 0xE8F4FF : 0xBFE0D8, roughness: .03, transparent: true, opacity: mat === 'crystal' ? .42 : .5, clearcoat: 1, clearcoatRoughness: .02, reflectivity: .9 });
      G.add(slab(P, t, glass, { bevel: mat === 'crystal' ? 3 : 1.2 }));
      G.add(capFace(P, null, new TH.MeshStandardMaterial({ map: tex(front), roughness: .35 }), mat === 'crystal' ? -t / 2 + 2 : -t / 2 + .3)); // ההדפסה מאחור, נראית דרך הזכוכית
    } else {
      const side = PHYS(TH, mat === 'stone' ? { color: 0x15161A, roughness: .95, flatShading: true } : mat === 'leather' ? { color: edge, roughness: .75, bumpMap: bumpTex('leather', 8, w, h), bumpScale: .4 } : mat === 'rubber' ? { color: edge, roughness: .95 } : { color: edge, roughness: .6 });
      const bv = mat === 'stone' ? 2.5 : it.bevel || 0; G.add(slab(P, t, side, { bevel: bv }));
      const faceMat = mat === 'leather' ? PHYS(TH, { map: tex(front), roughness: .55, bumpMap: bumpTex('leather', 8, w, h), bumpScale: .25 }) : mat === 'fabric' ? PHYS(TH, { map: tex(front), roughness: .95, bumpMap: bumpTex(it.fabric || 'canvas', 5, w, h), bumpScale: .35 }) : PHYS(TH, { map: tex(front), roughness: gloss, clearcoat: mat === 'wood' ? .9 : 0, clearcoatRoughness: .15 });
      G.add(capFace(mat === 'stone' ? P.map(([x, y]) => [x * .93, y * .93]) : P, null, faceMat, t / 2 + bv + .05));   // באבן: הפן הלבן קטן מהאבן, השוליים השבורים נשארים שחורים
      G.add(capFace(P, null, PHYS(TH, { color: it.back || edge, roughness: .8 }), -t / 2 - bv - .05, true));
    }
    if (it.stand === 'nickel') nickelFoot(TH, G, w, h, t);
    if (it.stand === 'easel') easel(TH, G, w, h, t, edge);
    if (it.stand === 'clear') { const m = PHYS(TH, { color: 0xF4FBFF, roughness: .05, transparent: true, opacity: .45, clearcoat: 1 }); [-1, 1].forEach(s => { const c = new TH.Mesh(new TH.BoxGeometry(14, 26, 22), m); c.position.set(s * w * .3, -h / 2 - 6, 0); G.add(c); }); }
    if (it.stand === 'feet') [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const f = new TH.Mesh(new TH.CylinderGeometry(6, 6, 4, 16), PHYS(TH, { color: 0x222, roughness: .9 })); f.rotation.x = PI / 2; f.position.set(a * w * .4, b * h * .4, -t / 2 - 2); G.add(f); });
    if (it.ribbon) { const rm = PHYS(TH, { color: it.ribbon, roughness: .6 }); const r = tube([[-w * .08, -h / 2 - 2], [0, -h / 2 - 34], [w * .08, -h / 2 - 2]], 1.6, rm, false, 0); G.add(r); }
    if (it.display) { const d = new TH.Mesh(new TH.PlaneGeometry(w * .22, h * .09), PHYS(TH, { color: 0x111318, roughness: .3 })); d.position.set(0, h * .36, t / 2 + .2); G.add(d); }
    if (it.hole) { const hm = new TH.Mesh(new TH.TorusGeometry(5, 1.6, 10, 32), PHYS(TH, { color: 0xE5E7EB, roughness: .4 })); hm.position.set(w * .4, h * .38, 0); G.add(hm); }
    return { group: G, spin: it.spin || 'sway', tilt: it.tilt || 0 };
  }

  /* גליל־הדפסה כללי: גוף (אפשר מחודד) עם ההדפסה עוטפת, בלי ידית; בסיס לבקבוקים/גביע/מגה-מאג */
  function printedBody(TH, it, art, o) {
    const r = o.r, top = o.top || o.r, hh = o.h, C = 2 * PI * Math.max(r, top), pp = 6, c = cv(C * pp, hh * pp), x = c.getContext('2d');
    x.fillStyle = o.color || '#FDFDFB'; x.fillRect(0, 0, c.width, c.height); x.scale(pp, pp);
    const pr = art(it.w, it.h, 'front'), y0 = o.py != null ? o.py : (hh - it.h) / 2, o0 = C * .75 - it.w / 2;
    [o0, o0 - C].forEach(off => x.drawImage(pr, off, y0, it.w, it.h));
    const m = PHYS(TH, Object.assign({ map: tex(c), roughness: .22, metalness: o.metal || 0, clearcoat: .9, clearcoatRoughness: .12 }, o.matOpt || {}));
    return new TH.Mesh(new TH.CylinderGeometry(top, r, hh, 96, 1, true), m);
  }
  function buildVessel(it, art) {
    const TH = T(), G = new TH.Group(), white = PHYS(TH, { color: 0xFDFDFB, roughness: .22, metalness: it.metal ? .3 : 0, clearcoat: .9, clearcoatRoughness: .12 }), dark = PHYS(TH, { color: 0x1F2124, roughness: .5 }), steel = PHYS(TH, { color: 0xC9CDD3, roughness: .25, metalness: .9 });
    const body = printedBody(TH, it, art, { r: it.r, top: it.top || it.r, h: it.bh, metal: it.metal ? .3 : 0 }); G.add(body);
    const bot = new TH.Mesh(new TH.CircleGeometry(it.r, 64), white); bot.rotation.x = PI / 2; bot.position.y = -it.bh / 2; G.add(bot);
    const topY = it.bh / 2;
    if (it.style === 'bottle' || it.style === 'bottle-straw') {
      const sh = new TH.Mesh(new TH.CylinderGeometry(it.neck, it.top || it.r, 26, 96, 1, true), white); sh.position.y = topY + 13; G.add(sh);
      const nk = new TH.Mesh(new TH.CylinderGeometry(it.neck, it.neck, 10, 64), white); nk.position.y = topY + 31; G.add(nk);
      if (it.style === 'bottle') {
        const cap = new TH.Mesh(new TH.CylinderGeometry(it.neck + 3, it.neck + 3, 22, 64), dark); cap.position.y = topY + 47; G.add(cap);
        const ring = new TH.Mesh(new TH.TorusGeometry(10, 2, 10, 40), steel); ring.position.set(it.neck + 6, topY + 52, 0); ring.rotation.y = PI / 2; G.add(ring);
        const hook = new TH.Mesh(new TH.TorusGeometry(16, 2.4, 10, 48, PI * 1.7), steel); hook.position.set(it.neck + 22, topY + 50, 0); hook.rotation.y = PI / 2; hook.rotation.x = .4; G.add(hook);
      } else {
        const cap = new TH.Mesh(new TH.CylinderGeometry(it.neck + 5, it.neck + 5, 20, 64), dark); cap.position.y = topY + 46; G.add(cap);
        const lid = new TH.Mesh(new TH.CylinderGeometry(it.neck + 5, it.neck + 5, 6, 64), dark); lid.position.set(-8, topY + 60, 0); lid.rotation.z = .9; G.add(lid);
        const straw = new TH.Mesh(new TH.CylinderGeometry(3.5, 3.5, 34, 20), PHYS(TH, { color: 0x3A3D42, roughness: .4 })); straw.position.set(6, topY + 68, 0); straw.rotation.z = -.35; G.add(straw);
      }
    } else if (it.style === 'goblet') {
      const stem = new TH.Mesh(new TH.CylinderGeometry(5, 7, it.stem, 32), white); stem.position.y = -it.bh / 2 - it.stem / 2; G.add(stem);
      const foot = new TH.Mesh(new TH.CylinderGeometry(it.r * 1.05, it.r * 1.1, 4, 64), white); foot.position.y = -it.bh / 2 - it.stem - 2; G.add(foot);
      const rim = new TH.Mesh(new TH.TorusGeometry(it.top - 1, 1.2, 10, 96), white); rim.rotation.x = PI / 2; rim.position.y = topY; G.add(rim);
      const inner = new TH.Mesh(new TH.CylinderGeometry(it.top - 2, it.r - 2, it.bh - 4, 96, 1, true), PHYS(TH, { color: 0xE6E8EB, roughness: .3, side: TH.BackSide, metalness: .4 })); inner.position.y = 1; G.add(inner);
    } else if (it.style === 'mega') {
      const lidM = PHYS(TH, { color: it.lidColor || 0xFDFDFB, roughness: .2, clearcoat: .9 });
      const lid = new TH.Mesh(new TH.CylinderGeometry(it.top + 2, it.top + 2, 12, 96), lidM); lid.position.y = topY + 6; G.add(lid);
      const dome = new TH.Mesh(new TH.SphereGeometry(it.top + 1, 64, 24, 0, PI * 2, 0, PI * .4), lidM); dome.scale.y = .35; dome.position.y = topY + 12; G.add(dome);
      const straw = new TH.Mesh(new TH.CylinderGeometry(4, 4, 70, 20), PHYS(TH, { color: it.strawColor || 0xFDFDFB, roughness: .3 })); straw.position.set(it.top * .4, topY + 40, 0); straw.rotation.z = -.12; G.add(straw);
      const R = it.bh * .2, arc = PI * 1.3, hd = new TH.Mesh(new TH.TorusGeometry(R, 6, 20, 48, arc), white); hd.rotation.z = -arc / 2; hd.position.set(it.r + R * .45, 0, 0); G.add(hd);
    }
    G.rotation.y = PI / 2; const wrap = new TH.Group(); wrap.add(G); return { group: wrap, spin: 'full' };
  }

  /* קופסת מתכת עגולה עם פלטת אלומיניום מודפסת על המכסה */
  function buildTin(it, art) {
    const TH = T(), G = new TH.Group(), r = it.r, hh = it.bh, steel = PHYS(TH, { color: 0xD4D7DB, roughness: .28, metalness: .9 });
    const box = new TH.Mesh(new TH.CylinderGeometry(r, r, hh, 96), steel); box.position.y = -6; G.add(box);
    const lid = new TH.Mesh(new TH.CylinderGeometry(r + 1.5, r + 1.5, 12, 96), steel); lid.position.y = hh / 2; G.add(lid);
    const pr = faceCanvas(it.w, it.h, '#FFFFFF', art(it.w, it.h, 'front'), it.w, it.h, null, { pp: 8, clip: ellipsePts(it.w / 2, it.h / 2) });
    const plate = new TH.Mesh(new TH.CircleGeometry(it.w / 2, 96), PHYS(TH, { map: tex(pr), roughness: .25, clearcoat: .8 })); plate.rotation.x = -PI / 2; plate.position.y = hh / 2 + 6.1; G.add(plate);
    const lip = new TH.Mesh(new TH.TorusGeometry(it.w / 2 + 1.5, 1.5, 10, 96), steel); lip.rotation.x = PI / 2; lip.position.y = hh / 2 + 6; G.add(lip);
    G.rotation.x = .95; // רואים את המכסה
    const wrap = new TH.Group(); wrap.add(G); return { group: wrap, spin: 'sway', tilt: 0 };
  }

  /* צמיד אלומיניום פתוח — ההדפסה עוטפת את החוץ */
  function buildCuff(it, art) {
    const TH = T(), G = new TH.Group(), r = it.r, hh = it.h, span = PI * 1.55, C = span * r, pp = 8, c = cv(C * pp, hh * pp), x = c.getContext('2d');
    x.fillStyle = '#FDFDFB'; x.fillRect(0, 0, c.width, c.height); x.scale(pp, pp); x.drawImage(art(it.w, it.h, 'front'), (C - it.w) / 2, 0, it.w, it.h);
    const outer = new TH.Mesh(new TH.CylinderGeometry(r, r, hh, 96, 1, true, -span / 2 + PI, span), PHYS(TH, { map: tex(c), roughness: .25, metalness: .35, clearcoat: .9 })); G.add(outer);
    const inner = new TH.Mesh(new TH.CylinderGeometry(r - 1.5, r - 1.5, hh, 96, 1, true, -span / 2 + PI, span), PHYS(TH, { color: 0xE3E5E8, roughness: .3, metalness: .8, side: TH.BackSide })); G.add(inner);
    const edgeM = PHYS(TH, { color: 0xF2F3F4, roughness: .3, metalness: .6 });
    [hh / 2, -hh / 2].forEach(y => { const e = new TH.Mesh(new TH.TorusGeometry(r - .75, .8, 8, 96, span), edgeM); e.rotation.x = PI / 2; e.rotation.z = -span / 2 + PI; e.position.y = y; G.add(e); });
    const wrap = new TH.Group(); wrap.add(G); return { group: wrap, spin: 'full' };
  }

  /* מברשת שיער עם פלטת אלומיניום מודפסת על הגב */
  function buildBrush(it, art) {
    const TH = T(), G = new TH.Group(), bw = it.w + 8, bh = it.h + 10, black = PHYS(TH, { color: 0x15161A, roughness: .45, clearcoat: .6 });
    const P = ellipsePts(bw / 2, bh / 2, 96).map(([x, y]) => [x, y * (1 + .08 * Math.sign(y))]);
    const head = new TH.Group(); head.add(slab(P, 16, black, { bevel: 3 }));
    const pr = faceCanvas(it.w, it.h, '#FFFFFF', art(it.w, it.h, 'front'), it.w, it.h, null, { pp: 8, clip: ellipsePts(it.w / 2, it.h / 2) });
    head.add(capFace(ellipsePts(it.w / 2, it.h / 2, 96), null, PHYS(TH, { map: tex(pr), roughness: .25, clearcoat: .9 }), 8 + 3.1));
    head.add(capFace(P, null, PHYS(TH, { color: 0x101114, roughness: .9 }), -8 - .05, true)); // צד הסיבים
    head.position.y = bh * .18; G.add(head);
    const handle = new TH.Mesh(new TH.CylinderGeometry(11, 9, 110, 24), black); handle.position.y = -bh / 2 - 40 + bh * .18; G.add(handle);
    return { group: G, spin: 'sway', tilt: 0 };
  }

  /* סינר: בד שטוח בצורת סינר, ההדפסה על כולו, רצועת צוואר וקשירה */
  function buildApron(it, art) {
    const TH = T(), G = new TH.Group(), w = it.w, h = it.h;
    const P = [[-w * .22, -h / 2], [w * .22, -h / 2], [w * .26, -h / 2 + h * .2], [w / 2, -h / 2 + h * .38], [w / 2, h / 2 - w * .03], [w / 2 - w * .03, h / 2], [-w / 2 + w * .03, h / 2], [-w / 2, h / 2 - w * .03], [-w / 2, -h / 2 + h * .38], [-w * .26, -h / 2 + h * .2]];
    const front = faceCanvas(w, h, '#FFFFFF', art(w, h, 'front'), w, h, 'canvas', { weave: .3, pp: ppFor(w, h, 1600) });
    const m = PHYS(TH, { map: tex(front), roughness: .95, bumpMap: bumpTex('canvas', 5, w, h), bumpScale: .3, side: TH.DoubleSide });
    G.add(capFace(P, null, m, 0));
    const str = PHYS(TH, { color: 0xF4F4F2, roughness: .9 });
    G.add(tube([[-w * .2, -h / 2], [-w * .22, -h / 2 - h * .14], [0, -h / 2 - h * .2], [w * .22, -h / 2 - h * .14], [w * .2, -h / 2]], 4, str, false, -1));
    G.add(tube([[w / 2, -h / 2 + h * .4], [w / 2 + w * .18, -h / 2 + h * .36], [w / 2 + w * .3, -h / 2 + h * .46]], 3.5, str, false, -1));
    G.add(tube([[-w / 2, -h / 2 + h * .4], [-w / 2 - w * .18, -h / 2 + h * .36], [-w / 2 - w * .3, -h / 2 + h * .46]], 3.5, str, false, -1));
    return { group: G, spin: 'sway', tilt: 0 };
  }

  /* שטיחון כניסה: מסגרת גומי שחורה עם אינסרט בד מודפס */
  function buildDoormat(it, art) {
    const TH = T(), G = new TH.Group(), bw = it.w + 60, bh = it.h + 60, t = 9;
    const rubber = PHYS(TH, { color: 0x1A1A1A, roughness: .98 });
    G.add(slab(roundRectPts(bw, bh, 14, 8), t, rubber));
    const frame = faceCanvas(bw, bh, '#1A1A1A', null, 1, 1, null, { pp: 4, after: x => { x.strokeStyle = '#2E2E2E'; x.lineWidth = 2; for (let i = 10; i < bw - 10; i += 14) { x.beginPath(); x.arc(i, 14, 5, 0, PI * 2); x.arc(i, bh - 14, 5, 0, PI * 2); x.stroke(); } for (let j = 10; j < bh - 10; j += 14) { x.beginPath(); x.arc(14, j, 5, 0, PI * 2); x.arc(bw - 14, j, 5, 0, PI * 2); x.stroke(); } } });
    G.add(capFace(roundRectPts(bw, bh, 14, 8), null, PHYS(TH, { map: tex(frame), roughness: .98 }), t / 2 + .05));
    const ins = faceCanvas(it.w, it.h, '#FFFFFF', art(it.w, it.h, 'front'), it.w, it.h, 'canvas', { weave: .35 });
    const panel = capFace(roundRectPts(it.w, it.h, 4, 4), null, PHYS(TH, { map: tex(ins), roughness: .95, bumpMap: bumpTex('canvas', 5, it.w, it.h), bumpScale: .35 }), t / 2 + .6); G.add(panel);
    return { group: G, spin: 'full', tilt: -1.05 };
  }

  const BUILD = { pouch: buildPouch, tote: buildTote, diecut: buildDiecut, mitt: buildMitt, mat: buildFlat, coaster: buildFlat, mug: buildMug, opener: buildOpener, shade: buildShade, glass: buildGlass, photo: buildPhoto, panel: buildPanel, vessel: buildVessel, tin: buildTin, cuff: buildCuff, brush: buildBrush, apron: buildApron, doormat: buildDoormat };

  function build(id, art, opt = {}) {
    const it = ITEMS[id]; if (!it) throw new Error('subl-3d: unknown ' + id);
    const r = BUILD[it.kind](it, art || sampleArt, opt);
    r.item = it; return r;
  }
  function fit(group, size = 1.8) {
    const TH = T(), b = new TH.Box3().setFromObject(group), s = new TH.Vector3(); b.getSize(s); const c = new TH.Vector3(); b.getCenter(c);
    const k = size / Math.max(s.x, s.y, s.z * .6); group.position.sub(c); const w = new TH.Group(); w.add(group); w.scale.setScalar(k); return w;
  }

  /* דוגמת הדפסה: שמיים ורודים־תכולים, בלונים וכיתוב (כמו בתמונות של האתר) */
  function sampleArt(wmm, hmm, side) {
    if (side == null) return null;
    const pp = ppFor(wmm, hmm, 1400), c = cv(wmm * pp, hmm * pp), x = c.getContext('2d'), W = c.width, H = c.height;
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, side === 'back' ? '#FDE68A' : '#BFE3FF'); g.addColorStop(1, side === 'back' ? '#FBCFE8' : '#FBD5E8');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const s = Math.min(W, H * 1.4) / 1000, cx = W / 2, cy = H * .42;
    [[-170, -60, 110, '#F43F5E'], [10, -110, 120, '#F59E0B'], [170, -40, 105, '#3B82F6'], [-70, 40, 95, '#22C55E'], [95, 50, 90, '#A855F7']].forEach(([dx, dy, r, col]) => {
      const X = cx + dx * s, Y = cy + dy * s, R = r * s;
      x.strokeStyle = 'rgba(60,60,80,.5)'; x.lineWidth = Math.max(1, R * .05); x.beginPath(); x.moveTo(X, Y + R * 1.1); x.bezierCurveTo(X - R * .3, Y + R * 1.7, X + R * .3, Y + R * 2.2, X, Y + R * 2.9); x.stroke();
      x.fillStyle = col; x.beginPath(); x.ellipse(X, Y, R * .86, R, 0, 0, PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(X - R * .3, Y - R * .38, R * .2, R * .32, -.5, 0, PI * 2); x.fill();
    });
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#1E1B4B';
    const txt = side === 'back' ? 'מזל טוב!' : 'באהבה', fs = Math.min(H * .2, W / (txt.length * .62));
    x.font = `900 ${fs}px Heebo, Rubik, Arial, sans-serif`; x.lineWidth = fs * .14; x.strokeStyle = '#fff'; x.lineJoin = 'round';
    x.strokeText(txt, cx, H * .86); x.fillText(txt, cx, H * .86);
    return c;
  }
  /* הדפסה מתמונה של הלקוח (cover) + כיתוב אופציונלי */
  function photoArt(img, text) {
    return (wmm, hmm, side) => {
      if (side == null) return null;
      const pp = ppFor(wmm, hmm, 1400), c = cv(wmm * pp, hmm * pp), x = c.getContext('2d'), W = c.width, H = c.height;
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s = Math.max(W / iw, H / ih);
      x.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      if (text) { const fs = Math.min(H * .18, W / (text.length * .6)); x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 ${fs}px Heebo, Rubik, Arial, sans-serif`;
        x.lineJoin = 'round'; x.lineWidth = fs * .16; x.strokeStyle = '#fff'; x.strokeText(text, W / 2, H * .86); x.fillStyle = '#1E1B4B'; x.fillText(text, W / 2, H * .86); }
      return c;
    };
  }

  /* ───────── במה ───────── */
  function envMap(r) { // השתקפויות רכות לסטודיו (בלי קבצי HDR): חדר עם אור עליון חם ופסי אור בצדדים
    const TH = T(), sc = new TH.Scene(), c = cv(512, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(.45, '#F3EEE6'); g.addColorStop(1, '#8F8678'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(60, 40, 70, 120); x.fillRect(380, 50, 60, 110);
    const t = tex(c); t.mapping = TH.EquirectangularReflectionMapping;
    const pm = new TH.PMREMGenerator(r), rt = pm.fromEquirectangular(t); pm.dispose(); return rt.texture;
  }
  function stage(el, opt = {}) {
    const TH = T(), r = new TH.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opt.keep });
    r.setPixelRatio(Math.min(2, W.devicePixelRatio || 1)); r.outputEncoding = TH.sRGBEncoding; r.physicallyCorrectLights = false;
    el.innerHTML = ''; el.appendChild(r.domElement); r.domElement.style.display = 'block';
    const sc = new TH.Scene(), cam = new TH.PerspectiveCamera(26, 1, 1, 20000);
    const ENV = envMap(r);
    sc.add(new TH.HemisphereLight(0xffffff, 0xb8ad9a, .5));
    const d1 = new TH.DirectionalLight(0xffffff, .8); d1.position.set(-3, 4, 3.5); sc.add(d1);
    const d2 = new TH.DirectionalLight(0xfff1e0, .3); d2.position.set(3.5, 1, -2.5); sc.add(d2);
    const d3 = new TH.DirectionalLight(0xe8f0ff, .22); d3.position.set(3, -.5, 3); sc.add(d3);
    const holder = new TH.Group(); sc.add(holder);
    // צל מגע רך — אליפסה מטושטשת מתחת למוצר
    const sh = cv(256, 256), sx = sh.getContext('2d'), rg = sx.createRadialGradient(128, 128, 0, 128, 128, 128); rg.addColorStop(0, 'rgba(40,30,15,.45)'); rg.addColorStop(.55, 'rgba(40,30,15,.16)'); rg.addColorStop(1, 'rgba(40,30,15,0)');
    sx.fillStyle = rg; sx.fillRect(0, 0, 256, 256);
    const shadow = new TH.Mesh(new TH.PlaneGeometry(1, 1), new TH.MeshBasicMaterial({ map: tex(sh), transparent: true, depthWrite: false })); shadow.rotation.x = -PI / 2; sc.add(shadow);
    const S = { r, sc, cam, holder, shadow, cur: null, ry: 0, rx: 0, spin: !(W.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), mode: 'full', t0: performance.now(), drag: null, raf: 0 };
    function size() { const w = el.clientWidth || 300, h = el.clientHeight || 300; r.setSize(w, h, false); r.domElement.style.width = '100%'; r.domElement.style.height = '100%'; cam.aspect = w / h; frame(); }
    function frame() { // מצלמה שמכילה את המוצר
      if (!S.cur) return; const b = new TH.Box3().setFromObject(S.cur.wrap), s = new TH.Vector3(); b.getSize(s); const rad = Math.max(s.x, s.y, s.z) * .62 + 1;
      const fov = cam.fov * PI / 180, d = Math.max(rad / Math.tan(fov / 2), rad / Math.tan(fov / 2) / cam.aspect) * (opt.zoom || 1.08);
      cam.position.set(0, rad * .28, d); cam.lookAt(0, 0, 0); cam.near = d / 50; cam.far = d * 10; cam.updateProjectionMatrix();
      shadow.position.y = -s.y / 2 - .5; shadow.scale.set(Math.max(s.x, 40) * 1.25, Math.max(s.z, s.x * .35) * 1.4, 1);
    }
    function set(id, art, o2 = {}) {
      while (holder.children.length) { const o = holder.children.pop(); o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose && m.dispose(); }); }); }
      const res = build(id, art, o2), inner = new TH.Group(); inner.add(res.group);
      // השתקפויות רק לחומרים מבריקים (פלדה, קרמיקה, זכוכית, גליטר) — בד נשאר מט, וצבעי ההדפסה לא נשטפים
      res.group.traverse(n => { if (!n.material) return; [].concat(n.material).forEach(m => { if (m.metalness > .3 || m.clearcoat > 0 || m.transparent) { m.envMap = ENV; m.envMapIntensity = m.metalness > .3 ? 1 : .55; m.needsUpdate = true; } }); });
      const b = new TH.Box3().setFromObject(res.group), c = new TH.Vector3(); b.getCenter(c); res.group.position.sub(c);
      inner.rotation.x = res.tilt || 0; const wrap = new TH.Group(); wrap.add(inner); holder.add(wrap);
      S.cur = { wrap, inner, res }; S.mode = res.spin; S.ry = res.spin === 'full' ? -.5 : 0; S.t0 = performance.now(); frame(); return res;
    }
    const dom = r.domElement; dom.style.touchAction = 'pan-y'; dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', e => { S.drag = { x: e.clientX, y: e.clientY, ry: S.ry, rx: S.rx }; S.spin = false; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => { if (!S.drag) return; S.ry = S.drag.ry + (e.clientX - S.drag.x) * .01; S.rx = clamp(S.drag.rx + (e.clientY - S.drag.y) * .006, -.5, .6); });
    const up = () => { S.drag = null; }; dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
    new ResizeObserver(size).observe(el); size();
    function tick(now) {
      S.raf = requestAnimationFrame(tick); if (!S.cur || document.hidden || !el.clientWidth) return; // מוסתר = לא מציירים
      if (S.spin && !S.drag) { if (S.mode === 'full') S.ry += .007; else S.ry = .55 * Math.sin((now - S.t0) / 2200); }
      S.cur.wrap.rotation.set(S.rx, S.ry, 0); r.render(sc, cam);
    }
    if (!opt.manual) S.raf = requestAnimationFrame(tick);
    S.set = set; S.size = size; S.render = () => { if (S.cur) { S.cur.wrap.rotation.set(S.rx, S.ry, 0); r.render(sc, cam); } }; S.play = v => { S.spin = v; };
    S.dispose = () => { cancelAnimationFrame(S.raf); r.dispose(); };
    return S;
  }

  W.SUBL3D = { ITEMS, LEATHER, build, fit, stage, sampleArt, photoArt };
})(window);
