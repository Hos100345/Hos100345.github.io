// js/hebrew-fonts.js
// מאגר פונטים עבריים משותף. כל הפונטים OFL/Apache 2.0 — שימוש מסחרי חופשי
// דרך ה-CDN של גוגל. 34 משפחות אומתו בפועל מול fonts.googleapis.com (סטטוס
// 200 + unicode-range שמכסה עברית ממש) — M PLUS Rounded 1c הוסרה מהמאגר כי
// גוגל מחזירה עבורה גליפים לטיניים בלבד, בלי עברית, למרות ה-&subset=hebrew.
(function(){
  'use strict';

  const CATS = {
    friendly: 'ידידותי ועגול', display: 'כותרות', daily: 'רגיל',
    serif: 'קלאסי', hand: 'כתב יד', fx: 'אפקטים'
  };

  // f=family (שם גוגל מדויק) · he=תווית עברית · c=קטגוריה · b=יש משקל 700
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
    {f:'Handjet', he:'פיקסלים', c:'fx', b:false}
  ];

  const loaded = new Map(); // family -> Promise

  function href(rec){
    const w = rec.b ? ':wght@400;700' : '';
    return `https://fonts.googleapis.com/css2?family=${rec.f.replace(/ /g,'+')}${w}&display=swap`;
  }

  // מזריק <link> פעם אחת למשפחה, וממתין שהגליפים באמת זמינים לפני שמצטטים "הצליח".
  function load(family){
    if(loaded.has(family)) return loaded.get(family);
    const rec = FONTS.find(r=>r.f===family);
    if(!rec) return Promise.reject(new Error('פונט לא מוכר: '+family));

    const p = new Promise((ok,fail)=>{
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href(rec);
      l.onload = ok; l.onerror = ()=>fail(new Error('טעינת הפונט נכשלה: '+family));
      document.head.appendChild(l);
    }).then(()=>Promise.all([
      document.fonts.load(`400 40px "${family}"`, 'אבגדה'),
      rec.b ? document.fonts.load(`700 40px "${family}"`, 'אבגדה') : null
    ])).then(()=>hasHebrew(family));

    loaded.set(family, p);
    p.catch(()=>loaded.delete(family)); // כישלון לא נשאר תקוע במטמון — ניסיון הבא (למשל אחרי חזרת הרשת) יתחיל מחדש
    return p;
  }

  // בדיקת אמת: האם הפונט באמת מצייר עברית, או שהדפדפן נפל ל-fallback בשקט.
  // מודדים מחרוזת עברית בפונט הנבדק מול monospace. רוחב זהה = הפונט לא נטען.
  function hasHebrew(family){
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const probe = 'אבגדהוזחט';
    ctx.font = '40px monospace';              const base = ctx.measureText(probe).width;
    ctx.font = `40px "${family}", monospace`; const test = ctx.measureText(probe).width;
    if(Math.abs(base-test) < 0.5) throw new Error('הפונט לא נטען: '+family);
    return family;
  }

  window.HebrewFonts = {
    CATS, FONTS, load, hasHebrew,
    list: (cat)=> cat ? FONTS.filter(r=>r.c===cat) : FONTS.slice(),
    label: (f)=> (FONTS.find(r=>r.f===f)||{}).he || f
  };
})();
