// ⛔ קובץ שנוצר אוטומטית — אין לערוך ידנית.
// מקור: dobble.html · נבנה ע"י tools/build-play-engine.py
// בסיס: ae3c3b9 · sha256(dobble.html)=995f950eb6d5
// כל פונקציה כאן היא עותק בייט-לבייט מהמחולל, כדי שקלף בנגן (play.html) ייראה
// בדיוק כמו במחולל. play.html מגדיר את S, needsWatermark ו-t לפני השימוש.

// ── ORDERS (dobble.html:3992) ──
const ORDERS=[{q:2,total:7,spc:3},{q:3,total:13,spc:4},{q:4,total:21,spc:5},
              {q:5,total:31,spc:6},{q:7,total:57,spc:8},
              {q:8,total:73,spc:9},{q:9,total:91,spc:10}];

// ── CARD_PX (dobble.html:3995) ──
const CARD_PX=500;

// ── IMG_PX (dobble.html:4000) ──
const IMG_PX=400;

// ── LOAD_MAX (dobble.html:4001) ──
const LOAD_MAX=1200; // צד ארוך מקסימלי בטעינה — שומר על יחס גובה-רוחב (לא כופה ריבוע)

// ── fitLongSide (dobble.html:4004) ──
function fitLongSide(w,h,max){
  const scale=Math.min(1,max/Math.max(w,h));
  return{w:Math.max(1,Math.round(w*scale)),h:Math.max(1,Math.round(h*scale))};
}

// ── gf4a (dobble.html:4009) ──
function gf4a(a,b){return a^b}

// ── gf4m (dobble.html:4010) ──
function gf4m(a,b){
  if(!a||!b)return 0;if(a===1)return b;if(b===1)return a;
  const a1=(a>>1)&1,a0=a&1,b1=(b>>1)&1,b0=b&1;
  return((((a1&b1)^(a1&b0)^(a0&b1))&1)<<1)|(((a1&b1)^(a0&b0))&1);
}

// ── gf8a (dobble.html:4017) ──
function gf8a(a,b){return a^b;}

// ── gf8m (dobble.html:4018) ──
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

// ── gf9a (dobble.html:4030) ──
function gf9a(a,b){
  const h=((a/3|0)+(b/3|0))%3, l=(a%3+b%3)%3;
  return h*3+l;
}

// ── gf9m (dobble.html:4034) ──
function gf9m(a,b){
  const h1=a/3|0,l1=a%3,h2=b/3|0,l2=b%3;
  const hi=(h1*l2+l1*h2)%3;
  const lo=(l1*l2+2*h1*h2)%3;
  return hi*3+lo;
}

// ── gfOps (dobble.html:4041) ──
function gfOps(q){
  if(q===4)return{a:gf4a,m:gf4m};
  if(q===8)return{a:gf8a,m:gf8m};
  if(q===9)return{a:gf9a,m:gf9m};
  return{a:(a,b)=>(a+b)%q,m:(a,b)=>(a*b)%q};
}

// ── genDeck (dobble.html:4048) ──
function genDeck(q){
  const{a,m}=gfOps(q),D=[];
  D.push(Array.from({length:q+1},(_,i)=>i));
  for(let s=0;s<q;s++)for(let i=0;i<q;i++){
    const c=[s+1];for(let x=0;x<q;x++)c.push(q+1+x*q+a(m(s,x),i));D.push(c);
  }
  for(let v=0;v<q;v++){const c=[0];for(let y=0;y<q;y++)c.push(q+1+v*q+y);D.push(c);}
  return D;
}

// ── bestOrder (dobble.html:4057) ──
function bestOrder(n){let b=null;for(const o of ORDERS)if(o.total<=n)b=o;return b}

// ── sr (dobble.html:4079) ──
function sr(seed){
  seed=Math.imul(seed^(seed>>>16),0x45d9f3b);
  seed=Math.imul(seed^(seed>>>16),0x45d9f3b);
  return((seed^(seed>>>16))>>>0)/0x100000000;
}

// ── buildLayouts (dobble.html:4086) ──
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

// ── overlapFactor (dobble.html:4101) ──
function overlapFactor(){
  const ov=S.overlap||0;
  return ov>=0 ? 1-(ov/100)*.35 : 1+(-ov/100)*.20;
}

// ── contactFactor (dobble.html:4107) ──
function contactFactor(){
  const ov=S.overlap||0;
  return ov>=0 ? 1-(ov/100)*0.85 : 1+(-ov/100)*0.60;
}

// ── symPos (dobble.html:4112) ──
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

// ── symPosPeriph (dobble.html:4144) ──
function symPosPeriph(n,cx,cy,r){
  // All symbols on one ring — evenly spaced, sized so neighbours don't overlap
  // hs ≤ rr·sin(π/n) כדי ששכנים על הטבעת לא ייגעו, ו-rr+hs ≤ ~.90 כדי להישאר בקלף.
  const cfg={3:{rr:.52,hs:.396},4:{rr:.57,hs:.330},5:{rr:.61,hs:.286},6:{rr:.64,hs:.253},8:{rr:.68,hs:.220},9:{rr:.70,hs:.205},10:{rr:.72,hs:.190}};
  const{rr,hs}=cfg[n]||{rr:.65,hs:.20};
  const P=[],ringR=r*rr*overlapFactor(),hsz=r*hs;
  for(let i=0;i<n;i++){const a=i*2*Math.PI/n-Math.PI/2;P.push({x:cx+ringR*Math.cos(a),y:cy+ringR*Math.sin(a),hs:hsz});}
  return P;
}

// ── CIRCLE_RADIAL (dobble.html:10268) ──
function CIRCLE_RADIAL(){const a=new Float32Array(64);a.fill(1);return a;}

// ── CIRCLE_META (dobble.html:4155) ──
const CIRCLE_META={hasAlpha:false,radial:CIRCLE_RADIAL()};

// ── symBoundNorm (dobble.html:4160) ──
function symBoundNorm(){
  if(CARD_SHAPES[S.shape])return specialBound();   // D-95
  if(S.shape!=='square')return null;
  const G=cardGeom(500),pad=G.fw+S.symPad*G.ppMm;
  return{H:(G.sq/2-pad)/G.rSym,cr:Math.max(0,G.sqcr-pad)/G.rSym};
}

// ── symOverSq (dobble.html:4169) ──
function symOverSq(meta,rot,half,x,y,B,R){
  const rad=meta.fine||meta.radial,n=rad.length,st=Math.PI*2/n,cu=meta.fine?1:1.012;   // עיגול אטום: פוליגון 64 צלעות — קצת מרווח לקשת
  let mx=-Infinity;
  if(B&&B.fld){   // D-95: צורה מיוחדת — שדה מרחק מסומן
    if(!meta.fine&&!meta.hasAlpha)return fldOver(B,x,y)+half*cu;   // סמל אטום עגול: ה-SDF הוא מרחק אמיתי, אז מספיק מרכז+רדיוס (במקום 64 נקודות)
    const T=unitCS(n),ca=Math.cos(rot),sa=Math.sin(rot);   // טבלת סינוס/קוסינוס + סיבוב אחד, במקום 2n קריאות טריגו
    for(let i=0;i<n;i++){const ux=T[2*i],uy=T[2*i+1],rr=rad[i]*half*cu,d=fldOver(B,x+rr*(ux*ca-uy*sa),y+rr*(ux*sa+uy*ca));if(d>mx)mx=d;}
    return mx;
  }
  if(B){
    const a0=B.H-B.cr;
    for(let i=0;i<n;i++){
      const a=rot+i*st,rr=rad[i]*half*cu;
      const qx=Math.abs(x+rr*Math.cos(a))-a0,qy=Math.abs(y+rr*Math.sin(a))-a0;
      const d=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-B.cr;
      if(d>mx)mx=d;
    }
  }else{
    for(let i=0;i<n;i++){
      const a=rot+i*st,rr=rad[i]*half*cu;
      const d=Math.hypot(x+rr*Math.cos(a),y+rr*Math.sin(a))-R;
      if(d>mx)mx=d;
    }
  }
  return mx;
}

// ── symGmaxSq (dobble.html:4196) ──
function symGmaxSq(meta,rot,half,x,y,B,cap,R){
  if(!(half>1e-9))return cap;
  if(symOverSq(meta,rot,0,x,y,B,R)>0)return 0;
  if(symOverSq(meta,rot,half*cap,x,y,B,R)<=0)return cap;
  let lo=0,hi=cap;
  for(let k=0;k<16;k++){const m=(lo+hi)/2;if(symOverSq(meta,rot,half*m,x,y,B,R)<=0)lo=m;else hi=m;}
  return lo;
}

