/* =====================================================
   הושעיה אמן בלונים — main.js
   ===================================================== */

/* =====================================================
   NAV — hamburger + hide-on-scroll
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
   SCROLL ANIMATIONS — IntersectionObserver
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
   GALLERY DATA
   הוסיפו תמונות נוספות לרשימה — לכל תמונה:
     src  = קישור לתמונה
     cat  = קטגוריה: events | workshops | characters | hats
     alt  = טקסט תיאור (חשוב לנגישות ו-SEO)
   ===================================================== */
const galleryItems = [
  { src: 'https://images.cdn-files-a.com/uploads/6457286/2000_62af187dc631b.jpg',  cat: 'events',     alt: 'עיצוב אירוע בלונים' },
  { src: 'https://images.cdn-files-a.com/uploads/6457286/2000_62b06d5e901f6.jpg',  cat: 'events',     alt: 'בלונים לאירוע' },
  { src: 'https://images.cdn-files-a.com/uploads/6457286/2000_62b06d5f03418.jpg',  cat: 'characters', alt: 'דמות מבלונים' },
  { src: 'https://images.cdn-files-a.com/uploads/6457286/2000_62b06d5f9f738.jpg',  cat: 'workshops',  alt: 'סדנת בלונים' },
  /* ← הוסיפו כאן עוד תמונות מהאתר הישן */
];

const catLabels = {
  events:     'עיצוב אירועים',
  workshops:  'סדנאות',
  characters: 'דמויות',
  hats:       'כתרים וכובעים',
};

/* =====================================================
   GALLERY — render + lightbox + filter
   ===================================================== */
const galleryGrid = document.getElementById('gallery-grid');

function buildGallery() {
  galleryGrid.innerHTML = galleryItems.map(item => `
    <div class="gallery-item" data-cat="${item.cat}" role="button" tabindex="0" aria-label="הגדל: ${item.alt}">
      <img src="${item.src}" alt="${item.alt}" loading="lazy">
      <div class="gallery-overlay" aria-hidden="true">
        <span>${catLabels[item.cat] || item.alt}</span>
      </div>
    </div>
  `).join('');

  // lightbox triggers
  galleryGrid.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click',   () => openLightbox(item.querySelector('img').src, item.querySelector('img').alt));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(item.querySelector('img').src, item.querySelector('img').alt); });
  });
}

buildGallery();

// filter buttons
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
   LIGHTBOX
   ===================================================== */
const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.innerHTML = `
  <button class="lightbox-close" aria-label="סגור">✕</button>
  <img src="" alt="" id="lightbox-img">
`;
document.body.appendChild(lightbox);

const lbImg   = lightbox.querySelector('#lightbox-img');
const lbClose = lightbox.querySelector('.lightbox-close');

function openLightbox(src, alt) {
  lbImg.src = src;
  lbImg.alt = alt;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
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
   TESTIMONIALS DATA
   ===================================================== */
const testimonials = [
  { name: 'חנה אור',             text: 'הושעיה היה אצלנו בברית. הפך את האירוע להרבה יותר משמח ומיוחד. בעל גישה נהדרת לילדים. זורם וכמובן שמוכשר בעבודתו. ממליצה עליו בגדול!' },
  { name: 'דוד לוין',             text: 'מומלץ ביותר!! מקצוען ותותח' },
  { name: 'אביאל כהן',           text: 'הושעיה היקר היה פשוט מדהים!! איזה בלונים יפים זה פשוט העיף את החתונה באוויר!!! תודה תודה תודה' },
  { name: 'אריה לייב שפירא',     text: 'הושעיה היה מפעיל בלונים בחתונה שלנו, וזה היה מדהים. הגיע עם בלונים מוכנים מראש ועם המכונה להוסיף עוד. חוויה מדהימה, הילדים נהנו המבוגרים נהנו. הכל במקצועיות ורוחב לב, ממליצים בחום' },
  { name: 'עינב צברי',           text: 'הזמנו את הושעיה לעצב את הבת-מצווה. במקצועיות ומיומנות מדהימה המועדון הפך לאולם אירועים יפהפה. חילק כתרים מבלונים מעוצבים, שידרג את האירוע ברמות. ממליצה בחום!' },
  { name: 'שירה כהן',            text: 'תודה רבה! נהנינו מאוד! גם הקטנים וגם הגדולים!' },
  { name: 'עידן יוסף וניצן ליבן', text: 'תודה רבה על ערב בלתי נשכח, הבלונים שדרגו אותו מאוד בצבעם ובייחודם. כשרון מהמם וכולם מהקטנטנים ועד הגדולים נהנו מאוד' },
  { name: 'משפחת ארביט',         text: 'הבלונים שעשית היו מקסימים, כל הכבוד אתה מקצוען' },
  { name: 'יגל ויסכה שרעבי',     text: 'הושעיה המוכשר עשה לנו פשוט שמח בבר מצווה! מלא סבלנות, עשה מלא כובעים ודמויות לפי בקשות. ממליצים בחום!' },
  { name: 'איתן ויפעת חובב',     text: 'ממליצה בחום! שידרג לנו את הבר מצווה. הכל היה מוכן בזמן. מענה מהיר וזמינות. מחכים כבר לאירוע הבא!' },
];

/* =====================================================
   TESTIMONIALS SLIDER
   ===================================================== */
const track    = document.getElementById('testimonials-track');
const dotsEl   = document.getElementById('tdots');
const btnPrev  = document.getElementById('tnav-prev');
const btnNext  = document.getElementById('tnav-next');

let currentSlide = 0;
let autoTimer;
let cardsPerView = getCardsPerView();

function getCardsPerView() {
  if (window.innerWidth >= 1000) return 3;
  if (window.innerWidth >= 640)  return 2;
  return 1;
}

function totalSlides() {
  return Math.ceil(testimonials.length / cardsPerView);
}

function buildTestimonials() {
  track.innerHTML = testimonials.map(t => `
    <div class="testimonial-card" role="article">
      <div class="stars" aria-label="דירוג 5 כוכבים">★★★★★</div>
      <p class="testimonial-text">"${t.text}"</p>
      <p class="testimonial-name">— ${t.name}</p>
    </div>
  `).join('');
}

function buildDots() {
  dotsEl.innerHTML = '';
  for (let i = 0; i < totalSlides(); i++) {
    const dot = document.createElement('button');
    dot.className = 'tdot' + (i === currentSlide ? ' active' : '');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `שקופית ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(dot);
  }
}

function goTo(index) {
  const ts = totalSlides();
  currentSlide = ((index % ts) + ts) % ts;
  const cardWidth = track.querySelector('.testimonial-card').offsetWidth;
  const gap = 20; // 1.25rem gap
  const offset = currentSlide * cardsPerView * (cardWidth + gap);
  // RTL: reverse scroll direction
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

/* =====================================================
   TOUCH SWIPE on testimonials
   ===================================================== */
let touchStartX = 0;
track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
track.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) {
    // RTL: swipe right → next, swipe left → prev
    goTo(dx > 0 ? currentSlide + 1 : currentSlide - 1);
    startAuto();
  }
}, { passive: true });

/* =====================================================
   SMOOTH SCROLL polyfill for older browsers
   ===================================================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
