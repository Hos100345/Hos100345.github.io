// =====================================================
// מאגר פונטים לטיניים משותף — 30 משפחות, 6 קטגוריות (אותן קטגוריות כמו
// js/hebrew-fonts.js), כולן Google Fonts ברישיון חופשי (OFL/Apache).
//
// אותו API בדיוק כמו HebrewFonts — הבורר בגב הקלף מחליף בין שני המאגרים
// לפי טאב, ומטפל בשניהם באותו קוד.
//
// ⛔ המפתח שנשמר בעיצוב הוא שם המשפחה בלבד ('Caveat'), בלי קידומת — אותו
//    שדה S.back.text.font כמו הפונטים העבריים. קידומת הייתה שוברת עיצובים
//    שמורים בענן וב-IndexedDB.
// ⛔ אסור ששם משפחה יופיע גם כאן וגם ב-hebrew-fonts.js — בדיקת חפיפה
//    רצה לפני כל שינוי ברשימה.
//
// אימות: כל 30 ה-URL מ-fonts.googleapis.com/css2 נבדקו (200 + בלוק
// /* latin */ עם U+0000-00FF; משקל 700 אומת למשפחות עם b:true) לפני
// שהקוד הזה נכתב. אף משפחה לא נכשלה.
// =====================================================
(function(){
  'use strict';
  const CATS = {
    friendly:{he:'ידידותי ועגול', en:'Friendly & Round'},
    display:{he:'כותרות', en:'Display'},
    daily:{he:'רגיל', en:'Everyday'},
    serif:{he:'קלאסי', en:'Classic Serif'},
    hand:{he:'כתב יד', en:'Handwriting'},
    fx:{he:'אפקטים', en:'Effects'}
  };
  const FONTS = [
    {f:'Inter', he:'אינטר', en:'Inter', c:'daily', b:true},
    {f:'Work Sans', he:'וורק סאנס', en:'Work Sans', c:'daily', b:true},
    {f:'Source Sans 3', he:'סורס סאנס', en:'Source Sans', c:'daily', b:true},
    {f:'Lato', he:'לאטו', en:'Lato', c:'daily', b:true},
    {f:'Poppins', he:'פופינס', en:'Poppins', c:'daily', b:true},
    {f:'Nunito', he:'נוניטו', en:'Nunito', c:'friendly', b:true},
    {f:'Quicksand', he:'קוויקסנד', en:'Quicksand', c:'friendly', b:true},
    {f:'Baloo 2', he:'באלו', en:'Baloo', c:'friendly', b:true},
    {f:'Comfortaa', he:'קומפורטה', en:'Comfortaa', c:'friendly', b:true},
    {f:'Chewy', he:"צ'ואי", en:'Chewy', c:'friendly', b:false},
    {f:'Bebas Neue', he:'בבאס', en:'Bebas Neue', c:'display', b:false},
    {f:'Anton', he:'אנטון', en:'Anton', c:'display', b:false},
    {f:'Righteous', he:'רייצ׳ס', en:'Righteous', c:'display', b:false},
    {f:'Oswald', he:'אוסוולד', en:'Oswald', c:'display', b:true},
    {f:'Luckiest Guy', he:'לאקיסט גאי', en:'Luckiest Guy', c:'display', b:false},
    {f:'Playfair Display', he:'פלייפייר', en:'Playfair Display', c:'serif', b:true},
    {f:'Merriweather', he:'מריוודר', en:'Merriweather', c:'serif', b:true},
    {f:'Lora', he:'לורה', en:'Lora', c:'serif', b:true},
    {f:'EB Garamond', he:'גרמונד', en:'EB Garamond', c:'serif', b:true},
    {f:'Libre Baskerville', he:'בסקרוויל', en:'Libre Baskerville', c:'serif', b:true},
    {f:'Caveat', he:'קאוויאט', en:'Caveat', c:'hand', b:true},
    {f:'Pacifico', he:'פסיפיקו', en:'Pacifico', c:'hand', b:false},
    {f:'Dancing Script', he:'דאנסינג סקריפט', en:'Dancing Script', c:'hand', b:true},
    {f:'Kalam', he:'קאלאם', en:'Kalam', c:'hand', b:true},
    {f:'Permanent Marker', he:'מרקר', en:'Permanent Marker', c:'hand', b:false},
    {f:'Bungee', he:"באנג'י", en:'Bungee', c:'fx', b:false},
    {f:'Creepster', he:'קריפסטר', en:'Creepster', c:'fx', b:false},
    {f:'Monoton', he:'מונוטון', en:'Monoton', c:'fx', b:false},
    {f:'Press Start 2P', he:'פיקסלים', en:'Press Start', c:'fx', b:false},
    {f:'Audiowide', he:'אודיו-וייד', en:'Audiowide', c:'fx', b:false},
  ];

  const loaded = new Map();

  function href(rec){
    const w = rec.b ? ':wght@400;700' : '';
    return `https://fonts.googleapis.com/css2?family=${rec.f.replace(/ /g,'+')}${w}&display=swap`;
  }

  // כמו hasHebrew במאגר העברי, אבל בודק גליפים לטיניים — פונט לטיני
  // שלא נטען באמת מתגלה רק בהשוואה על טקסט לטיני.
  function hasLatin(family){
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const probe = 'Aa Bb 123';
    ctx.font = '40px monospace';               const base = ctx.measureText(probe).width;
    ctx.font = `40px "${family}", monospace`;   const test = ctx.measureText(probe).width;
    if (Math.abs(base-test) < 0.5) throw new Error('הפונט לא נטען: '+family);
    return family;
  }

  function load(family){
    if (loaded.has(family)) return loaded.get(family);
    const rec = FONTS.find(r => r.f === family);
    if (!rec) return Promise.reject(new Error('פונט לא מוכר: '+family));

    const p = new Promise((ok, fail) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href(rec);
      l.onload = ok; l.onerror = () => fail(new Error('טעינת הפונט נכשלה: '+family));
      document.head.appendChild(l);
    }).then(() => Promise.all([
      document.fonts.load(`400 40px "${family}"`, 'Aa Bb 123'),
      rec.b ? document.fonts.load(`700 40px "${family}"`, 'Aa Bb 123') : null
    ])).then(() => hasLatin(family));

    loaded.set(family, p);
    return p;
  }

  window.LatinFonts = {
    CATS, FONTS, load, hasLatin,
    list: (cat) => cat ? FONTS.filter(r => r.c === cat) : FONTS.slice(),
    label: (f, lang) => { const r = FONTS.find(x => x.f === f); return r ? (lang === 'en' ? r.en : r.he) : f; },
    hasBold: (f) => !!(FONTS.find(r => r.f === f) || {}).b,
  };
})();
