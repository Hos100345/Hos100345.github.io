// ⛔ קובץ שנוצר אוטומטית — אין לערוך ידנית.
// מקור: dobble.html · נבנה ע"י tools/build-play-engine.py
// בסיס: 3a091e5 · sha256(dobble.html)=2e499ec4e44c
// כל פונקציה כאן היא עותק בייט-לבייט מהמחולל, כדי שקלף בנגן (play.html) ייראה
// בדיוק כמו במחולל. play.html מגדיר את S, needsWatermark ו-t לפני השימוש.

// ── ORDERS (dobble.html:3599) ──
const ORDERS=[{q:2,total:7,spc:3},{q:3,total:13,spc:4},{q:4,total:21,spc:5},
              {q:5,total:31,spc:6},{q:7,total:57,spc:8},
              {q:8,total:73,spc:9},{q:9,total:91,spc:10}];

// ── CARD_PX (dobble.html:3602) ──
const CARD_PX=500;

// ── IMG_PX (dobble.html:3607) ──
const IMG_PX=400;

// ── LOAD_MAX (dobble.html:3608) ──
const LOAD_MAX=1200; // צד ארוך מקסימלי בטעינה — שומר על יחס גובה-רוחב (לא כופה ריבוע)

// ── fitLongSide (dobble.html:3611) ──
function fitLongSide(w,h,max){
  const scale=Math.min(1,max/Math.max(w,h));
  return{w:Math.max(1,Math.round(w*scale)),h:Math.max(1,Math.round(h*scale))};
}

// ── gf4a (dobble.html:3616) ──
function gf4a(a,b){return a^b}

// ── gf4m (dobble.html:3617) ──
function gf4m(a,b){
  if(!a||!b)return 0;if(a===1)return b;if(b===1)return a;
  const a1=(a>>1)&1,a0=a&1,b1=(b>>1)&1,b0=b&1;
  return((((a1&b1)^(a1&b0)^(a0&b1))&1)<<1)|(((a1&b1)^(a0&b0))&1);
}

// ── gf8a (dobble.html:3624) ──
function gf8a(a,b){return a^b;}

// ── gf8m (dobble.html:3625) ──
function gf8m(a,b){
  let r=0;
  while(b){
    if(b&1)r^=a;
    a<<=1;
    if(a&0b1000)a^=0b1011;
    b>>=1;
  }
  return r;
}

// ── gf9a (dobble.html:3637) ──
function gf9a(a,b){
  const h=((a/3|0)+(b/3|0))%3, l=(a%3+b%3)%3;
  return h*3+l;
}

// ── gf9m (dobble.html:3641) ──
function gf9m(a,b){
  const h1=a/3|0,l1=a%3,h2=b/3|0,l2=b%3;
  const hi=(h1*l2+l1*h2)%3;
  const lo=(l1*l2+2*h1*h2)%3;
  return hi*3+lo;
}

// ── gfOps (dobble.html:3648) ──
function gfOps(q){
  if(q===4)return{a:gf4a,m:gf4m};
  if(q===8)return{a:gf8a,m:gf8m};
  if(q===9)return{a:gf9a,m:gf9m};
  return{a:(a,b)=>(a+b)%q,m:(a,b)=>(a*b)%q};
}

// ── genDeck (dobble.html:3655) ──
function genDeck(q){
  const{a,m}=gfOps(q),D=[];
  D.push(Array.from({length:q+1},(_,i)=>i));
  for(let s=0;s<q;s++)for(let i=0;i<q;i++){
    const c=[s+1];for(let x=0;x<q;x++)c.push(q+1+x*q+a(m(s,x),i));D.push(c);
  }
  for(let v=0;v<q;v++){const c=[0];for(let y=0;y<q;y++)c.push(q+1+v*q+y);D.push(c);}
  return D;
}

// ── bestOrder (dobble.html:3664) ──
function bestOrder(n){let b=null;for(const o of ORDERS)if(o.total<=n)b=o;return b}

// ── sr (dobble.html:3686) ──
function sr(seed){
  seed=Math.imul(seed^(seed>>>16),0x45d9f3b);
  seed=Math.imul(seed^(seed>>>16),0x45d9f3b);
  return((seed^(seed>>>16))>>>0)/0x100000000;
}

