/* matchito-tour.js — D-103: "🎬 סרטון הסבר" מקיף למחולל מאצ׳טו (matchito.html).
 * באותה רוח כמו js/studio-tour.js (S-125): סמן עכבר עובר על הכפתורים האמיתיים, כתובית, ⏮⏯⏭ ✕, הקראה בעברית — אבל כאן התסריט כתוב
 * ביד: הסרטון מסביר מה שלא כתוב על המסך (למה כל כפתור טוב ומתי משתמשים בו), עם דוגמאות מצוירות, ומחולק לפרקים שאפשר לקפוץ ביניהם.
 *
 * ⛔ לא לוחץ באמת על שום דבר ולא משנה את העיצוב של הלקוחה: הצעדים רק מסמנים ומסבירים. מה שהוא כן עושה — מעביר רגעית בין שלבי המחולל
 *    (goScr, רק כשכבר יש משחק), פותח לרגע <details> סגור ומחזיר אותו, ובסגירה חוזר לשלב ולגלילה שהיו. הדוגמאות הן ציורי SVG מוכנים
 *    בקובץ הזה — לעולם לא התמונות של הלקוחה, ולא נוגעים ב-S.
 * ⛔ אין כאן "Dobble"/"Spot It"/"דאבל" — השם הוא מאצ׳טו.
 */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = `
.mt-tab{position:fixed;z-index:10000;left:0;bottom:84px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:.55rem .5rem .55rem .45rem;border:0;border-radius:0 14px 14px 0;
  background:#4338CA;color:#fff;font-weight:700;font-size:.74rem;line-height:1.15;font-family:inherit;box-shadow:0 6px 18px rgba(67,56,202,.4);cursor:pointer;max-width:64px;text-align:center}
.mt-tab span{font-size:1.35rem;line-height:1}.mt-tab:hover{background:#3730A3}.mt-tab:focus-visible{outline:3px solid #F59E0B;outline-offset:2px}
.mt-cur{position:fixed;z-index:10102;left:0;top:0;width:30px;height:30px;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}
.mt-cur.mv{transition:left .9s cubic-bezier(.45,.05,.25,1),top .9s cubic-bezier(.45,.05,.25,1)}
.mt-ring{position:fixed;z-index:10101;pointer-events:none;border:3px solid #F59E0B;border-radius:12px;box-shadow:0 0 0 9999px rgba(20,16,60,.30);transition:all .45s ease}
.mt-click{position:fixed;z-index:10101;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #F59E0B;pointer-events:none;animation:mtclk .6s ease-out forwards}
@keyframes mtclk{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
.mt-bar{position:fixed;z-index:10103;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 20px));max-height:calc(100vh - 20px);overflow-y:auto;background:#fff;color:#1e1b4b;border-radius:16px;
  box-shadow:0 10px 30px rgba(20,16,60,.4);padding:.6rem .8rem .6rem;font-size:1rem;line-height:1.5;font-family:inherit;direction:rtl}
.mt-bar.top{top:calc(10px + env(safe-area-inset-top,0px))}.mt-bar.bot{bottom:calc(10px + env(safe-area-inset-bottom,0px))}
.mt-ch{font-size:.8rem;font-weight:700;color:#6D28D9;margin-bottom:.2rem}
.mt-ex{display:flex;justify-content:center;margin:.1rem 0 .35rem;background:#F5F3FF;border-radius:12px;padding:.3rem}
.mt-ex[hidden]{display:none}
.mt-ex svg{width:100%;max-width:420px;height:auto;max-height:150px}
.mt-ex .pop{animation:mtpop .5s ease-out both;transform-box:fill-box;transform-origin:center}
@keyframes mtpop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
.mt-cap{min-height:3em;font-weight:600}
.mt-row{display:flex;align-items:center;gap:6px;margin-top:.45rem}
.mt-row button{min-width:40px;min-height:40px;border:0;border-radius:999px;background:#EEF2FF;color:#1e1b4b;font-size:1.05rem;cursor:pointer;font-family:inherit}
.mt-row button:focus-visible,.mt-menu button:focus-visible{outline:3px solid #F59E0B;outline-offset:2px}.mt-row button[aria-pressed="true"],.mt-row button[aria-expanded="true"]{background:#4338CA;color:#fff}
.mt-prog{flex:1;height:6px;border-radius:3px;background:#E5E7EB;overflow:hidden}.mt-prog i{display:block;height:100%;width:0;background:#F59E0B;transition:width .3s}
.mt-num{font-size:.8rem;color:#4B5563;font-variant-numeric:tabular-nums;min-width:3.2em;text-align:center}
.mt-menu{display:flex;flex-direction:column;gap:4px;margin-top:.5rem}
.mt-menu[hidden]{display:none}
.mt-menu button{text-align:right;border:2px solid #E5E7EB;border-radius:10px;background:#fff;color:#1e1b4b;padding:.45rem .7rem;font-weight:600;font-size:.92rem;line-height:1.3;font-family:inherit;cursor:pointer;min-height:40px}
.mt-menu button[aria-current="true"]{border-color:#4338CA;background:#EEF2FF}
@media (max-width:480px){.mt-ex[hidden]{display:none}
.mt-ex svg{max-height:110px}.mt-cap{font-size:.95rem}}
@media (prefers-reduced-motion:reduce){.mt-cur.mv,.mt-ring,.mt-prog i{transition:none}.mt-click{animation:none;opacity:0}.mt-ex .pop{animation:none}}`;
  const CURSOR = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M4 2.5 4 20l4.6-4.3 3.1 6.8 3.2-1.5-3.1-6.7 6.3-.4z" fill="#fff" stroke="#312E81" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  // ── דוגמאות מצוירות (SVG) — תמונות דוגמה מוכנות, לא של הלקוחה ──
  const svg = (w, h, inner) => '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + inner + '</svg>';
  const T = (x, y, s, size, fill, w) => '<text x="' + x + '" y="' + y + '" font-size="' + (size || 14) + '" text-anchor="middle" fill="' + (fill || '#1e1b4b') + '" font-weight="' + (w || 700) + '" font-family="system-ui,Arial,sans-serif">' + s + '</text>';
  const EM = (x, y, e, size) => '<text x="' + x + '" y="' + (y + (size || 26) * .35) + '" font-size="' + (size || 26) + '" text-anchor="middle">' + e + '</text>';
  const arrow = (x1, y, x2) => '<path d="M' + x1 + ' ' + y + 'H' + x2 + 'm-8-6 8 6-8 6" fill="none" stroke="#6D28D9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  const face = (x, y, r, skin, hair, id) =>
    '<g' + (id ? ' class="pop" style="animation-delay:' + id * .18 + 's"' : '') + '><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + skin + '"/>' +
    '<path d="M' + (x - r) + ' ' + y + 'a' + r + ' ' + r + ' 0 0 1 ' + 2 * r + ' 0q-' + r + ' -' + r * .55 + ' -' + 2 * r + ' 0z" fill="' + hair + '"/>' +
    '<circle cx="' + (x - r * .35) + '" cy="' + (y + r * .05) + '" r="' + r * .08 + '" fill="#1e1b4b"/><circle cx="' + (x + r * .35) + '" cy="' + (y + r * .05) + '" r="' + r * .08 + '" fill="#1e1b4b"/>' +
    '<path d="M' + (x - r * .35) + ' ' + (y + r * .4) + 'q' + r * .35 + ' ' + r * .3 + ' ' + r * .7 + ' 0" fill="none" stroke="#1e1b4b" stroke-width="' + r * .08 + '" stroke-linecap="round"/></g>';
  const SKIN = ['#F5C9A6', '#E0A87C', '#C68642', '#F8D9BE', '#8D5524'], HAIR = ['#5B3A1E', '#222', '#B5651D', '#C9A227', '#111'];
  const SYM = ['🐶', '🐱', '🌞', '🎈', '🚗', '🍎', '⭐', '🐟', '🌳', '🎁'];
  const COL = ['#FDE68A', '#BFDBFE', '#FBCFE8', '#BBF7D0', '#DDD6FE', '#FED7AA', '#A5F3FC', '#FECACA'];
  // קלף לדוגמה עם n סמלים: מרכז + טבעת
  function card(cx, cy, r, n, round, extra) {
    let o = round ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#FFFEF5" stroke="#4338CA" stroke-width="3"/>' : '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" rx="' + r * .16 + '" fill="#FFFEF5" stroke="#4338CA" stroke-width="3"/>';
    const pts = [[0, 0]]; const k = n - 1;
    for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2 - Math.PI / 2; pts.push([Math.cos(a) * r * .58, Math.sin(a) * r * .58]); }
    const fs = Math.max(12, r * (n <= 4 ? .56 : n <= 6 ? .44 : .38));
    pts.forEach((p, i) => { o += EM(cx + p[0], cy + p[1], SYM[(i + (extra || 0)) % SYM.length], fs); });
    return o;
  }
  const EX = {
    pair: () => svg(420, 140,
      card(100, 70, 58, 4, true, 0).replace(/🐶/, '🐶') + card(320, 70, 58, 4, true, 3) +
      '<circle cx="100" cy="70" r="20" fill="none" stroke="#F59E0B" stroke-width="3" opacity="0"/>' +
      '<path d="M150 70H270" stroke="#F59E0B" stroke-width="3" stroke-dasharray="6 6"/>' + T(210, 58, 'סמל אחד זהה', 14, '#B45309')),
    family: () => {
      let f = '<rect x="6" y="14" width="190" height="112" rx="10" fill="#DBEAFE" stroke="#93C5FD" stroke-width="2"/>';
      [[40, 80], [82, 62], [124, 82], [162, 64], [100, 104]].forEach((p, i) => { f += face(p[0], p[1], i === 4 ? 14 : 19, SKIN[i], HAIR[i]); });
      f += T(101, 140, 'תמונה אחת של כולם', 12, '#4B5563', 600) + arrow(206, 70, 240);
      const xs = [270, 322, 374, 296, 348];
      xs.forEach((x, i) => { const y = i < 3 ? 40 : 100; f += '<circle cx="' + x + '" cy="' + y + '" r="23" fill="#fff" stroke="#6D28D9" stroke-width="3" class="pop" style="animation-delay:' + (i * .2 + .2) + 's"/>' + face(x, y + 2, 17, SKIN[i], HAIR[i], i + 1); });
      return svg(420, 150, f);
    },
    mix: () => {
      let f = '', i = 0;
      [['🐕', '#BFDBFE'], ['🏠', '#FDE68A'], ['🧸', '#FBCFE8']].forEach((p, k) => { f += '<rect x="' + (10 + k * 52) + '" y="14" width="46" height="46" rx="8" fill="' + p[1] + '"/>' + EM(33 + k * 52, 37, p[0], 26); });
      f += T(88, 80, 'התמונות שלכם', 12, '#4B5563', 600);
      ['🍎', '🚗', '🌳', '🎈', '⭐', '🐟'].forEach((e, k) => { const x = 10 + (k % 3) * 52, y = 96 + Math.floor(k / 3) * 0; f += '<rect x="' + x + '" y="' + y + '" width="46" height="46" rx="8" fill="' + COL[k] + '"/>' + EM(x + 23, y + 23, e, 26); });
      f += T(88, 160, 'ספריית הסמלים', 12, '#4B5563', 600) + arrow(184, 90, 222);
      const all = ['🐕', '🏠', '🧸', '🍎', '🚗', '🌳', '🎈', '⭐', '🐟'];
      all.forEach((e, k) => { const x = 250 + (k % 3) * 52, y = 28 + Math.floor(k / 3) * 52; f += '<circle cx="' + (x + 23) + '" cy="' + (y + 23) + '" r="23" fill="#fff" stroke="#6D28D9" stroke-width="2.5" class="pop" style="animation-delay:' + k * .1 + 's"/>' + EM(x + 23, y + 23, e, 24); });
      f += T(326, 190, 'משחק אחד', 12, '#4B5563', 600);
      return svg(420, 196, f);
    },
    sizes: () => svg(420, 150,
      [['13', 4, 70, 'קלפים'], ['31', 6, 210, 'קלפים'], ['57', 8, 350, 'קלפים']].map(c => card(c[2], 62, 52, c[1], true, 0) + T(c[2], 134, c[0] + ' ' + c[3] + ' · ' + c[1] + ' סמלים בקלף', 11, '#1e1b4b', 700)).join('')),
    shapes: () => svg(420, 130, card(110, 62, 52, 5, true, 1) + card(310, 62, 52, 5, false, 1) + T(110, 126, 'עגול', 13) + T(310, 126, 'מרובע', 13)),
    crop: () => svg(420, 150,
      '<rect x="10" y="14" width="230" height="110" rx="8" fill="#BBF7D0" stroke="#86EFAC" stroke-width="2"/>' + face(125, 70, 30, SKIN[1], HAIR[0]) + EM(40, 100, '🌳', 30) + EM(210, 98, '🌳', 30) +
      '<circle cx="125" cy="72" r="42" fill="none" stroke="#F59E0B" stroke-width="3" stroke-dasharray="7 5"/>' + T(125, 142, 'התמונה המקורית + מסגרת החיתוך', 11, '#4B5563', 600) + arrow(250, 70, 284) +
      '<circle cx="350" cy="70" r="46" fill="#fff" stroke="#6D28D9" stroke-width="3"/>' + face(350, 72, 34, SKIN[1], HAIR[0]) + T(350, 142, 'הסמל', 12, '#4B5563', 600)),
    bg: () => svg(420, 150,
      '<rect x="14" y="14" width="150" height="110" rx="8" fill="#93C5FD"/><rect x="14" y="88" width="150" height="36" fill="#86EFAC"/>' + EM(60, 50, '☁️', 26) + EM(120, 40, '☀️', 26) + EM(89, 84, '🐶', 56) + T(89, 142, 'לפני: רקע עמוס', 12, '#4B5563', 600) + arrow(176, 70, 214) +
      '<rect x="226" y="14" width="150" height="110" rx="8" fill="#fff" stroke="#E5E7EB" stroke-width="2"/>' + EM(301, 70, '🐶', 62) + T(301, 142, 'אחרי: הכלב בלבד', 12, '#4B5563', 600) + '<text x="402" y="40" font-size="20">✨</text>'),
    sharp: () => svg(420, 130,
      '<g style="filter:blur(2.5px)">' + face(90, 62, 40, SKIN[0], HAIR[0]) + '</g>' + T(90, 124, 'מטושטש', 13, '#4B5563', 600) + arrow(170, 62, 220) + face(300, 62, 40, SKIN[0], HAIR[0]) + T(300, 124, 'חד', 13, '#4B5563', 600)),
    variety: () => svg(420, 130,
      '<circle cx="90" cy="60" r="52" fill="#FFFEF5" stroke="#4338CA" stroke-width="3"/>' + [[-22, -18], [24, -16], [-20, 24], [26, 22]].map((p, i) => EM(90 + p[0], 60 + p[1], SYM[i], 28)).join('') + T(90, 124, 'כולם באותו גודל', 12, '#4B5563', 600) +
      '<circle cx="320" cy="60" r="52" fill="#FFFEF5" stroke="#4338CA" stroke-width="3"/>' + EM(300, 50, SYM[0], 46) + EM(345, 38, SYM[1], 22) + EM(340, 82, SYM[2], 34) + EM(298, 88, SYM[3], 20) + T(320, 124, 'גודל מגוון', 12, '#4B5563', 600)),
    spacing: () => svg(420, 130,
      '<circle cx="90" cy="60" r="52" fill="#FFFEF5" stroke="#4338CA" stroke-width="3"/>' + [[-20, -17], [22, -15], [-18, 22], [24, 20]].map((p, i) => EM(90 + p[0], 60 + p[1], SYM[i], 24)).join('') + T(90, 124, 'מרווח', 12, '#4B5563', 600) +
      '<circle cx="320" cy="60" r="52" fill="#FFFEF5" stroke="#4338CA" stroke-width="3"/>' + [[-15, -13], [16, -11], [-13, 17], [18, 15]].map((p, i) => EM(320 + p[0], 60 + p[1], SYM[i], 40)).join('') + T(320, 124, 'חפיפה — סמלים גדולים', 12, '#4B5563', 600)),
    label: () => svg(420, 150,
      '<circle cx="110" cy="52" r="38" fill="#fff" stroke="#6D28D9" stroke-width="3"/>' + face(110, 54, 28, SKIN[3], HAIR[1]) + '<rect x="56" y="98" width="108" height="26" rx="10" fill="#fff" stroke="#E5E7EB"/>' + T(110, 117, 'סבתא רחל', 16, '#111827') +
      '<circle cx="300" cy="52" r="38" fill="#fff" stroke="#6D28D9" stroke-width="3"/>' + EM(300, 52, '🐶', 44) + '<rect x="246" y="98" width="108" height="26" rx="10" fill="#fff" stroke="#E5E7EB"/>' + T(300, 117, 'כֶּלֶב', 16, '#111827') + T(205, 144, 'מתחת לכל סמל — השם שלו', 11, '#4B5563', 600)),
    back: () => svg(420, 150,
      '<circle cx="110" cy="72" r="58" fill="#7C3AED"/><circle cx="110" cy="72" r="52" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 6"/>' + EM(110, 62, '⭐', 40) + T(110, 104, 'מזל טוב', 16, '#fff') + T(110, 144, 'גב הקלף', 12, '#4B5563', 600) +
      card(300, 72, 58, 4, true, 0) + T(300, 144, 'חזית הקלף', 12, '#4B5563', 600) + '<path d="M180 72H236" stroke="#F59E0B" stroke-width="3" stroke-dasharray="5 5"/>'),
    home: () => svg(420, 150,
      '<rect x="30" y="20" width="80" height="108" rx="6" fill="#fff" stroke="#9CA3AF" stroke-width="2"/>' + [0, 1, 2].map(i => '<circle cx="' + (52 + (i % 2) * 36) + '" cy="' + (50 + Math.floor(i / 2) * 36 + (i === 2 ? 0 : 0)) + '" r="15" fill="#FFFEF5" stroke="#4338CA" stroke-width="2"/>').join('') + EM(70, 100, '✂️', 22) + T(70, 146, 'בבית: PDF → A4 → גזירה', 11, '#1e1b4b', 700) +
      arrow(140, 70, 176) + '<rect x="190" y="30" width="80" height="80" rx="10" fill="#FDE68A" stroke="#F59E0B" stroke-width="2"/>' + EM(230, 70, '📦', 40) + T(230, 130, 'הזמנה: דפוס מקצועי', 11, '#1e1b4b', 700) + arrow(282, 70, 318) + EM(366, 70, '🏠', 40) + T(366, 108, 'משלוח עד הבית', 11, '#1e1b4b', 700)),
    cards: () => svg(420, 130, [0, 1, 2, 3].map(i => card(52 + i * 105, 60, 44, 4, true, i)).join('') + T(210, 124, 'כל זוג קלפים — סמל משותף אחד בלבד', 12, '#4B5563', 600))
  };

  // ── התסריט ──
  // sel: הפקד האמיתי להדגשה (אם הוא לא נראה — הצעד מוצג בלי טבעת). scr: לאיזה שלב להעביר (רק כשכבר יש משחק). open: <details> לפתיחה זמנית. ex: דוגמה מצוירת. when: 'locked'|'unlocked'
  const CH = [
    { id: 'intro', title: 'ברוכים הבאים', steps: [
      { ex: 'pair', t: '🎴 מאצ׳טו הוא משחק קלפים: בין כל שני קלפים יש בדיוק סמל אחד זהה, ומי שמוצא אותו ראשון — מנצח. כאן מכינים משחק כזה מהתמונות שלכם: המשפחה, החברים, החיות והחפצים האהובים.' },
      { sel: '#lock-tab-code', when: 'locked', t: '🔑 בכניסה בוחרים איך להיכנס. "יש לי קוד" — למי שכבר קיבל קוד גישה או רכש מנוי.' },
      { sel: '#lock-tab-free', when: 'locked', t: '🆓 "הרשמה חינם" נותנת לנסות את המחולל עם משחק קטן של 7 קלפים, בלי תשלום — כדי להבין איך זה עובד לפני שמחליטים.' },
      { sel: '#lock-tab-buy', when: 'locked', t: '🛒 "רכישת מנוי": בוחרים כמה קלפים רוצים במשחק. התשלום חד־פעמי, בלי חיוב חוזר, והגישה נגמרת מעצמה אחרי חודש.' },
      { sel: '.step-ind', when: 'unlocked', t: '🧭 העבודה בשלושה שלבים: 1 — מעלים תמונות. 2 — מסדרים את הקלפים. 3 — מדפיסים. אפשר לחזור אחורה בכל רגע, ושום דבר לא הולך לאיבוד.' }
    ] },
    { id: 'upload', title: 'איך מעלים תמונות', steps: [
      { scr: 1, sel: '#uz', t: '📷 כאן מעלים תמונות: לוחצים ובוחרים מהטלפון או מהמחשב (אפשר כמה ביחד), או גוררים לכאן. כל סוגי התמונות מתקבלים, גם מהאייפון. הכי יפה: תמונות שהנושא בהן ברור ובמרכז — הן ייראו טוב בתוך העיגול.' },
      { scr: 1, sel: '#btn-faces-all', ex: 'family', t: '🙂 יש תמונה אחת של כל המשפחה? לא חותכים אחד־אחד: מעלים אותה ולוחצים "מצא פנים בכל התמונות". כל פרצוף הופך לסמל נפרד, מוכן לקלף. מתמונה אחת יוצאים 5–10 סמלים.' },
      { scr: 1, sel: '#emoji-lib-btn', ex: 'mix', t: '🔎 אין מספיק תמונות? מעלים כמה תמונות בודדות ומשלימים מספריית הסמלים — מאות ציורים מוכנים לפי נושא. אפשר לערבב תמונות אישיות עם ציורים, וככה קל להגיע ל־13 או ל־31 סמלים.' },
      { scr: 1, sel: '#gallery-grid', t: '☑️ כל תמונה שעלתה מופיעה כאן. רק התמונות המסומנות ב־✓ נכנסות למשחק; מי שלא מסומנת נשארת בצד. ה־✕ מוחק תמונה (עם אפשרות ביטול), ו־"סמן הכל" ו"נקה הכל" חוסכים לחיצות.' },
      { scr: 1, sel: '#gallery-count', t: '🔢 המחולל סופר את התמונות המסומנות ובוחר את גודל המשחק הגדול ביותר שמתאים: 7, 13, 21, 31, 57, 73 או 91 קלפים. מספר התמונות הוא מספר הסמלים השונים במשחק כולו.' },
      { scr: 1, sel: '.g-edit', ex: 'crop', t: '✂ התמונה לא מרובעת, או שהנושא בצד? בחיתוך בוחרים בדיוק איזה חלק ייכנס לסמל — למשל רק הפנים — בעיגול או במרובע, ורואים את התוצאה מיד.' },
      { scr: 1, sel: '#btn-bg-selected', ex: 'bg', t: '✨ "הסר רקע" מתאים לחפץ או לחיה על רקע עמוס, כמו כלב על הדשא: הרקע נעלם והכלב נשאר לבדו על הקלף. לפרצופים לא צריך — "מצא פנים" כבר חותך אותם. תמיד אפשר להחזיר רקע בלחיצה על 🖼.' },
      { scr: 1, sel: '#btn-sh-selected', ex: 'sharp', t: '🔍 "חדד" — תמונה קטנה או מעט מטושטשת, שמיועדת להדפסה? החידוד מחזק את הפרטים כדי שתצא חדה גם על נייר. אפשר לבטל בכל רגע.' },
      { scr: 1, sel: '#lab-row', ex: 'label', t: '🏷️ "שם מתחת לתמונה" מתאים לילדים שלומדים לקרוא: מתחת לכל סמל כתוב שמו, אפשר גם עם ניקוד. מדליקים, כותבים את השמות ברשימה אחת (Enter עובר לבא) ואפשר להחליף פונט. הסמלים קטנים מעט יותר כדי לפנות מקום לשם.' }
    ] },
    { id: 'size', title: 'כמה קלפים ואיזו צורה', steps: [
      { scr: 1, sel: '#rec', ex: 'sizes', t: '🧮 כמה קלפים? יותר קלפים = יותר סמלים בכל קלף ויותר גיוון, והמשחק ארוך ומאתגר יותר — אבל הסמלים קטנים יותר. 7 קלפים: ילדים קטנים. 13: ילדים מגיל 6. 21: כל המשפחה. 31: בינוני עד קשה. 57: הגודל הסטנדרטי, 8 סמלים בכל קלף.' },
      { scr: 1, sel: '#shp', ex: 'shapes', t: '⭕⬜ צורת הקלף: עגול, כמו במשחק המוכר, או מרובע. מרובע קל יותר לגזירה בבית. אפשר להחליף בכל שלב.' },
      { scr: 1, sel: '#symshp', t: '🖼️ צורת הסמל: עגול חותך כל תמונה לעיגול; מרובע משאיר יותר מהתמונה — מתאים לתמונות שלא רוצים לגזור מהן את הפינות.' }
    ] },
    { id: 'arrange', title: 'איך מסדרים את הקלף', steps: [
      { scr: 1, sel: '#btn-create', t: '✨ כשהכול מוכן לוחצים "ייצר משחק". המחולל מחשב את כל הקלפים, מבטיח שבין כל שני קלפים יש סמל משותף אחד בדיוק, ומסדר את הסמלים בכל קלף. לוקח כמה שניות.' },
      { scr: 2, sel: '#cgrid', ex: 'cards', t: '🃏 אלה כל הקלפים של המשחק. לוחצים על שני קלפים — ונפתח חלון שמראה את הסמל המשותף שלהם. ככה בודקים שהכול תקין.' },
      { scr: 2, sel: '.card-edit-btn', t: '✏️ על כל קלף יש כפתור עריכה: אפשר להגדיל או להזיז סמל אחד בקלף הזה בלבד, אם משהו נראה צפוף. "אפס קלף" מחזיר את הסידור המקורי.' },
      { scr: 2, sel: '#sl-var', ex: 'variety', t: '↔️ "גיוון בגדלים": כמה הסמלים שונים זה מזה. מעט — כולם בערך באותו גודל. הרבה — חלק גדולים וחלק קטנים, וזה נותן קלפים חיים יותר.' },
      { scr: 2, sel: '#sl-ov', ex: 'spacing', t: '↔️ "חפיפה / מרווח": מרחיקים את הסמלים זה מזה לקלף נקי ומסודר, או מקרבים עד שנוגעים כדי לקבל סמלים גדולים יותר. אין דרך נכונה אחת — תלוי בתמונות.' },
      { scr: 2, sel: '#btn-reshuffle', t: '🔀 לא אהבתם את הסידור? "ערבב מחדש" מסדר את הסמלים בכל הקלפים מחדש. אין סיכון — אפשר לערבב כמה פעמים עד שמתאים.' },
      { scr: 2, sel: '#btn-save-design', t: '💾 "שמור עיצוב" שומר את העבודה כדי לחזור אליה בפעם אחרת. למנויים מחוברים השמירה גם בענן, ולכן אפשר להמשיך ממכשיר אחר.' }
    ] },
    { id: 'back', title: 'גב הקלף', steps: [
      { scr: 2, sel: '#btn-back-design', ex: 'back', t: '🎴 כשמדפיסים קלפים דו־צדדיים, לכל קלף צריך גב. כאן מעצבים אותו: צבע ודוגמה, מסגרת, סמל וכיתוב (למשל "מזל טוב"), ואפשר להוסיף תמונה משלכם. גב אחיד גם מסתיר את החזית — כך אי אפשר לנחש קלף מהצד השני.' },
      { scr: 3, sel: '#chk-back-enabled', t: '☑️ מדליקים את הגב כדי שיכלל בקובץ ההדפסה. אם לא — יודפסו רק החזיתות.' }
    ] },
    { id: 'design', title: 'עיצוב הקלף', steps: [
      { scr: 3, sel: '#sl-card-size', t: '📏 גודל הקלף במילימטרים. 85 מ"מ הוא הגודל הנפוץ. קלף גדול נוח לידיים קטנות; קלף קטן נותן יותר קלפים בדף אחד.' },
      { scr: 3, sel: '#sl-fw', t: '🖼️ מסגרת: עובי וצבע של קו סביב הקלף. מסגרת צבעונית מוסיפה אופי ומסתירה סטיות קטנות של החיתוך.' },
      { scr: 3, sel: '#pick-bg', t: '🎨 צבע רקע לקלף. רקע בהיר מבליט תמונות רגילות; רקע כהה מתאים לסמלים בהירים או לציורים בלי רקע.' }
    ] },
    { id: 'print', title: 'איך מדפיסים', steps: [
      { scr: 3, sel: '#btn-prevprint', t: '👁 "תצוגה מקדימה" מראה איך הדף ייראה לפני שיוצרים קובץ, כדי לוודא שהכול במקום.' },
      { scr: 3, sel: '#btn-doexp', ex: 'home', t: '⚙️ "צור PDF" — להדפסה בבית על דפי A4. עדיף נייר עבה. הקובץ כולל קווי חיתוך, ואחרי ההדפסה גוזרים לפיהם. זו הדרך הזולה והמהירה ביותר.' },
      { scr: 3, sel: '#btn-dozip', t: '🗜️ "ZIP" — כל קלף כקובץ תמונה נפרד. מתאים לשליחה, לשימוש בתוכנה אחרת או לבית דפוס שמבקש תמונות.' },
      { scr: 3, sel: '#btn-doprint', open: 'details#printshop-fold', t: '🖨️ "לבית דפוס": קבצים מוכנים להדפסה מקצועית — עמוד לכל קלף, גיליון גדול וקובץ לחיתוך צורני. את זה מוסרים לבית דפוס. הקבצים כוללים שוליים לחיתוך נקי.' },
      { scr: 3, sel: '#btn-print-order', ex: 'home', t: '💬 לא רוצים לטרוח? מזמינים הדפסה ומשלוח: הקלפים מגיעים עד הבית בגימור מקצועי. הלחיצה פותחת וואטסאפ עם פרטי המשחק שלכם, ואחרי התיאום מוסרים.' },
      { t: '🎉 זהו! מהעלאת התמונות ועד ההדפסה. אפשר לצפות בהסבר שוב בכל רגע — בכפתור 🎬 בצד, ולקפוץ ישר לפרק שמעניין.' }
    ] }
  ];

  const vis = e => !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const $ = s => { try { return document.querySelector(s); } catch (e) { return null; } };
  const locked = () => vis(document.getElementById('lock-screen'));
  const hasGame = () => { try { return typeof S !== 'undefined' && S.canvases && S.canvases.length > 0; } catch (e) { return false; } }; // eslint-disable-line no-undef
  const curScr = () => { for (const n of [1, 2, 3]) { const e = document.getElementById('s' + n); if (e && e.classList.contains('on')) return n; } return 1; };

  function buildSteps() {
    const lk = locked(), out = [], chapters = [];
    CH.forEach(c => {
      const start = out.length;
      c.steps.forEach(s => { if (s.when === 'locked' && !lk) return; if (s.when === 'unlocked' && lk) return; out.push(Object.assign({ ch: chapters.length }, s)); });
      if (out.length > start) chapters.push({ id: c.id, title: c.title, first: start }); else { /* פרק ריק */ }
    });
    out.forEach(s => { if (s.ch >= chapters.length) s.ch = chapters.length - 1; });
    return { steps: out, chapters };
  }

  let P = null; // מצב הנגן
  function speak(t) {
    if (!P || !P.voice || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[\u{1F300}-\u{1FAFF}☀-➿✂]/gu, '').replace(/→/g, '')); u.lang = 'he-IL'; u.voice = P.voice; u.rate = 1.02; speechSynthesis.speak(u); } catch (e) { /* בלי הקראה */ }
  }
  function hebVoice() { try { return (speechSynthesis.getVoices() || []).find(v => /^he|^iw/i.test(v.lang)) || null; } catch (e) { return null; } }

  function place(step, el) {
    const { cur, ring, bar } = P;
    if (!el) { ring.style.opacity = '0'; cur.style.opacity = '0'; bar.className = 'mt-bar bot'; return null; }
    ring.style.opacity = '1'; cur.style.opacity = '1';
    const r = el.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
    Object.assign(ring.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (Math.min(r.height, vh * .6) + pad * 2) + 'px' });
    const x = Math.max(8, Math.min(vw - 30, r.left + Math.min(r.width * .5, 140))), y = Math.max(8, Math.min(vh - 30, r.top + Math.min(r.height * .5, 60)));
    cur.style.left = x + 'px'; cur.style.top = y + 'px';
    bar.className = 'mt-bar ' + (r.top + r.height / 2 > vh * .5 ? 'top' : 'bot');
    return [x, y];
  }
  function ensureScr(n) {
    if (!n || curScr() === n) return;
    if (locked()) return;
    if (n !== 1 && !hasGame()) return;                 // אין משחק — שלבים 2 ו-3 ריקים; לא עוברים אליהם
    try { goScr(n); } catch (e) { /* */ }              // eslint-disable-line no-undef
  }
  function show(i) {
    if (!P) return; clearTimeout(P.t); clearTimeout(P.t2); clearTimeout(P.t3);
    P.i = Math.max(0, Math.min(P.steps.length - 1, i)); const s = P.steps[P.i];
    ensureScr(s.scr);
    if (s.open) { const d = $(s.open); if (d && d.tagName === 'DETAILS' && !d.open) { d.open = true; P.opened.push(d); } }
    const ch = P.chapters[s.ch];
    P.chEl.textContent = 'פרק ' + (s.ch + 1) + ' מתוך ' + P.chapters.length + ' · ' + ch.title;
    P.exEl.textContent = ''; P.exEl.hidden = !s.ex;
    if (s.ex && EX[s.ex]) P.exEl.innerHTML = EX[s.ex]();
    P.cap.textContent = s.t; P.num.textContent = (P.i + 1) + '/' + P.steps.length; P.prog.style.width = ((P.i + 1) / P.steps.length * 100) + '%';
    P.menuBtns.forEach((b, k) => b.setAttribute('aria-current', k === s.ch ? 'true' : 'false'));
    speak(s.t);
    const el = s.sel ? $(s.sel) : null, ok = vis(el);
    if (ok) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: RM ? 'auto' : 'smooth' });
    P.t2 = setTimeout(() => {
      if (!P) return; const p = place(s, ok ? el : null);
      if (p) P.t3 = setTimeout(() => { if (!P) return; const c = document.createElement('div'); c.className = 'mt-click'; c.style.left = (p[0] + 4) + 'px'; c.style.top = (p[1] + 4) + 'px'; document.body.append(c); setTimeout(() => c.remove(), 700); }, RM ? 0 : 950);
    }, ok ? (RM ? 60 : 420) : 0);
    if (P.playing) P.t = setTimeout(() => { if (P.i < P.steps.length - 1) show(P.i + 1); else { P.playing = false; P.pp.textContent = '▶'; P.pp.setAttribute('aria-label', 'הפעלה מההתחלה'); P.ended = true; } }, Math.max(4200, s.t.length * 75));
  }
  function onScroll() { if (P && P.steps[P.i] && P.steps[P.i].sel) { const el = $(P.steps[P.i].sel); if (vis(el)) { P.cur.classList.remove('mv'); place(P.steps[P.i], el); requestAnimationFrame(() => P && P.cur.classList.add('mv')); } } }
  function close() {
    if (!P) return; clearTimeout(P.t); clearTimeout(P.t2); clearTimeout(P.t3); try { speechSynthesis.cancel(); } catch (e) { /* */ }
    P.opened.forEach(d => { d.open = false; });
    [P.cur, P.ring, P.bar].forEach(n => n.remove());
    removeEventListener('scroll', onScroll, true); removeEventListener('resize', onScroll); document.removeEventListener('keydown', onKey, true);
    const back = P.from, scr = P.scr0, y = P.y0; P = null;
    if (scr && curScr() !== scr) { try { goScr(scr); } catch (e) { /* */ } } // eslint-disable-line no-undef
    setTimeout(() => window.scrollTo({ top: y, behavior: 'auto' }), 80);
    if (back) back.focus();
  }
  function onKey(e) {
    if (!P) return;
    if (e.key === 'Escape') { close(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'ArrowLeft') { show(P.i + 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { show(P.i - 1); e.preventDefault(); }
  }
  function open(from) {
    if (P) close();
    const cur = document.createElement('div'); cur.className = 'mt-cur'; cur.innerHTML = CURSOR;
    const ring = document.createElement('div'); ring.className = 'mt-ring'; ring.style.opacity = '0';
    const bar = document.createElement('div'); bar.className = 'mt-bar bot'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'סרטון הסבר');
    const chEl = document.createElement('div'); chEl.className = 'mt-ch';
    const exEl = document.createElement('div'); exEl.className = 'mt-ex'; exEl.setAttribute('aria-hidden', 'true'); exEl.hidden = true;
    const cap = document.createElement('div'); cap.className = 'mt-cap'; cap.setAttribute('aria-live', 'polite');
    const row = document.createElement('div'); row.className = 'mt-row';
    const B = (t, a, f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-label', a); b.title = a; b.addEventListener('click', f); return b; };
    const pp = B('⏸', 'השהיה', () => { if (!P) return; if (P.ended) { P.ended = false; P.playing = true; pp.textContent = '⏸'; pp.setAttribute('aria-label', 'השהיה'); show(0); return; } P.playing = !P.playing; pp.textContent = P.playing ? '⏸' : '▶'; pp.setAttribute('aria-label', P.playing ? 'השהיה' : 'המשך'); if (P.playing) show(P.i); else { clearTimeout(P.t); try { speechSynthesis.cancel(); } catch (e) { /* */ } } });
    const prev = B('⏮', 'הצעד הקודם', () => P && show(P.i - 1)), next = B('⏭', 'הצעד הבא', () => P && show(P.i + 1));
    const progW = document.createElement('div'); progW.className = 'mt-prog'; const prog = document.createElement('i'); progW.append(prog);
    const num = document.createElement('span'); num.className = 'mt-num';
    const voice = window.speechSynthesis ? hebVoice() : null;
    const snd = voice ? B('🔊', 'הקראה בקול', () => { if (!P) return; P.voice = P.voice ? null : voice; snd.setAttribute('aria-pressed', String(!!P.voice)); if (P.voice) speak(P.steps[P.i].t); else speechSynthesis.cancel(); }) : null;
    if (snd) snd.setAttribute('aria-pressed', 'false');
    const menuBtn = B('📑', 'פרקים — קפיצה לפרק', () => { const o = menu.hidden; menu.hidden = !o; menuBtn.setAttribute('aria-expanded', String(o)); });
    menuBtn.setAttribute('aria-expanded', 'false');
    const x = B('✕', 'סגירת ההסבר', close);
    const menu = document.createElement('div'); menu.className = 'mt-menu'; menu.hidden = true; menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'פרקים');
    const built = buildSteps(), menuBtns = [];
    built.chapters.forEach((c, k) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = (k + 1) + '. ' + c.title; b.addEventListener('click', () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); if (P) { P.playing = true; pp.textContent = '⏸'; pp.setAttribute('aria-label', 'השהיה'); P.ended = false; show(c.first); } }); menu.append(b); menuBtns.push(b); });
    row.append(...[prev, pp, next, progW, num, snd, menuBtn, x].filter(Boolean)); bar.append(chEl, exEl, cap, row, menu);
    document.body.append(ring, cur, bar);
    P = { cur, ring, bar, cap, chEl, exEl, prog, num, pp, menuBtns, steps: built.steps, chapters: built.chapters, i: 0, playing: true, opened: [], from, voice: null, t: 0, t2: 0, t3: 0, ended: false, scr0: curScr(), y0: window.scrollY };
    const r0 = from && from.getBoundingClientRect(); if (r0) { cur.style.left = (r0.right + 4) + 'px'; cur.style.top = (r0.top + r0.height / 2) + 'px'; }
    requestAnimationFrame(() => { if (P && !RM) cur.classList.add('mv'); show(0); });
    addEventListener('scroll', onScroll, true); addEventListener('resize', onScroll); document.addEventListener('keydown', onKey, true);
    pp.focus();
  }

  function init() {
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mt-tab'; b.setAttribute('aria-label', 'סרטון הסבר — סמן עכבר מראה איך משתמשים במחולל, פרק אחרי פרק');
    b.innerHTML = '<span aria-hidden="true">🎬</span>סרטון הסבר'; b.addEventListener('click', () => open(b));
    document.body.append(b);
    if (window.speechSynthesis) try { speechSynthesis.getVoices(); } catch (e) { /* */ }
  }
  window.MatchitoTour = { open: () => open(document.querySelector('.mt-tab')), close, build: buildSteps, chapters: CH };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
