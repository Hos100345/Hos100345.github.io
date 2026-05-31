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
  garlands:    'הגרטלים',
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

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  header.classList.toggle('nav-open', open);
});
navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    header.classList.remove('nav-open');
  });
});

let lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 60);
  if (y > 200) {
    header.classList.toggle('hidden',  y > lastY + 8);
    header.classList.toggle('visible', y < lastY - 8);
  }
  lastY = y;
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
  div.addEventListener('click',   () => openLightbox(img.src, img.alt));
  div.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(img.src, img.alt); });
  return div;
}

function loadGalleryPage() {
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

// Gallery starts closed — show prompt
galleryGrid.innerHTML = '<p class="gallery-placeholder">בחרו קטגוריה לצפייה בתמונות ↑</p>';

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
  garlands:     { label: 'הגרטלים',                 icon: '🌿' },
  printing:     { label: 'הדפסה על בלונים',          icon: '🖨️' },
  hoop:         { label: 'חישוק',                   icon: '⭕' },
  hats:         { label: 'כתבים / כובעים מבלונים',  icon: '🎩' },
  frame:        { label: 'מסגרת',                   icon: '🖼️' },
  column:       { label: 'עמוד',                    icon: '🏛️' },
  'bar-chars':  { label: 'דמויות של בר בלונים',     icon: '🎊' },
  'event-chars':{ label: 'דמויות של עיצוב אירועים', icon: '🎭' },
};

function buildCategoryCards() {
  const cards = document.getElementById('gallery-cat-cards');
  if (!cards) return;
  const images = SD.gallery || [];
  const order = [
    'events','workshops','bar','characters','rooms','satisfied',
    'arch','numbers','centerpieces','photocorner','garlands',
    'printing','hoop','hats','frame','column','bar-chars','event-chars'
  ];

  cards.innerHTML = order.map(cat => {
    const catImgs = images.filter(i => i.cat === cat);
    if (!catImgs.length) return '';
    const thumb = catImgs[Math.floor(Math.random() * Math.min(catImgs.length, 8))];
    const cfg = catConfig[cat] || { label: cat, icon: '📷' };
    return `
      <button class="gcat-card" data-cat="${cat}" tabindex="0">
        <img src="${thumb.src}" alt="${cfg.label}" class="gcat-card-img" loading="lazy">
        <div class="gcat-card-overlay">
          <span class="gcat-card-cta">צפו עכשיו</span>
          <span class="gcat-card-icon">${cfg.icon}</span>
          <span class="gcat-card-name">${cfg.label}</span>
          <span class="gcat-card-count">${catImgs.length} תמונות</span>
        </div>
      </button>`;
  }).join('');

  cards.querySelectorAll('.gcat-card').forEach(card => {
    card.addEventListener('click', () => openGalleryBrowse(card.dataset.cat));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGalleryBrowse(card.dataset.cat); }
    });
  });
}

function openGalleryBrowse(cat) {
  document.getElementById('gallery-cat-cards').hidden = true;
  const browse = document.getElementById('gallery-browse');
  browse.hidden = false;
  setGalleryFilter(cat);
  document.getElementById('gallery-sub').textContent = catConfig[cat]?.label || 'גלריה';
}

function closeGalleryBrowse() {
  document.getElementById('gallery-cat-cards').hidden = false;
  document.getElementById('gallery-browse').hidden = true;
  document.getElementById('gallery-sub').textContent = 'בחרו קטגוריה לצפייה';
}

function setGalleryFilter(cat) {
  document.querySelectorAll('.gfilter').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  galCat  = cat;
  galPage = 0;
  galleryGrid.innerHTML = '';
  const moreBtn = document.getElementById('gallery-more-btn');
  if (moreBtn) moreBtn.remove();
  if (!(SD.gallery || []).length) {
    galleryGrid.innerHTML = '<p style="text-align:center;color:#6B7280;padding:2rem;">הגלריה ריקה — הוסף תמונות דרך admin.html</p>';
    return;
  }
  loadGalleryPage();
}

buildCategoryCards();

document.getElementById('gallery-back-btn')?.addEventListener('click', closeGalleryBrowse);

document.querySelectorAll('.gfilter').forEach(btn => {
  btn.addEventListener('click', () => setGalleryFilter(btn.dataset.cat));
});

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

function getCardsPerView() {
  if (window.innerWidth >= 1000) return 3;
  if (window.innerWidth >= 640)  return 2;
  return 1;
}
function totalSlides() {
  return Math.ceil((SD.testimonials || []).length / cardsPerView);
}

const avatarColors = ['#2563EB','#7C3AED','#0891B2','#059669','#D97706','#DC2626','#DB2777','#4338CA'];
function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return avatarColors[h % avatarColors.length];
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
}

function buildTestimonials() {
  const list = SD.testimonials || [];
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

/* =====================================================
   SERVICE TILES → GALLERY FILTER
   ===================================================== */
document.querySelectorAll('.service-tile[data-gallery-cat]').forEach(tile => {
  tile.addEventListener('click', () => {
    const cat = tile.dataset.galleryCat;
    document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => openGalleryBrowse(cat), 600);
  });
  tile.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') tile.click();
  });
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('role', 'button');
});

/* =====================================================
   WORKS IMAGE STRIP
   ===================================================== */
function buildWorksStrip() {
  const images = SD.gallery || [];
  if (!images.length) return;

  const trackA = document.getElementById('works-strip-track-a');
  const trackB = document.getElementById('works-strip-track-b');
  if (!trackA || !trackB) return;

  // Pick a varied selection: up to 18 images, mixing categories
  const picked = [];
  const cats = ['events', 'bar', 'characters', 'workshops'];
  cats.forEach(cat => {
    images.filter(i => i.cat === cat).slice(0, 5).forEach(i => picked.push(i));
  });
  const strip = picked.slice(0, 20);

  const makeImg = item => {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt;
    img.loading = 'lazy';
    img.className = 'works-strip-img';
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
    return img;
  };

  strip.forEach(item => trackA.appendChild(makeImg(item)));
  strip.forEach(item => trackB.appendChild(makeImg(item)));
}
buildWorksStrip();

/* =====================================================
   SMOOTH SCROLL
   ===================================================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