// ── buildLayouts (dobble.html:3693) ──
function buildLayouts(deck,seed,sMin,sMax){
  const range=sMax-sMin;
  return deck.map((syms,ci)=>{
    const base=seed*10000+ci;
    const sh=[...syms];
    for(let i=sh.length-1;i>0;i--){const j=Math.floor(sr(base*100+i)*(i+1));[sh[i],sh[j]]=[sh[j],sh[i]];}
    const tr=sh.map((_,si)=>({sc:sMin+sr(base*200+si*7)*range,ro:sr(base*300+si*13+7)*Math.PI*2}));
    return{syms:sh,tr,ci};   // ci = אינדקס הקלף — נדרש לשליפת התאמות ידניות (S.cardEdits)
  });
}

// ── overlapFactor (dobble.html:3708) ──
function overlapFactor(){
  const ov=S.overlap||0;
  return ov>=0 ? 1-(ov/100)*.35 : 1+(-ov/100)*.20;
}

// ── contactFactor (dobble.html:3714) ──
function contactFactor(){
  const ov=S.overlap||0;
  return ov>=0 ? 1-(ov/100)*0.85 : 1+(-ov/100)*0.60;
}

// ── symPos (dobble.html:3719) ──
function symPos(n,cx,cy,r){
  if(S.layoutMode==='peripheral') return symPosPeriph(n,cx,cy,r);
  const ov=overlapFactor();
  const P=[],p=(x,y,hs)=>P.push({x,y,hs});
  if(n===3){
    const rr=r*.56*ov,hs=r*.34;for(let i=0;i<3;i++){const a=i*2*Math.PI/3-Math.PI/2;p(cx+rr*Math.cos(a),cy+rr*Math.sin(a),hs);}
  }else if(n===4){
    p(cx,cy,r*.30);const rr=r*.60*ov,hs=r*.28;for(let i=0;i<3;i++){const a=i*2*Math.PI/3-Math.PI/2;p(cx+rr*Math.cos(a),cy+rr*Math.sin(a),hs);}
  }else if(n===5){
    p(cx,cy,r*.27);const rr=r*.60*ov,hs=r*.25;for(let i=0;i<4;i++){const a=i*Math.PI/2-Math.PI/4;p(cx+rr*Math.cos(a),cy+rr*Math.sin(a),hs);}
  }else if(n===6){
    p(cx,cy,r*.24);const rr=r*.60*ov,hs=r*.23;for(let i=0;i<5;i++){const a=i*2*Math.PI/5-Math.PI/2;p(cx+rr*Math.cos(a),cy+rr*Math.sin(a),hs);}
  }else if(n===9){
    // 73 קלפים (q=8): מרכז + טבעת פנימית 3 + טבעת חיצונית 5. אותו יחס טבעת+חצי-גודל
    // ≤ .90r כמו ב-8, כדי שהסמלים לא יחרגו מהקלף לפני ההרפיה.
    p(cx,cy,r*.18);
    const ri=r*.36*ov,hsi=r*.17;for(let i=0;i<3;i++){const a=i*2*Math.PI/3-Math.PI/2;p(cx+ri*Math.cos(a),cy+ri*Math.sin(a),hsi);}
    const ro=r*.73*ov,hso=r*.17;for(let i=0;i<5;i++){const a=i*2*Math.PI/5+Math.PI/10;p(cx+ro*Math.cos(a),cy+ro*Math.sin(a),hso);}
  }else if(n===10){
    // 91 קלפים (q=9): מרכז + 3 + 6.
    p(cx,cy,r*.17);
    const ri=r*.35*ov,hsi=r*.16;for(let i=0;i<3;i++){const a=i*2*Math.PI/3-Math.PI/2;p(cx+ri*Math.cos(a),cy+ri*Math.sin(a),hsi);}
    const ro=r*.74*ov,hso=r*.16;for(let i=0;i<6;i++){const a=i*Math.PI/3;p(cx+ro*Math.cos(a),cy+ro*Math.sin(a),hso);}
  }else{
    // 8 סמלים (57 קלפים): מרכז + 3 + 4.
    p(cx,cy,r*.20);
    const ri=r*.38*ov,hsi=r*.19;for(let i=0;i<3;i++){const a=i*2*Math.PI/3;p(cx+ri*Math.cos(a),cy+ri*Math.sin(a),hsi);}
    const ro=r*.72*ov,hso=r*.18;for(let i=0;i<4;i++){const a=i*Math.PI/2-Math.PI/4;p(cx+ro*Math.cos(a),cy+ro*Math.sin(a),hso);}
  }
  return P;
}