// ── reachAt (dobble.html:4206) ──
function reachAt(meta,rotation,angle,half){
  const bins=64;
  let a=angle-rotation;                       // לזווית העולם מחסירים את סיבוב הסמל
  a=((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  const idx=Math.round(a/(Math.PI*2)*bins)%bins;
  return meta.radial[idx]*half;
}

// ── EX_N (dobble.html:4218) ──
const EX_N=64;

// ── EX_CIRC (dobble.html:4219) ──
const EX_CIRC=(()=>{const a=new Float32Array(128);for(let i=0;i<64;i++){const t=i*Math.PI/32;a[2*i]=Math.cos(t);a[2*i+1]=Math.sin(t);}return a;})();

// ── EX_SQE (dobble.html:4220) ──
const EX_SQE=(()=>{const a=new Float32Array(256);for(let i=0;i<128;i++){const sd=Math.floor(i/32),f=(i%32)/32*2-1;const q=[[f,-1],[1,f],[-f,1],[-1,-f]][sd];a[2*i]=q[0];a[2*i+1]=q[1];}return a;})();

// ── exactData (dobble.html:4222) ──
function exactData(meta){
  if(!meta||!meta.m64)return null;
  const key=S.symShape==='square'?'s':'c';
  const c=meta.__ex;if(c&&c.key===key)return c;
  const N=EX_N,m=meta.m64,op=new Uint8Array(N*N),clip=key==='c';
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(!m[y*N+x])continue;
    if(clip&&Math.hypot((x+.5)/N*2-1,(y+.5)/N*2-1)>1+1.5/N)continue;
    op[y*N+x]=1;
  }
  const dt=new Float32Array(N*N),ed=[];
  for(let k=0;k<N*N;k++)dt[k]=op[k]?0:1e9;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const k=y*N+x;let v=dt[k];
    if(x>0)v=Math.min(v,dt[k-1]+1);
    if(y>0){v=Math.min(v,dt[k-N]+1);if(x>0)v=Math.min(v,dt[k-N-1]+1.414);if(x<N-1)v=Math.min(v,dt[k-N+1]+1.414);}
    dt[k]=v;
  }
  for(let y=N-1;y>=0;y--)for(let x=N-1;x>=0;x--){
    const k=y*N+x;let v=dt[k];
    if(x<N-1)v=Math.min(v,dt[k+1]+1);
    if(y<N-1){v=Math.min(v,dt[k+N]+1);if(x<N-1)v=Math.min(v,dt[k+N+1]+1.414);if(x>0)v=Math.min(v,dt[k+N-1]+1.414);}
    dt[k]=v;
  }
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(!op[y*N+x])continue;
    if(x===0||y===0||x===N-1||y===N-1||!op[y*N+x-1]||!op[y*N+x+1]||!op[(y-1)*N+x]||!op[(y+1)*N+x])ed.push((x+.5)/N*2-1,(y+.5)/N*2-1);
  }
  let rs=0;for(let i=0;i<meta.radial.length;i++)rs+=meta.radial[i];
  const ex={key,dt,edge:Float32Array.from(ed),rm:rs/meta.radial.length};
  meta.__ex=ex;return ex;
}

// ── exDir (dobble.html:4255) ──
function exDir(A,B){
  const sqS=S.symShape==='square',ea=A.ex?A.ex.edge:(sqS?EX_SQE:EX_CIRC),N=EX_N;
  const slack=(A.ex?.71*2*A.h/N:0)+(B.ex?1.42*2*B.h/N:0);
  const ca=Math.cos(A.ro),sa=Math.sin(A.ro),cb=Math.cos(B.ro),sb=Math.sin(B.ro),dtB=B.ex&&B.ex.dt,cw=2*B.h/N;
  let best=1e9;
  for(let k=0;k<ea.length;k+=2){
    const u=ea[k]*A.h,v=ea[k+1]*A.h;
    const wx=A.x+u*ca-v*sa-B.x,wy=A.y+u*sa+v*ca-B.y;
    const qx=(wx*cb+wy*sb)/B.h,qy=(-wx*sb+wy*cb)/B.h;   // סיבוב הפוך של B
    let d;
    if(dtB){
      const gx=(qx+1)*.5*N-.5,gy=(qy+1)*.5*N-.5;
      const ix=Math.min(N-1,Math.max(0,Math.round(gx))),iy=Math.min(N-1,Math.max(0,Math.round(gy)));
      const ox=gx<0?gx:(gx>N-1?gx-(N-1):0),oy=gy<0?gy:(gy>N-1?gy-(N-1):0);
      d=(dtB[iy*N+ix]+Math.hypot(ox,oy))*cw;
    }else d=sqS?Math.max(0,Math.max(Math.abs(qx),Math.abs(qy))-1)*B.h:Math.max(0,Math.hypot(qx,qy)-1)*B.h;
    if(d-slack<best)best=d-slack;
  }
  return best;
}

// ── exDeficit (dobble.html:4276) ──
function exDeficit(A,B,fk){
  const rA=A.ex?A.ex.rm:1,rB=B.ex?B.ex.rm:1,tgt=fk*(rA*A.h+rB*B.h);
  const mA=A.ex?1.5:(S.symShape==='square'?1.42:1),mB=B.ex?1.5:(S.symShape==='square'?1.42:1);
  if(Math.hypot(B.x-A.x,B.y-A.y)>mA*A.h+mB*B.h+tgt)return -1;
  return tgt-Math.min(exDir(A,B),exDir(B,A));
}

// ── exactSeparate (dobble.html:4284) ──
function exactSeparate(pos,layout,imgs){
  if((S.overlap||0)>0)return;
  const n=pos.length;if(n<2)return;
  const metas=layout.syms.map(si=>(imgs[si]&&imgs[si].__symMeta)||CIRCLE_META);
  if(!metas.some(m=>m.hasAlpha&&m.m64))return;
  const kT=contactFactor(),fk=Math.max(0,kT-1),hullToo=!!(S.tightPack||S.sizeMode==='auto'),SQ=symBoundNorm();
  const st=pos.map((p,i)=>({m:metas[i],ex:exactData(metas[i]),ro:layout.tr[i].ro,sc:layout.tr[i].sc,x:p.x,y:p.y,h:p.hs*layout.tr[i].sc}));
  const pairs=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    if(st[i].ex||st[j].ex)pairs.push([i,j,true]);
    else if(hullToo)pairs.push([i,j,false]);   // אטום מול אטום: רק כשהפריסה הרגילה כבר אוכפת אותם (ההרפיה) — לא נוגעים בציר אחר
  }
  const def=(a,b,ex)=>{
    if(ex)return exDeficit(a,b,fk);
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-4,ang=Math.atan2(dy,dx);
    return (reachAt(a.m,a.ro,ang+Math.PI,a.h)+reachAt(b.m,b.ro,ang,b.h))*kT-d;
  };
  const out=s2=>{   // חריגה מגבול הקלף (>0)
    const dist=Math.hypot(s2.x,s2.y);
    if(SQ||s2.ex)return symOverSq(s2.m,s2.ro,s2.h,s2.x,s2.y,SQ,1);
    return dist+reachAt(s2.m,s2.ro,dist<1e-6?0:Math.atan2(s2.y,s2.x),s2.h)-1;
  };
  for(let it=0;it<12;it++){
    let moved=0;
    for(const [i,j,ex] of pairs){
      const a=st[i],b=st[j],dfc=def(a,b,ex);
      if(!(dfc>1e-4))continue;
      let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
      if(d<1e-6){dx=Math.cos(i*2.4);dy=Math.sin(i*2.4);d=1;}
      const ux=dx/d,uy=dy/d,push=dfc/2;
      a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push;moved++;
    }
    for(const s2 of st){   // מושכים פנימה סמל שיצא מהקלף
      const o=out(s2);
      if(o>0&&SQ&&SQ.fld){const q=fldPull(SQ,s2.x,s2.y,o*.9);s2.x=q.x;s2.y=q.y;moved++;continue;}   // D-95
      if(o>0){const dist=Math.hypot(s2.x,s2.y);if(dist>1e-6){const m=Math.min(o,dist);s2.x-=s2.x/dist*m;s2.y-=s2.y/dist*m;moved++;}}
    }
    if(!moved)break;
  }
  for(const s2 of st){   // גבול הקלף: רק הקטנה (נשארת בתוך הקלף גם אחרי הקטנות הבאות)
    if(!(out(s2)>0))continue;
    let lo=0,hi=1;for(let k=0;k<14;k++){const m=(lo+hi)/2,h0=s2.h;s2.h=h0*m;const o=out(s2);s2.h=h0;if(o<=0)lo=m;else hi=m;}
    s2.h*=Math.max(lo,0.02);
  }
  for(let it=0;it<60;it++){   // אם נשארה הפרה — מקטינים את הזוג (המרווח הנדרש קטן יחד איתו)
    let bad=0;
    for(const [i,j,ex] of pairs){
      if(def(st[i],st[j],ex)>1e-4){st[i].h*=0.95;st[j].h*=0.95;bad++;}
    }
    if(!bad)break;
  }
  for(let i=0;i<n;i++){pos[i].x=st[i].x;pos[i].y=st[i].y;pos[i].hs=st[i].h/st[i].sc;}
}

