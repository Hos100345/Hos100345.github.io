/* ════════════════════════════════════════════════════════════════════════════
   js/photo-filters.js — פילטרים לתמונה (משותף; היום הסטודיו טוען אותו, הדאבל בהמשך)
   26 "מראות צילום" + 8 פילטרים אמנותיים. לוגיקה בלבד: לא נוגע ב-DOM של הדף ולא תלוי בשום משתנה גלובלי.
   (יוצר canvas פנימי רק לשכבות המיזוג של מראות הצילום ולנקודות הפופ-ארט — לא מוסיף אותו לדף.)

   מראות הצילום — הסבה ל-canvas של CSSgram:
     The MIT License (MIT) — Copyright (c) 2015 Una Kravets — https://github.com/una/CSSgram
     Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
     documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
     rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
     persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice
     and this permission notice shall be included in all copies or substantial portions of the Software.
     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
   הפילטרים האמנותיים — קוד שלנו.

   ── v0.31: 26 "מראות צילום" — הסבה ל-canvas של CSSgram (MIT © 2015 Una Kravets, github.com/una/CSSgram).
   כל מראה = שרשרת פילטרי CSS (מחושבים בפיקסלים לפי מטריצות Filter Effects — ctx.filter לא נתמך בכל ספארי)
   ועוד שכבות צבע/מעבר במצבי מיזוג (globalCompositeOperation — נתמך בכל הדפדפנים). השמות בעברית שלנו.
   שכבה: c=צבע מלא · lin='right'|'bottom' · rad=[cx,cy] (עיגול עד הפינה הרחוקה, כמו CSS) · s=[[צבע,מיקום]] · m=מצב מיזוג · o=שקיפות. סדר: before ואז after.

   API (window.PhotoFilters):
     apply(imageData,W,H,id,strength) — במקום (in place). imageData = ImageData או המערך שלו (RGBA).
        strength 0–1 (1 = מלא). שקיפות (ערוץ alpha) נשמרת. מחזיר true אם id מוכר, false אחרת (ואז לא נוגע).
     LOOKS · ARTS — [[id,שם בעברית]] · has(id)
   ⛔ שינוי בקובץ = להעלות את ה-?v= בכל דף שטוען אותו (בסטודיו: PF_V).
   ⛔ החישוב חייב להישאר זהה בפיקסלים — עיצובים שמורים מצוירים מחדש מההגדרות.
   ════════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.PhotoFilters)return;
  // עזרים פרטיים — העתק מדויק של phBoxBlur/phHue בסטודיו (שם הם משמשים גם לצינור הבסיסי), כדי שהקובץ יעמוד בפני עצמו
  function boxBlur(src,W,H,r){const n=src.length,o=new Float32Array(n),t=new Float32Array(n);o.set(src);if(r<1)return o;const k=1/(2*r+1);
  for(let it=0;it<3;it++){
    for(let y=0;y<H;y++){const row=y*W;for(let ch=0;ch<3;ch++){let acc=0;for(let i=-r;i<=r;i++)acc+=o[(row+(i<0?0:i>=W?W-1:i))*4+ch];
      for(let x=0;x<W;x++){t[(row+x)*4+ch]=acc*k;const a=x+r+1,b=x-r;acc+=o[(row+(a>=W?W-1:a))*4+ch]-o[(row+(b<0?0:b))*4+ch];}}}
    for(let x=0;x<W;x++){for(let ch=0;ch<3;ch++){let acc=0;for(let i=-r;i<=r;i++)acc+=t[((i<0?0:i>=H?H-1:i)*W+x)*4+ch];
      for(let y=0;y<H;y++){o[(y*W+x)*4+ch]=acc*k;const a=y+r+1,b=y-r;acc+=t[((a>=H?H-1:a)*W+x)*4+ch]-t[((b<0?0:b)*W+x)*4+ch];}}}}
  return o;}
  function hueRotate(r,g,b,deg){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return[r*(.213+c*.787-s*.213)+g*(.715-c*.715-s*.715)+b*(.072-c*.072+s*.928),r*(.213-c*.213+s*.143)+g*(.715+c*.285+s*.140)+b*(.072-c*.072-s*.283),r*(.213-c*.213-s*.787)+g*(.715-c*.715+s*.715)+b*(.072+c*.928+s*.072)];}
const T0=c=>c.replace(/rgba?\(([^,]+),([^,]+),([^,)]+)(,[^)]+)?\)/,'rgba($1,$2,$3,0)'); // "transparent" בצבע השכן — אחרת המעבר מתכהה
const GRAM={
  clarendon:{f:[['contrast',1.2],['saturate',1.35]],l:[{c:'rgba(127,187,227,.2)',m:'overlay'}]},
  gingham:{f:[['brightness',1.05],['hue',-10]],l:[{c:'#e6e6fa',m:'soft-light'}]},
  moon:{f:[['grayscale',1],['contrast',1.1],['brightness',1.1]],l:[{c:'#a0a0a0',m:'soft-light'},{c:'#383838',m:'lighten'}]},
  lark:{f:[['contrast',.9]],l:[{c:'#22253f',m:'color-dodge'},{c:'rgba(242,242,242,.8)',m:'darken'}]},
  reyes:{f:[['sepia',.22],['brightness',1.1],['contrast',.85],['saturate',.75]],l:[{c:'#efcdad',m:'soft-light',o:.5}]},
  juno:null,
  slumber:{f:[['saturate',.66],['brightness',1.05]],l:[{c:'rgba(69,41,12,.4)',m:'lighten'},{c:'rgba(125,105,24,.5)',m:'soft-light'}]},
  aden:{f:[['hue',-20],['contrast',.9],['saturate',.85],['brightness',1.2]],l:[{lin:'right',s:[['rgba(66,10,14,.2)',0],[T0('rgba(66,10,14,.2)'),1]],m:'darken'}]},
  perpetua:{f:[],l:[{lin:'bottom',s:[['#005b9a',0],['#e6c13d',1]],m:'soft-light',o:.5}]},
  mayfair:{f:[['contrast',1.1],['saturate',1.1]],l:[{rad:[.4,.4],s:[['rgba(255,255,255,.8)',0],['rgba(255,200,200,.6)',.3],['#111111',.6]],m:'overlay',o:.4}]},
  rise:{f:[['brightness',1.05],['sepia',.2],['contrast',.9],['saturate',.9]],l:[{rad:[.5,.5],s:[['rgba(236,205,169,.15)',.55],['rgba(50,30,7,.4)',1]],m:'multiply'},{rad:[.5,.5],s:[['rgba(232,197,152,.8)',0],[T0('rgba(232,197,152,.8)'),.9]],m:'overlay',o:.6}]},
  hudson:{f:[['brightness',1.2],['contrast',.9],['saturate',1.1]],l:[{rad:[.5,.5],s:[['#a6b1ff',.5],['#342134',1]],m:'multiply',o:.5}]},
  valencia:{f:[['contrast',1.08],['brightness',1.08],['sepia',.08]],l:[{c:'#3a0339',m:'exclusion',o:.5}]},
  xpro2:{f:[['sepia',.3]],l:[{rad:[.5,.5],s:[['#e6e7e0',.4],['rgba(43,42,161,.6)',1.1]],m:'color-burn'}]},
  willow:{f:[['grayscale',.5],['contrast',.95],['brightness',.9]],l:[{c:'#d8cdcb',m:'color'}]},
  lofi:{f:[['saturate',1.1],['contrast',1.5]],l:[{rad:[.5,.5],s:[['rgba(34,34,34,0)',.7],['#222222',1.5]],m:'multiply'}]},
  inkwell:{f:[['sepia',.3],['contrast',1.1],['brightness',1.1],['grayscale',1]],l:[]},
  nashville:{f:[['sepia',.2],['contrast',1.2],['brightness',1.05],['saturate',1.2]],l:[{c:'rgba(247,176,153,.56)',m:'darken'},{c:'rgba(0,70,150,.4)',m:'lighten'}]},
  stinson:{f:[['contrast',.75],['saturate',.85],['brightness',1.15]],l:[{c:'rgba(240,149,128,.2)',m:'soft-light'}]},
  walden:{f:[['brightness',1.1],['hue',-10],['sepia',.3],['saturate',1.6]],l:[{c:'#0044cc',m:'screen',o:.3}]},
  earlybird:{f:[['contrast',.9],['sepia',.2]],l:[{rad:[.5,.5],s:[['#d0ba8e',.2],['#360309',.85],['#1d0210',1]],m:'overlay'}]},
  toaster:{f:[['contrast',1.5],['brightness',.9]],l:[{rad:[.5,.5],s:[['#804e0f',0],['#3b003b',1]],m:'screen'}]},
  brannan:{f:[['sepia',.5],['contrast',1.4]],l:[{c:'rgba(161,44,199,.31)',m:'lighten'}]},
  kelvin:{f:[],l:[{c:'#382c34',m:'color-dodge'},{c:'#b77d21',m:'overlay'}]},
  maven:{f:[['sepia',.25],['brightness',.95],['contrast',.95],['saturate',1.5]],l:[{c:'rgba(3,230,26,.2)',m:'hue'}]},
  brooklyn:{f:[['contrast',.9],['brightness',1.1]],l:[{rad:[.5,.5],s:[['rgba(168,223,193,.4)',.7],['#c4b7c8',1]],m:'overlay'}]},
  y1977:{f:[['contrast',1.1],['brightness',1.1],['saturate',1.3]],l:[{c:'rgba(243,106,188,.3)',m:'screen'}]}};
delete GRAM.juno; // לא קיים ב-CSSgram
const PH_LOOKS=[['g_clarendon','שמיים חדים'],['g_gingham','לבנדר'],['g_moon','ירח'],['g_lark','בהיר טבעי'],['g_reyes','אבקה'],['g_slumber','חלומי'],['g_aden','אפרסק'],['g_perpetua','כחול-זהב'],
  ['g_mayfair','זוהר'],['g_rise','אור רך'],['g_hudson','קריר מבריק'],['g_valencia','חמים'],['g_xpro2','קרוס'],['g_willow','ערבה'],['g_lofi','לו-פיי'],['g_inkwell','דיו'],['g_nashville','ורדרד'],
  ['g_stinson','פסטל'],['g_walden','בוקר כחול'],['g_earlybird','זריחה'],['g_toaster','קלוי'],['g_brannan','מתכתי'],['g_kelvin','שקיעה'],['g_maven','זית'],['g_brooklyn','מנטה'],['g_y1977','שנות ה-70']];
// ── v0.31: פילטרים אמנותיים (קוד שלנו)
const PH_ARTS=[['oil','🖼️ ציור שמן'],['halftone','🔴 נקודות פופ-ארט'],['cpencil','🖍️ עפרונות צבעוניים'],['emboss','🪨 תבליט'],['glitch','📺 גליץ\''],['neon','💡 ניאון'],['thermal','🌡️ מצלמה תרמית'],['cyan','🔵 הדפס כחול']];
// פילטרי CSS לפי Filter Effects Level 1 (מטריצות על ערכי 0–255, חיתוך אחרי כל שלב — כמו הדפדפן)
function cssOps(r,g,b,ops){const c=v=>v<0?0:v>255?255:v;
  for(const [op,a] of ops){
    if(op==='brightness'){r=c(r*a);g=c(g*a);b=c(b*a);}
    else if(op==='contrast'){const k=(.5-.5*a)*255;r=c(r*a+k);g=c(g*a+k);b=c(b*a+k);}
    else if(op==='saturate'){const R=(.213+.787*a)*r+(.715-.715*a)*g+(.072-.072*a)*b,G=(.213-.213*a)*r+(.715+.285*a)*g+(.072-.072*a)*b,B=(.213-.213*a)*r+(.715-.715*a)*g+(.072+.928*a)*b;r=c(R);g=c(G);b=c(B);}
    else if(op==='grayscale'){const t=1-a,R=(.2126+.7874*t)*r+(.7152-.7152*t)*g+(.0722-.0722*t)*b,G=(.2126-.2126*t)*r+(.7152+.2848*t)*g+(.0722-.0722*t)*b,B=(.2126-.2126*t)*r+(.7152-.7152*t)*g+(.0722+.9278*t)*b;r=c(R);g=c(G);b=c(B);}
    else if(op==='sepia'){const t=1-a,R=(.393+.607*t)*r+(.769-.769*t)*g+(.189-.189*t)*b,G=(.349-.349*t)*r+(.686+.314*t)*g+(.168-.168*t)*b,B=(.272-.272*t)*r+(.534-.534*t)*g+(.131+.869*t)*b;r=c(R);g=c(G);b=c(B);}
    else if(op==='hue'){const o=hueRotate(r,g,b,a);r=c(o[0]);g=c(o[1]);b=c(o[2]);}}
  return[r,g,b];}
function gramLayers(x,W,H,layers){for(const L of layers){x.save();x.globalCompositeOperation=L.m;x.globalAlpha=L.o==null?1:L.o;let fill=L.c;
    if(L.lin){const gr=L.lin==='right'?x.createLinearGradient(0,0,W,0):x.createLinearGradient(0,0,0,H);L.s.forEach(([col,p])=>gr.addColorStop(p,col));fill=gr;}
    else if(L.rad){const cx=W*L.rad[0],cy=H*L.rad[1],R0=Math.max(Math.hypot(cx,cy),Math.hypot(W-cx,cy),Math.hypot(cx,H-cy),Math.hypot(W-cx,H-cy)),mx=Math.max(1,...L.s.map(q=>q[1])); // מיקום מעל 100% → מגדילים את הרדיוס
      const gr=x.createRadialGradient(cx,cy,0,cx,cy,R0*mx);L.s.forEach(([col,p])=>gr.addColorStop(p/mx,col));fill=gr;}
    x.fillStyle=fill;x.fillRect(0,0,W,H);x.restore();}}
// מריץ מראה/פילטר אמנותי על d (RGBA) במקום, ומשלב עם המקור לפי st (עוצמה)
function special(d,W,H,fl,st){const N=W*H,orig=new Uint8ClampedArray(d),cl=v=>v<0?0:v>255?255:v;
  const toCanvas=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(d),W,H),0,0);return c;};
  const fromCanvas=c=>{const q=c.getContext('2d').getImageData(0,0,W,H).data;for(let i=0;i<N*4;i+=4){d[i]=q[i];d[i+1]=q[i+1];d[i+2]=q[i+2];}};
  const lum=new Float32Array(N);for(let p=0,i=0;p<N;p++,i+=4)lum[p]=.299*d[i]+.587*d[i+1]+.114*d[i+2];
  if(fl.startsWith('g_')){const G=GRAM[fl.slice(2)];if(!G)return;
    for(let i=0;i<N*4;i+=4){const o=cssOps(d[i],d[i+1],d[i+2],G.f);d[i]=o[0];d[i+1]=o[1];d[i+2]=o[2];d[i+3]=255;}
    if(G.l.length){const c=toCanvas();gramLayers(c.getContext('2d'),W,H,G.l);fromCanvas(c);}}
  else if(fl==='oil'){ // Kuwahara: לכל פיקסל — הממוצע של הרבע (מתוך 4) עם השונות הנמוכה ביותר. טבלאות סכומים → O(N) בכל רדיוס
    const r=Math.max(2,Math.round(Math.max(W,H)/220)),W1=W+1,S=[0,1,2].map(()=>new Float64Array(W1*(H+1))),SL=new Float64Array(W1*(H+1)),SQ=new Float64Array(W1*(H+1));
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,p=(y+1)*W1+x+1,L=lum[y*W+x];for(let ch=0;ch<3;ch++)S[ch][p]=d[i+ch]+S[ch][p-1]+S[ch][p-W1]-S[ch][p-W1-1];SL[p]=L+SL[p-1]+SL[p-W1]-SL[p-W1-1];SQ[p]=L*L+SQ[p-1]+SQ[p-W1]-SQ[p-W1-1];}
    const box=(T,x0,y0,x1,y1)=>T[(y1+1)*W1+x1+1]-T[y0*W1+x1+1]-T[(y1+1)*W1+x0]+T[y0*W1+x0];
    const out=new Uint8ClampedArray(d);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){let best=1e18,bx=0,by=0,ex=0,ey=0;
      for(const [qx,qy] of [[-1,-1],[0,-1],[-1,0],[0,0]]){const x0=Math.max(0,qx<0?x-r:x),x1=Math.min(W-1,qx<0?x:x+r),y0=Math.max(0,qy<0?y-r:y),y1=Math.min(H-1,qy<0?y:y+r),n=(x1-x0+1)*(y1-y0+1),m=box(SL,x0,y0,x1,y1)/n,v=box(SQ,x0,y0,x1,y1)/n-m*m;
        if(v<best){best=v;bx=x0;by=y0;ex=x1;ey=y1;}}
      const n=(ex-bx+1)*(ey-by+1),i=(y*W+x)*4;for(let ch=0;ch<3;ch++)out[i+ch]=box(S[ch],bx,by,ex,ey)/n;}
    d.set(out);}
  else if(fl==='halftone'){ // נקודות בצבע הממוצע של כל תא, גודל לפי הכהות — על נייר לבן
    const s=Math.max(4,Math.round(Math.max(W,H)/90)),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fffdf7';x.fillRect(0,0,W,H);
    for(let y0=0,row=0;y0<H;y0+=s*.87,row++)for(let x0=(row&1)?s/2:0;x0<W;x0+=s){let R=0,G=0,B=0,n=0;const xa=Math.max(0,Math.floor(x0-s/2)),xb=Math.min(W,Math.ceil(x0+s/2)),ya=Math.max(0,Math.floor(y0-s/2)),yb=Math.min(H,Math.ceil(y0+s/2));
      for(let yy=ya;yy<yb;yy++)for(let xx=xa;xx<xb;xx++){const i=(yy*W+xx)*4;R+=d[i];G+=d[i+1];B+=d[i+2];n++;}if(!n)continue;R/=n;G/=n;B/=n;
      const L=.299*R+.587*G+.114*B,rad=s*.62*Math.sqrt(Math.max(0,1-L/255))+s*.08,sat=v=>cl(L+(v-L)*1.5);
      x.fillStyle='rgb('+sat(R*.85)+','+sat(G*.85)+','+sat(B*.85)+')';x.beginPath();x.arc(x0,y0,rad,0,7);x.fill();}
    fromCanvas(c);}
  else if(fl==='cpencil'){ // רישום עיפרון × צבעים מוחלשים
    const g=new Float32Array(N*4);for(let p=0;p<N;p++){g[p*4]=g[p*4+1]=g[p*4+2]=255-lum[p];}const bl=boxBlur(g,W,H,Math.max(1,Math.round(Math.max(W,H)/220)));
    for(let p=0,i=0;p<N;p++,i+=4){const sk=Math.min(255,lum[p]*255/Math.max(1,255-bl[i]))/255;for(let ch=0;ch<3;ch++)d[i+ch]=cl((d[i+ch]*.6+255*.4)*sk);}}
  else if(fl==='emboss'){const o=new Uint8ClampedArray(d),L=(x,y)=>lum[Math.min(H-1,Math.max(0,y))*W+Math.min(W-1,Math.max(0,x))],k=Math.max(1,Math.round(Math.max(W,H)/600));
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=cl(128+(L(x+k,y+k)-L(x-k,y-k))*1.4),i=(y*W+x)*4;o[i]=o[i+1]=o[i+2]=v;}d.set(o);}
  else if(fl==='glitch'){ // הזזת ערוצים + פסים אופקיים מוזזים (זרע קבוע — אותה תוצאה בכל ציור) + קווי סריקה
    const o=new Uint8ClampedArray(d),k=Math.max(2,Math.round(W/90));let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    const shift=new Int32Array(H);for(let y=0;y<H;){const h=Math.round(H*(.01+rnd()*.05)),sh=rnd()<.35?Math.round((rnd()-.5)*W*.08):0;for(let j=0;j<h&&y<H;j++,y++)shift[y]=sh;}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,sx=Math.min(W-1,Math.max(0,x-shift[y])),at=xx=>(y*W+Math.min(W-1,Math.max(0,xx)))*4,line=(y%3===0)?.82:1;
      o[i]=d[at(sx+k)]*line;o[i+1]=d[at(sx)+1]*line;o[i+2]=d[at(sx-k)+2]*line;}d.set(o);}
  else if(fl==='neon'){ // קצוות (Sobel על תמונה מוחלקת — בלי מרקם של דשא/שיער) בצבע המקור הרווי, על שחור, עם הילה
    const k=Math.max(1,Math.round(Math.max(W,H)/500)),g4=new Float32Array(N*4);for(let p=0;p<N;p++)g4[p*4]=lum[p];
    const bs=boxBlur(g4,W,H,k),L=(x,y)=>bs[(Math.min(H-1,Math.max(0,y))*W+Math.min(W-1,Math.max(0,x)))*4],e=new Float32Array(N*4);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const gx=L(x+k,y-k)+2*L(x+k,y)+L(x+k,y+k)-L(x-k,y-k)-2*L(x-k,y)-L(x-k,y+k),gy=L(x-k,y+k)+2*L(x,y+k)+L(x+k,y+k)-L(x-k,y-k)-2*L(x,y-k)-L(x+k,y-k),
        m=Math.max(0,Math.min(1,(Math.hypot(gx,gy)-70)/220)),i=(y*W+x)*4,l=lum[y*W+x];
      for(let ch=0;ch<3;ch++)e[i+ch]=cl(128+(d[i+ch]-l)*2.6)*m;}
    const gl=boxBlur(e,W,H,Math.max(2,Math.round(Math.max(W,H)/160)));for(let i=0;i<N*4;i+=4)for(let ch=0;ch<3;ch++)d[i+ch]=cl(e[i+ch]*1.5+gl[i+ch]*1.6);}
  else if(fl==='thermal'||fl==='cyan'){const P=fl==='thermal'?[[0,0,0],[30,0,110],[150,0,160],[230,40,40],[255,170,0],[255,255,170]]:[[8,32,80],[24,72,130],[90,140,190],[200,222,236],[244,246,248]];
    for(let p=0,i=0;p<N;p++,i+=4){const t=Math.min(.9999,lum[p]/255)*(P.length-1),a=Math.floor(t),f=t-a;for(let ch=0;ch<3;ch++)d[i+ch]=P[a][ch]+(P[a+1][ch]-P[a][ch])*f;}}
  if(st<1)for(let i=0;i<N*4;i+=4)for(let ch=0;ch<3;ch++)d[i+ch]=orig[i+ch]+(d[i+ch]-orig[i+ch])*st;
  for(let i=3;i<N*4;i+=4)d[i]=orig[i];} // שקיפות נשמרת
  window.PhotoFilters={LOOKS:PH_LOOKS,ARTS:PH_ARTS,
    has:id=>PH_LOOKS.some(a=>a[0]===id)||PH_ARTS.some(a=>a[0]===id),
    apply(img,W,H,id,strength){const d=img&&img.data?img.data:img;if(!d||!this.has(id))return false;special(d,W,H,id,strength==null?1:strength);return true;}};
})();