// ── symPosPeriph (dobble.html:3751) ──
function symPosPeriph(n,cx,cy,r){
  // All symbols on one ring — evenly spaced, sized so neighbours don't overlap
  // hs ≤ rr·sin(π/n) כדי ששכנים על הטבעת לא ייגעו, ו-rr+hs ≤ ~.90 כדי להישאר בקלף.
  const cfg={3:{rr:.52,hs:.396},4:{rr:.57,hs:.330},5:{rr:.61,hs:.286},6:{rr:.64,hs:.253},8:{rr:.68,hs:.220},9:{rr:.70,hs:.205},10:{rr:.72,hs:.190}};
  const{rr,hs}=cfg[n]||{rr:.65,hs:.20};
  const P=[],ringR=r*rr*overlapFactor(),hsz=r*hs;
  for(let i=0;i<n;i++){const a=i*2*Math.PI/n-Math.PI/2;P.push({x:cx+ringR*Math.cos(a),y:cy+ringR*Math.sin(a),hs:hsz});}
  return P;
}

// ── CIRCLE_RADIAL (dobble.html:8316) ──
function CIRCLE_RADIAL(){const a=new Float32Array(64);a.fill(1);return a;}

// ── CIRCLE_META (dobble.html:3762) ──
const CIRCLE_META={hasAlpha:false,radial:CIRCLE_RADIAL()};

