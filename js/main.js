/* =====================================================
   הושעיה אמן בלונים — main.js
   תוכן האתר נטען מ-js/site-data.js
   ===================================================== */

const SD = window.SITE_DATA || { video: {}, gallery: [], testimonials: [] };

const catLabels = {
  events:      'עיצוב אירועים',
  workshops:   'סדנאות',
  bar:         'בר בלונים ודמויות',
  characters:  'דמויות',
  rooms:       'עיצוב חדרים',
  satisfied:   'לקוחות מרוצים',
  arch:        'קשת',
  numbers:     'מספרים',
  centerpieces:'מרכזי שולחן',
  photocorner: 'פינת צילום',
  garlands:    'גירלנדות',
  printing:    'הדפסה על בלונים',
  hoop:        'חישוק',
  hats:        'כתבים / כובעים מבלונים',
  frame:       'מסגרת',
  column:      'עמוד',
  'bar-chars': 'דמויות של בר בלונים',
  'event-chars':'דמויות של עיצוב אירועים',
};

/* =====================================================
   NAV
   ===================================================== */
const header    = document.getElementById('site-header');
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.getElementById('nav-links');

if (navToggle && navLinks) navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  header.classList.toggle('nav-open', open);
});
if (navLinks) navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    header.classList.remove('nav-open');
  });
});

// ההדר תמיד נשאר נגיש — הוסרה הסתרה-אוטומטית בגלילה למטה (הפכה את כפתור
// התפריט לבלתי-נגיש עד שגוללים בחזרה למעלה, ולקוחות דיווחו שהכפתור
// "נעלם"). נשאר רק אפקט ה-scrolled (רקע/גודל) לפי מיקום הגלילה.
if (header) window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// מעבר לדסקטופ בזמן שהתפריט פתוח — משחררים את נעילת הגלילה ואת מצב התפריט
if (navToggle && navLinks) window.addEventListener('resize', () => {
  if (window.innerWidth >= 860 && navLinks.classList.contains('open')) {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    header.classList.remove('nav-open');
  }
}, { passive: true });

/* =====================================================
   SCROLL ANIMATIONS
   ===================================================== */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* =====================================================
   VIDEO — מוצג אם יש youtubeId או facebookUrl ב-site-data.js
   ===================================================== */
function renderVideo() {
  const v = SD.video || {};
  const container = document.getElementById('video-content');
  if (!container) return;

  if (v.youtubeId && v.youtubeId.trim()) {
    container.innerHTML = `
      <div class="video-wrap reveal">
        <iframe src="https://www.youtube.com/embed/${v.youtubeId.trim()}?rel=0"
                title="הושעיה אמן בלונים" frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen loading="lazy"></iframe>
      </div>`;
    revealObserver.observe(container.querySelector('.reveal'));
  } else if (v.facebookUrl && v.facebookUrl.trim()) {
    const enc = encodeURIComponent(v.facebookUrl.trim());
    container.innerHTML = `
      <div class="video-wrap reveal">
        <iframe src="https://www.facebook.com/plugins/video.php?href=${enc}&width=1200&show_text=false&appId"
                title="הושעיה אמן בלונים" frameborder="0" scrolling="no"
                allowfullscreen loading="lazy"></iframe>
      </div>`;
    revealObserver.observe(container.querySelector('.reveal'));
  } else if (v.driveId && v.driveId.trim()) {
    container.innerHTML = `
      <div class="video-wrap reveal">
        <iframe src="https://drive.google.com/file/d/${v.driveId.trim()}/preview"
                title="הושעיה אמן בלונים — סרטון תדמית" frameborder="0"
                allow="autoplay" allowfullscreen loading="lazy"></iframe>
      </div>`;
    revealObserver.observe(container.querySelector('.reveal'));
  }
  // אם ריק — ה-placeholder מ-HTML נשאר
}
renderVideo();