// ── CARD_SHAPES (dobble.html:4558) ──
const CARD_SHAPES={
  'menorah-candles':{he:'חנוכייה עם בליטות להבות',en:'Menorah with flame bumps',ops:()=>abstractShapeOps('menorah-candles')},
  'menorah-smooth':{he:'חנוכייה עם קשת חלקה',en:'Menorah with smooth arch',ops:()=>abstractShapeOps('menorah-smooth')},
  'dreidel':{he:'סביבון',en:'Dreidel',ops:()=>abstractShapeOps('dreidel')}
};

// ── isSpecialShape (dobble.html:4563) ──
function isSpecialShape(id){return !!CARD_SHAPES[id===undefined?S.shape:id];}

// ── SHAPE_RAD (dobble.html:4567) ──
const SHAPE_RAD=.082,DOME_N=2.5;   // 7 מ"מ — הפער שמעל 6 מ"מ סופג את ההחלקה

// ── _maskDilate (dobble.html:4568) ──
function _maskDilate(m,N,r){const d=edt2d(m,N,1),o=new Uint8Array(N*N);for(let i=0;i<N*N;i++)o[i]=d[i]<=r?1:0;return o;}

// ── _maskErode (dobble.html:4569) ──
function _maskErode(m,N,r){const d=edt2d(m,N,0),o=new Uint8Array(N*N);for(let i=0;i<N*N;i++)o[i]=d[i]>r?1:0;return o;}

// ── abstractShapeOps (dobble.html:4570) ──
function abstractShapeOps(id){
  const N=SHAPE_N*2,k=N/SHAPE_S,M=SHAPE_M,X=u=>(u+M)*k;   // בנייה ברזולוציה כפולה — קווים ישרים/אלכסוניים בלי אדוות פיקסל
  const cv=document.createElement('canvas');cv.width=cv.height=N;
  const c=cv.getContext('2d',{willReadFrequently:true});c.fillStyle='#000';
  const ell=(cx,cy,rx,ry)=>{c.beginPath();c.ellipse(X(cx),X(cy),rx*k,ry*k,0,0,Math.PI*2);c.fill();};
  const rect=(x,y,w,h)=>{c.beginPath();c.rect(X(x),X(y),w*k,h*k);c.fill();};
  const rr=(x,y,w,h,cr)=>{c.beginPath();rrect(c,X(x),X(y),w*k,h*k,cr*k);c.fill();};
  const circ=(cx,cy,r)=>ell(cx,cy,r,r);
  if(id==='dreidel'){
    // גוף = מעטפת קמורה של 5 מרכזים מורחבת ב-0.12 (10 מ"מ): פינות עליונות, פינות אמצע וחוד עגול; ידית רחבה וקצרה עם קצה עגול
    c.beginPath();[[.22,.29],[.78,.29],[.78,.55],[.5,.85],[.22,.55]].forEach((q,i)=>i?c.lineTo(X(q[0]),X(q[1])):c.moveTo(X(q[0]),X(q[1])));c.closePath();c.fill();
    const g=c.getImageData(0,0,N,N).data,hm=new Uint8Array(N*N);
    for(let i=0;i<N*N;i++)hm[i]=g[i*4+3]>127?1:0;
    const hd=_maskDilate(hm,N,.12*k);   // רק הגוף מורחב; הידית נוספת אחרי
    c.clearRect(0,0,N,N);rr(.35,.03,.30,.30,.15);
    const h2=c.getImageData(0,0,N,N).data;
    c.clearRect(0,0,N,N);const im=c.createImageData(N,N);
    for(let i=0;i<N*N;i++){const v=hd[i]||h2[i*4+3]>127;im.data[i*4+3]=v?255:0;}
    c.putImageData(im,0,0);
  }else{
    const topY=x=>.40-.345*Math.pow(Math.max(0,1-Math.pow(Math.abs(x-.5)/.4,DOME_N)),1/DOME_N);
    c.beginPath();for(let i=0;i<=160;i++){const t=i/160*Math.PI*2,ct=Math.cos(t),st=Math.sin(t);   // כיפה: על-אליפסה (n=2.5), 80% מרוחב הקלף
      const px=.5+.40*Math.sign(ct)*Math.pow(Math.abs(ct),2/DOME_N),py=.40+.345*Math.sign(st)*Math.pow(Math.abs(st),2/DOME_N);i?c.lineTo(X(px),X(py)):c.moveTo(X(px),X(py));}c.closePath();c.fill();
    rect(.28,.55,.44,.30);                // צוואר 37 מ"מ
    rr(.17,.79,.66,.185,.0925);           // בסיס עגול: 66% מהרוחב
    if(id==='menorah-candles')for(const x of[.5,.26,.74])circ(x,topY(x)+.19-.044,.19);   // 3 בליטות רכות, גובה 3.7 מ"מ, בסיס ≥20 מ"מ
  }
  const a=c.getImageData(0,0,N,N).data;let m=new Uint8Array(N*N);
  for(let i=0;i<N*N;i++)m[i]=a[i*4+3]>127?1:0;
  const r=SHAPE_RAD*k;
  m=_maskDilate(_maskErode(m,N,r),N,r);   // פתיחה: מעגלת פינות חיצוניות ומסירה בליטות דקות
  m=_maskErode(_maskDilate(m,N,r),N,r);   // סגירה (אחרונה — שומרת רדיוס פנימי ≥ r): ממלאת חריצים צרים ומעגלת פינות פנימיות
  // טשטוש קל של המסכה (3 מעברי ממוצע אופקי+אנכי) ← שדה רציף; הקו ברמה 0.5 חלק, בלי מדרגות פיקסל
  let f=new Float32Array(N*N);for(let i=0;i<N*N;i++)f[i]=m[i];
  const tmp=new Float32Array(N*N),RB=6;
  for(let pass=0;pass<4;pass++){
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){let a2=0,c2=0;for(let d=-RB;d<=RB;d++){const xx=x+d;if(xx>=0&&xx<N){a2+=f[y*N+xx];c2++;}}tmp[y*N+x]=a2/c2;}
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){let a2=0,c2=0;for(let d=-RB;d<=RB;d++){const yy=y+d;if(yy>=0&&yy<N){a2+=tmp[yy*N+x];c2++;}}f[y*N+x]=a2/c2;}
  }
  for(let i=0;i<N*N;i++)f[i]=.5-f[i];   // שלילי = פנים
  let pts=marchingLoop(f,N,0);   // [x,y,...] בקואורדינטות תיבה
  let n=pts.length/2;
  for(let it=0;it<18;it++){const q=pts.slice();for(let i=0;i<n;i++){const a2=((i-1+n)%n)*2,b2=((i+1)%n)*2;pts[2*i]=(q[a2]+q[2*i]*2+q[b2])/4;pts[2*i+1]=(q[a2+1]+q[2*i+1]*2+q[b2+1])/4;}}
  const cum=[0];for(let i=1;i<=n;i++){const a2=(i-1)*2,b2=(i%n)*2;cum.push(cum[i-1]+Math.hypot(pts[b2]-pts[a2],pts[b2+1]-pts[a2+1]));}
  const total=cum[n],cnt=Math.max(120,Math.round(total/.004)),ops=[];let seg=0;
  for(let j=0;j<cnt;j++){
    const tgt=j/cnt*total;while(seg<n-1&&cum[seg+1]<tgt)seg++;
    const a2=seg*2,b2=((seg+1)%n)*2,sl=cum[seg+1]-cum[seg]||1,t=(tgt-cum[seg])/sl;
    ops.push([j?'L':'M',pts[a2]+(pts[b2]-pts[a2])*t,pts[a2+1]+(pts[b2+1]-pts[a2+1])*t]);
  }
  ops.push(['Z']);
  return ops;
}