// ── reachAt (dobble.html:3765) ──
function reachAt(meta,rotation,angle,half){
  const bins=64;
  let a=angle-rotation;                       // לזווית העולם מחסירים את סיבוב הסמל
  a=((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  const idx=Math.round(a/(Math.PI*2)*bins)%bins;
  return meta.radial[idx]*half;
}

// ── relaxSymbolPositions (dobble.html:3776) ──
function relaxSymbolPositions(pos,layout,imgs,cx,cy,rSym){
  const n=pos.length;
  if(!n)return;
  const metas=layout.syms.map(si=>{const img=imgs[si];return (img&&img.__symMeta)||CIRCLE_META;});
  const rots=layout.tr.map(t=>t.ro);
  const halves=pos.map((p,i)=>p.hs*layout.tr[i].sc);   // משתנה רק בגודל האוטומטי (D-60), במקום
  const origX=pos.map(p=>p.x),origY=pos.map(p=>p.y);
  const kT=contactFactor();          // יעד המגע האמיתי — לעולם לא יורד, גם כשההרפיה מתפשרת
  const tol=rSym*0.015;

  // ההפרה הגרועה ביותר של פריסה נתונה מול יעד k (זוגות + גבול הקלף)
  function violation(P,k){
    let mv=0;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const dx=P[j].x-P[i].x,dy=P[j].y-P[i].y,d=Math.hypot(dx,dy)||1e-4;
      const ang=Math.atan2(dy,dx);
      const need=(reachAt(metas[i],rots[i],ang+Math.PI,halves[i])+reachAt(metas[j],rots[j],ang,halves[j]))*k;
      if(need-d>mv)mv=need-d;
    }
    for(let i=0;i<n;i++){
      const dx=P[i].x-cx,dy=P[i].y-cy,dist=Math.hypot(dx,dy);
      const angOut=dist<1e-6?0:Math.atan2(dy,dx);
      const over=dist+reachAt(metas[i],rots[i],angOut,halves[i])-rSym;
      if(over>mv)mv=over;
    }
    return mv;
  }

  // מעבר הרפיה יחיד מנקודת פתיחה נתונה. יציאה מוקדמת כשאין יותר דחיפות.
  function runPass(k,X0,Y0){
    const P=X0.map((x,i)=>({x,y:Y0[i]}));
    for(let it=0;it<90;it++){
      let moved=0;
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        let dx=P[j].x-P[i].x,dy=P[j].y-P[i].y,d=Math.hypot(dx,dy),ang;
        if(d<1e-6){ang=i*2.4;dx=Math.cos(ang);dy=Math.sin(ang);d=0.01;}
        else ang=Math.atan2(dy,dx);
        const need=(reachAt(metas[i],rots[i],ang+Math.PI,halves[i])+reachAt(metas[j],rots[j],ang,halves[j]))*k;
        if(d<need){
          const push=(need-d)/2*0.6,ux=dx/d,uy=dy/d;
          P[i].x-=ux*push;P[i].y-=uy*push;
          P[j].x+=ux*push;P[j].y+=uy*push;
          if(push>rSym*1e-4)moved++;
        }
      }
      for(let i=0;i<n;i++){
        const dx=P[i].x-cx,dy=P[i].y-cy,dist=Math.hypot(dx,dy);
        if(dist<1e-6)continue;
        const angOut=Math.atan2(dy,dx);
        const reach=reachAt(metas[i],rots[i],angOut,halves[i]);
        if(dist+reach>rSym){
          const over=dist+reach-rSym,ux=dx/dist,uy=dy/dist;
          P[i].x-=ux*over;P[i].y-=uy*over;moved++;
        }
      }
      if(!moved)break;
    }
    return P;
  }

  // נקודות פתיחה חלופיות ("לולאת ניסיונות מחדש" מהאפיון) — דטרמיניסטיות לחלוטין:
  // סיבוב קשיח של הפריסה ההתחלתית + פיזור רדיאלי. אין Math.random בשום שלב.
  function variant(v){
    const X=[],Y=[],rot=v*(Math.PI*2/7),cs=Math.cos(rot),sn=Math.sin(rot);
    const spread=v>=2?1.10:1;
    for(let i=0;i<n;i++){
      const dx=(origX[i]-cx)*spread,dy=(origY[i]-cy)*spread;
      X.push(cx+dx*cs-dy*sn);Y.push(cy+dx*sn+dy*cs);
    }
    return{X,Y};
  }

  // חיפוש: 4 נקודות פתיחה × 4 מעברים עם נסיגה הדרגתית ב-k. תקרה קבועה = 16 מעברים,
  // ולכן אין שום מסלול ללולאה אינסופית. עוצרים מוקדם ברגע שנמצאה פריסה נקייה.
  let best=null,bestViol=Infinity;
  for(let v=0;v<4;v++){
    const st=variant(v);
    let k=kT;
    for(let a=0;a<4;a++){
      const P=runPass(k,st.X,st.Y);
      const mv=violation(P,kT);
      if(mv<bestViol){bestViol=mv;best=P;}
      if(bestViol<=tol)break;
      k*=0.92;
    }
    if(bestViol<=tol)break;
  }

  // ── סגירה אנליטית: הערובה ל-0% חפיפה ו-0 חריגה, בצעד יחיד ──
  // need_ij ו-reach_i לינאריים במקדם g, ולכן
  //   g = min( d_ij / need_ij ,  (rSym − dist_i) / reach_i )
  // הוא בדיוק המקדם הגדול ביותר שעדיין חוקי. O(n²), בלי איטרציות, בלי סיכון לקיפאון.
  function exactShrink(P){
    let g=1;
    for(let i=0;i<n;i++){
      const dx=P[i].x-cx,dy=P[i].y-cy,dist=Math.hypot(dx,dy);
      const angOut=dist<1e-6?0:Math.atan2(dy,dx);
      const reach=reachAt(metas[i],rots[i],angOut,halves[i]);
      if(reach>1e-9&&dist+reach>rSym)g=Math.min(g,Math.max(0,(rSym-dist)/reach));
    }
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const dx=P[j].x-P[i].x,dy=P[j].y-P[i].y,d=Math.hypot(dx,dy);
      const ang=Math.atan2(dy,dx);
      const need=(reachAt(metas[i],rots[i],ang+Math.PI,halves[i])+reachAt(metas[j],rots[j],ang,halves[j]))*kT;
      if(need>1e-9&&d<need)g=Math.min(g,d/need);
    }
    return Math.max(0.20,Math.min(1,g));
  }
  let g=exactShrink(best);

  // D-60 גודל אוטומטי: "ניפוח" — מגדילים את כל הסמלים יחד עד המגע הראשון (g אנליטי בלי תקרת 1), מרפים שוב כדי
  // לפנות מקום, וחוזר — עד שאין עוד לאן לגדול. עובד גם עם מרווח (kT>1): המרווח הוא יחס לגודל הסמלים ונשמר.
  // התקרה היחידה היא הגבולות עצמם (dist+reach ≤ rSym וזוגות ≥ need). AUTO_GMAX=4 הוא רק בלם בטיחות לסמל
  // "ריק" (פרופיל רדיאלי ≈ 0) שבלעדיו g יכול לצאת אינסופי. שלב אחרון: g המדויק — לעולם לא מעבר לחוקי.
  if(S.sizeMode==='auto'){
    const gU=P=>{
      let gg=Infinity;
      for(let i=0;i<n;i++){
        const dx=P[i].x-cx,dy=P[i].y-cy,dist=Math.hypot(dx,dy);
        const angOut=dist<1e-6?0:Math.atan2(dy,dx);
        const reach=reachAt(metas[i],rots[i],angOut,halves[i]);
        if(reach>1e-9)gg=Math.min(gg,Math.max(0,(rSym-dist)/reach));
      }
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        const dx=P[j].x-P[i].x,dy=P[j].y-P[i].y,d=Math.hypot(dx,dy);
        const ang=Math.atan2(dy,dx);
        const need=(reachAt(metas[i],rots[i],ang+Math.PI,halves[i])+reachAt(metas[j],rots[j],ang,halves[j]))*kT;
        if(need>1e-9)gg=Math.min(gg,d/need);
      }
      return Math.max(0.05,Math.min(AUTO_GMAX,gg));
    };
    // חיפוש בינארי על מקדם הגדילה F: לכל ניסיון מגדילים את כל הסמלים פי F, מרפים מהפריסה החוקית האחרונה
    // (התחלה חמה), ובודקים שאין הפרה. הגדול ביותר שעבר = הקלף מלא. AUTO_STEPS צעדים, דטרמיניסטי, בלי רנדום.
    const base=halves.slice(),setF=f=>{for(let i=0;i<n;i++)halves[i]=base[i]*f;};
    let lo=gU(best),loP=best,hi=lo*2.5;
    setF(lo);
    for(let s2=0;s2<AUTO_STEPS;s2++){
      const mid=(lo+hi)/2;setF(mid);
      const P=runPass(kT,loP.map(p=>p.x),loP.map(p=>p.y));
      if(violation(P,kT)<=tol){lo=mid;loP=P;}else hi=mid;
    }
    setF(lo);best=loP;const F=lo;
    g=F*Math.min(1,gU(best));
    for(let i=0;i<n;i++){pos[i].x=best[i].x;pos[i].y=best[i].y;pos[i].hs=pos[i].hs*g;}
    return;
  }

  // "מילוי מיטבי": רק כשאין שום הפרה (g===1) וכשאין מרווח שלילי — הגדלה עד הגבול החוקי.
  if(g>=1&&S.tightFill&&(S.overlap||0)>=0){
    const fits=q=>{
      for(let i=0;i<n;i++){
        const dx=best[i].x-cx,dy=best[i].y-cy,dist=Math.hypot(dx,dy);
        const angOut=dist<1e-6?0:Math.atan2(dy,dx);
        if(dist+reachAt(metas[i],rots[i],angOut,halves[i])*q>rSym*1.001)return false;
      }
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        const dx=best[j].x-best[i].x,dy=best[j].y-best[i].y,d=Math.hypot(dx,dy)||1e-4;
        const ang=Math.atan2(dy,dx);
        const need=(reachAt(metas[i],rots[i],ang+Math.PI,halves[i])+reachAt(metas[j],rots[j],ang,halves[j]))*q*kT;
        if(d<need*0.999)return false;
      }
      return true;
    };
    let lo=1,hi=1.5;
    for(let s=0;s<10;s++){const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid;}
    g=lo;
  }

  for(let i=0;i<n;i++){pos[i].x=best[i].x;pos[i].y=best[i].y;pos[i].hs=pos[i].hs*g;}
}