/* =====================================================
   LIGHTBOX (gallery + testimonial screenshots)
   ===================================================== */
const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.setAttribute('role', 'dialog');
lightbox.setAttribute('aria-modal', 'true');
lightbox.innerHTML = `
  <button class="lightbox-close" aria-label="סגור">✕</button>
  <img src="" alt="" id="lightbox-img">
`;
document.body.appendChild(lightbox);

const lbImg   = lightbox.querySelector('#lightbox-img');
const lbClose = lightbox.querySelector('.lightbox-close');

function openLightbox(src, alt) {
  lbImg.src = src;
  lbImg.alt = alt || '';
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbClose.focus();
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  lbImg.src = '';
}
lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* =====================================================
   GALLERY — lazy paginated render (18 per page)
   ===================================================== */
const galleryGrid = document.getElementById('gallery-grid');
const GAL_PAGE_SIZE = 18;
let galCat  = null;
let galPage = 0;

function makeGalleryItem(item) {
  const div = document.createElement('div');
  div.className = 'gallery-item';
  div.dataset.cat = item.cat;
  div.setAttribute('role', 'button');
  div.setAttribute('tabindex', '0');
  div.setAttribute('aria-label', `הגדל: ${item.alt}`);
  div.innerHTML = `
    <img src="${item.src}" alt="${item.alt}" loading="lazy">
    <div class="gallery-overlay" aria-hidden="true"><span>${catLabels[item.cat] || item.alt}</span></div>`;
  const img = div.querySelector('img');
  const big = item.full || item.src;   // W-30: תמונה גדולה (1600) בהגדלה, קטנה (600) ברשת
  div.addEventListener('click',   () => openLightbox(big, img.alt));
  div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(big, img.alt); });
  return div;
}

function loadGalleryPage() {
  if (!galleryGrid) return;
  const all      = SD.gallery || [];
  const filtered = galCat === 'all' ? all : all.filter(i => i.cat === galCat);
  const start    = galPage * GAL_PAGE_SIZE;

  filtered.slice(start, start + GAL_PAGE_SIZE).forEach(item => {
    galleryGrid.appendChild(makeGalleryItem(item));
  });

  let moreBtn = document.getElementById('gallery-more-btn');
  const remaining = filtered.length - start - GAL_PAGE_SIZE;
  if (remaining > 0) {
    if (!moreBtn) {
      moreBtn = document.createElement('button');
      moreBtn.id = 'gallery-more-btn';
      moreBtn.className = 'gallery-more-btn';
      moreBtn.addEventListener('click', () => { galPage++; loadGalleryPage(); });
      galleryGrid.insertAdjacentElement('afterend', moreBtn);
    }
    moreBtn.textContent = `הצג עוד תמונות (${remaining} נותרו)`;
  } else if (moreBtn) {
    moreBtn.remove();
  }
}

// קטגוריית ברירת מחדל לגלריה — נקבעת לפי data-default-cat על #gallery-grid
if (galleryGrid) setGalleryFilter(galleryGrid.dataset.defaultCat || 'all');

/* W-30: תמונות שהועלו מדף הניהול חיות בטבלה site_gallery בסופאבייס (לא ב-site-data.js).
   הגלריה מוצגת מיד מהרשימה הקבועה, ואז מצטרפות אליה התמונות החדשות. כשל/חסימה → נשארת הרשימה הקבועה. */