// ── marchingLoop (dobble.html:4714) ──
function marchingLoop(s,N,L){
  const segs=[],eid=(x,y,dir)=>(y*N+x)*2+dir;
  const pt=(e)=>{   // נקודת החיתוך על הקצה e
    const dir=e&1,idx=e>>1,x=idx%N,y=(idx-x)/N;
    const a=s[idx],b=dir===0?s[idx+1]:s[idx+N],t=(L-a)/(b-a);
    return dir===0?[(x+t+.5)/N*SHAPE_S-SHAPE_M,(y+.5)/N*SHAPE_S-SHAPE_M]:[(x+.5)/N*SHAPE_S-SHAPE_M,(y+t+.5)/N*SHAPE_S-SHAPE_M];
  };
  for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){
    const a=s[y*N+x]<L?1:0,b=s[y*N+x+1]<L?2:0,c=s[(y+1)*N+x+1]<L?4:0,d=s[(y+1)*N+x]<L?8:0,cs=a|b|c|d;
    if(cs===0||cs===15)continue;
    const T=eid(x,y,0),R=eid(x+1,y,1),Bt=eid(x,y+1,0),Lf=eid(x,y,1);
    switch(cs){
      case 1:case 14:segs.push([Lf,T]);break;
      case 2:case 13:segs.push([T,R]);break;
      case 3:case 12:segs.push([Lf,R]);break;
      case 4:case 11:segs.push([R,Bt]);break;
      case 6:case 9:segs.push([T,Bt]);break;
      case 7:case 8:segs.push([Lf,Bt]);break;
      case 5:{const m=(s[y*N+x]+s[y*N+x+1]+s[(y+1)*N+x]+s[(y+1)*N+x+1])/4<L;if(m){segs.push([T,R],[Bt,Lf]);}else{segs.push([Lf,T],[R,Bt]);}break;}
      case 10:{const m=(s[y*N+x]+s[y*N+x+1]+s[(y+1)*N+x]+s[(y+1)*N+x+1])/4<L;if(m){segs.push([Lf,T],[R,Bt]);}else{segs.push([T,R],[Bt,Lf]);}break;}
    }
  }
  const adj=new Map();
  for(let i=0;i<segs.length;i++)for(const e of segs[i]){if(!adj.has(e))adj.set(e,[]);adj.get(e).push(i);}
  const used=new Uint8Array(segs.length);let best=[];
  for(let i0=0;i0<segs.length;i0++){
    if(used[i0])continue;
    const loop=[];let i=i0,e=segs[i][0];
    while(i!==undefined&&!used[i]){
      used[i]=1;const sg=segs[i],nx=sg[0]===e?sg[1]:sg[0];
      loop.push(pt(nx)[0],pt(nx)[1]);e=nx;
      const cand=adj.get(e);i=cand?cand.find(j=>!used[j]):undefined;
    }
    if(loop.length>best.length)best=loop;
  }
  return best;
}

// ── DREIDEL_LETTERS (dobble.html:4878) ──
const DREIDEL_LETTERS=['נ','ג','ה','ש'];

// ── drawShapeArt (dobble.html:4879) ──
function drawShapeArt(ctx,id,G,color,alpha,letter){
  const box=2*G.r,x0=G.cx-G.r,y0=G.cy-G.r,X=u=>x0+u*box,Y=v=>y0+v*box,L=v=>v*box;
  ctx.save();
  ctx.beginPath();traceCardShape(ctx,id,G,G.ppMm*4);ctx.clip();   // גבול הציור = קו החיתוך פחות 4 מ"מ
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.fillStyle=color;
  const A=alpha==null?1:alpha;
  ctx.globalAlpha=A*.10;ctx.fillRect(0,0,G.cx*2,G.cy*2);          // מילוי רך של כל הצורה הפנימית
  ctx.globalAlpha=A;ctx.lineWidth=L(.008);
  ctx.beginPath();traceCardShape(ctx,id,G,G.ppMm*4);ctx.stroke();   // קו מקביל לחיתוך
  if(id==='dreidel'){
    ctx.lineWidth=L(.012);
    ctx.beginPath();ctx.moveTo(X(.2),Y(.40));ctx.lineTo(X(.8),Y(.40));ctx.stroke();   // כתף הסביבון
    ctx.lineWidth=L(.006);ctx.globalAlpha=A*.7;ctx.beginPath();traceCardShape(ctx,id,G,G.ppMm*11);ctx.stroke();ctx.globalAlpha=A;ctx.lineWidth=L(.012);   // קו פנימי נוסף, מקביל לחיתוך
    ctx.globalAlpha=A*.22;ctx.beginPath();ctx.ellipse(X(.5),Y(.17),L(.06),L(.05),0,0,Math.PI*2);ctx.fill();   // ידית רכה
    ctx.globalAlpha=A;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`800 ${L(.34)}px Heebo,Arial,sans-serif`;ctx.fillText(letter||'נ',X(.5),Y(.62));
  }else{
    const arch=x=>.40-.298*Math.pow(Math.max(0,1-Math.pow(Math.abs(x-.5)/.353,2.5)),.4);   // קשת הכיפה הפנימית (מקבילה לקלף)
    ctx.lineWidth=L(.016);
    const xs=[];for(let k=-4;k<=4;k++)xs.push(.5+k*.08);
    xs.forEach((x,i)=>{
      const sham=i===4,top=arch(x)+(sham?.0:.035),flameH=.05,candleTop=top+flameH,candleBase=candleTop+(sham?.15:.115);
      if(!sham){const dx=x-.5;ctx.beginPath();ctx.moveTo(X(.5),Y(.66));ctx.bezierCurveTo(X(.5+dx*.55),Y(.73),X(.5+dx),Y(.62),X(x),Y(candleBase));ctx.stroke();}   // זרוע
      ctx.fillRect(X(x-.017),Y(candleTop),L(.034),L(candleBase-candleTop));                                   // נר
      ctx.beginPath();ctx.ellipse(X(x),Y(top+flameH*.5),L(.016),L(flameH*.55),0,0,Math.PI*2);ctx.fill();   // להבה
    });
    ctx.beginPath();ctx.moveTo(X(.5),Y(.38));ctx.lineTo(X(.5),Y(.84));ctx.stroke();                          // גזע
    ctx.globalAlpha=A*.55;ctx.beginPath();rrect(ctx,X(.24),Y(.845),L(.52),L(.085),L(.042));ctx.fill();       // בסיס — מילוי רך
    ctx.globalAlpha=A;ctx.beginPath();rrect(ctx,X(.24),Y(.845),L(.52),L(.085),L(.042));ctx.stroke();
  }
  ctx.restore();
}

// ── traceShapeOps (dobble.html:4631) ──
function traceShapeOps(ctx,ops,x0,y0,w,h){
  for(const s of ops){
    if(s[0]==='M')ctx.moveTo(x0+s[1]*w,y0+s[2]*h);
    else if(s[0]==='L')ctx.lineTo(x0+s[1]*w,y0+s[2]*h);
    else if(s[0]==='C')ctx.bezierCurveTo(x0+s[1]*w,y0+s[2]*h,x0+s[3]*w,y0+s[4]*h,x0+s[5]*w,y0+s[6]*h);
    else ctx.closePath();
  }
}

// ── shapePolyline (dobble.html:4640) ──
function shapePolyline(id){
  const inf=shapeInfo(id);if(inf.poly)return inf.poly;
  const pts=[];let cx=0,cy=0;
  for(const s of inf.ops){
    if(s[0]==='M'||s[0]==='L'){cx=s[1];cy=s[2];pts.push([cx,cy]);}
    else if(s[0]==='C'){
      for(let i=1;i<=14;i++){const t=i/14,u=1-t;
        pts.push([u*u*u*cx+3*u*u*t*s[1]+3*u*t*t*s[3]+t*t*t*s[5],u*u*u*cy+3*u*u*t*s[2]+3*u*t*t*s[4]+t*t*t*s[6]]);}
      cx=s[5];cy=s[6];
    }
  }
  inf.poly=pts;
  let x0=9,y0=9,x1=-9,y1=-9;
  for(const p of pts){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];}
  inf.bbox=[x0,y0,x1,y1];
  return pts;
}