// ── AUTO_GMAX (dobble.html:3947) ──
const AUTO_GMAX=4,AUTO_STEPS=7;   // ראו "גודל אוטומטי" ב-relaxSymbolPositions. 7 צעדים = דיוק ~1% ב-F

// ── cardGeom (dobble.html:3951) ──
function cardGeom(sz){
  // המרווח היה 7px מוחלטים — 1.4% מהקלף ב-500px אבל 0.625% ב-1120px, מה שגרם
  // לסטייה של 1.59% ב-ppMm בין איכויות הייצוא ולפריסה שונה במקצת בכל אחת.
  // 7/500 = 0.014 בדיוק, ולכן ב-sz=500 התוצאה זהה לחלוטין להתנהגות הקודמת.
  const M=sz*0.014;
  const cx=sz/2,cy=sz/2,r=sz/2-M;
  const sq=r*1.88,sqx=cx-sq/2,sqy=cy-sq/2,sqcr=sq*.09;
  const ppMm=(sz-2*M)/Math.max(1,S.cardSizeMm),fw=S.frame.w*ppMm;
  const rSym=Math.max(r*.25,r-fw-S.symPad*ppMm);
  return{cx,cy,r,sq,sqx,sqy,sqcr,ppMm,fw,rSym};
}

// ── packSignature (dobble.html:3967) ──
function packSignature(n){
  return [n,S.layoutMode,S.overlap,S.tightPack?1:0,S.tightFill?1:0,S.metaVer||0,S.sizeMode||'',S.sizeMode==='auto'?S.sizeK:''].join('|');
}