(function loadUploadedGallery() {
  if (!window.fetch) return;
  const SB = 'https://sccivxenkyzxolpraexf.supabase.co';
  const KEY = 'sb_publishable_Ctloh48bIY2Lxm_YmTiSGA_1ADr5FDz';
  const PUB = SB + '/storage/v1/object/public/site-gallery/';
  const ctl = window.AbortController ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), 6000);
  fetch(SB + '/rest/v1/site_gallery?select=cat,alt,thumb_path,full_path,sort&thumb_path=like.up/*&order=sort.asc',
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }, signal: ctl ? ctl.signal : undefined })
    .then(r => r.ok ? r.json() : [])
    .then(rows => {
      clearTimeout(t);
      if (!Array.isArray(rows) || !rows.length) return;
      const fresh = rows.map(r => ({ src: PUB + r.thumb_path, full: PUB + r.full_path, cat: r.cat, alt: r.alt || '' }));
      SD.gallery = fresh.concat(SD.gallery || []);   // חדשות קודם
      if (galleryGrid && galCat) setGalleryFilter(galCat);
      if (galleryGrid) galRefreshTabs();
    })
    .catch(() => clearTimeout(t));
})();

/* GALLERY CATEGORY CARDS */
const catConfig = {
  // ── תיקיות ראשיות ──
  events:       { label: 'עיצוב אירועים',           icon: '🎈' },
  workshops:    { label: 'סדנאות',                  icon: '🎪' },
  bar:          { label: 'בר בלונים ודמויות',        icon: '🎪' },
  characters:   { label: 'דמויות',                  icon: '🤡' },
  rooms:        { label: 'עיצוב חדרים',              icon: '🏠' },
  satisfied:    { label: 'לקוחות מרוצים',            icon: '😊' },
  // ── תת-קטגוריות ──
  arch:         { label: 'קשת',                     icon: '🌈' },
  numbers:      { label: 'מספרים',                  icon: '🔢' },
  centerpieces: { label: 'מרכזי שולחן',             icon: '🌸' },
  photocorner:  { label: 'פינת צילום',               icon: '📸' },
  garlands:     { label: 'גירלנדות',                icon: '🌿' },
  printing:     { label: 'הדפסה על בלונים',          icon: '🖨️' },
  hoop:         { label: 'חישוק',                   icon: '⭕' },
  hats:         { label: 'כתבים / כובעים מבלונים',  icon: '🎩' },
  frame:        { label: 'מסגרת',                   icon: '🖼️' },
  column:       { label: 'עמוד',                    icon: '🏛️' },
  'bar-chars':  { label: 'דמויות של בר בלונים',     icon: '🎊' },
  'event-chars':{ label: 'דמויות של עיצוב אירועים', icon: '🎭' },
};


function openGalleryBrowse(cat) {
  setGalleryFilter(cat);
  const sub = document.getElementById('gallery-sub');
  if (sub) sub.textContent = catConfig[cat]?.label || 'גלריה';
}

function setGalleryFilter(cat) {
  if (!galleryGrid) return;
  document.querySelectorAll('.gfilter').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  galCat  = cat;
  galPage = 0;
  galleryGrid.innerHTML = '';
  const moreBtn = document.getElementById('gallery-more-btn');
  if (moreBtn) moreBtn.remove();
  if (!(SD.gallery || []).length) {
    galleryGrid.innerHTML = '<p style="text-align:center;color:#6B7280;padding:2rem;">תמונות מהאירועים שלנו — בפייסבוק ובאינסטגרם</p>';
    return;
  }
  loadGalleryPage();
}

/* W-38: לשוניות לגלריה — מספר תמונות על כל לשונית, לשונית ריקה מוסתרת,
   קפיצה ישירה מראש העמוד (data-gal-jump) ומקישור #gallery-<קטגוריה>. */