// ── edt1d (dobble.html:4658) ──
function edt1d(f,n,d,v,z){
  let k=0;v[0]=0;z[0]=-1e30;z[1]=1e30;
  for(let q=1;q<n;q++){
    let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
    while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
    k++;v[k]=q;z[k]=s;z[k+1]=1e30;
  }
  k=0;
  for(let q=0;q<n;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])*(q-v[k])+f[v[k]];}
}

// ── edt2d (dobble.html:4668) ──
function edt2d(bin,N,target){   // מרחק (בתאים) מכל תא אל התא הקרוב ביותר שערכו target
  const INF=1e12,g=new Float64Array(N*N),f=new Float64Array(N),d=new Float64Array(N),v=new Int32Array(N),z=new Float64Array(N+1);
  for(let x=0;x<N;x++){
    for(let y=0;y<N;y++)f[y]=bin[y*N+x]===target?0:INF;
    edt1d(f,N,d,v,z);for(let y=0;y<N;y++)g[y*N+x]=d[y];
  }
  const out=new Float32Array(N*N);
  for(let y=0;y<N;y++){
    for(let x=0;x<N;x++)f[x]=g[y*N+x];
    edt1d(f,N,d,v,z);for(let x=0;x<N;x++)out[y*N+x]=Math.sqrt(d[x]);
  }
  return out;
}

// ── SHAPE_N (dobble.html:4681) ──
const SHAPE_N=320,SHAPE_M=.15,SHAPE_S=1+2*SHAPE_M;   // רשת ה-SDF מכסה את התיבה + שוליים (לקווי אופסט החוצה)

// ── shapeInfo (dobble.html:4682) ──
function shapeInfo(id){
  CARD_SHAPES._c=CARD_SHAPES._c||{};
  let inf=CARD_SHAPES._c[id];if(inf)return inf;
  const N=SHAPE_N,ops=CARD_SHAPES[id].ops();
  const cv=document.createElement('canvas');cv.width=cv.height=N;
  const c=cv.getContext('2d',{willReadFrequently:true});c.fillStyle='#000';c.beginPath();traceShapeOps(c,ops,SHAPE_M/SHAPE_S*N,SHAPE_M/SHAPE_S*N,N/SHAPE_S,N/SHAPE_S);c.fill();
  const a=c.getImageData(0,0,N,N).data,bin=new Uint8Array(N*N);
  for(let i=0;i<N*N;i++)bin[i]=a[i*4+3]>127?1:0;
  const dOut=edt2d(bin,N,1),dIn=edt2d(bin,N,0),sdf=new Float32Array(N*N);   // מחוץ: מרחק לפנים · פנים: מרחק לחוץ
  for(let i=0;i<N*N;i++)sdf[i]=(bin[i]?-(dIn[i]-.5):(dOut[i]-.5))*SHAPE_S/N;          // שלילי = בפנים (יחידות תיבה)
  {   // החלקת ה-SDF (2 מעברי ממוצע) — קווי אופסט (מסגרת/גלישה) בלי מדרגות פיקסל
    const tmp=new Float32Array(N*N),R=2;
    for(let pass=0;pass<2;pass++){
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){let a2=0,c2=0;for(let d=-R;d<=R;d++){const xx=x+d;if(xx>=0&&xx<N){a2+=sdf[y*N+xx];c2++;}}tmp[y*N+x]=a2/c2;}
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){let a2=0,c2=0;for(let d=-R;d<=R;d++){const yy=y+d;if(yy>=0&&yy<N){a2+=tmp[yy*N+x];c2++;}}sdf[y*N+x]=a2/c2;}
    }
  }
  inf={ops,N,sdf,contours:{}};CARD_SHAPES._c[id]=inf;
  shapePolyline(id);
  return inf;
}

// ── shapeSdfAt (dobble.html:4704) ──
function shapeSdfAt(inf,u,v){
  const N=inf.N,gx=(u+SHAPE_M)/SHAPE_S*N-.5,gy=(v+SHAPE_M)/SHAPE_S*N-.5;
  const cx=Math.min(N-1,Math.max(0,gx)),cy=Math.min(N-1,Math.max(0,gy));
  const x0=Math.min(N-2,Math.floor(cx)),y0=Math.min(N-2,Math.floor(cy)),fx=cx-x0,fy=cy-y0,s=inf.sdf;
  const val=(s[y0*N+x0]*(1-fx)+s[y0*N+x0+1]*fx)*(1-fy)+(s[(y0+1)*N+x0]*(1-fx)+s[(y0+1)*N+x0+1]*fx)*fy;
  const ox=(gx-cx)/N*SHAPE_S,oy=(gy-cy)/N*SHAPE_S;
  return (ox||oy)?val+Math.hypot(ox,oy):val;
}

// ── shapeContour (dobble.html:4751) ──
function shapeContour(id,L){
  const inf=shapeInfo(id),key=Math.round(L*20000);
  if(inf.contours[key])return inf.contours[key];
  const best=marchingLoop(inf.sdf,inf.N,L);
  inf.contours[key]=best;
  return best;
}

// ── traceCardShape (dobble.html:4759) ──
function traceCardShape(ctx,id,G,inset){
  const box=2*G.r,x0=G.cx-G.r,y0=G.cy-G.r;
  if(!inset){traceShapeOps(ctx,shapeInfo(id).ops,x0,y0,box,box);return;}
  const c=shapeContour(id,-inset/box);
  for(let i=0;i<c.length;i+=2){if(i===0)ctx.moveTo(x0+c[i]*box,y0+c[i+1]*box);else ctx.lineTo(x0+c[i]*box,y0+c[i+1]*box);}
  ctx.closePath();
}

// ── specialBound (dobble.html:4792) ──
function specialBound(){
  if(!CARD_SHAPES[S.shape])return null;
  const G=cardGeom(500),inf=shapeInfo(S.shape),key=[S.shape,S.cardSizeMm,S.frame.w,S.symPad].join('|');
  const c=inf.__b;if(c&&c.key===key)return c;
  const b={fld:true,key,info:inf,k:G.rSym/(2*G.r),pad:(G.r-G.rSym)/G.rSym};
  inf.__b=b;return b;
}

// ── _UCS (dobble.html:4799) ──
const _UCS={};

// ── unitCS (dobble.html:4800) ──
function unitCS(n){let t=_UCS[n];if(!t){t=new Float32Array(2*n);for(let i=0;i<n;i++){const a=i*Math.PI*2/n;t[2*i]=Math.cos(a);t[2*i+1]=Math.sin(a);}_UCS[n]=t;}return t;}

// ── fldOver (dobble.html:4801) ──
function fldOver(B,x,y){return shapeSdfAt(B.info,.5+x*B.k,.5+y*B.k)/B.k+B.pad;}

// ── fldPull (dobble.html:4802) ──
function fldPull(B,x,y,o){   // מזיז נקודה פנימה לאורך הגרדיאנט של השדה בגובה החריגה
  const e=.012,gx=fldOver(B,x+e,y)-fldOver(B,x-e,y),gy=fldOver(B,x,y+e)-fldOver(B,x,y-e),gl=Math.hypot(gx,gy)||1;
  return{x:x-gx/gl*o,y:y-gy/gl*o};
}