// ── packNormalized (dobble.html:3970) ──
function packNormalized(layout,imgs){
  const n=layout.syms.length;
  if(!n)return[];
  const sig=packSignature(n)+'|'+layout.tr.map(t=>t.sc.toFixed(4)+','+t.ro.toFixed(4)).join(';');
  const c=layout.__pack;
  if(c&&c.sig===sig)return c.pos;
  const pos=symPos(n,0,0,1);
  if(S.tightPack)relaxSymbolPositions(pos,layout,imgs,0,0,1);
  else if(S.sizeMode==='auto')relaxSymbolPositions(pos,layout,[],0,0,1);   // גודל אוטומטי בלי "לפי צורה" = מילוי לפי עיגולים
  else clampInsideCard(pos,layout,1);
  layout.__pack={sig,pos};
  return pos;
}

// ── clampInsideCard (dobble.html:3985) ──
function clampInsideCard(pos,layout,rSym){
  let g=1;
  for(let i=0;i<pos.length;i++){
    const half=pos[i].hs*layout.tr[i].sc;
    if(half<=1e-9)continue;
    const d=Math.hypot(pos[i].x,pos[i].y);
    if(d+half>rSym)g=Math.min(g,Math.max(0,(rSym-d)/half));
  }
  if(g<1){g=Math.max(g,0.20);for(const p of pos)p.hs*=g;}
}

// ── computeCardPositions (dobble.html:3997) ──
function computeCardPositions(layout,imgs,sz){
  const G=cardGeom(sz);
  const npos=packNormalized(layout,imgs);
  const pos=npos.map(p=>({x:G.cx+p.x*G.rSym,y:G.cy+p.y*G.rSym,hs:p.hs*G.rSym}));
  applyCardEdits(pos,layout,G);
  return{pos,G};
}

// ── applyCardEdits (dobble.html:4007) ──
function applyCardEdits(pos,layout,G){
  const ed=(layout&&layout.ci!=null&&S.cardEdits)?S.cardEdits[layout.ci]:null;
  if(!ed)return;
  for(let i=0;i<pos.length;i++){
    const o=ed[i];if(!o)continue;
    if(o.s)pos[i].hs*=o.s;
    if(o.dx)pos[i].x+=o.dx*G.rSym;
    if(o.dy)pos[i].y+=o.dy*G.rSym;
  }
}

// ── rrect (dobble.html:4042) ──
function rrect(ctx,x,y,w,h,cr){
  ctx.moveTo(x+cr,y);ctx.lineTo(x+w-cr,y);ctx.arcTo(x+w,y,x+w,y+cr,cr);
  ctx.lineTo(x+w,y+h-cr);ctx.arcTo(x+w,y+h,x+w-cr,y+h,cr);
  ctx.lineTo(x+cr,y+h);ctx.arcTo(x,y+h,x,y+h-cr,cr);
  ctx.lineTo(x,y+cr);ctx.arcTo(x,y,x+cr,y,cr);ctx.closePath();
}