function galCount(cat) {
  const all = SD.gallery || [];
  return cat === 'all' ? all.length : all.filter(i => i.cat === cat).length;
}
function galScrollTo() {
  const box = document.getElementById('gallery-browse') || galleryGrid;
  if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function galRefreshTabs() {
  const btns = [...document.querySelectorAll('.gfilter')];
  btns.forEach(b => {
    if (!b.dataset.label) b.dataset.label = b.textContent.trim();
    const n = galCount(b.dataset.cat);
    b.textContent = `${b.dataset.label} (${n})`;
    b.hidden = n === 0 && b.dataset.cat !== 'all';
  });
  const jump = document.querySelector('[data-gal-jump]');
  if (!jump) return;
  const list = jump.querySelector('.gal-jump-list');
  const items = btns.filter(b => b.dataset.cat !== 'all' && !b.hidden);
  list.innerHTML = items.map(b =>
    `<a class="gal-jump-chip" href="#gallery-${b.dataset.cat}"><span aria-hidden="true">${catConfig[b.dataset.cat]?.icon || '📷'}</span> ${b.dataset.label}</a>`).join('');
  jump.hidden = !items.length;
}
function galFromHash() {
  const m = /^#gallery-([a-z-]+)$/.exec(location.hash);
  if (!m || !galleryGrid) return;
  const btn = document.querySelector(`.gfilter[data-cat="${m[1]}"]`);
  if (!btn || btn.hidden) return;
  setGalleryFilter(m[1]);
  galScrollTo();
}
document.querySelectorAll('.gfilter').forEach(btn => {
  btn.addEventListener('click', () => {
    setGalleryFilter(btn.dataset.cat);
    if (history.replaceState) history.replaceState(null, '', '#gallery-' + btn.dataset.cat);
    const box = document.getElementById('gallery-browse');
    if (box && box.getBoundingClientRect().top < 0) galScrollTo();   // גללו למטה — חוזרים לראש התמונות
  });
});
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('.gal-jump-chip');
  if (!a) return;
  e.preventDefault();
  if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
  galFromHash();
});
window.addEventListener('hashchange', galFromHash);
if (galleryGrid) { galRefreshTabs(); galFromHash(); }

/* =====================================================
   TESTIMONIALS
   ===================================================== */
const track   = document.getElementById('testimonials-track');
const dotsEl  = document.getElementById('tdots');
const btnPrev = document.getElementById('tnav-prev');
const btnNext = document.getElementById('tnav-next');

let currentSlide = 0;
let autoTimer;
let cardsPerView = getCardsPerView();

/* המלצות לפי הקשר — data-keywords על testimonials-track מסנן המלצות
   שמכילות אחת ממילות המפתח (למשל "חתונה,בר מצווה" בעמוד אירועים).
   אם נמצאו פחות מ-2 התאמות מוצגות כל ההמלצות. */
function contextTestimonials() {
  const all = SD.testimonials || [];
  const kw = (track?.dataset.keywords || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!kw.length) return all;
  const matched = all.filter(t => kw.some(k => t.text.includes(k) || t.name.includes(k)));
  return matched.length >= 2 ? matched : all;
}
const tList = contextTestimonials();

function getCardsPerView() {
  if (window.innerWidth >= 1000) return 3;
  if (window.innerWidth >= 640)  return 2;
  return 1;
}
function totalSlides() {
  return Math.ceil(tList.length / cardsPerView);
}

const avatarColors = ['#2563EB','#7C3AED','#0E7490','#047857','#B45309','#DC2626','#BE185D','#4338CA'];   // W-35: ניגודיות ≥4.5 לטקסט לבן
function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return avatarColors[h % avatarColors.length];
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
}