// ── shapeInitPos (dobble.html:4807) ──
function shapeInitPos(n,B){
  const key='init'+n;if(B[key])return B[key].map(p=>({x:p.x,y:p.y,hs:p.hs}));
  const H=.5/B.k,st=H*2/56,C=[];
  for(let j=0;j<56;j++)for(let i=0;i<56;i++){const x=-H+(i+.5)*st,y=-H+(j+.5)*st;if(fldOver(B,x,y)<-.02)C.push([x,y]);}
  const area=C.length*st*st,hs=Math.sqrt(area/n/Math.PI)*.8;
  if(!C.length)return Array.from({length:n},()=>({x:0,y:0,hs:.2}));
  const C2=C.filter(p=>fldOver(B,p[0],p[1])<-hs*.55);   // מרכזים רק איפה שיש מקום לסמל בגודל סביר (לא בגזע/ברגל הצרים)
  if(C2.length>=n*8){C.length=0;for(const q of C2)C.push(q);}
  let cen=[];for(let i=0;i<n;i++)cen.push(C[Math.min(C.length-1,Math.floor((i+.5)*C.length/n))].slice());
  for(let it=0;it<14;it++){
    const sx=new Float64Array(n),sy=new Float64Array(n),cnt=new Float64Array(n);
    for(const p of C){let b=0,bd=1e9;for(let i=0;i<n;i++){const d=(p[0]-cen[i][0])**2+(p[1]-cen[i][1])**2;if(d<bd){bd=d;b=i;}}sx[b]+=p[0];sy[b]+=p[1];cnt[b]++;}
    for(let i=0;i<n;i++)if(cnt[i]){
      let x=sx[i]/cnt[i],y=sy[i]/cnt[i];
      if(fldOver(B,x,y)>-.02){let bd=1e9,bp=null;for(const p of C){const d=(p[0]-x)**2+(p[1]-y)**2;if(d<bd){bd=d;bp=p;}}x=bp[0];y=bp[1];}
      cen[i]=[x,y];
    }
  }
  const pos=cen.map(c=>({x:c[0],y:c[1],hs}));B[key]=pos;
  return pos.map(p=>({x:p.x,y:p.y,hs:p.hs}));
}

// ── packSpecial (dobble.html:4831) ──
function packSpecial(pos,layout,imgs,B){
  const n=pos.length,metas=layout.syms.map(si=>(imgs[si]&&imgs[si].__symMeta)||CIRCLE_META),rots=layout.tr.map(t=>t.ro),scs=layout.tr.map(t=>t.sc);
  const kT=contactFactor(),h0=pos[0].hs,auto=S.sizeMode==='auto',tol=.004;
  function run(F,X0,Y0){
    const X=X0.slice(),Y=Y0.slice(),half=scs.map(c=>h0*c*F);
    for(let it=0;it<44;it++){
      let moved=0;
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
        let dx=X[j]-X[i],dy=Y[j]-Y[i],d=Math.hypot(dx,dy),ang;
        if(d<1e-6){ang=i*2.4;dx=Math.cos(ang);dy=Math.sin(ang);d=.01;}else ang=Math.atan2(dy,dx);
        const need=(reachAt(metas[i],rots[i],ang+Math.PI,half[i])+reachAt(metas[j],rots[j],ang,half[j]))*kT;
        if(d<need){const push=(need-d)/2*.6,ux=dx/d,uy=dy/d;X[i]-=ux*push;Y[i]-=uy*push;X[j]+=ux*push;Y[j]+=uy*push;if(push>1e-4)moved++;}
      }
      for(let i=0;i<n;i++){
        const o=symOverSq(metas[i],rots[i],half[i],X[i],Y[i],B,1);
        if(o>0){const q=fldPull(B,X[i],Y[i],Math.max(o*.7,.004));X[i]=q.x;Y[i]=q.y;moved++;}
      }
      if(!moved)break;
    }
    let v=0;
    for(let i=0;i<n;i++){
      const o=symOverSq(metas[i],rots[i],half[i],X[i],Y[i],B,1);if(o>v)v=o;
      for(let j=i+1;j<n;j++){
        const dx=X[j]-X[i],dy=Y[j]-Y[i],d=Math.hypot(dx,dy)||1e-4,ang=Math.atan2(dy,dx);
        const need=(reachAt(metas[i],rots[i],ang+Math.PI,half[i])+reachAt(metas[j],rots[j],ang,half[j]))*kT;
        if(need-d>v)v=need-d;
      }
    }
    return{ok:v<=tol,X,Y};
  }
  let X=pos.map(p=>p.x),Y=pos.map(p=>p.y),lo=.08,hi=auto?3:1,best=null;
  const r1=run(hi,X,Y);
  if(r1.ok)best={F:hi,X:r1.X,Y:r1.Y};
  else{
    let base=run(lo,X,Y);   // גם F קטן מאוד מתחיל מנקודה חוקית, אחרת נשארים עם הפריסה המרוכזת
    best={F:lo,X:base.X,Y:base.Y};
    for(let s2=0;s2<9;s2++){
      const mid=(lo+hi)/2,r=run(mid,best.X,best.Y);
      if(r.ok){lo=mid;best={F:mid,X:r.X,Y:r.Y};}else hi=mid;
    }
  }
  for(let i=0;i<n;i++){pos[i].x=best.X[i];pos[i].y=best.Y[i];pos[i].hs=h0*best.F;}
}