// ── drawCard (dobble.html:4049) ──
function drawCard(canvas,layout,imgs,shape,hitIdx){
  hitIdx=hitIdx==null?-1:hitIdx;
  const ctx=canvas.getContext('2d'),sz=canvas.width;
  const G=cardGeom(sz);
  const cx=G.cx,cy=G.cy,r=G.r,sq=G.sq,sqx=G.sqx,sqy=G.sqy,sqcr=G.sqcr;
  ctx.clearRect(0,0,sz,sz);
  const isC=shape==='circle';

  // Background (configurable color + opacity)
  ctx.save();ctx.beginPath();
  if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
  ctx.clip();ctx.globalAlpha=S.bg.op/100;ctx.fillStyle=S.bg.color;
  ctx.fillRect(0,0,sz,sz);ctx.globalAlpha=1;ctx.restore();

  // Frame (configurable width, color, opacity)
  const ppMm=G.ppMm,fw=G.fw;
  if(fw>0.5&&S.frame.op>0){
    ctx.save();ctx.beginPath();
    if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
    ctx.clip();ctx.beginPath();
    if(isC)ctx.arc(cx,cy,r-fw/2,0,Math.PI*2);
    else rrect(ctx,sqx+fw/2,sqy+fw/2,sq-fw,sq-fw,sqcr);
    ctx.strokeStyle=S.frame.color;ctx.globalAlpha=S.frame.op/100;
    ctx.lineWidth=fw;ctx.stroke();ctx.globalAlpha=1;ctx.restore();
  }else{
    ctx.beginPath();
    if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
    ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1.5;ctx.stroke();
  }

  const pos=computeCardPositions(layout,imgs,sz).pos;
  for(let i=0;i<layout.syms.length;i++){
    const si=layout.syms[i],pp=pos[i],t=layout.tr[i],img=imgs[si];
    if(!img)continue;
    const hit=si===hitIdx,ds=pp.hs*t.sc*2;
    ctx.save();ctx.translate(pp.x,pp.y);ctx.rotate(t.ro);
    if(hit){
      ctx.shadowColor='#F59E0B';ctx.shadowBlur=sz*.07;
      ctx.beginPath();ctx.arc(0,0,pp.hs*t.sc*1.35,0,Math.PI*2);
      ctx.fillStyle='rgba(253,224,71,.28)';ctx.fill();ctx.shadowBlur=0;
    }
    const meta=img.__symMeta;
    if(meta&&meta.hasAlpha){
      // סמל עם שקיפות: הקנבס כבר גזור וממורכז לצורתו האמיתית (trimAlphaSquare) — אין חיתוך צורה
      ctx.drawImage(img,-ds/2,-ds/2,ds,ds);
    }else if(S.symShape==='square')drawCover(ctx,img,-ds/2,-ds/2,ds);
    else{ctx.save();ctx.beginPath();ctx.arc(0,0,ds/2,0,Math.PI*2);ctx.clip();drawCover(ctx,img,-ds/2,-ds/2,ds);ctx.restore();}
    ctx.restore();
  }
  if(needsWatermark())drawWatermark(ctx,cx,cy,r,isC,sq,sqx,sqy,sqcr,sz);
}

// ── drawWatermark (dobble.html:4102) ──
function drawWatermark(ctx,cx,cy,r,isC,sq,sqx,sqy,sqcr,sz){
  ctx.save();
  ctx.beginPath();
  if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
  ctx.clip();
  ctx.globalAlpha=.16;
  ctx.fillStyle='#1e1b4b';
  ctx.font=`900 ${Math.round(sz*.1)}px system-ui,-apple-system,"Segoe UI",Arial`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.translate(cx,cy);ctx.rotate(-Math.PI/6);
  for(let y=-sz;y<=sz;y+=sz*.24)ctx.fillText('תצוגה מקדימה',0,y);
  ctx.restore();
}

// ── imgNatW (dobble.html:8223) ──
function imgNatW(el){return el.naturalWidth||el.width;}

// ── imgNatH (dobble.html:8224) ──
function imgNatH(el){return el.naturalHeight||el.height;}

// ── drawCover (dobble.html:8227) ──
function drawCover(ctx,img,dx,dy,dSize){
  const iw=imgNatW(img),ih=imgNatH(img);
  const s=Math.max(dSize/iw,dSize/ih);
  const sw=dSize/s,sh=dSize/s;
  const sx=(iw-sw)/2,sy=(ih-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dSize,dSize);
}

// ── symbolShapeMeta (dobble.html:8276) ──
function symbolShapeMeta(cv){
  if(cv.__symMeta)return cv.__symMeta;
  const N=64,bins=64;
  let data;
  try{
    const tmp=document.createElement('canvas');tmp.width=tmp.height=N;
    const tctx=tmp.getContext('2d');
    tctx.drawImage(cv,0,0,N,N);
    data=tctx.getImageData(0,0,N,N).data;
  }catch(e){
    const meta={hasAlpha:false,radial:CIRCLE_RADIAL()};
    cv.__symMeta=meta;return meta;
  }
  let hasAlpha=false;
  for(let i=3;i<data.length;i+=4){if(data[i]<250){hasAlpha=true;break;}}
  let radial;
  if(!hasAlpha){
    radial=CIRCLE_RADIAL();
  }else{
    const raw=new Float32Array(bins);
    const cx=N/2,cy=N/2,half=N/2;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const idx=(y*N+x)*4;
      if(data[idx+3]<=10)continue;
      const ddx=x+0.5-cx,ddy=y+0.5-cy;
      const dist=Math.hypot(ddx,ddy)/half;
      let ang=Math.atan2(ddy,ddx);if(ang<0)ang+=Math.PI*2;
      const bin=Math.round(ang/(Math.PI*2)*bins)%bins;
      if(dist>raw[bin])raw[bin]=dist;
    }
    radial=new Float32Array(bins);
    for(let i=0;i<bins;i++){
      const a=raw[(i-1+bins)%bins],b=raw[i],c=raw[(i+1)%bins];
      radial[i]=Math.min(1,Math.max((a+b+c)/3,0.15));
    }
  }
  const meta={hasAlpha,radial};
  cv.__symMeta=meta;
  return meta;
}