function buildTestimonials() {
  const list = tList;
  track.innerHTML = list.map(t => {
    const avatar = t.photo
      ? `<img src="${t.photo}" alt="${t.name}" class="testimonial-avatar" loading="lazy">`
      : `<span class="testimonial-avatar-initials" style="background:${avatarColor(t.name)}" aria-hidden="true">${initials(t.name)}</span>`;
    return `
    <div class="testimonial-card" role="article">
      <div class="stars" aria-label="דירוג 5 כוכבים">★★★★★</div>
      <p class="testimonial-text">"${t.text}"</p>
      <div class="testimonial-footer">
        <div class="testimonial-author">
          ${avatar}
          <p class="testimonial-name">— ${t.name}</p>
        </div>
        ${t.screenshot ? `<button class="screenshot-btn" onclick="openLightbox('${t.screenshot}','המלצה מ-${t.name}')">📸 צילום מסך</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function buildDots() {
  dotsEl.innerHTML = '';
  for (let i = 0; i < totalSlides(); i++) {
    const dot = document.createElement('button');
    dot.className = 'tdot' + (i === 0 ? ' active' : '');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `שקופית ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
  }
}

function goTo(index) {
  const ts = totalSlides();
  currentSlide = ((index % ts) + ts) % ts;
  const card = track.querySelector('.testimonial-card');
  if (!card) return;
  const offset = currentSlide * cardsPerView * (card.offsetWidth + 20);
  track.style.transform = `translateX(${offset}px)`;
  dotsEl.querySelectorAll('.tdot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}

function startAuto() {
  clearInterval(autoTimer);
  autoTimer = setInterval(() => goTo(currentSlide + 1), 5000);
}

if (track) {
  buildTestimonials();
  buildDots();
  goTo(0);
  startAuto();

  btnPrev.addEventListener('click', () => { goTo(currentSlide + 1); startAuto(); });
  btnNext.addEventListener('click', () => { goTo(currentSlide - 1); startAuto(); });
  track.addEventListener('mouseenter', () => clearInterval(autoTimer));
  track.addEventListener('mouseleave', startAuto);

  window.addEventListener('resize', () => {
    const newCPV = getCardsPerView();
    if (newCPV !== cardsPerView) {
      cardsPerView = newCPV;
      currentSlide = 0;
      buildDots();
      goTo(0);
    }
  }, { passive: true });

  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) { goTo(dx > 0 ? currentSlide + 1 : currentSlide - 1); startAuto(); }
  }, { passive: true });
}

/* =====================================================
   SERVICE TILES — inject gallery image + link to gallery filter
   ===================================================== */
(function buildServiceTileImages() {
  const images = SD.gallery || [];
  document.querySelectorAll('.service-tile[data-gallery-cat]').forEach((tile, idx) => {
    const cat = tile.dataset.galleryCat;
    const catImgs = images.filter(i => i.cat === cat);
    if (!catImgs.length) return;

    const pick = catImgs[(idx * 7) % catImgs.length];

    const img = document.createElement('img');
    img.src = pick.src;
    img.alt = '';
    img.className = 'service-tile-img';
    img.loading = 'lazy';
    img.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'service-tile-body';
    [...tile.children].forEach(child => body.appendChild(child));

    tile.appendChild(img);
    tile.appendChild(body);
  });
})();

document.querySelectorAll('.service-tile[data-gallery-cat]').forEach(tile => {
  tile.addEventListener('click', () => {
    const cat = tile.dataset.galleryCat;
    const gallerySection = document.getElementById('gallery');
    if (!gallerySection) return;
    gallerySection.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => openGalleryBrowse(cat), 600);
  });
  tile.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') tile.click();
  });
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('role', 'button');
});

/* =====================================================
   WORKS IMAGE STRIP — continuous right-to-left scroll
   ===================================================== */
function buildWorksStrip() {
  const images = SD.gallery || [];
  if (!images.length) return;

  const trackA = document.getElementById('works-strip-track-a');
  const trackB = document.getElementById('works-strip-track-b');
  if (!trackA || !trackB) return;

  // 12 images — one per main category, fast to load
  const cats = [
    'events','characters','bar','workshops','centerpieces',
    'arch','hats','column','printing','hoop','garlands','rooms'
  ];
  const strip = cats.map((cat, idx) => {
    const c = images.filter(i => i.cat === cat);
    return c.length ? c[idx % c.length] : null;
  }).filter(Boolean);

  const inner = document.querySelector('.works-strip-inner');

  const makeImg = item => {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt;
    img.loading = 'eager';
    img.className = 'works-strip-img';
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
    img.addEventListener('error', () => {
      const fallback = images[Math.floor(Math.random() * images.length)];
      img.src = fallback.src;
      img.alt = fallback.alt;
    });
    return img;
  };

  strip.forEach(item => { trackA.appendChild(makeImg(item)); trackB.appendChild(makeImg(item)); });

  // Start animation only after at least half of track A images have loaded
  let loaded = 0;
  const needed = Math.ceil(strip.length * 0.6);
  const start = () => { if (++loaded >= needed && inner) inner.style.animationPlayState = 'running'; };
  trackA.querySelectorAll('img').forEach(img => {
    if (img.complete) start();
    else { img.addEventListener('load', start); img.addEventListener('error', start); }
  });
}
buildWorksStrip();

/* =====================================================
   SMOOTH SCROLL
   ===================================================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const href = anchor.getAttribute('href');
    if (href.length < 2) return;
    const target = document.querySelector(href);
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});


/* =====================================================
   W-32: טופס פנייה מהירה → הודעת וואטסאפ מוכנה
   שדות האירוע (תאריך/יישוב/משתתפים) מוצגים רק לשירותים שזקוקים להם.
   ===================================================== */
document.querySelectorAll('[data-wa-form]').forEach(form => {
  const sel = form.querySelector('[name=service]');
  const NO_EVENT = ['משחק מהתמונות שלי', 'מדבקות שם / הדפסה', 'אחר'];
  const sync = () => form.querySelectorAll('[data-for=event]').forEach(el => { el.hidden = NO_EVENT.includes(sel.value); });
  sel.addEventListener('change', sync); sync();
  form.querySelector('.wa-send').addEventListener('click', () => {
    const v = n => (form.querySelector(`[name=${n}]`) || {}).value?.trim() || '';
    const lines = ['שלום הושעיה, אשמח לפרטים על: ' + v('service')];
    if (!NO_EVENT.includes(v('service'))) {
      if (v('date')) lines.push('תאריך: ' + v('date').split('-').reverse().join('/'));
      if (v('place')) lines.push('יישוב: ' + v('place'));
      if (v('count')) lines.push('משתתפים: ' + v('count'));
    }
    if (v('notes')) lines.push(v('notes'));
    if (v('name')) lines.push('שם: ' + v('name'));
    lines.push('(מקור: ' + (form.dataset.source || 'האתר') + ' · טופס)');
    window.open('https://wa.me/972505918734?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  });
});


/* =====================================================
   W-36: מדידה פשוטה — כניסות ולחיצות וואטסאפ, לטבלת events בסופאבייס.
   בלי עוגיות, בלי מזהה משתמש ובלי שירות חיצוני. נשמר: הדף, מאיפה הגיעו (שם אתר בלבד), סוג המכשיר.
   ===================================================== */
(function siteStats() {
  if (!window.fetch || /^(localhost|127\.)/.test(location.hostname) || navigator.webdriver) return;
  const SB = 'https://sccivxenkyzxolpraexf.supabase.co', KEY = 'sb_publishable_Ctloh48bIY2Lxm_YmTiSGA_1ADr5FDz';
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  const send = (event, detail) => {
    try {
      fetch(SB + '/rest/v1/events', { method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ event, label: page, detail: (detail || '').slice(0, 120), ua: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop' }) }).catch(() => {});
    } catch (e) {}
  };
  let ref = '';
  try {
    const q = new URLSearchParams(location.search);
    ref = q.get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : '');
    if (ref === location.hostname) ref = 'internal';
  } catch (e) {}
  send('site_view', ref || 'direct');
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me"],a[href^="tel:"],.wa-send');
    if (!a) return;
    const kind = a.classList.contains('wa-send') ? 'form' : (a.href || '').startsWith('tel:') ? 'phone' : (a.classList.contains('wa-float') ? 'float' : 'button');
    send(kind === 'phone' ? 'site_phone' : 'site_wa', kind);
  }, true);
})();
