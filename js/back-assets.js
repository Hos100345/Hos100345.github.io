// =====================================================
// עיצובי גב הקלף — מאגר משותף: סמלים (ציור וקטורי בקוד), מסגרות, דוגמאות
// רקע ופריסטים. משמש את dobble.html (עורך הגב) ואת pencil-stickers.html
// (סמלים כאפשרות בחלון "בחר אייקון או אימוג'י").
//
// ⛔ קוד ציור load-bearing — הועבר מ-dobble.html מילה-במילה. כל שינוי כאן
//    משנה כל גב שמור של כל לקוח. הבדיקה החוסמת: toDataURL של כל preset
//    זהה בייט-לבייט לפני/אחרי (ראה PR של החילוץ).
//
// כל הסמלים/מסגרות/דוגמאות כאן מקוריים ונכתבים בקוד — אין ולא יהיה כאן
// שימוש בלוגו/סמל/עיצוב של Dobble, Spot-It, Asmodee או Zygomatic.
//
// שמות: הקובץ נטען לפני מילון ה-I18N של dobble.html, לכן כל רשומה נושאת
// nameKey (מפתח במילון — dobble פותר אותו ב-t()) וגם he (תווית עברית לדף
// בלי מילון, כמו המדבקות). ⛔ ה-id נשמר בעיצובים בענן/IndexedDB — לא לשנות.
// =====================================================
(function(){
  'use strict';

  // כל draw() מצפה ל-ctx שכבר עבר translate למרכז הסמל ו-scale(size,size), ומצייר בטווח [-1..1].
  function starPath(ctx,spikes,outerR,innerR,rot){
    rot=rot||-Math.PI/2;
    ctx.beginPath();
    for(let i=0;i<spikes*2;i++){
      const rr=i%2===0?outerR:innerR;
      const a=rot+i*Math.PI/spikes;
      const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.closePath();
  }
  function heartPath(ctx,s){
    s=s||1;
    ctx.beginPath();
    ctx.moveTo(0,0.32*s);
    ctx.bezierCurveTo(-0.95*s,-0.42*s,-0.55*s,-1.05*s,0,-0.42*s);
    ctx.bezierCurveTo(0.55*s,-1.05*s,0.95*s,-0.42*s,0,0.32*s);
    ctx.closePath();
  }

  const SYMBOLS=[
    {id:'sparkle',nameKey:'back.symbolNameSparkle',he:'ניצוץ',draw(ctx){
      starPath(ctx,4,0.95,0.16);ctx.fill();
      ctx.save();ctx.rotate(Math.PI/4);starPath(ctx,4,0.42,0.09);ctx.fill();ctx.restore();
    }},
    {id:'star5',nameKey:'back.symbolNameStar',he:'כוכב',draw(ctx){starPath(ctx,5,0.95,0.38);ctx.fill();}},
    {id:'heart',nameKey:'back.symbolNameHeart',he:'לב',draw(ctx){heartPath(ctx,0.85);ctx.fill();}},
    {id:'flower8',nameKey:'back.symbolNameFlower',he:'פרח',draw(ctx){
      for(let i=0;i<8;i++){
        ctx.save();ctx.rotate(i*Math.PI/4);
        ctx.beginPath();ctx.ellipse(0,-0.5,0.26,0.5,0,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();ctx.arc(0,0,0.24,0,Math.PI*2);ctx.fill();
    }},
    {id:'sun',nameKey:'back.symbolNameSun',he:'שמש',draw(ctx){
      for(let i=0;i<8;i++){
        ctx.save();ctx.rotate(i*Math.PI/4);
        ctx.beginPath();ctx.moveTo(-0.1,-0.55);ctx.lineTo(0.1,-0.55);ctx.lineTo(0,-0.98);ctx.closePath();ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();ctx.arc(0,0,0.55,0,Math.PI*2);ctx.fill();
    }},
    {id:'moon',nameKey:'back.symbolNameMoon',he:'ירח',draw(ctx){
      ctx.save();
      ctx.beginPath();ctx.arc(0,0,0.9,0,Math.PI*2);
      ctx.arc(0.38,-0.12,0.78,0,Math.PI*2,true);
      ctx.fill('evenodd');
      ctx.restore();
    }},
    {id:'clover',nameKey:'back.symbolNameClover',he:'תלתן',draw(ctx){
      const d=0.46;
      [[0,-d],[d,0],[0,d],[-d,0]].forEach(([ox,oy])=>{
        ctx.beginPath();ctx.arc(ox,oy,0.5,0,Math.PI*2);ctx.fill();
      });
      ctx.save();ctx.rotate(Math.PI/4);ctx.fillRect(-0.09,0,0.18,0.62);ctx.restore();
    }},
    {id:'diamond',nameKey:'back.symbolNameDiamond',he:'יהלום',draw(ctx){
      ctx.beginPath();ctx.moveTo(0,-0.95);ctx.lineTo(0.68,0);ctx.lineTo(0,0.95);ctx.lineTo(-0.68,0);ctx.closePath();ctx.fill();
    }},
    {id:'balloon',nameKey:'back.symbolNameBalloon',he:'בלון',draw(ctx){
      ctx.beginPath();ctx.ellipse(0,-0.18,0.62,0.72,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(-0.13,0.5);ctx.lineTo(0.13,0.5);ctx.lineTo(0,0.68);ctx.closePath();ctx.fill();
      ctx.save();ctx.lineWidth=0.045;ctx.strokeStyle=ctx.fillStyle;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(0,0.68);ctx.bezierCurveTo(0.14,0.8,-0.1,0.9,0,1.0);ctx.stroke();
      ctx.restore();
    }},
    {id:'gift',nameKey:'back.symbolNameGift',he:'מתנה',draw(ctx){
      ctx.fillRect(-0.68,-0.12,1.36,0.95);
      ctx.fillRect(-0.68,-0.32,1.36,0.2);
      ctx.fillRect(-0.11,-0.32,0.22,1.27);
      ctx.beginPath();ctx.arc(-0.28,-0.42,0.24,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(0.28,-0.42,0.24,0,Math.PI*2);ctx.fill();
    }},
    {id:'crown',nameKey:'back.symbolNameCrown',he:'כתר',draw(ctx){
      ctx.beginPath();
      ctx.moveTo(-0.8,0.55);ctx.lineTo(0.8,0.55);ctx.lineTo(0.8,-0.05);
      ctx.lineTo(0.4,0.2);ctx.lineTo(0.22,-0.5);
      ctx.lineTo(0,0.05);ctx.lineTo(-0.22,-0.5);ctx.lineTo(-0.4,0.2);
      ctx.lineTo(-0.8,-0.05);ctx.closePath();ctx.fill();
      [-0.8,0,0.8].forEach((x,i)=>{const yy=i===1?0.05:-0.05;
        ctx.beginPath();ctx.arc(i===1?0:x,i===1?-0.6:-0.06+((i===0)?0:0),0.11,0,Math.PI*2);ctx.fill();});
      ctx.beginPath();ctx.arc(0,-0.62,0.12,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(-0.8,-0.08,0.1,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(0.8,-0.08,0.1,0,Math.PI*2);ctx.fill();
    }},
    {id:'note',nameKey:'back.symbolNameNote',he:'תו',draw(ctx){
      ctx.save();ctx.translate(-0.15,0.5);ctx.rotate(-0.15);
      ctx.beginPath();ctx.ellipse(0,0,0.32,0.24,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
      ctx.fillRect(0.12,-0.85,0.11,1.25);
      ctx.beginPath();ctx.moveTo(0.23,-0.85);ctx.bezierCurveTo(0.75,-0.65,0.7,-0.15,0.23,-0.25);ctx.closePath();ctx.fill();
    }},
    {id:'snow',nameKey:'back.symbolNameSnow',he:'פתית',draw(ctx){
      ctx.save();ctx.lineWidth=0.09;ctx.strokeStyle=ctx.fillStyle;ctx.lineCap='round';
      for(let i=0;i<6;i++){
        ctx.save();ctx.rotate(i*Math.PI/3);
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-0.95);ctx.stroke();
        [0.35,0.6].forEach(t=>{
          ctx.beginPath();ctx.moveTo(0,-t);ctx.lineTo(-0.22,-t-0.2);ctx.moveTo(0,-t);ctx.lineTo(0.22,-t-0.2);ctx.stroke();
        });
        ctx.restore();
      }
      ctx.restore();
    }},
    {id:'smile',nameKey:'back.symbolNameSmile',he:'חיוך',draw(ctx){
      ctx.save();ctx.lineWidth=0.1;ctx.strokeStyle=ctx.fillStyle;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(0,0,0.92,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(-0.32,-0.18,0.1,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(0.32,-0.18,0.1,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(0,0.05,0.5,0.15*Math.PI,0.85*Math.PI);ctx.stroke();
      ctx.restore();
    }},
    {id:'spiral',nameKey:'back.symbolNameSpiral',he:'ספירלה',draw(ctx){
      ctx.save();ctx.lineWidth=0.11;ctx.strokeStyle=ctx.fillStyle;ctx.lineCap='round';
      ctx.beginPath();
      const turns=2.4,steps=90;
      for(let i=0;i<=steps;i++){
        const t=i/steps,a=t*turns*Math.PI*2,rr=t*0.92;
        const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.restore();
    }},
    {id:'none',nameKey:'back.noneLabel',he:'ללא',draw(){}}
  ];

  const FRAMES=[
    {id:'none',nameKey:'back.noneLabel',he:'ללא'},{id:'single',nameKey:'back.frameNameSingle',he:'קו יחיד'},{id:'double',nameKey:'back.frameNameDouble',he:'קו כפול'},
    {id:'dashed',nameKey:'back.frameNameDashed',he:'מקווקו'},{id:'beads',nameKey:'back.frameNameBeads',he:'חרוזים'},{id:'scallop',nameKey:'back.frameNameScallop',he:'גלי'},
    {id:'zigzag',nameKey:'back.frameNameZigzag',he:'זיגזג'},{id:'corners',nameKey:'back.frameNameCorners',he:'פינות'}
  ];

  const PATTERNS=[
    {id:'none',nameKey:'back.noneLabel',he:'ללא'},{id:'dots',nameKey:'back.patternNameDots',he:'נקודות'},{id:'stripes',nameKey:'back.patternNameStripes',he:'פסים'},
    {id:'checker',nameKey:'back.patternNameChecker',he:'משבצות'},{id:'confetti',nameKey:'back.patternNameConfetti',he:'קונפטי'},
    {id:'stars',nameKey:'back.patternNameStars',he:'כוכבונים'},{id:'grid',nameKey:'back.patternNameGrid',he:'רשת'},{id:'waves',nameKey:'back.patternNameWaves',he:'גלים'}
  ];

  const PRESETS=[
    {id:'classic',nameKey:'back.presetNameClassic',he:'קלאסי',apply(){return{bg:{mode:'radial',c1:'#4338CA',c2:'#1E1B4B'},pattern:{id:'none',color:'#FFFFFF',op:14,scale:100},frame:{id:'double',color:'#FFFFFF',w:3,op:100},symbol:{id:'sparkle',color:'#FFFFFF',size:46,op:100,dy:0}};}},
    {id:'party',nameKey:'back.presetNameParty',he:'מסיבה',apply(){return{bg:{mode:'diag',c1:'#DB2777',c2:'#7C3AED'},pattern:{id:'confetti',color:'#FFFFFF',op:55,scale:110},frame:{id:'dashed',color:'#FFFFFF',w:2.5,op:100},symbol:{id:'balloon',color:'#FDE047',size:50,op:100,dy:0}};}},
    {id:'birthday',nameKey:'back.presetNameBirthday',he:'יום הולדת',apply(){return{bg:{mode:'radial',c1:'#EC4899',c2:'#A855F7'},pattern:{id:'stars',color:'#FFFFFF',op:20,scale:90},frame:{id:'beads',color:'#FDE047',w:3,op:100},symbol:{id:'crown',color:'#FDE047',size:44,op:100,dy:-4},text:{main:'מזל טוב',sub:'',font:'round',color:'#FFFFFF',size:11,dy:36}};}},
    {id:'kids',nameKey:'back.presetNameKids',he:'ילדים',apply(){return{bg:{mode:'solid',c1:'#FDE68A',c2:'#93C5FD'},pattern:{id:'dots',color:'#FFFFFF',op:35,scale:80},frame:{id:'scallop',color:'#38BDF8',w:3,op:100},symbol:{id:'smile',color:'#0369A1',size:48,op:100,dy:0}};}},
    {id:'elegant',nameKey:'back.presetNameElegant',he:'אלגנטי',apply(){return{bg:{mode:'solid',c1:'#0F172A',c2:'#0F172A'},pattern:{id:'none',color:'#D4AF37',op:10,scale:100},frame:{id:'corners',color:'#D4AF37',w:2.5,op:100},symbol:{id:'diamond',color:'#D4AF37',size:40,op:100,dy:0}};}},
    {id:'nature',nameKey:'back.presetNameNature',he:'טבע',apply(){return{bg:{mode:'diag',c1:'#15803D',c2:'#84CC16'},pattern:{id:'waves',color:'#FFFFFF',op:16,scale:120},frame:{id:'single',color:'#FFFFFF',w:2.5,op:100},symbol:{id:'clover',color:'#FFFFFF',size:42,op:100,dy:0}};}}
  ];

  window.BackAssets={
    SYMBOLS,FRAMES,PATTERNS,PRESETS,
    starPath,heartPath,
    symbol:(id)=>SYMBOLS.find(s=>s.id===id)||null,
  };
})();