// ── prepareSymbolMeta (dobble.html:8319) ──
function prepareSymbolMeta(){
  S.metaVer=(S.metaVer||0)+1;   // מבטל את ה-cache של הפריסה כשמטא-הצורה של הסמלים השתנה
  S.imgEls.forEach(img=>{if(img)symbolShapeMeta(img);});
}

// ── isSymbolAsset (dobble.html:4695) ──
function isSymbolAsset(a){return !a.isCropSource&&a.type!=='backlogo';}

// ── isFaceSym (dobble.html:5344) ──
function isFaceSym(a){return !!(a&&a.type==='crop'&&a.af&&!a.af.kind);}

// ── SH_LIM (dobble.html:5345) ──
var SH_LIM=24;   // ⛔ תקרת שינוי לפיקסל (רמות בהירות) — בלי הילות סביב קצוות; הבדיקה דורשת ≤25

// ── shStrength (dobble.html:5348) ──
function shStrength(a){
  const src=S.assets.find(x=>x.id===a.srcAssetId);
  const side=src&&src.imgEl&&a.af&&a.af.s?a.af.s*imgNatW(src.imgEl):0;
  const u=side>0?IMG_PX/side:2;
  return {amt:Math.max(.35,Math.min(1.3,.35+.25*(u-1))),rad:u<1.6?1:(u<3?2:3)};
}

// ── sharpenCanvas (dobble.html:5356) ──
function sharpenCanvas(src,{amt,rad}){
  const W=imgNatW(src),H=imgNatH(src),cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const x=cv.getContext('2d');x.drawImage(src,0,0);
  const img=x.getImageData(0,0,W,H),d=img.data,n=W*H;
  const P=[new Float32Array(n),new Float32Array(n),new Float32Array(n),new Float32Array(n)];
  for(let i=0;i<n;i++){const a=d[i*4+3]/255;P[3][i]=a;P[0][i]=d[i*4]*a;P[1][i]=d[i*4+1]*a;P[2][i]=d[i*4+2]*a;}
  const tmp=new Float32Array(n);
  const box=(A,horiz)=>{const L=horiz?W:H,M=horiz?H:W,step=horiz?1:W,line=horiz?W:1;
    for(let m=0;m<M;m++){const o=m*line;let acc=0;
      for(let k=-rad;k<=rad;k++)acc+=A[o+Math.min(L-1,Math.max(0,k))*step];
      for(let l=0;l<L;l++){tmp[o+l*step]=acc/(2*rad+1);
        acc+=A[o+Math.min(L-1,l+rad+1)*step]-A[o+Math.max(0,l-rad)*step];}
      for(let l=0;l<L;l++)A[o+l*step]=tmp[o+l*step];}};
  for(const A of P){box(A,true);box(A,false);box(A,true);box(A,false);}   // 2× box ≈ גאוסיאני
  for(let i=0;i<n;i++){
    if(!d[i*4+3])continue;
    const ab=P[3][i];if(ab<=1e-6)continue;
    for(let ch=0;ch<3;ch++){const v=d[i*4+ch],b=P[ch][i]/ab;
      let dl=amt*(v-b);if(dl>SH_LIM)dl=SH_LIM;else if(dl<-SH_LIM)dl=-SH_LIM;
      d[i*4+ch]=Math.max(0,Math.min(255,Math.round(v+dl)));}
  }
  x.putImageData(img,0,0);
  return cv;
}

// ── symImg (dobble.html:5380) ──
function symImg(a){
  if(!(a&&a.af&&a.af.sh&&isFaceSym(a)))return a.imgEl;
  const c=a._sh;
  if(c&&c.src===a.imgEl)return c.cv;
  const cv=sharpenCanvas(a.imgEl,shStrength(a));
  a._sh={src:a.imgEl,cv};
  return cv;
}
