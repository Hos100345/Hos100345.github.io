// =====================================================
// מאגר פונטים עבריים משותף — 35 משפחות (הספירה במפרט אמרה 34, אבל המערך
// עצמו מכיל 35; כל ה-35 אומתו, אין סיבה להוריד אחת), 6 קטגוריות, כולן
// OFL/Apache — חינמיות לשימוש מסחרי.
//
// נבנה לשמש גם את pencil-stickers.html (שילוב בפועל, PR הזה) וגם את
// dobble.html בעתיד (PR נפרד — לא נוגעים שם עכשיו).
//
// אימות: כל 35 ה-URL מ-fonts.googleapis.com/css2 נבדקו (200 + unicode-range
// שמכיל U+0590-05FF) לפני שהקוד הזה נכתב. אף משפחה לא נכשלה.
// =====================================================
(function(){
  'use strict';
  const CATS = {
    friendly:'ידידותי ועגול', display:'כותרות', daily:'רגיל',
    serif:'קלאסי', hand:'כתב יד', fx:'אפקטים'
  };
  const FONTS = [
    {f:'Heebo', he:'היבו', c:'daily', b:true},
    {f:'Assistant', he:'אסיסטנט', c:'daily', b:true},
    {f:'Rubik', he:'רוביק', c:'daily', b:true},
    {f:'Open Sans', he:'אופן סאנס', c:'daily', b:true},
    {f:'Arimo', he:'אורימו', c:'daily', b:true},
    {f:'Noto Sans Hebrew', he:'נוטו סאנס', c:'daily', b:true},
    {f:'IBM Plex Sans Hebrew', he:'פלקס סאנס', c:'daily', b:true},
    {f:'Varela Round', he:'ורלה עגול', c:'friendly', b:false},
    {f:'Fredoka', he:'פרדוקה', c:'friendly', b:true},
    {f:'M PLUS Rounded 1c', he:'עגול רך', c:'friendly', b:true},
    {f:'Secular One', he:'סקולר', c:'friendly', b:false},
    {f:'Alef', he:'אלף', c:'friendly', b:true},
    {f:'Playpen Sans Hebrew', he:'כתב יד ילדותי', c:'friendly', b:true},
    {f:'Suez One', he:'סואץ', c:'display', b:false},
    {f:'Karantina', he:'קרנטינה', c:'display', b:true},
    {f:'Amatic SC', he:'אמטיק', c:'display', b:true},
    {f:'Bellefair', he:'בלפייר', c:'display', b:false},
    {f:'Miriam Libre', he:'מרים', c:'display', b:true},
    {f:'Frank Ruhl Libre', he:'פרנק רויל', c:'serif', b:true},
    {f:'David Libre', he:'דוד', c:'serif', b:true},
    {f:'Noto Serif Hebrew', he:'נוטו סריף', c:'serif', b:true},
    {f:'Tinos', he:'טינוס', c:'serif', b:true},
    {f:'Cardo', he:'קרדו', c:'serif', b:true},
    {f:'Libertinus Serif', he:'ליברטינוס', c:'serif', b:true},
    {f:'Noto Rashi Hebrew', he:'כתב רש"י', c:'serif', b:true},
    {f:'Gveret Levin', he:'גברת לוין', c:'hand', b:false},
    {f:'Solitreo', he:'סוליטריאו', c:'hand', b:false},
    {f:'Rubik Wet Paint', he:'צבע נוזל', c:'fx', b:false},
    {f:'Rubik Dirt', he:'מלוכלך', c:'fx', b:false},
    {f:'Rubik Glitch', he:"גליץ'", c:'fx', b:false},
    {f:'Rubik Iso', he:'תלת-ממד', c:'fx', b:false},
    {f:'Rubik Moonrocks', he:'אבני ירח', c:'fx', b:false},
    {f:'Rubik Gemstones', he:'אבני חן', c:'fx', b:false},
    {f:'Rubik Doodle Shadow', he:'קשקוש עם צל', c:'fx', b:false},
    {f:'Handjet', he:'פיקסלים', c:'fx', b:false},
  ];

  const loaded = new Map();

  function href(rec){
    const w = rec.b ? ':wght@400;700' : '';
    return `https://fonts.googleapis.com/css2?family=${rec.f.replace(/ /g,'+')}${w}&display=swap`;
  }

  function hasHebrew(family){
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const probe = 'אבגדהוזחט';
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
      document.fonts.load(`400 40px "${family}"`, 'אבגדה'),
      rec.b ? document.fonts.load(`700 40px "${family}"`, 'אבגדה') : null
    ])).then(() => hasHebrew(family));

    loaded.set(family, p);
    return p;
  }

  window.HebrewFonts = {
    CATS, FONTS, load, hasHebrew,
    list: (cat) => cat ? FONTS.filter(r => r.c === cat) : FONTS.slice(),
    label: (f) => (FONTS.find(r => r.f === f) || {}).he || f,
    hasBold: (f) => !!(FONTS.find(r => r.f === f) || {}).b,
  };
})();
