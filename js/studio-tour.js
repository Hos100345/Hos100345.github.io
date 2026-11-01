/* studio-tour.js — S-125: "🎬 סרטון הסבר" לכל מוצר בסטודיו.
 * כפתור קבוע בצד המסך. לחיצה מפעילה "סרטון": סמן עכבר עובר על הכפתורים האמיתיים של המוצר הפתוח, מסמן כל אחד ומסביר מה הוא עושה.
 * הצעדים נבנים אוטומטית מהממשק של המוצר (טאב, במה, צ'יפים, חלונות הבחירה ומה שבתוכם, כפתור ההזמנה) — מוצר חדש מקבל הסבר בלי קוד נוסף.
 * לא לוחץ באמת על שום דבר ולא משנה את העיצוב. חלונות סגורים נפתחים לרגע ונסגרים בסוף.
 * נגן: ⏯ השהיה, ⏮⏭ צעד, ✕ סגירה, 🔊 הקראה בעברית (אם יש קול עברי במכשיר). מקלדת: רווח, חיצים, Esc. reduced-motion = בלי תנועה חלקה.
 */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = `
.st-tab{position:fixed;z-index:60;left:0;top:42%;display:flex;flex-direction:column;align-items:center;gap:2px;padding:.55rem .5rem .55rem .45rem;border:0;border-radius:0 14px 14px 0;
  background:#14294D;color:#fff;font:700 .78rem/1.15 Rubik,system-ui,sans-serif;box-shadow:0 6px 18px rgba(20,41,77,.3);cursor:pointer;max-width:64px;text-align:center}
.st-tab span{font-size:1.35rem;line-height:1}.st-tab:hover{background:#1E3A6B}.st-tab:focus-visible{outline:3px solid #C9A227;outline-offset:2px}
.st-cur{position:fixed;z-index:10002;left:0;top:0;width:30px;height:30px;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}
.st-cur.mv{transition:left .9s cubic-bezier(.45,.05,.25,1),top .9s cubic-bezier(.45,.05,.25,1)}
.st-ring{position:fixed;z-index:10001;pointer-events:none;border:3px solid #C9A227;border-radius:12px;box-shadow:0 0 0 9999px rgba(10,20,40,.28);transition:all .45s ease}
.st-click{position:fixed;z-index:10001;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #C9A227;pointer-events:none;animation:stclk .6s ease-out forwards}
@keyframes stclk{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
.st-bar{position:fixed;z-index:10003;left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 20px));background:#fff;color:#14294D;border-radius:16px;box-shadow:0 10px 30px rgba(10,20,40,.35);
  padding:.7rem .8rem .6rem;font:1rem/1.5 Rubik,system-ui,sans-serif;direction:rtl}
.st-bar.top{top:calc(10px + env(safe-area-inset-top,0px))}.st-bar.bot{bottom:calc(10px + env(safe-area-inset-bottom,0px))}
.st-cap{min-height:3em;font-weight:600}
.st-row{display:flex;align-items:center;gap:6px;margin-top:.45rem}
.st-row button{min-width:40px;min-height:40px;border:0;border-radius:999px;background:#EEF2FF;color:#14294D;font-size:1.05rem;cursor:pointer}
.st-row button:focus-visible{outline:3px solid #C9A227;outline-offset:2px}.st-row button[aria-pressed="true"]{background:#14294D;color:#fff}
.st-prog{flex:1;height:6px;border-radius:3px;background:#E5E7EB;overflow:hidden}.st-prog i{display:block;height:100%;width:0;background:#C9A227;transition:width .3s}
.st-num{font-size:.8rem;color:#4B5563;font-variant-numeric:tabular-nums;min-width:3.2em;text-align:center}
@media (prefers-reduced-motion:reduce){.st-cur.mv,.st-ring,.st-prog i{transition:none}.st-click{animation:none;opacity:0}}`;
  const CURSOR = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M4 2.5 4 20l4.6-4.3 3.1 6.8 3.2-1.5-3.1-6.7 6.3-.4z" fill="#fff" stroke="#14294D" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  const vis = e => !!e && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const txt = e => (e.textContent || '').replace(/\s+/g, ' ').trim();
  function labelOf(e) {
    if (e.id) { const l = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (l) return txt(l); }
    const r = e.closest('.row'); if (r) { const l = r.querySelector('label'); if (l && l !== e) return txt(l); }
    const w = e.closest('label'); if (w) return txt(w);
    return e.getAttribute('aria-label') || e.getAttribute('placeholder') || '';
  }
  const curProd = () => { try { return typeof cur !== 'undefined' ? cur : null; } catch (e) { return null; } }; // eslint-disable-line no-undef

  function explainControl(e) {
    if (e.matches('input[type=file]')) return { el: e.closest('label,.inline,div') || e, text: '📷 כאן מעלים תמונה — מהטלפון או מהמחשב. אחרי שהיא עולה, לחיצה עליה פותחת חיתוך והסרת רקע.' };
    if (e.matches('.fontbtn')) return { el: e, text: '🔤 כאן בוחרים פונט — נפתח חלון שמראה את הכיתוב שלכם בכל הפונטים, ולוחצים על זה שאוהבים.' };
    if (e.matches('input[type=color]')) return { el: e, text: '🎨 ' + (labelOf(e) || 'צבע') + ' — לוחצים על הריבוע ובוחרים צבע.' };
    if (e.matches('input[type=range]')) return { el: e, text: '↔️ ' + (labelOf(e) || 'כוונון') + ' — מזיזים את המחוון ורואים את השינוי מיד.' };
    if (e.matches('input[type=number]')) return { el: e, text: '🔢 ' + (labelOf(e) || 'מספר') + ' — כותבים מספר או לוחצים על החיצים.' };
    if (e.matches('input[type=checkbox]')) return { el: e.closest('label') || e, text: '☑️ מסמנים אם רוצים: ' + labelOf(e) };
    if (e.matches('select')) return { el: e, text: '📋 ' + (labelOf(e) || 'בחירה') + ' — בוחרים מהרשימה.' };
    if (e.matches('input[type=text],textarea')) return { el: e, text: '✏️ ' + (labelOf(e) ? labelOf(e) + ' — ' : '') + 'כותבים כאן, והכיתוב מופיע מיד על המוצר.' };
    if (e.matches('.seg')) { const o = [...e.querySelectorAll('button')].map(txt).filter(Boolean); return { el: e, text: '👆 בוחרים אחת מהאפשרויות: ' + o.slice(0, 5).join(' · ') + (o.length > 5 ? ' ועוד' : '') + '.' }; }
    if (e.matches('.shqty')) return { el: e, text: '🧮 כמה יחידות — לוחצים על + ועל −.' };
    if (e.matches('.sublist')) return { el: e, text: '🗂️ כאן בוחרים את המוצר עצמו — לוחצים על הכרטיס שלו.' };
    if (e.matches('.mgtext')) return { el: e, text: '✏️ כרטיס כיתוב: כותבים, בוחרים פונט, צבע וקו מסביב — ואפשר גם באלכסון.' };
    if (e.matches('button.btn')) { const t = txt(e); return t ? { el: e, text: '👆 ' + t } : null; }
    return null;
  }
  const CTRL = 'input[type=file],.fontbtn,input[type=color],input[type=range],input[type=number],input[type=checkbox],select,input[type=text],textarea,.seg,.shqty,.sublist,.mgtext,button.btn';

  function stageStep() {
    const ids = [['sh2d', '✋ כאן עורכים ישירות על המוצר: גוררים תמונה או כיתוב, מגדילים בפינה ומסובבים. בטלפון — שתי אצבעות.'], ['mg2d', '✋ כאן עורכים ישירות על הספל: לוחצים על תמונה או כיתוב, גוררים, ⤡ בפינה מגדיל ו-↻ מסובב — גם באלכסון.'],
      ['ad2d', '✋ כאן עורכים את הפרסומת ישירות.'], ['sb3d', '🧊 כאן רואים את המוצר עצמו בתלת־ממד עם העיצוב שלכם — גוררים באצבע כדי לסובב.'], ['mg3d', '🧊 כאן רואים את הספל בתלת־ממד — גוררים כדי לסובב.'],
      ['sh3d', '🧊 כאן רואים את החולצה בתלת־ממד — גוררים כדי לסובב.'], ['v3In', '🧊 כאן רואים את המוצר המודפס בתלת־ממד — גוררים כדי לסובב.'], ['cv', '📄 כאן רואים את הדף בדיוק כמו שהוא יודפס. כל שינוי בצד מופיע כאן מיד.']];
    for (const [id, t] of ids) { const e = document.getElementById(id); if (vis(e)) return { el: e, text: t, click: false }; }
    return null;
  }

  function buildSteps() {
    const S = [], P = curProd(), add = s => { if (s && s.el && vis(s.el)) S.push(s); };
    const tab = document.querySelector('#tabs [aria-selected="true"]') || document.querySelector('.brand');
    add({ el: tab, text: '👋 ' + (P ? P.label.replace(/^\S+\s/, '') + ': ' + (P.intro || '') : 'ככה משתמשים בסטודיו.'), click: false });
    const how = document.getElementById('how'); if (vis(how) && how.children.length) add({ el: how, text: '🏠🖨️ קודם בוחרים: מדפיסים בעצמכם בבית, או שאנחנו מדפיסים ושולחים מוכן.' });
    add(stageStep());
    const chips = [...document.querySelectorAll('#pagebar button')].filter(vis).slice(0, 4);
    chips.forEach(b => { const t = txt(b).length > 2 ? txt(b) : (b.getAttribute('aria-label') || ''); if (t) add({ el: b, text: '👆 ' + t + ' — לוחצים כדי להחליף תצוגה.' }); });
    const skip = d => /^שמירה לקובץ/.test(txt(d.querySelector('summary') || d)); // שמירה/פתיחה מקובץ — לא חלק מהעיצוב
    const NOISE = /^(נקה תמונות|💾|📂)/;
    const secs = [...document.querySelectorAll('#controls details.sec')].filter(d => vis(d) && !skip(d));
    const one = (e, seen, within) => { // מסביר פקד אחד (ומדלג על חלקים של פקד שכבר הוסבר)
      if (e.closest('.seg') && !e.matches('.seg')) return null; if (e.closest('.mgtext') && !e.matches('.mgtext')) return null; if (e.closest('.sublist') && !e.matches('.sublist')) return null; if (e.closest('.shqty') && !e.matches('.shqty')) return null;
      if (e.matches('button.btn') && NOISE.test(txt(e))) return null;
      const row = e.closest('.row') || e; if (seen.has(row)) return null; seen.add(row);
      const s = explainControl(e); if (!s || !vis(s.el)) return null; if (S.length && S[S.length - 1].text === s.text) return null; s.within = within; return s;
    };
    if (!secs.length) { // מוצר בלי חלונות (למשל החולצה) — הפקדים עצמם, לפי הסדר
      const seen = new Set(); let n = 0;
      [...document.querySelectorAll('#controls ' + CTRL.split(',').join(', #controls '))].forEach(e => { if (n >= 10 || !vis(e) || [...document.querySelectorAll('#controls details.sec')].some(d => skip(d) && d.contains(e))) return; const s = one(e, seen, null); if (s) { S.push(s); n++; } });
    }
    secs.forEach(d => {
      const sum = d.querySelector('summary');
      S.push({ el: sum, text: '📂 ' + txt(sum) + ' — לוחצים על הכותרת כדי לפתוח ולסגור.', open: d });
      const seen = new Set(); let n = 0;
      [...d.querySelectorAll(':scope > .body ' + CTRL.split(',').join(', :scope > .body '))]
        .forEach(e => { if (n >= 3) return; const s = one(e, seen, d); if (s) { S.push(s); n++; } });
    });
    const acts = [...document.querySelectorAll('[data-act]')].filter(b => !b.hidden && vis(b));
    const seenAct = new Set();
    acts.forEach(b => {
      const a = b.dataset.act; if (seenAct.has(a)) return; seenAct.add(a);
      const t = a === 'order' ? '🛒 כשהכל מוכן — לוחצים "' + txt(b) + '". משלמים רק אחרי שאישרנו אתכם.' : a === 'home' ? '⬇️ או מורידים קובץ ומדפיסים בבית.' : '⬇️ ' + txt(b);
      add({ el: b, text: t });
    });
    S.push({ el: null, text: '🎉 זהו! אפשר לראות את ההסבר שוב בכל רגע — בכפתור 🎬 בצד.' });
    return S;
  }

  let T = null; // מצב הנגן
  function speak(t) {
    if (!T || !T.voice || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '')); u.lang = 'he-IL'; u.voice = T.voice; u.rate = 1.02; speechSynthesis.speak(u); } catch (e) { /* בלי הקראה */ }
  }
  function hebVoice() { try { return (speechSynthesis.getVoices() || []).find(v => /^he|^iw/i.test(v.lang)) || null; } catch (e) { return null; } }

  function place(step) {
    const { cur, ring, bar } = T;
    if (!step.el) { ring.style.opacity = '0'; cur.style.opacity = '0'; bar.className = 'st-bar bot'; return; }
    ring.style.opacity = '1'; cur.style.opacity = '1';
    const r = step.el.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
    Object.assign(ring.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (Math.min(r.height, vh * .7) + pad * 2) + 'px' });
    const x = Math.max(8, Math.min(vw - 30, r.left + Math.min(r.width * .5, 140))), y = Math.max(8, Math.min(vh - 30, r.top + Math.min(r.height * .5, 60)));
    cur.style.left = x + 'px'; cur.style.top = y + 'px';
    bar.className = 'st-bar ' + (r.top + r.height / 2 > vh * .5 ? 'top' : 'bot');
    return [x, y];
  }
  function show(i) {
    if (!T) return; clearTimeout(T.t); clearTimeout(T.t2);
    T.i = Math.max(0, Math.min(T.steps.length - 1, i)); const s = T.steps[T.i];
    if (s.open && !s.open.open) { s.open.open = true; T.opened.push(s.open); }
    T.cap.textContent = s.text; T.num.textContent = (T.i + 1) + '/' + T.steps.length; T.prog.style.width = ((T.i + 1) / T.steps.length * 100) + '%';
    speak(s.text);
    if (s.el) s.el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: RM ? 'auto' : 'smooth' });
    T.t2 = setTimeout(() => {
      if (!T) return; const p = place(s);
      if (p && s.click !== false) T.t3 = setTimeout(() => { if (!T) return; const c = document.createElement('div'); c.className = 'st-click'; c.style.left = (p[0] + 4) + 'px'; c.style.top = (p[1] + 4) + 'px'; document.body.append(c); setTimeout(() => c.remove(), 700); }, RM ? 0 : 950);
    }, s.el ? (RM ? 60 : 420) : 0);
    if (T.playing) T.t = setTimeout(() => { if (T.i < T.steps.length - 1) show(T.i + 1); else { T.playing = false; T.pp.textContent = '▶'; T.pp.setAttribute('aria-label', 'הפעלה מההתחלה'); T.ended = true; } }, Math.max(3200, s.text.length * 75) + 900);
  }
  function onScroll() { if (T && T.steps[T.i] && T.steps[T.i].el) { T.cur.classList.remove('mv'); place(T.steps[T.i]); requestAnimationFrame(() => T && T.cur.classList.add('mv')); } }
  function close() {
    if (!T) return; clearTimeout(T.t); clearTimeout(T.t2); clearTimeout(T.t3); try { speechSynthesis.cancel(); } catch (e) { /* */ }
    T.opened.forEach(d => { d.open = false; }); [T.cur, T.ring, T.bar].forEach(n => n.remove());
    removeEventListener('scroll', onScroll, true); removeEventListener('resize', onScroll); document.removeEventListener('keydown', onKey, true);
    const back = T.from; T = null; if (back) back.focus();
  }
  function onKey(e) {
    if (!T) return;
    if (e.key === 'Escape') { close(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { show(T.i + 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { show(T.i - 1); e.preventDefault(); }
    else if (e.key === ' ' && e.target.closest && e.target.closest('.st-bar')) { /* כפתור עם פוקוס — הדפדפן לוחץ בעצמו */ }
  }
  function open(from) {
    if (T) close();
    const cur = document.createElement('div'); cur.className = 'st-cur'; cur.innerHTML = CURSOR;
    const ring = document.createElement('div'); ring.className = 'st-ring'; ring.style.opacity = '0';
    const bar = document.createElement('div'); bar.className = 'st-bar bot'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'סרטון הסבר');
    const cap = document.createElement('div'); cap.className = 'st-cap'; cap.setAttribute('aria-live', 'polite');
    const row = document.createElement('div'); row.className = 'st-row';
    const B = (t, a, f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-label', a); b.title = a; b.addEventListener('click', f); return b; };
    const pp = B('⏸', 'השהיה', () => { if (!T) return; if (T.ended) { T.ended = false; T.playing = true; pp.textContent = '⏸'; pp.setAttribute('aria-label', 'השהיה'); show(0); return; } T.playing = !T.playing; pp.textContent = T.playing ? '⏸' : '▶'; pp.setAttribute('aria-label', T.playing ? 'השהיה' : 'המשך'); if (T.playing) show(T.i); else clearTimeout(T.t); });
    const prev = B('⏮', 'הצעד הקודם', () => T && show(T.i - 1)), next = B('⏭', 'הצעד הבא', () => T && show(T.i + 1));
    const progW = document.createElement('div'); progW.className = 'st-prog'; const prog = document.createElement('i'); progW.append(prog);
    const num = document.createElement('span'); num.className = 'st-num';
    const voice = window.speechSynthesis ? hebVoice() : null;
    const snd = voice ? B('🔊', 'הקראה בקול', () => { if (!T) return; T.voice = T.voice ? null : voice; snd.setAttribute('aria-pressed', String(!!T.voice)); if (T.voice) speak(T.steps[T.i].text); else speechSynthesis.cancel(); }) : null;
    if (snd) snd.setAttribute('aria-pressed', 'false');
    const x = B('✕', 'סגירת ההסבר', close);
    row.append(...[prev, pp, next, progW, num, snd, x].filter(Boolean)); bar.append(cap, row);
    document.body.append(ring, cur, bar);
    T = { cur, ring, bar, cap, prog, num, pp, steps: buildSteps(), i: 0, playing: true, opened: [], from, voice: null, t: 0, t2: 0, t3: 0, ended: false };
    const r0 = from && from.getBoundingClientRect(); if (r0) { cur.style.left = (r0.right + 4) + 'px'; cur.style.top = (r0.top + r0.height / 2) + 'px'; }
    requestAnimationFrame(() => { if (T && !RM) cur.classList.add('mv'); show(0); });
    addEventListener('scroll', onScroll, true); addEventListener('resize', onScroll); document.addEventListener('keydown', onKey, true);
    pp.focus();
  }

  function init() {
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'st-tab'; b.setAttribute('aria-label', 'סרטון הסבר — סמן עכבר מראה איך משתמשים במוצר הזה');
    b.innerHTML = '<span aria-hidden="true">🎬</span>סרטון הסבר'; b.addEventListener('click', () => open(b));
    document.body.append(b);
    if (window.speechSynthesis) try { speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => {}); } catch (e) { /* */ }
  }
  window.StudioTour = { open: () => open(document.querySelector('.st-tab')), close, steps: buildSteps };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