// ── relaxSymbolPositions (dobble.html:4341) ──
function relaxSymbolPositions(pos,layout,imgs,cx,cy,rSym){
  const n=pos.length;
  if(!n)return;
  const metas=layout.syms.map(si=>{const img=imgs[si];return (img&&img.__symMeta)||CIRCLE_META;});
  const rots=layout.tr.map(t=>t.ro);
  const halves=pos.map((p,i)=>p.hs*layout.tr[i].sc);   // משתנה רק בגודל האוטומטי (D-60), במקום
  const origX=pos.map(p=>p.x),origY=pos.map(p=>p.y);
  const kT=contactFactor();          // יעד המגע האמיתי — לעולם לא יורד, גם כשההרפיה מתפשרת
  const tol=rSym*0.015;
  const SQ=(rSym===1&&cx===0&&cy===0)?symBoundNorm():null;   // D-87: בריבוע הגבול הוא ריבוע מעוגל, לא רדיוס
  // סמל "דגום" = בדיקת גבול מול כל פרופיל הצורה: תמיד בריבוע, ובעיגול רק לסמל עם שקיפות. עיגול אטום = הנוסחה הישנה (פלט זהה לפיקסל)
  const smp=i=>!!SQ||metas[i].hasAlpha;
  const ovr=(i,x,y,h)=>symOverSq(metas[i],rots[i],h,x-cx,y-cy,SQ,rSym);

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
      const over=smp(i)?ovr(i,P[i].x,P[i].y,halves[i]):dist+reachAt(metas[i],rots[i],angOut,halves[i])-rSym;
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
        if(SQ&&SQ.fld){const o=ovr(i,P[i].x,P[i].y,halves[i]);if(o>0){const q=fldPull(SQ,P[i].x,P[i].y,o*.9);P[i].x=q.x;P[i].y=q.y;moved++;}continue;}   // D-95: צורה לא קמורה — מושכים לאורך הגרדיאנט, לא למרכז
        if(dist<1e-6)continue;
        if(smp(i)){   // מושכים לכיוון המרכז בגובה החריגה
          const o=ovr(i,P[i].x,P[i].y,halves[i]);
          if(o>0){const m=Math.min(o,dist);P[i].x-=dx/dist*m;P[i].y-=dy/dist*m;moved++;}
          continue;
        }
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

  // D-95: בצורה לא קמורה ההרפיה יכולה להשאיר מרכז סמל מחוץ לצורה — אז כל ההקטנות הבאות היו מכווצות אותו לאפס. מחזירים כל מרכז פנימה (לאורך הגרדיאנט) לפני הכול.
  if(SQ&&SQ.fld){
    for(const q of best){
      for(let k=0;k<80;k++){const o=fldOver(SQ,q.x-cx,q.y-cy);if(o<-0.03)break;const w=fldPull(SQ,q.x-cx,q.y-cy,o+0.06);q.x=cx+w.x;q.y=cy+w.y;}
    }
  }

  // D-87: גבול קשיח בסוף — אם אחרי הכול סמל עדיין חורג (למשל כשהכיווץ הגלובלי נעצר בתקרת 0.20), מקטינים אותו עד שאין חריגה.
  // בריבוע ובעיגול עם סמלים חתוכים בלבד: עיגול אטום כבר מובטח, ושם הפלט חייב להישאר זהה לפיקסל.
  const needHard=!!SQ||metas.some(m=>m.hasAlpha);   // (עיגול אטום מובטח כבר, ושם הפלט חייב להישאר זהה)
  function hardBound(){
    if(!needHard)return;
    for(let i=0;i<n;i++){
      const half=pos[i].hs*layout.tr[i].sc;if(!(half>1e-9))continue;
      let gi;
      if(smp(i))gi=symGmaxSq(metas[i],rots[i],half,pos[i].x-cx,pos[i].y-cy,SQ,1,rSym);
      else{
        const dx=pos[i].x-cx,dy=pos[i].y-cy,dist=Math.hypot(dx,dy),ang=dist<1e-6?0:Math.atan2(dy,dx);
        const reach=reachAt(metas[i],rots[i],ang,half);
        gi=reach>1e-9&&dist+reach>rSym?Math.max(0,(rSym-dist)/reach):1;
      }
      if(gi<1)pos[i].hs*=Math.max(gi,0.02);
    }
  }

  // ── סגירה אנליטית: הערובה ל-0% חפיפה ו-0 חריגה, בצעד יחיד ──
  // need_ij ו-reach_i לינאריים במקדם g, ולכן
  //   g = min( d_ij / need_ij ,  (rSym − dist_i) / reach_i )
  // הוא בדיוק המקדם הגדול ביותר שעדיין חוקי. O(n²), בלי איטרציות, בלי סיכון לקיפאון.
  function exactShrink(P){
    let g=1;
    for(let i=0;i<n;i++){
      if(smp(i)){g=Math.min(g,symGmaxSq(metas[i],rots[i],halves[i],P[i].x-cx,P[i].y-cy,SQ,1,rSym));continue;}
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
        if(smp(i)){gg=Math.min(gg,symGmaxSq(metas[i],rots[i],halves[i],P[i].x-cx,P[i].y-cy,SQ,AUTO_GMAX,rSym));continue;}
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
    hardBound();
    return;
  }

  // "מילוי מיטבי": רק כשאין שום הפרה (g===1) וכשאין מרווח שלילי — הגדלה עד הגבול החוקי.
  if(g>=1&&S.tightFill&&(S.overlap||0)>=0){
    const fits=q=>{
      for(let i=0;i<n;i++){
        if(smp(i)){if(ovr(i,best[i].x,best[i].y,halves[i]*q)>0.001*rSym)return false;continue;}
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
  hardBound();
}

// ── AUTO_GMAX (dobble.html:4552) ──
const AUTO_GMAX=4,AUTO_STEPS=7;   // ראו "גודל אוטומטי" ב-relaxSymbolPositions. 7 צעדים = דיוק ~1% ב-F

// ── cardGeom (dobble.html:4920) ──
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

// ── packSignature (dobble.html:4936) ──
function packSignature(n){
  // D-87: בריבוע הגבול תלוי במידת הקלף, במסגרת ובמרחק מהשפה (ביחידות rSym) — לכן הם חלק מהחתימה. בעיגול החתימה זהה למה שהיה.
  const sqSig=(S.shape==='square'||CARD_SHAPES[S.shape])?'sq:'+[S.shape,S.cardSizeMm,S.frame.w,S.symPad].join(','):'';
  return [n,S.layoutMode,S.overlap,S.tightPack?1:0,S.tightFill?1:0,S.metaVer||0,S.sizeMode||'',S.sizeMode==='auto'?S.sizeK:'',sqSig,S.symShape==='square'?'ss':''].join('|');
}

// ── packNormalized (dobble.html:4941) ──
function packNormalized(layout,imgs){
  const n=layout.syms.length;
  if(!n)return[];
  const sig=packSignature(n)+'|'+layout.tr.map(t=>t.sc.toFixed(4)+','+t.ro.toFixed(4)).join(';');
  const c=layout.__pack;
  if(c&&c.sig===sig)return c.pos;
  const SPB=CARD_SHAPES[S.shape]?specialBound():null;   // D-95
  const pos=SPB?shapeInitPos(n,SPB):symPos(n,0,0,1);
  // D-87: בריבוע נקודות הפתיחה מורחקות מעט מהמרכז — יש מקום בפינות (הפריסה הבסיסית מתוכננת לעיגול). ההרפיה מחזירה פנימה מה שחורג
  if(S.shape==='square')for(const q of pos){q.x*=1.12;q.y*=1.12;}
  if(SPB)packSpecial(pos,layout,imgs,SPB);
  else if(S.tightPack)relaxSymbolPositions(pos,layout,imgs,0,0,1);
  else if(S.sizeMode==='auto'){
    relaxSymbolPositions(pos,layout,[],0,0,1);   // גודל אוטומטי בלי "לפי צורה" = מילוי לפי עיגולים (המרווח בין סמלים)
    // D-87: אבל גבול הקלף נאכף לפי הצורה האמיתית של כל סמל חתוך / לפי ריבוע. עיגול אטום — בלי נגיעה (פלט זהה לפיקסל)
    if(S.shape==='square'||layout.syms.some(si=>imgs[si]&&imgs[si].__symMeta&&imgs[si].__symMeta.hasAlpha))clampInsideCard(pos,layout,1,imgs);
  }
  else clampInsideCard(pos,layout,1,imgs);
  exactSeparate(pos,layout,imgs);   // D-93
  layout.__pack={sig,pos};
  return pos;
}

// ── clampInsideCard (dobble.html:4965) ──
function clampInsideCard(pos,layout,rSym,imgs){
  let g=1,smpUsed=false;
  const SQ=(rSym===1)?symBoundNorm():null;   // D-87: ריבוע מעוגל במקום רדיוס; ובעיגול — סמל עם שקיפות נבדק מול כל הפרופיל שלו
  for(let i=0;i<pos.length;i++){
    const half=pos[i].hs*layout.tr[i].sc;
    if(half<=1e-9)continue;
    const mt=(imgs&&imgs[layout.syms[i]]&&imgs[layout.syms[i]].__symMeta)||CIRCLE_META;
    if(SQ||mt.hasAlpha){smpUsed=true;g=Math.min(g,symGmaxSq(mt,layout.tr[i].ro,half,pos[i].x,pos[i].y,SQ,1,rSym));continue;}
    const d=Math.hypot(pos[i].x,pos[i].y);
    if(d+half>rSym)g=Math.min(g,Math.max(0,(rSym-d)/half));
  }
  if(g<1){g=smpUsed?Math.max(g,0.02):Math.max(g,0.20);for(const p of pos)p.hs*=g;}
}

// ── computeCardPositions (dobble.html:4980) ──
function computeCardPositions(layout,imgs,sz){
  const G=cardGeom(sz);
  const npos=packNormalized(layout,imgs);
  const pos=npos.map(p=>({x:G.cx+p.x*G.rSym,y:G.cy+p.y*G.rSym,hs:p.hs*G.rSym}));
  applyCardEdits(pos,layout,G);
  return{pos,G};
}

// ── applyCardEdits (dobble.html:4990) ──
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

// ── rrect (dobble.html:5029) ──
function rrect(ctx,x,y,w,h,cr){
  ctx.moveTo(x+cr,y);ctx.lineTo(x+w-cr,y);ctx.arcTo(x+w,y,x+w,y+cr,cr);
  ctx.lineTo(x+w,y+h-cr);ctx.arcTo(x+w,y+h,x+w-cr,y+h,cr);
  ctx.lineTo(x+cr,y+h);ctx.arcTo(x,y+h,x,y+h-cr,cr);
  ctx.lineTo(x,y+cr);ctx.arcTo(x,y,x+cr,y,cr);ctx.closePath();
}

// ── drawCard (dobble.html:5036) ──
function drawCard(canvas,layout,imgs,shape,hitIdx,opts){
  hitIdx=hitIdx==null?-1:hitIdx;
  const ctx=canvas.getContext('2d'),sz=canvas.width;
  const G=cardGeom(sz);
  const cx=G.cx,cy=G.cy,r=G.r,sq=G.sq,sqx=G.sqx,sqy=G.sqy,sqcr=G.sqcr;
  ctx.clearRect(0,0,sz,sz);
  const isC=shape==='circle',SP=CARD_SHAPES[shape]?shape:null;   // D-95: צורה מיוחדת

  // Background (configurable color + opacity)
  ctx.save();ctx.beginPath();
  if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else if(SP)traceCardShape(ctx,SP,G,0);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
  ctx.clip();ctx.globalAlpha=S.bg.op/100;ctx.fillStyle=S.bg.color;
  ctx.fillRect(0,0,sz,sz);ctx.globalAlpha=1;ctx.restore();

  // Frame (configurable width, color, opacity)
  const ppMm=G.ppMm,fw=G.fw;
  if(fw>0.5&&S.frame.op>0){
    ctx.save();ctx.beginPath();
    if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else if(SP)traceCardShape(ctx,SP,G,0);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
    ctx.clip();ctx.beginPath();
    if(isC)ctx.arc(cx,cy,r-fw/2,0,Math.PI*2);
    else if(SP){traceCardShape(ctx,SP,G,0);ctx.lineJoin='round';}
    else rrect(ctx,sqx+fw/2,sqy+fw/2,sq-fw,sq-fw,sqcr);
    ctx.strokeStyle=S.frame.color;ctx.globalAlpha=S.frame.op/100;
    ctx.lineWidth=SP?fw*2:fw;ctx.stroke();ctx.globalAlpha=1;ctx.restore();
  }else if(!(opts&&opts.noOutline)){   // D-85: בקובץ חיתוך צורני קו המתאר הדק היה נצרב בתמונה ונראה על המגנט
    ctx.beginPath();
    if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else if(SP)traceCardShape(ctx,SP,G,0);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
    ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1.5;ctx.stroke();
  }

  if(SP&&S.shapeArt&&S.shapeArt.on&&!(opts&&opts.noArt)){   // D-95B: ציור חלש מאחורי הסמלים (מנהל)
    const lt=S.shapeArt.letter==='auto'?DREIDEL_LETTERS[(layout.ci||0)%4]:S.shapeArt.letter;
    drawShapeArt(ctx,SP,G,S.shapeArt.color||'#1E3A8A',(S.shapeArt.op||12)/100,lt);
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
  if(needsWatermark())drawWatermark(ctx,cx,cy,r,isC,sq,sqx,sqy,sqcr,sz,SP);
}

// ── drawWatermark (dobble.html:5094) ──
function drawWatermark(ctx,cx,cy,r,isC,sq,sqx,sqy,sqcr,sz,SP){
  ctx.save();
  ctx.beginPath();
  if(isC)ctx.arc(cx,cy,r,0,Math.PI*2);else if(SP)traceCardShape(ctx,SP,{cx,cy,r},0);else rrect(ctx,sqx,sqy,sq,sq,sqcr);
  ctx.clip();
  ctx.globalAlpha=.16;
  ctx.fillStyle='#1e1b4b';
  ctx.font=`900 ${Math.round(sz*.1)}px system-ui,-apple-system,"Segoe UI",Arial`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.translate(cx,cy);ctx.rotate(-Math.PI/6);
  for(let y=-sz;y<=sz;y+=sz*.24)ctx.fillText('תצוגה מקדימה',0,y);
  ctx.restore();
}

// ── imgNatW (dobble.html:10157) ──
function imgNatW(el){return el.naturalWidth||el.width;}

// ── imgNatH (dobble.html:10158) ──
function imgNatH(el){return el.naturalHeight||el.height;}

// ── drawCover (dobble.html:10161) ──
function drawCover(ctx,img,dx,dy,dSize){
  const iw=imgNatW(img),ih=imgNatH(img);
  const s=Math.max(dSize/iw,dSize/ih);
  const sw=dSize/s,sh=dSize/s;
  const sx=(iw-sw)/2,sy=(ih-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dSize,dSize);
}

// ── symbolShapeMeta (dobble.html:10210) ──
function symbolShapeMeta(cv){
  if(cv.__symMeta)return cv.__symMeta;
  // D-87: שני פרופילים. radial (64 זוויות, דגימה 64px) — מרחקי מגע בין סמלים, כמו תמיד (אבל שיא-שכנים במקום ממוצע, וללא תקרה 1).
  // fine (128 זוויות, דגימה 128px) — בדיקת הגבול מול הקלף: הערכה תמיד קצת גדולה, כדי שאף פיקסל אטום לא ייצא.
  const N=128,bins=64,fb=128;
  let data;
  try{
    const tmp=document.createElement('canvas');tmp.width=tmp.height=N;
    const tctx=tmp.getContext('2d');
    tctx.drawImage(cv,0,0,N,N);       // כמו ב-drawCard: סמל חתוך מצויר מתוח לריבוע ds×ds, לכן גם המדידה על ריבוע
    data=tctx.getImageData(0,0,N,N).data;
  }catch(e){
    const meta={hasAlpha:false,radial:CIRCLE_RADIAL()};
    cv.__symMeta=meta;return meta;
  }
  let hasAlpha=false;
  for(let i=3;i<data.length;i+=4){if(data[i]<250){hasAlpha=true;break;}}
  let radial,fine=null;
  if(!hasAlpha){
    radial=CIRCLE_RADIAL();
  }else{
    const raw=new Float32Array(bins),rawF=new Float32Array(fb);
    const cx=N/2,cy=N/2,half=N/2;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const idx=(y*N+x)*4;
      if(data[idx+3]<=10)continue;
      const ddx=x+0.5-cx,ddy=y+0.5-cy;
      const dist=Math.hypot(ddx,ddy)/half;
      let ang=Math.atan2(ddy,ddx);if(ang<0)ang+=Math.PI*2;
      const bin=Math.round(ang/(Math.PI*2)*bins)%bins;
      if(dist>raw[bin])raw[bin]=dist;
      const bf=Math.round(ang/(Math.PI*2)*fb)%fb;
      if(dist>rawF[bf])rawF[bf]=dist;
    }
    // (1) בלי תקרה של 1 — פינות של צורה חתוכה מגיעות עד √2; (2) החלקה לפי המקסימום של השכנים, לא ממוצע — שיא חד (אוזן, כנף)
    // לא נעלם; (3) מרווח: חצי פיקסל של הדגימה (נמדד מרכז הפיקסל, לא הקצה) + שגיאת כימות הזווית. ההערכה תמיד קצת גדולה.
    radial=new Float32Array(bins);
    for(let i=0;i<bins;i++){
      const m=Math.max(raw[(i-1+bins)%bins],raw[i],raw[(i+1)%bins]);
      radial[i]=m>0?Math.min(1.5,Math.max(m+0.03,0.15)):0.15;
    }
    fine=new Float32Array(fb);
    for(let i=0;i<fb;i++){
      const m=Math.max(rawF[(i-1+fb)%fb],rawF[i],rawF[(i+1)%fb]);
      fine[i]=m>0?Math.min(1.5,Math.max(m+0.04,0.15)):0.15;
    }
  }
  const meta={hasAlpha,radial,fine};
  if(hasAlpha){   // D-93: מסכה 64×64 (OR על בלוקים 2×2 של הדגימה) למרחק אמיתי בין סמלים חתוכים
    const m64=new Uint8Array(64*64);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      if(data[((2*y)*N+2*x)*4+3]>10||data[((2*y)*N+2*x+1)*4+3]>10||data[((2*y+1)*N+2*x)*4+3]>10||data[((2*y+1)*N+2*x+1)*4+3]>10)m64[y*64+x]=1;
    }
    meta.m64=m64;
  }
  cv.__symMeta=meta;
  return meta;
}

// ── prepareSymbolMeta (dobble.html:10271) ──
function prepareSymbolMeta(){
  S.metaVer=(S.metaVer||0)+1;   // מבטל את ה-cache של הפריסה כשמטא-הצורה של הסמלים השתנה
  S.imgEls.forEach(img=>{if(img)symbolShapeMeta(img);});
}

// ── isSymbolAsset (dobble.html:5782) ──
function isSymbolAsset(a){return !a.isCropSource&&a.type!=='backlogo';}

// ── isFaceSym (dobble.html:6463) ──
function isFaceSym(a){return !!(a&&a.type==='crop'&&a.af&&!a.af.kind);}

// ── SH_LIM (dobble.html:6464) ──
var SH_LIM=24;   // ⛔ תקרת שינוי לפיקסל (רמות בהירות) — בלי הילות סביב קצוות; הבדיקה דורשת ≤25

// ── shStrength (dobble.html:6467) ──
function shStrength(a){
  const src=S.assets.find(x=>x.id===a.srcAssetId);
  const side=src&&src.imgEl&&a.af&&a.af.s?a.af.s*imgNatW(src.imgEl):0;
  const u=side>0?IMG_PX/side:2;
  return {amt:Math.max(.35,Math.min(1.3,.35+.25*(u-1))),rad:u<1.6?1:(u<3?2:3)};
}

// ── sharpenCanvas (dobble.html:6475) ──
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

// ── symImg (dobble.html:6499) ──
function symImg(a){
  if(!(a&&a.af&&a.af.sh&&isFaceSym(a)))return a.imgEl;
  const c=a._sh;
  if(c&&c.src===a.imgEl)return c.cv;
  const cv=sharpenCanvas(a.imgEl,shStrength(a));
  a._sh={src:a.imgEl,cv};
  return cv;
}
