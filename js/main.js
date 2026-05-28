/* =====================================================
   הושעיה אמן בלונים — main.js
   תוכן האתר נטען מ-js/site-data.js
   ===================================================== */

const SD = window.SITE_DATA || { video: {}, gallery: [], testimonials: [] };

const catLabels = {
  events:     'עיצוב אירועים',
  workshops:  'סדנאות',
  characters: 'דמויות',
  hats:       'כתרים וכובעים',
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
});
navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
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
   GALLERY
   ===================================================== */
const galleryGrid = document.getElementById('gallery-grid');

function buildGallery() {
  const items = SD.gallery || [];
  if (!items.length) {
    galleryGrid.innerHTML = '<p style="text-align:center;color:#6B7280;padding:2rem;">הגלריה ריקה — הוסף תמונות דרך admin.html</p>';
    return;
  }
  galleryGrid.innerHTML = items.map(item => `
    <div class="gallery-item" data-cat="${item.cat}" role="button" tabindex="0" aria-label="הגדל: ${item.alt}">
      <img src="${item.src}" alt="${item.alt}" loading="lazy">
      <div class="gallery-overlay" aria-hidden="true">
        <span>${catLabels[item.cat] || item.alt}</span>
      </div>
    </div>
  `).join('');

  galleryGrid.querySelectorAll('.gallery-item').forEach(el => {
    const img = el.querySelector('img');
    el.addEventListener('click',   () => openLightbox(img.src, img.alt));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(img.src, img.alt); });
  });
}
buildGallery();

document.querySelectorAll('.gfilter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gfilter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    document.querySelectorAll('.gallery-item').forEach(item => {
      item.classList.toggle('hidden', cat !== 'all' && item.dataset.cat !== cat);
    });
  });
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

function buildTestimonials() {
  const list = SD.testimonials || [];
  track.innerHTML = list.map(t => `
    <div class="testimonial-card" role="article">
      <div class="stars" aria-label="דירוג 5 כוכבים">★★★★★</div>
      <p class="testimonial-text">"${t.text}"</p>
      <div class="testimonial-footer">
        <p class="testimonial-name">— ${t.name}</p>
        ${t.screenshot ? `<button class="screenshot-btn" onclick="openLightbox('${t.screenshot}','המלצה מ-${t.name}')">📸 צילום מסך</button>` : ''}
      </div>
    </div>
  `).join('');
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
   SMOOTH SCROLL
   ===================================================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
