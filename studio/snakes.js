// ── S-98: סולמות וחבלים בסטודיו — אותו קוד כמו אב-הטיפוס (claude.ai/artifact/463n1Ck1yE2XgP7jC1td5w), עטוף לסטודיו ──
// המחולל רץ בתוך #sn-app בפאנל; הלוח מצויר כ-SVG ומומר לתמונה אחת (3000px, עם התמונות והפונטים מוטמעים) לתצוגה ול-PDF.
// נכסים: studio/snakes/{heads,ladders,bg,vintage,fluent} — ראשי נחש, סולמות, רקעים ואייקוני וינטג׳ מ-ChatGPT; Fluent Emoji 3D (MIT) של מיקרוסופט.
// מנוע סולמות וחבלים — משותף לבדיקה ב-node ולעמוד. בלי תלות ב-DOM.
(function(root){
const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
let N=10; // צלע הלוח: 6, 8 או 10 (36/64/100 משבצות)
function setSize(n){N=[6,8,10].includes(n)?n:10;}
function rc(n){const i=n-1,r=Math.floor(i/N),c=i%N;return{c:r%2?c:N-1-c,r:r};} // r=0 שורה תחתונה
function num(row,c){return row*N+(row%2?c+1:N-c);}
const LAST=()=>N*N;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=ri(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
// התאים שקטע בין שני מרכזי משבצות עובר דרכם (כולל שוליים קטנים)
function cellsOf(a,b){const A=rc(a),B=rc(b),s=new Set(),n=40;
  for(let i=0;i<=n;i++){const x=A.c+(B.c-A.c)*i/n,y=A.r+(B.r-A.r)*i/n;
    for(const[dx,dy]of[[0,0],[.35,0],[-.35,0],[0,.35],[0,-.35]]){const c=Math.round(x+dx),r=Math.round(y+dy);if(c>=0&&c<N&&r>=0&&r<N)s.add(r*N+c);}}
  return s;}
const RANGES={short:[1,2],medium:[2,4],long:[5,8],mixed:[1,8]};
// cfg: {nL,nR,lenL,lenR,nQ,nT,qF,qB,tF,mid}
function generate(cfg){
  let best=null;
  for(let attempt=0;attempt<60;attempt++){const r=tryOnce(cfg);if(r.complete)return r;if(!best||r.placed>best.placed)best=r;}
  return best;}
function tryOnce(cfg){
  const L={},R={},Q={},T={},used=new Set([1,LAST()]),busy=new Set(),links=[];let placed=0;const M=N,m0=Math.round(M*.3),m1=Math.round(M*.7)-1,cap=r=>Math.min(r,M-2);
  const blocked=new Set();if(cfg.mid)for(let r=m0;r<=m1;r++)for(let c=m0;c<=m1;c++)blocked.add(r*M+c);
  (cfg.keep||[]).forEach(k=>blocked.add(k)); // תאים שהלקוח סימן (פנים בתמונה) — לא עוברים בהם
  blocked.forEach(c=>busy.add(c));
  // אזורים 3×3 — כל קישור מקבל אזור, בסבב מעורבב, כדי שהפיזור יהיה אחיד
  const zones=shuffle([0,1,2,3,4,5,6,7,8].filter(z=>!(cfg.mid&&z===4)));
  const jobs=[];for(let i=0;i<cfg.nL;i++)jobs.push({up:true,len:cap(ri(...(RANGES[cfg.lenL]||cfg.lenL)))});for(let i=0;i<cfg.nR;i++)jobs.push({up:false,len:cap(ri(...(RANGES[cfg.lenR]||cfg.lenR)))});
  shuffle(jobs).sort((a,b)=>b.len-a.len); // ארוכים קודם — להם הכי קשה למצוא מקום
  jobs.forEach((j,i)=>{j.zone=zones[i%zones.length];});
  for(const j of jobs){let ok=false;
    for(let k=0;k<400&&!ok;k++){const dr=Math.max(1,j.len-(k>250?ri(0,2):0));
      const zc=j.zone%3,zr=Math.floor(j.zone/3),zs=M/3;let c0,r0;
      if(k<150){c0=Math.min(M-1,Math.floor(zc*zs+Math.random()*zs));r0=Math.min(M-1,Math.floor(zr*zs+Math.random()*zs));}else{c0=ri(0,M-1);r0=ri(0,M-1);}
      const r1=j.up?r0+dr:r0-dr;if(r1<0||r1>M-1)continue;
      const maxTilt=Math.min(3,dr),tilt=Math.random()<.35?0:ri(1,maxTilt)*(Math.random()<.5?-1:1),c1=c0+tilt;if(c1<0||c1>M-1)continue;
      const a=num(r0,c0),b=num(r1,c1);if(a>=LAST()||b>=LAST()||a<2||b<1||used.has(a)||used.has(b)||blocked.has(r0*M+c0)||blocked.has(r1*M+c1))continue;
      const cells=cellsOf(a,b);let clash=false;for(const c of cells)if(blocked.has(c)){clash=true;break;}if(clash)continue; // הושעיה 28/10: מותר להצטלב — רק לא אותה משבצת התחלה/סוף, ולא דרך תמונה/פנים
      for(const c of cells)busy.add(c);used.add(a);used.add(b);links.push({a,b,up:j.up});(j.up?L:R)[a]=b;ok=true;placed++;}}
  // משבצות מיוחדות (שאלה, משימה, ומשבצות משלכם): לא על סולם/חבל, לא בתא שקישור עובר בו, ולא כשהיעד שלהן הוא ראש חבל
  const S={},okT=n=>n>=1&&n<=LAST()&&!R[n];
  const place=(cnt,key,fw,bk)=>{let z=[];while(z.length<cnt)z=z.concat(shuffle([...Array(M).keys()]));
    for(let i=0;i<cnt;i++){let k=0,n;do{n=z[i]*M+ri(1,M);const p=rc(n);k++;
      if(n>=2&&n<LAST()&&!used.has(n)&&!busy.has(p.r*M+p.c)&&(!fw||okT(n+fw))&&(!bk||okT(n-bk))&&n+(fw||0)<LAST())break;}while(k<300);
      if(k<300){S[n]=key;used.add(n);const p=rc(n);busy.add(p.r*M+p.c);}}};
  const specials=cfg.specials||[{key:'q',count:cfg.nQ||0,fw:cfg.qF||3,bk:cfg.qB||0},{key:'t',count:cfg.nT||0,fw:cfg.tF||2,bk:0}];
  for(const sp of specials)place(sp.count||0,sp.key,sp.fw||0,sp.bk||0);
  for(const n in S){if(S[n]==='q')Q[n]=1;else if(S[n]==='t')T[n]=1;}
  return{L,R,Q,T,S,links,placed,complete:placed===jobs.length};}
// ── סטטיסטיקה ──
const DICE={one:[[1,1/6],[2,1/6],[3,1/6],[4,1/6],[5,1/6],[6,1/6]],two:[2,3,4,5,6,7,8,9,10,11,12].map(s=>[s,(6-Math.abs(s-7))/36])};
// rules: {dice:'one'|'two', end:'over'|'exact'|'bounce', qF,qB,tF, players}
function stats(b,rules){const D=DICE[rules.dice||'one'],end=rules.end||'over',land=m=>b.L[m]||b.R[m]||m,qF=rules.qF||3,qB=rules.qB||0,tF=rules.tF||2;
  const SP=Object.assign({q:{type:'ask',n:qF,back:qB},t:{type:'task',n:tF}},rules.specials||{}),S=b.S||{};
  const E=LAST(),T=[],W=[];for(let n=0;n<E;n++){const o={},w={};for(const[s,p]of D){let m=n+s;if(m>E)m=end==='over'?E:end==='exact'?n:2*E-m;const x=land(m);
    let outs=[[x,1]];const sp=x<E&&S[x]?SP[S[x]]:null;
    if(sp){const fw=k=>land(Math.min(E,x+k)),bk=k=>land(Math.max(1,x-k));
      if(sp.type==='ask')outs=[[fw(sp.n||0),.5],[bk(sp.back||0),.5]];
      else if(sp.type==='task')outs=[[fw(sp.n||0),.8],[x,.2]];
      else if(sp.type==='fwd')outs=[[fw(sp.n||0),1]];
      else if(sp.type==='back')outs=[[bk(sp.n||0),1]];
      else if(sp.type==='extra')outs=D.map(([s2,p2])=>[land(Math.min(E,x+s2)),p2]); // עוד תור: מטילים שוב באותו תור
      else if(sp.type==='skip'){w[x]=(w[x]||0)+p;continue;} // מפסידים תור: המסה מחכה תור אחד ואז ממשיכה
      }
    for(const[y,q]of outs)o[y]=(o[y]||0)+p*q;}T[n]=o;W[n]=w;}
  let dist=new Array(E+1).fill(0),wait=new Array(E+1).fill(0);dist[0]=1;const cdf=[0];let done=0;
  for(let t=1;t<=700&&done<.995;t++){const nd=new Array(E+1).fill(0),nw=new Array(E+1).fill(0);for(let n=0;n<E;n++)if(dist[n]){for(const y in T[n])nd[y]+=dist[n]*T[n][y];for(const y in W[n])nw[y]+=dist[n]*W[n][y];}
    for(let n=0;n<=E;n++)nd[n]+=wait[n];done+=nd[E];cdf[t]=done;nd[E]=0;dist=nd;wait=nw;}
  const P=rules.players||2;let mean=0,p10=0,p50=0,p90=0,prev=0;
  for(let t=1;t<cdf.length;t++){const F=1-Math.pow(1-cdf[t],P);mean+=t*(F-prev);if(!p10&&F>=.1)p10=t;if(!p50&&F>=.5)p50=t;if(!p90&&F>=.9)p90=t;prev=F;}
  if(done<.5)return{stuck:true,mean:999,p10:999,p50:999,p90:999,minutes:999,spread:999};
  const minutes=Math.round(mean*P*20/60);
  return{mean:Math.round(mean),p10,p50,p90,minutes,spread:p90-p10};}
// לוח מהיר לחיפוש פרמטרים בלבד (בלי בדיקת חפיפות) — זול פי 50
function quickBoard(cfg){const L={},R={},Q={},T={},E=LAST(),used=new Set([1,E]);const rg=k=>RANGES[k]||k,cap=r=>Math.min(r,N-2);
  const mk=(cnt,[lo,hi],up,obj)=>{for(let i=0;i<cnt;i++){for(let k=0;k<200;k++){const dr=cap(ri(lo,hi)),r0=up?ri(0,N-1-dr):ri(dr,N-1),c0=ri(0,N-1),r1=up?r0+dr:r0-dr,c1=Math.max(0,Math.min(N-1,c0+ri(-2,2)));
    const a=num(r0,c0),b=num(r1,c1);if(a<2||a>=E||b>=E||used.has(a)||used.has(b))continue;obj[a]=b;used.add(a);used.add(b);break;}}};
  mk(cfg.nL,rg(cfg.lenL),true,L);mk(cfg.nR,rg(cfg.lenR),false,R);
  const okT=n=>n>=1&&n<=E&&!R[n];const pl=(cnt,obj,fw,bk)=>{for(let i=0;i<cnt;i++)for(let k=0;k<200;k++){const n=ri(2,E-1);if(!used.has(n)&&okT(n+fw)&&(!bk||okT(n-bk))&&n+fw<E){obj[n]=1;used.add(n);break;}}};
  pl(cfg.nQ||0,Q,cfg.qF||3,cfg.qB||0);pl(cfg.nT||0,T,cfg.tF||2,0);return{L,R,Q,T};}
root.SL={generate,quickBoard,stats,rc,num,RANGES,setSize,get N(){return N;}};
})(typeof module!=='undefined'?module.exports:window);

(function(){
const SN_CSS="#sn-app{--bg:#f7f4ec;--paper:#fff;--ink:#14294D;--ink2:#4b5872;--mute:#8d93a3;--line:#dcd6c6;--gold:#C6A135;--gold2:#a07d1c;--blue:#185FA5;--disp:'Secular One',system-ui,sans-serif;--body:'Heebo',system-ui,sans-serif;color:var(--ink);font-family:var(--body);direction:rtl;line-height:1.5}\n#sn-app /* פריסה: מסך פתיחה עם לוח לדוגמה ותבניות → משפך שאלות מסך-מסך → לוח,#sn-app מדדים,#sn-app כוונון. צבעי המותג: כחול כהה וזהב. */\n:root{--bg:#f7f4ec;--paper:#ffffff;--ink:#14294D;--ink2:#4b5872;--mute:#8d93a3;--line:#dcd6c6;--gold:#C6A135;--gold2:#a07d1c;--blue:#185FA5;\n --disp:'Secular One',system-ui,sans-serif;--body:'Heebo',system-ui,sans-serif}\n#sn-app .wrap{max-width:560px;margin:0 auto}\n#sn-app h1{font-family:var(--disp);font-weight:400;font-size:26px;margin:0;text-wrap:balance}\n#sn-app .sub{color:var(--ink2);margin:4px 0 14px;font-size:14px}\n#sn-app .step{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px 16px}\n#sn-app .eyebrow{font-size:12px;letter-spacing:.06em;color:var(--mute);margin-bottom:6px}\n#sn-app .q{font-family:var(--disp);font-size:22px;margin:0 0 4px;font-weight:400}\n#sn-app .help{color:var(--ink2);font-size:14px;margin:0 0 14px}\n#sn-app .opts{display:grid;gap:10px}\n#sn-app .opt{display:flex;align-items:center;gap:12px;text-align:right;width:100%;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:12px 14px;font:inherit;font-size:16px;cursor:pointer}\n#sn-app .opt small{display:block;color:var(--ink2);font-size:13px}\n#sn-app .opt .ic{width:36px;height:36px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-family:var(--disp);color:var(--gold2);flex:none}\n#sn-app .opt:hover,#sn-app .opt:focus-visible{border-color:var(--gold);outline:none}\n#sn-app .opt.on{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}\n#sn-app .tip{background:var(--bg);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--ink2);margin-top:12px}\n#sn-app .nav{display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:8px}\n#sn-app .btn{font:inherit;font-size:17px;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:14px;padding:13px 20px;cursor:pointer;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s,background .18s,border-color .18s;box-shadow:0 1px 0 rgba(20,41,77,.06)}\n#sn-app .btn:hover{transform:translateY(-2px);box-shadow:0 8px 18px -8px rgba(20,41,77,.35);border-color:var(--gold)}.btn:active{transform:translateY(0) scale(.97);transition-duration:.06s}\n#sn-app .btn.p{background:linear-gradient(180deg,#d6b451,var(--gold));border-color:var(--gold);color:#1a1a1a;font-weight:600;font-size:18px;padding:14px 24px;box-shadow:0 6px 16px -6px rgba(198,161,53,.6)}.btn.p:hover{box-shadow:0 12px 24px -8px rgba(198,161,53,.7)}\n#sn-app .btn[disabled]{opacity:.45;transform:none;box-shadow:none;cursor:default}\n#sn-app /* הנפשת כניסה עדינה לכפתורי השלב */\n.nav .btn,#sn-app .row .btn,#sn-app .ups .up,#sn-app .pick .pk,#sn-app .tile{animation:pop .35s cubic-bezier(.2,.8,.2,1) both}@keyframes pop{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}\n#sn-app .btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}\n#sn-app .dots{display:flex;gap:5px}.dots i{width:7px;height:7px;border-radius:50%;background:var(--line)}.dots i.on{background:var(--gold)}\n#sn-app .rng{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;margin:8px 0;font-size:14px;color:var(--ink2)}\n#sn-app .rng input[type=range]{grid-column:1/3;width:100%;accent-color:var(--gold)}\n#sn-app .rng b{color:var(--ink);font-weight:500;font-variant-numeric:tabular-nums}\n#sn-app .board{position:relative;width:100%;aspect-ratio:1;max-width:100%;border:3px solid #14294D;border-radius:10px;overflow:hidden;background:#fff}\n#sn-app .board svg{position:absolute;inset:0;width:100%;height:100%;display:block}\n#sn-app .board.mark svg{cursor:crosshair}\n#sn-app .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 6px}\n#sn-app .m{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:8px 10px;text-align:center}\n#sn-app .m .l{font-size:12px;color:var(--mute)}.m .v{font-family:var(--disp);font-size:22px;font-variant-numeric:tabular-nums}\n#sn-app .m .s{font-size:12px;color:var(--ink2)}\n#sn-app .why{font-size:14px;color:var(--ink2);background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0}\n#sn-app .row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}\n#sn-app details{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin-top:12px}\n#sn-app summary{cursor:pointer;font-weight:500}\n#sn-app .seg{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}\n#sn-app .seg button{font:inherit;font-size:14px;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer}\n#sn-app .seg button.on{border-color:var(--gold);background:var(--gold);color:#1a1a1a}\n#sn-app .lbl{font-size:13px;color:var(--mute);margin-top:8px}\n#sn-app .meter{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:4px}.meter i{display:block;height:100%;background:var(--gold)}\n#sn-app .gal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:8px 0 14px}\n#sn-app .bigwrap{margin:6px 0 10px}.board.big{max-width:360px;margin:0 auto}.bigname{text-align:center;font-family:var(--disp);font-size:18px;margin-top:6px}\n#sn-app .tile.on{border-color:var(--gold);box-shadow:inset 0 0 0 2px var(--gold)}\n#sn-app .tilt{perspective:1100px}.tilt .board{transition:transform .25s ease-out,box-shadow .25s;transform-style:preserve-3d;will-change:transform;box-shadow:0 18px 40px -18px rgba(20,41,77,.45)}\n#sn-app .tilt .board::after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.28),rgba(255,255,255,0) 55%);opacity:0;transition:opacity .25s;z-index:2}\n#sn-app .tilt.live .board{transition:transform .05s linear}.tilt.live .board::after{opacity:1}\n#sn-app .swatches{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px}.sw{width:36px;height:36px;border-radius:50%;border:2px solid var(--line);cursor:pointer}.sw{transition:transform .15s}.sw:hover{transform:scale(1.15)}.sw.on{border-color:var(--ink);box-shadow:0 0 0 2px var(--gold)}\n#sn-app .pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin:6px 0 10px}.pk{font:inherit;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:6px;cursor:pointer}.pk svg{width:100%;aspect-ratio:1;border-radius:8px;display:block}.pk span{display:block;font-size:14px;padding-top:4px}.pk{transition:transform .2s,box-shadow .2s,border-color .2s}.pk:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 12px 24px -12px rgba(20,41,77,.4)}.pk.on{border-color:var(--gold);box-shadow:inset 0 0 0 2px var(--gold)}\n#sn-app .ups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:6px 0 10px}.up{display:flex;align-items:center;gap:10px;font:inherit;font-size:15px;text-align:right;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:10px;cursor:pointer}.up img{width:34px;height:34px;flex:none}.up{transition:transform .2s,box-shadow .2s,border-color .2s;font-size:16px;padding:14px 12px}.up:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 12px 24px -12px rgba(20,41,77,.4)}.up img{width:40px;height:40px}.up.on{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}\n#sn-app .tile{font:inherit;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:6px;cursor:pointer;text-align:center}\n#sn-app .tile .board{border-width:2px;border-radius:8px;pointer-events:none}.tile span{display:block;font-family:var(--disp);font-size:15px;padding:6px 0 2px}\n#sn-app .tile{transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s,border-color .2s}.tile:hover,.tile:focus-visible{border-color:var(--gold);outline:none;transform:translateY(-3px);box-shadow:0 12px 24px -12px rgba(20,41,77,.4)}\n#sn-app .icons{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 10px}\n#sn-app .ico{width:40px;height:40px;padding:4px;border:1.5px solid var(--line);border-radius:8px;background:var(--paper);cursor:pointer;opacity:.55}.ico img{width:100%;height:100%;object-fit:contain}.ico.on{border-color:var(--gold);opacity:1;box-shadow:inset 0 0 0 1px var(--gold)}\n#sn-app .tpl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}\n#sn-app .tpl button{font:inherit;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;padding:10px 8px;cursor:pointer;text-align:center}\n#sn-app .tpl button b{display:block;font-family:var(--disp);font-weight:400;font-size:16px}.tpl button small{color:var(--ink2);font-size:12px}\n#sn-app input[type=file]{font:inherit;font-size:14px;max-width:100%}\n#sn-app .hint{font-size:13px;color:var(--ink2);margin:6px 0}\n#sn-app .sqrow{border:1.5px solid var(--line);border-right:6px solid var(--c);border-radius:12px;padding:8px 10px;margin:8px 0;background:var(--paper)}\n#sn-app .sqhead{display:flex;align-items:center;gap:8px}.sqic{width:34px;height:34px;border-radius:50%;background:var(--c);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--disp);font-size:18px;overflow:hidden;flex:none}.sqic img{width:100%;height:100%;object-fit:cover}\n#sn-app .sqname{flex:1;min-width:0;font:inherit;font-size:15px;padding:6px 8px;border:1.5px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)}\n#sn-app .sqhead .x{background:none;border:0;font-size:20px;color:var(--mute);cursor:pointer}\n#sn-app .sqgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;margin-top:8px;font-size:13px;color:var(--ink2)}\n#sn-app .sqgrid label{display:grid;gap:2px}.sqgrid input,.sqgrid select{font:inherit;font-size:14px;padding:5px 8px;border:1.5px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);width:100%;min-width:0}\n#sn-app .sqgrid input[type=color]{padding:2px;height:34px}.sqgrid input[type=file]{font-size:12px;padding:3px}\n#sn-app .deck{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}\n#sn-app .card{position:relative;aspect-ratio:63/88;border-radius:10px;border:2px solid var(--cardc);background:#fff;color:#1a1a1a;display:flex;flex-direction:column;overflow:hidden}\n#sn-app .card .hd{background:var(--cardc);color:#fff;font-family:var(--disp);font-size:14px;padding:4px 8px;display:flex;justify-content:space-between;align-items:center}\n#sn-app .card .hd b{font-size:20px;line-height:1}\n#sn-app .card .tx{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;font-size:14px;line-height:1.35;padding:8px;outline:none;word-break:break-word}.card .tx:empty::before{content:attr(data-ph);color:#b4b2a9}.card .tx:focus{background:#fffbe8}\n#sn-app .card .ft{font-size:10px;color:#8d93a3;text-align:center;padding:0 0 4px;font-family:var(--disp)}\n#sn-app .card .x{position:absolute;bottom:2px;left:6px;background:none;border:0;color:#8d93a3;font-size:16px;cursor:pointer;line-height:1}\n#sn-app .fld{display:grid;gap:4px;margin:8px 0;font-size:14px;color:var(--ink2)}\n#sn-app .fld input[type=text]{font:inherit;font-size:15px;padding:8px 10px;border:1.5px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);width:100%}\n@media (prefers-reduced-motion:no-preference){#sn-app .step{animation:in .25s ease}}@keyframes in{from{opacity:.4;transform:translateY(4px)}to{opacity:1;transform:none}}\n#sn-app .seg button.on{background:var(--ink);color:#fff;border-color:var(--ink)}\n#sn-app .seg button{border-radius:999px}\n#sn-app .step{padding:12px 10px}\n";

let HOST=null;const $=s=>s==='#app'?HOST:HOST.querySelector(s),ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
let A=null;const SN_DEFAULTS={cardFont:'Heebo',mode:'blank',mirror:true,photoURL:null,screen:'home',P:null,board:null,bg:'',who:'family',players:3,minutes:20,drama:'mid',special:'none',qF:3,qB:0,tF:2,dice:'one',end:'over',photo:'none',img:null,down:'rope',ladder:'gold',pal:'navy',keep:[],numPos:'corner',numBg:'white',numFont:'Heebo',numColor:'',badge:'circle',theme:'family',name:'',cards:[],size:10,sq:[],tiles:'grid',deco:'',frame:false,art:'',preset:'classic'};
const HEADS={jungle:{w:292,h:350,nw:113,cx:145.5,col:'#48b12c',dark:'#2d7a1c'},ocean:{w:351,h:358,nw:113,cx:174.5,col:'#2fa1b9',dark:'#1b6f82'},candy:{w:293,h:349,nw:113,cx:146.5,col:'#f2abca',dark:'#d9679a'},space:{w:292,h:377,nw:113,cx:145,col:'#8d55d1',dark:'#5e3395'},birthday:{w:296,h:417,nw:115,cx:147.5,col:'#278fd2',dark:'#1a5f8e'},vintage:{w:293,h:354,nw:114,cx:146,col:'#d6362a',dark:'#8e1f16'}}; // הצוואר נחתך מהתמונה — הגוף מתחבר ישירות לבסיס הראש
// נחש = גוף SVG לאורך המסלול + ראש PNG (ChatGPT) שמעוגן בצוואר. הצוואר בתמונה יוצא מהקצה התחתון, הראש פונה למעלה
function headSnake([x1,y1],[x2,y2],seed,H){const K=LK,th=2*K;{const L=Math.hypot(x2-x1,y2-y1),o=Math.min(2.6*K,L*.15);x1+=(x2-x1)/L*o;y1+=(y2-y1)/L*o;} // הראש יושב בתוך משבצת ההתחלה
 const d=sPath([x1,y1],[x2,y2],3,seed),pts=bez([x1,y1],[x2,y2],3,seed);
 const [hx,hy]=pts[0],[qx,qy]=pts[5],hang=Math.atan2(qy-hy,qx-hx)*180/Math.PI,rot=hang-90,sc=th/H.nw,hw=H.w*sc,hh=H.h*sc;
 const n=pts.length-1,tail=pts.slice(Math.round(n*.78)).map(p=>p.join(' ')).join(' L'),ux=(qx-hx)/Math.hypot(qx-hx,qy-hy),uy=(qy-hy)/Math.hypot(qx-hx,qy-hy);
 let g=`<path d="M${hx-ux*.6*K} ${hy-uy*.6*K} L${hx} ${hy}" stroke="${H.col}" stroke-width="${th}" stroke-linecap="butt"/><path d="${d}" fill="none" stroke="${H.dark}" stroke-width="${th+1*K}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${H.col}" stroke-width="${th}" stroke-linecap="round"/>`;
 g+=`<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="${.6*K}" stroke-linecap="round" transform="translate(${-.4*K} ${-.4*K})"/>`;
 g+=`<path d="${d}" fill="none" stroke="${H.dark}" stroke-opacity=".55" stroke-width="${th*.45}" stroke-dasharray="${.9*K} ${2.2*K}" stroke-linecap="round"/>`;
 g+=`<path d="M${tail}" fill="none" stroke="${H.dark}" stroke-width="${th*.55}" stroke-linecap="round"/><path d="M${tail}" fill="none" stroke="${H.col}" stroke-width="${th*.35}" stroke-linecap="round"/>`;
 HEADTOP+=`<image href="snakes/heads/${A.preset}_head.png" x="${hx-H.cx*sc}" y="${hy-hh+.25*K}" width="${hw}" height="${hh}" transform="rotate(${rot} ${hx} ${hy})"/>`; // הראש מעל המספרים
 return g;}
const LADS={"jungle": {"w": 200, "top": 131, "mid": 78, "bot": 88}, "ocean": {"w": 222, "top": 124, "mid": 77, "bot": 88}, "candy": {"w": 200, "top": 123, "mid": 78, "bot": 88}, "space": {"w": 194, "top": 128, "mid": 78, "bot": 88}, "birthday": {"w": 204, "top": 126, "mid": 78, "bot": 88}, "vintage": {"w": 204, "top": 127, "mid": 78, "bot": 87}};
// סולם מאויר (ChatGPT): כיפה עליונה + אריח חוזר של שלב אחד + כיפה תחתונה — כך השלבים לא נמתחים
function artLadder([x1,y1],[x2,y2],L){const K=LK,dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy)+2.4*K,w=3.4*K,sc=w/L.w,top=L.top*sc,mid=L.mid*sc,bot=L.bot*sc,ang=Math.atan2(dy,dx)*180/Math.PI+90,id='al'+Math.round(x1*7+y1*13+l*3),p='snakes/ladders/'+A.preset;
 const mh=Math.max(0,l-top-bot),nrep=Math.max(1,Math.round(mh/mid)),mid2=mh/nrep; // מתאימים את גובה האריח כך שייכנס מספר שלם של שלבים
 return `<g transform="translate(${x1} ${y1}) rotate(${ang}) translate(${-w/2} ${1.2*K})"><defs><pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="${-bot-mh}" width="${w}" height="${mid2}"><image href="${p}_mid.png" x="0" y="0" width="${w}" height="${mid2}" preserveAspectRatio="none"/></pattern></defs><rect x="0" y="${-bot-mh}" width="${w}" height="${mh}" fill="url(#${id})"/><image href="${p}_bot.png" x="0" y="${-bot}" width="${w}" height="${bot}" preserveAspectRatio="none"/><image href="${p}_top.png" x="0" y="${-l}" width="${w}" height="${top}" preserveAspectRatio="none"/></g>`;}
const BGS={jungle:'snakes/bg/jungle.jpg',ocean:'snakes/bg/ocean.jpg',candy:'snakes/bg/candy.jpg',space:'snakes/bg/space.jpg',birthday:'snakes/bg/birthday.jpg',vintage:'snakes/bg/vintage.jpg'}; // רקע מאויר (ChatGPT): מרכז שקט + מסגרת איורים — הלוח יושב במרכז ה-76%
const ART={};
const TILES={grid:'רשת',chips:'משבצות מעוגלות',glossy:'מבריקות'};
const FL=[['rocket','רקטה'],['ringed_planet','כוכב לכת'],['alien','חייזר'],['flying_saucer','חללית'],['crescent_moon','ירח'],['shooting_star','כוכב נופל'],['monkey','קוף'],['lion','אריה'],['palm_tree','דקל'],['parrot','תוכי'],['elephant','פיל'],['butterfly','פרפר'],['tropical_fish','דג'],['octopus','תמנון'],['anchor','עוגן'],['spiral_shell','צדף'],['crab','סרטן'],['lollipop','סוכרייה על מקל'],['cupcake','קאפקייק'],['doughnut','דונאט'],['candy','סוכרייה'],['cow','פרה'],['chicken','תרנגולת'],['tractor','טרקטור'],['pig','חזיר'],['ewe','כבשה'],['balloon','בלון'],['wrapped_gift','מתנה'],['birthday_cake','עוגה'],['party_popper','קונפטי'],['confetti_ball','כדור קונפטי'],['menorah','חנוכייה'],['star_of_david','מגן דוד'],['dove','יונה'],['star','כוכב'],['glowing_star','כוכב זוהר'],['gem_stone','יהלום'],['blue_circle','עיגול כחול'],['knot','קשר'],['sun','שמש'],['rainbow','קשת'],['sunflower','חמנייה'],['snake','נחש'],['ladder','סולם'],['playground_slide','מגלשה'],['game_die','קובייה'],['crown','כתר'],['trophy','גביע'],['chequered_flag','דגל'],['red_question_mark','סימן שאלה'],['red_exclamation_mark','סימן קריאה']];
const VINT={trophy:'trophy',chequered_flag:'flag',red_question_mark:'note_q',red_exclamation_mark:'note_x'};
const FLI=f=>f[0]==='v'&&f.length>1&&!f.includes('_')&&f!=='volcano'?'snakes/vintage/'+f.slice(1)+'.png':(A.preset==='vintage'&&VINT[f]?'snakes/vintage/'+VINT[f]+'.png':'snakes/fluent/'+f+'.png');
const RULES={ask:'שאלה',task:'משימה',fwd:'קדימה',back:'אחורה',extra:'עוד תור',skip:'מפסידים תור'};
let _sqid=0;const sqNew=(o={})=>Object.assign({key:'s'+(++_sqid),name:'',sym:'★',color:'',img:null,count:3,rule:{type:'fwd',n:3,back:0}},o);
const SQ_Q=()=>sqNew({key:'q',name:'שאלה',sym:'?',count:Math.max(2,Math.round(6*A.size/10)),rule:{type:'ask',n:3,back:0}}),SQ_T=()=>sqNew({key:'t',name:'משימה',sym:'!',count:Math.max(2,Math.round(5*A.size/10)),rule:{type:'task',n:2,back:0}});
function ruleText(r){return r.type==='ask'?`נכון: ${r.n} קדימה · טעות: ${r.back?r.back+' אחורה':'נשארים'}`:r.type==='task'?`ביצעתם: ${r.n} קדימה`:r.type==='fwd'?`${r.n} קדימה`:r.type==='back'?`${r.n} אחורה`:RULES[r.type];}
const SIZES={6:'36 משבצות',8:'64 משבצות',10:'100 משבצות'};
// ── קלפי שאלה / משימה / פעילות — מאגר לפי נושא, עם {שם} למי שחוגגים ──
const THEMES={birthday:'יום הולדת',kids:'ילדים קטנים',party:'משחקי חברה',family:'משפחה',school:'כיתה וגן'};
const CTYPES={q:'שאלה',t:'משימה',a:'פעילות'};
// כל פריט: [סוג, נושאים, טקסט]. '*' = מתאים לכל נושא
const BANK=[
 ['q','*','מה הדבר הכי מצחיק שקרה לך השבוע?'],['q','*','אם היית יכול לעוף לכל מקום, לאן היית טס עכשיו?'],['q','*','איזה אוכל היית אוכל כל יום בלי להימאס?'],['q','*','מה הדבר הכי אמיץ שעשית?'],['q','*','איזו חיה היית רוצה להיות ליום אחד, ולמה?'],
 ['q','birthday','מה הזיכרון הכי טוב שלך עם {שם}?'],['q','birthday','מה {שם} הכי אוהב לעשות בשבת?'],['q','birthday','איזו מתנה {שם} הכי שמח לקבל?'],['q','birthday','ספרו משהו ש{שם} עושה יותר טוב מכולם.'],['q','birthday','מה השיר האהוב על {שם}?'],['q','birthday','באיזו שעה {שם} קם בבוקר ביום הולדת?'],
 ['q','kids','איזה צבע יש לשמיים?'],['q','kids','כמה רגליים יש לכלב?'],['q','kids','מה עושים לפני שהולכים לישון?'],['q','kids','איזה קול עושה פרה?'],['q','kids','מה אוכלים בבוקר?'],['q','kids','איזו עונה עכשיו — קיץ או חורף?'],
 ['q','party','מה הדבר הכי מביך שקרה לך בעבודה או בלימודים?'],['q','party','אם היית זוכה במיליון שקל, מה הדבר הראשון שהיית קונה?'],['q','party','מי בחדר הכי מתאים להיות ראש ממשלה, ולמה?'],['q','party','איזה סרט ראית יותר מחמש פעמים?'],['q','party','מה הכישרון הנסתר שלך?'],['q','party','ספרו על ביקור במקום שהיה שונה לגמרי ממה שציפיתם.'],
 ['q','family','איך סבא וסבתא הכירו?'],['q','family','מה המאכל שרק במשפחה שלנו מכינים?'],['q','family','מי במשפחה הכי טוב בלספר בדיחות?'],['q','family','איפה גרנו כשהייתי קטן?'],['q','family','מה הטיול המשפחתי הכי טוב שהיה לנו?'],['q','family','איזה שיר שרים אצלנו בכל חג?'],
 ['q','school','כמה זה 7 ועוד 8?'],['q','school','איזו אות מתחילה את המילה "שמש"?'],['q','school','תגידו שלוש מילים שמתחרזות עם "בית".'],['q','school','כמה ימים יש בשבוע?'],['q','school','איזו חיה הכי גדולה בעולם?'],['q','school','מה ההפך מ"חם"?'],
 ['t','*','עשו 5 קפיצות במקום.'],['t','*','חקו חיה, והשאר ינחשו איזו.'],['t','*','שירו שיר ילדים בקול רם.'],['t','*','ספרו בדיחה.'],['t','*','הסתובבו 3 פעמים ואז לכו ישר.'],['t','*','תנו מחמאה לשחקן שמימינכם.'],['t','*','דברו בקול של רובוט עד התור הבא שלכם.'],
 ['t','birthday','שירו "יום הולדת שמח" ל{שם} בסגנון אופרה.'],['t','birthday','חקו את {שם} כשהוא צוחק.'],['t','birthday','תנו ל{שם} חיבוק גדול.'],['t','birthday','אמרו משפט ברכה ל{שם} שמתחיל באות הראשונה של השם שלכם.'],['t','birthday','צלמו סלפי עם {שם} ועוד שני שחקנים.'],
 ['t','kids','עשו פרצוף מצחיק.'],['t','kids','עמדו על רגל אחת וספרו עד 5.'],['t','kids','מחאו כפיים 10 פעמים.'],['t','kids','חקו צפרדע.'],['t','kids','תגידו את השם שלכם בלחישה ואז בצעקה.'],['t','kids','לכו כמו פינגווין עד הדלת וחזרה.'],
 ['t','party','ספרו בדיחה שאף אחד לא צוחק ממנה — בכוונה.'],['t','party','חקו שחקן אחר בחדר, והשאר מנחשים מי.'],['t','party','דקלמו שיר ילדים בטון של כתב חדשות.'],['t','party','התנהגו כמו שהייתם בגיל 5 עד התור הבא.'],['t','party','הציגו פנטומימה של "מורה כועסת".'],['t','party','החליפו מקום עם מי שמשמאלכם.'],
 ['t','family','חקו את אבא כשהוא מחפש את המפתחות.'],['t','family','תנו חיבוק לבן המשפחה הכי מבוגר בחדר.'],['t','family','שירו את השיר שסבתא שרה לכם.'],['t','family','ספרו סיפור משפחתי בשלושה משפטים.'],['t','family','אמרו משהו טוב על כל אחד מהשחקנים.'],
 ['t','school','אמרו את האלף-בית בקצב כפול.'],['t','school','ספרו עד 20 אחורה.'],['t','school','תגידו 3 שמות של ירקות בירוק.'],['t','school','קפצו כמספר השחקנים בחדר.'],['t','school','לחשו מילה בת 4 אותיות, והשאר מנחשים.'],
 ['a','*','כולם קמים ורוקדים 10 שניות.'],['a','*','כולם מחליפים כיסאות.'],['a','*','סיבוב של מחמאות: כל אחד אומר משהו טוב על השכן.'],['a','*','כולם מחקים את השחקן שתורו — לדקה.'],['a','*','תור חופשי: השחקן בוחר משימה לכולם.'],
 ['a','birthday','כולם שרים ל{שם} ומוחאים כפיים.'],['a','birthday','כל אחד אומר דבר אחד שהוא אוהב ב{שם}.'],['a','birthday','תמונה קבוצתית מצחיקה עם {שם} באמצע.'],
 ['a','kids','כולם קופצים כמו קנגורו.'],['a','kids','כולם עושים "שקט" של שלוש שניות.'],['a','kids','כולם שרים "יונתן הקטן".'],
 ['a','party','כולם מספרים מה היה היום הכי טוב בחיים שלהם — במשפט אחד.'],['a','party','סבב מהיר: כל אחד אומר מילה שמתחילה באות של קודמו.'],['a','party','כולם מצביעים: מי ינצח במשחק?'],
 ['a','family','כולם מספרים זיכרון משותף אחד.'],['a','family','חיבוק משפחתי קבוצתי.'],['a','family','כולם אומרים "תודה" על משהו מהשבוע.'],
 ['a','school','כולם קמים, מתמתחים, ומתיישבים.'],['a','school','כולם סופרים יחד עד 10 בשפה אחרת.'],['a','school','כולם אומרים מילה שמתחילה באות שהשחקן בוחר.'],
];
function cardsFor(type,theme,n,name){const pool=BANK.filter(b=>b[0]===type&&(b[1]==='*'||b[1]===theme)),pri=pool.filter(b=>b[1]===theme),gen=pool.filter(b=>b[1]==='*');
 const sh=a=>a.slice().sort(()=>Math.random()-.5),pick=sh(pri).concat(sh(gen)).slice(0,n);
 return pick.map(b=>({type,text:b[2].replace(/\{שם\}/g,name||'{שם}')}));}

const NUMPOS={corner:'בפינה',center:'על כל המשבצת'},NUMBG={white:'פתקית לבנה',pal:'פתקית בצבע הלוח',dark:'פתקית כהה',none:'בלי רקע'},FONTS={'Heebo':'רגיל','Varela Round':'מעוגל','Secular One':'כותרת','Suez One':'קלאסי','Fredoka':'ילדותי','Rubik Mono One':'מודגש'},BADGE={circle:'עיגול',note:'פתק',fill:'על כל המשבצת'};
const PALS={navy:{n:'כחול וזהב',a:'#fbf9f3',b:'#f1ecdd',l:'#C6A135',d:'#14294D',t:'#14294D'},candy:{n:'סוכריות',a:'#fff7fb',b:'#ffe3f1',l:'#ff8fab',d:'#7c3aed',t:'#5b2a86'},sea:{n:'ים',a:'#f2fbff',b:'#d9f1fb',l:'#f2a93b',d:'#0f6e8c',t:'#0b3d4f'},forest:{n:'יער',a:'#f6fbf2',b:'#e3f1d8',l:'#b7791f',d:'#2f6b3a',t:'#1f4a28'},sunset:{n:'שקיעה',a:'#fff8f1',b:'#ffe6cf',l:'#e05a2b',d:'#5d2e8c',t:'#3b1c5a'},mono:{n:'שחור-לבן',a:'#ffffff',b:'#ececec',l:'#333333',d:'#777777',t:'#111111'},birthday:{n:'יום הולדת',a:'#fffaff',b:'#ffe4ef',l:'#f0597f',d:'#6d3fb3',t:'#5a2650',m:'confetti'},space:{n:'חלל',a:'#f3f3ff',b:'#e2e2fb',l:'#f5a623',d:'#3b3a9a',t:'#2a2866',m:'star'},hanukkah:{n:'חנוכה',a:'#f6f9ff',b:'#dfe9fb',l:'#d9a520',d:'#1d4f9c',t:'#163a73',m:'candle'}};
Object.assign(PALS.sea,{m:'wave'});Object.assign(PALS.forest,{m:'leaf'});Object.assign(PALS.candy,{m:'candy'});Object.assign(PALS.sunset,{m:'heart'});
const PRESETS=[['classic','קלאסי','navy','rope','gold','grid',''],['vintage','וינטג׳','vintage','snake','art','grid','vstar,vkey,vclock,vsun,vrocket,vcrown,vgift,vdice'],['birthday','יום הולדת','birthday','snake','art','chips','balloon,wrapped_gift,birthday_cake,party_popper,confetti_ball'],['ocean','מסע אל הים','sea','snake','art','glossy','tropical_fish,octopus,spiral_shell,crab,anchor'],['jungle','ג׳ונגל','forest','snake','art','glossy','monkey,lion,palm_tree,parrot,elephant,butterfly'],['space','חלל','space','snake','art','chips','rocket,ringed_planet,alien,flying_saucer,crescent_moon,shooting_star'],['candy','ארץ הממתקים','candy','snake','art','chips','lollipop,cupcake,doughnut,candy'],['hanukkah','חנוכה','hanukkah','rope','gold','grid','menorah,star_of_david,doughnut,wrapped_gift,dove'],['family','משפחה','navy','rope','gold','grid','sun,rainbow,sunflower,butterfly']];
PALS.vintage={n:'וינטג׳',a:'#f4ecd2',b:'#d9432f',c3:'#e6a93c',c4:'#8fb8b4',l:'#e6a93c',d:'#c0392b',t:'#2b2b2b',four:true};
const DOWN={rope:'חבלים',slide:'מגלשות',snake:'נחשים'},LAD={art:'מאויר',gold:'עץ זהוב',rope:'חבל',neon:'צבעוני'},LEN={short:'קצרים',medium:'בינוניים',long:'ארוכים',mixed:'מעורבים'};
const TPL={kids:{who:'kids',size:8,players:3,minutes:10,drama:'calm',dice:'one',end:'over',pal:'candy',sq:[],P:{nL:5,nR:2,lenL:'medium',lenR:'short'}},
 family:{who:'family',size:10,players:3,minutes:20,drama:'mid',dice:'one',end:'over',sq:'qt',P:{nL:8,nR:7,lenL:'medium',lenR:'medium'}},
 hard:{who:'teens',size:10,players:3,minutes:30,drama:'wild',dice:'one',end:'bounce',sq:'q',P:{nL:6,nR:8,lenL:'medium',lenR:'long'}}};
function sqFromTpl(v){return v==='qt'?[SQ_Q(),SQ_T()]:v==='q'?[Object.assign(SQ_Q(),{count:8})]:[];}
let P=null,B=null,mode='home';
// ── שלבי המשפך: רק מה שרלוונטי לתשובות הקודמות ──
// ── הזרימה: 1 לוח וצבעים → 2 סולמות ונחשים → 3 המשחק → לוח + שדרוגים ──
function syncSize(){SL.setSize(A.size);}
// הטיה תלת־ממדית בהעברת עכבר/אצבע על הלוח (עד 9°), עם ברק שעוקב אחרי המצביע
function bindTilt(root){root.querySelectorAll('.tilt').forEach(w=>{const b=w.querySelector('.board');if(!b||w._tilt)return;w._tilt=1;
 const mv=e=>{if(e.pointerType==='touch')return;const r=w.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;w.classList.add('live');b.style.setProperty('--gx',(px*100)+'%');b.style.setProperty('--gy',(py*100)+'%');b.style.transform=`rotateX(${(.5-py)*18}deg) rotateY(${(px-.5)*18}deg) scale(1.02)`;};
 const out=()=>{w.classList.remove('live');b.style.transform='';};
 w.addEventListener('pointermove',mv);w.addEventListener('pointerleave',out);w.addEventListener('pointercancel',out);});}
function applyPreset(id){const p=PRESETS.find(x=>x[0]===id);if(!p)return;A.preset=id;A.pal=p[2];A.down=p[3];A.ladder=p[4];A.tiles=p[5];A.deco=p[6]==='frame'?'':p[6];A.frame=p[6]==='frame'||id==='vintage';A.art=p[7]||'';if(A.ladder==='art'&&!LADS[id])A.ladder='gold';}
function stepNav(n,label,backMode){return `<div class="nav"><button class="btn" id="back" ${backMode?'':'disabled'}>חזרה</button><div class="dots">${[1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div><button class="btn p" id="next">${label}</button></div>`;}
function renderHome(){const app=$('#app');mode='home';syncSize();if(!A.preset)A.preset='classic';if(!B){P={...TPL.family.P};B=SL.generate({...P,specials:sqSpecials()});}
 app.innerHTML=`<div class="step"><div class="eyebrow">שלב 1 מתוך 3</div><h2 class="q">בחרו לוח</h2>
 <div class="bigwrap tilt"><div class="board big" id="big"></div><div class="bigname">${PRESETS.find(p=>p[0]===A.preset)?.[1]||''}</div></div>
 <div class="lbl">צבעים</div><div class="swatches">${Object.entries(PALS).map(([v,p])=>`<button class="sw ${A.pal===v?'on':''}" data-pal="${v}" title="${p.n}" aria-label="${p.n}" style="background:linear-gradient(135deg,${p.l} 50%,${p.d} 50%)"></button>`).join('')}</div>
 <div class="lbl">עוד לוחות — לחיצה פותחת למעלה</div>
 <div class="gal">${PRESETS.map(([id,t])=>`<button class="tile ${A.preset===id?'on':''}" data-preset="${id}"><div class="board" id="tile-${id}"></div><span>${t}</span></button>`).join('')}</div>
 ${stepNav(1,'הבא: סולמות ונחשים',false)}</div>`;
 const keep={pal:A.pal,down:A.down,ladder:A.ladder,photo:A.photo,tiles:A.tiles,deco:A.deco,frame:A.frame,art:A.art};A.photo='none';
 const kp=A.preset;PRESETS.forEach(([id,t,pal,down,lad,tiles,deco,art])=>{A.preset=id;A.pal=id===kp?keep.pal:pal;A.down=down;A.ladder=lad;A.tiles=tiles;A.deco=deco==='frame'?'':deco;A.frame=deco==='frame'||id==='vintage';A.art=art||'';draw('#tile-'+id);});A.preset=kp;Object.assign(A,keep);draw('#big');bindTilt(app);
 app.querySelectorAll('.tile').forEach(b=>b.onclick=()=>{applyPreset(b.dataset.preset);app.querySelectorAll('.tile').forEach(x=>x.classList.toggle('on',x===b));$('.bigname').textContent=PRESETS.find(p=>p[0]===A.preset)?.[1]||'';app.querySelectorAll('.sw').forEach(x=>x.classList.toggle('on',x.dataset.pal===A.pal));draw('#big');$('#big').scrollIntoView({behavior:'smooth',block:'center'});});
 app.querySelectorAll('.sw').forEach(b=>b.onclick=()=>{A.pal=b.dataset.pal;app.querySelectorAll('.sw').forEach(x=>x.classList.toggle('on',x===b));draw('#big');draw('#tile-'+A.preset);});
 $('#next').onclick=()=>renderStyle();snScroll();}
function miniLad(k){const sv=A.ladder,lk=LK;A.ladder=k;LK=3;const g=ladder([35,90],[65,10],PALS[A.pal]||PALS.navy);A.ladder=sv;LK=lk;return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${(PALS[A.pal]||PALS.navy).b}"/>${g}</svg>`;}
function miniDown(k){const sv=A.down,lk=LK,ht=HEADTOP;HEADTOP='';A.down=k;LK=3;const g=down([35,10],[65,90],PALS[A.pal]||PALS.navy,1)+HEADTOP;A.down=sv;LK=lk;HEADTOP=ht;return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${(PALS[A.pal]||PALS.navy).b}"/>${g}</svg>`;}
function renderStyle(){const app=$('#app');mode='style';const art=A.art;A.art='';
 app.innerHTML=`<div class="step"><div class="eyebrow">שלב 2 מתוך 3</div><h2 class="q">סולמות ונחשים</h2>
 <div class="lbl">מה עולה למעלה</div><div class="pick">${Object.entries(LAD).filter(([v])=>v!=='art'||LADS[A.preset]).map(([v,t])=>`<button class="pk ${A.ladder===v?'on':''}" data-k="ladder" data-v="${v}">${miniLad(v)}<span>${t}</span></button>`).join('')}</div>
 <div class="lbl">מה יורד למטה</div><div class="pick">${Object.entries(DOWN).map(([v,t])=>`<button class="pk ${A.down===v?'on':''}" data-k="down" data-v="${v}">${miniDown(v)}<span>${t}</span></button>`).join('')}</div>
 ${BGS[A.preset]?`<div class="lbl">מסגרת מאוירת מסביב ללוח</div><div class="seg" data-k="bgOn"><button data-v="1" class="${A.bg!=='off'?'on':''}">עם</button><button data-v="0" class="${A.bg==='off'?'on':''}">בלי</button></div>`:''}
 ${art?`<div class="lbl">איורים מצוירים</div><div class="seg" data-k="artOn"><button data-v="1" class="on">עם האיורים של ${PRESETS.find(p=>p[0]===art)?.[1]||''}</button><button data-v="0">בלי</button></div>`:''}
 ${stepNav(2,'הבא: המשחק',true)}</div>`;A.art=art;
 app.querySelectorAll('.pk').forEach(b=>b.onclick=()=>{A[b.dataset.k]=b.dataset.v;renderStyle();});
 app.querySelectorAll('.seg[data-k="bgOn"] button').forEach(b=>b.onclick=()=>{A.bg=b.dataset.v==='1'?'':'off';renderStyle();});
 app.querySelectorAll('.seg[data-k="artOn"] button').forEach(b=>b.onclick=()=>{A.art=b.dataset.v==='1'?(PRESETS.find(p=>p[0]===A.preset)?.[7]||''):'';renderStyle();});
 $('#back').onclick=renderHome;$('#next').onclick=renderGame;snScroll();}
function chips(k,opts){return `<div class="seg" data-k="${k}">${opts.map(([v,t])=>`<button data-v="${v}" class="${A[k]==v?'on':''}">${t}</button>`).join('')}</div>`;}
function renderGame(){const app=$('#app');mode='game';
 app.innerHTML=`<div class="step"><div class="eyebrow">שלב 3 מתוך 3</div><h2 class="q">המשחק</h2>
 <div class="lbl">מי משחק</div>${chips('who',[['kids','ילדים קטנים'],['older','ילדים גדולים'],['family','כל המשפחה'],['teens','נוער ומבוגרים']])}
 <div class="lbl">כמה משבצות</div>${chips('size',[[6,'36'],[8,'64'],[10,'100']])}
 <div class="lbl">כמה שחקנים</div>${chips('players',[[2,'2'],[3,'3–4'],[5,'5+']])}
 <div class="lbl">כמה זמן יש לכם למשחק אחד</div>${chips('minutes',[[10,'~10 דק׳'],[20,'~20 דק׳'],[35,'30+ דק׳']])}
 <div class="lbl">אופי המשחק</div>${chips('drama',[['calm','יציב'],['mid','מאוזן'],['wild','סוער']])}
 <p class="hint">${{calm:'יציב: סולמות ונחשים קצרים, מעט מהפכים — מי שמוביל בדרך כלל מנצח. טוב לקטנים.',mid:'מאוזן: הלוח הקלאסי — יש הפתעות, אבל המשחק לא נגרר.',wild:'סוער: נחשים ארוכים ומהפכים בכל סיבוב — גם מי שמאחור יכול לנצח. המשחק קצת יותר ארוך.'}[A.drama]}</p>
 <p class="hint">${A.who==='kids'?'לילדים קטנים מומלץ 36 או 64 משבצות וקובייה אחת.':'100 משבצות הוא הלוח הקלאסי.'} סולמות וחבלים הוא משחק של מזל בלבד — התשובות כאן קובעות כמה סולמות ונחשים יהיו ובאיזה אורך, כך שהמשחק יימשך בערך את הזמן שביקשתם.</p>
 ${stepNav(3,'בנו לי את הלוח',true)}</div>`;
 app.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{const k=b.closest('.seg').dataset.k,v=b.dataset.v;A[k]=isNaN(v)?v:+v;if(k==='who'&&v==='kids'&&A.size===10)A.size=8;renderGame();});
 $('#back').onclick=renderStyle;$('#next').onclick=()=>{A.keep=[];build();};snScroll();}
// ── משבצות מיוחדות: עורך משותף למשפך ולכוונון ──
function sqBody(){return `<div id="sqWrap"><div id="sqList">${A.sq.map((q,i)=>sqRow(q,i)).join('')||'<p class="hint">עדיין אין משבצות מיוחדות — רק סולמות וחבלים.</p>'}</div>
 <div class="row"><button class="btn" data-sqadd="q" ${A.sq.some(x=>x.key==='q')?'disabled':''}>+ שאלות ?</button><button class="btn" data-sqadd="t" ${A.sq.some(x=>x.key==='t')?'disabled':''}>+ משימות !</button><button class="btn p" data-sqadd="custom">+ משבצת משלכם</button></div></div>`;}
function sqRow(q,i){const pal=PALS[A.pal]||PALS.navy,col=q.color||(q.key==='t'?pal.l:pal.d),r=q.rule;
 return `<div class="sqrow" data-i="${i}" style="--c:${col}"><div class="sqhead"><span class="sqic">${q.img?`<img src="${q.img}" alt="">`:q.icon?`<img src="${FLI(q.icon)}" alt="">`:q.sym}</span><input type="text" class="sqname" value="${(q.name||'').replace(/"/g,'&quot;')}" placeholder="שם המשבצת" aria-label="שם"><button class="x" data-del="${i}" aria-label="מחיקה">×</button></div>
 <div class="sqgrid"><label>כמה<input type="number" min="1" max="12" value="${q.count}" data-f="count"></label>
 <label>מה קורה<select data-f="type">${Object.entries(RULES).map(([v,t])=>`<option value="${v}" ${r.type===v?'selected':''}>${t}</option>`).join('')}</select></label>
 ${['ask','task','fwd','back'].includes(r.type)?`<label>${r.type==='back'?'כמה אחורה':r.type==='ask'?'נכון: קדימה':'כמה קדימה'}<input type="number" min="0" max="12" value="${r.n}" data-f="n"></label>`:''}
 ${r.type==='ask'?`<label>טעות: אחורה<input type="number" min="0" max="12" value="${r.back||0}" data-f="back"></label>`:''}
 ${q.key==='q'||q.key==='t'?'':`<label>צבע<input type="color" value="${q.color||col}" data-f="color"></label><label>תמונה<input type="file" accept="image/*" data-f="img"></label>`}
 </div>${q.key==='q'||q.key==='t'?'':`<div class="lbl">סמל</div><div class="icons">${['star','gem_stone','blue_circle','knot','wrapped_gift','balloon','game_die','crown','snake','ladder','playground_slide','rocket','lion','tropical_fish','lollipop','sun'].map(f=>`<button class="ico ${q.icon===f?'on':''}" data-icon="${f}" aria-label="${f}"><img src="${FLI(f)}" alt=""></button>`).join('')}</div><div class="sqgrid">`}
 </div><div class="hint">${ruleText(r)}${q.img?' · עם תמונה':''}</div></div>`;}
function bindSq(root){root.querySelectorAll('.sqrow').forEach(row=>{const q=A.sq[+row.dataset.i];if(!q)return;
   row.querySelector('.sqname').oninput=e=>{q.name=e.target.value;if(mode==='result')renderStats();};
   row.querySelectorAll('[data-f]').forEach(inp=>{const f=inp.dataset.f;
     if(f==='img'){inp.onchange=e=>{const fl=e.target.files[0];if(!fl)return;const rd=new FileReader();rd.onload=()=>{q.img=rd.result;sqRefresh(root);};rd.readAsDataURL(fl);};return;}
     inp.oninput=e=>{const v=e.target.value;if(f==='count')q.count=Math.max(1,Math.min(12,+v||1));else if(f==='n')q.rule.n=+v||0;else if(f==='back')q.rule.back=+v||0;else if(f==='sym')q.sym=v||'★';else if(f==='color')q.color=v;
       if(f==='type'){q.rule.type=v;if((v==='ask'||v==='task'||v==='fwd'||v==='back')&&!q.rule.n)q.rule.n=3;sqRefresh(root);return;}
       if(f==='sym'||f==='color'){row.style.setProperty('--c',q.color||'');const ic=row.querySelector('.sqic');if(ic&&!q.img)ic.textContent=q.sym;}
       if(mode==='result')regen(false);};});
   row.querySelector('[data-del]').onclick=()=>{A.sq.splice(+row.dataset.i,1);sqRefresh(root);};});
 root.querySelectorAll('[data-sqadd]').forEach(b=>b.onclick=()=>{const k=b.dataset.sqadd;A.sq.push(k==='q'?SQ_Q():k==='t'?SQ_T():sqNew({name:'',sym:'★',count:3}));sqRefresh(root);const last=root.querySelector('.sqrow:last-child .sqname');last&&last.focus();});}
function sqRefresh(root){const host=root.querySelector('#sqWrap');if(!host)return;const wrap=document.createElement('div');wrap.innerHTML=sqBody();host.replaceWith(wrap.firstElementChild);bindSq(root);if(mode==='result')regen(false);}
function sqSpecials(){return A.sq.map(q=>({key:q.key,count:q.count,fw:['ask','task','fwd'].includes(q.rule.type)?q.rule.n:0,bk:q.rule.type==='back'?q.rule.n:q.rule.type==='ask'?(q.rule.back||0):0}));}
function sqRules(){const m={};A.sq.forEach(q=>{m[q.key]={type:q.rule.type,n:q.rule.n,back:q.rule.back||0};});return m;}
function sqOf(key){return A.sq.find(q=>q.key===key);}
function opt(k,[v,t,s]){return `<button class="opt ${A[k]==v?'on':''}" data-k="${k}" data-v="${v}"><span class="ic">${String(t)[0]}</span><span>${t}${s?`<small>${s}</small>`:''}</span></button>`;}
function loadImg(e,cb){const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{A.photoURL=rd.result;cb&&cb();if($('#bd')&&mode==='result')draw();};rd.readAsDataURL(f);}
function decoList(){return String(A.deco||'').split(',').map(x=>x.trim()).filter(Boolean);}
function styleBody(withPreview){return `<div class="lbl">ערכות מוכנות (לחיצה אחת קובעת צבעים, סולמות ומה יורד)</div><div class="seg" data-k="preset">${PRESETS.map(([id,t,pal])=>`<button data-v="${id}" class="${A.pal===pal&&PRESETS.find(p=>p[0]===id)[3]===A.down&&PRESETS.find(p=>p[0]===id)[4]===A.ladder?'on':''}"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${PALS[pal].l};margin-left:4px;vertical-align:-1px"></i><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${PALS[pal].d};margin-left:6px;vertical-align:-1px"></i>${t}</button>`).join('')}</div>
 ${A.art?`<div class="lbl">איורים מצוירים</div><div class="seg" data-k="artOn"><button data-v="1" class="${A.art?'on':''}">עם האיורים של ${PRESETS.find(p=>p[0]===A.art)?.[1]||''}</button><button data-v="0">בלי</button></div>`:''}
 <div class="lbl">צורת המשבצות</div><div class="seg" data-k="tiles">${Object.entries(TILES).map(([v,t])=>`<button data-v="${v}" class="${A.tiles===v?'on':''}">${t}</button>`).join('')}</div>
 <div class="lbl">איורים במשבצות (לחיצה מוסיפה או מסירה)</div><div class="icons">${FL.filter(([f])=>!['red_question_mark','red_exclamation_mark','chequered_flag','trophy'].includes(f)).map(([f,t])=>`<button class="ico ${decoList().includes(f)?'on':''}" data-deco="${f}" title="${t}" aria-label="${t}"><img src="${FLI(f)}" alt=""></button>`).join('')}</div>
 <div class="lbl">מה יורד למטה</div><div class="seg" data-k="down">${Object.entries(DOWN).map(([v,t])=>`<button data-v="${v}" class="${A.down===v?'on':''}">${t}</button>`).join('')}</div>
 <div class="lbl">סולמות</div><div class="seg" data-k="ladder">${Object.entries(LAD).filter(([v])=>v!=='art'||LADS[A.preset]).map(([v,t])=>`<button data-v="${v}" class="${A.ladder===v?'on':''}">${t}</button>`).join('')}</div>
 <div class="lbl">צבעים</div><div class="seg" data-k="pal">${Object.entries(PALS).map(([v,p])=>`<button data-v="${v}" class="${A.pal===v?'on':''}"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.l};margin-left:4px;vertical-align:-1px"></i><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.d};margin-left:6px;vertical-align:-1px"></i>${p.n}</button>`).join('')}</div>
 <div class="lbl">משבצות ? ו-!</div><div class="seg" data-k="badge">${Object.entries(BADGE).map(([v,t])=>`<button data-v="${v}" class="${A.badge===v?'on':''}">${t}</button>`).join('')}</div>
 ${withPreview?'<div class="board" id="pv" style="max-width:220px;margin:10px auto 0"></div>':''}`;}
function numBody(withPreview){return ` <div class="lbl">מספרים</div><div class="seg" data-k="numPos">${Object.entries(NUMPOS).map(([v,t])=>`<button data-v="${v}" class="${A.numPos===v?'on':''}">${t}</button>`).join('')}</div>
 <div class="seg" data-k="numBg">${Object.entries(NUMBG).map(([v,t])=>`<button data-v="${v}" class="${(A.numBg||'white')===v?'on':''}">${t}</button>`).join('')}</div>
 <div class="seg" data-k="numFont">${Object.entries(FONTS).map(([v,t])=>`<button data-v="${v}" class="${A.numFont===v?'on':''}" style="font-family:'${v}'">${t} 42</button>`).join('')}</div>
 <div class="rng" style="grid-template-columns:auto 1fr auto">צבע המספרים<input type="color" id="numColor_${withPreview?'a':'b'}" value="${A.numColor||(PALS[A.pal]||PALS.navy).t}" style="width:44px;height:30px;padding:0;border:1px solid var(--line);border-radius:6px;background:none"><button class="btn" id="numReset_${withPreview?'a':'b'}" style="padding:4px 10px;font-size:13px">כמו הפלטה</button></div>
`;}
function bindStyle(root){root.querySelectorAll('.seg[data-k="preset"] button').forEach(b=>b.onclick=()=>{const p=PRESETS.find(x=>x[0]===b.dataset.v);A.pal=p[2];A.down=p[3];A.ladder=p[4];A.tiles=p[5];A.deco=p[6]==='frame'?'':p[6];A.frame=p[6]==='frame'||id==='vintage';A.art=p[7]||'';if(A.ladder==='art'&&!LADS[id])A.ladder='gold';root.querySelectorAll('.seg[data-k="preset"] button').forEach(x=>x.classList.toggle('on',x===b));['pal','down','ladder'].forEach(k=>root.querySelectorAll(`.seg[data-k="${k}"] button`).forEach(x=>x.classList.toggle('on',x.dataset.v===A[k])));root.querySelectorAll('input[type=color]').forEach(c=>{if(!A.numColor)c.value=PALS[A.pal].t;});if($('#pv'))preview();if($('#bd'))draw();});
 root.querySelectorAll('input[type=color]').forEach(c=>c.oninput=()=>{A.numColor=c.value;if($('#pv'))preview();if($('#bd'))draw();});root.querySelectorAll('[id^=numReset]').forEach(b=>b.onclick=()=>{A.numColor='';root.querySelectorAll('input[type=color]').forEach(c=>c.value=(PALS[A.pal]||PALS.navy).t);if($('#pv'))preview();if($('#bd'))draw();});
 root.querySelectorAll('.seg[data-k="artOn"] button').forEach(b=>b.onclick=()=>{if(b.dataset.v==='0'){A.art='';}root.querySelectorAll('.seg[data-k="artOn"] button').forEach(x=>x.classList.toggle('on',x===b));if($('#bd'))draw();});
 root.querySelectorAll('[data-deco]').forEach(b=>b.onclick=()=>{const l=decoList(),f=b.dataset.deco,i=l.indexOf(f);if(i<0)l.push(f);else l.splice(i,1);A.deco=l.join(',');b.classList.toggle('on',i<0);if($('#pv'))preview();if($('#bd'))draw();});
 root.querySelectorAll('.seg[data-k="down"],.seg[data-k="ladder"],.seg[data-k="pal"],.seg[data-k="numPos"],.seg[data-k="numBg"],.seg[data-k="numFont"],.seg[data-k="badge"],.seg[data-k="tiles"]').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{A[sg.dataset.k]=b.dataset.v;sg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));if($('#pv'))preview();if($('#bd'))draw();}));if($('#pv'))preview();}
function preview(){const old=B;B={L:{3:24},R:{37:15},Q:{8:1},T:{28:1}};const sp=A.photo;A.photo='none';draw('#pv',4);A.photo=sp;B=old;}
// ── מהתשובות לפרמטרים ──
function rules(){return{dice:A.dice,end:A.end,players:A.players,specials:sqRules()};}
function pick(){const target=A.minutes,R=rules();
 const lensR=A.drama==='calm'?['short']:A.drama==='mid'?['short','medium']:['medium','long'],lensL=A.drama==='calm'?['short','medium']:['medium','long'];
 const spreadOK=s=>A.drama==='calm'?s<=14:A.drama==='mid'?(s>=10&&s<=30):s>=24;let best=null;
 syncSize();const GL=A.size===6?[2,3,4,5]:A.size===8?[3,4,6,8]:[4,6,8,10,12],GR=A.size===6?[1,2,3,4]:A.size===8?[2,3,4,6]:[2,4,6,8,10,12];
 for(const nL of GL)for(const nR of GR)for(const lenL of lensL)for(const lenR of lensR){
  const cfg={nL,nR,lenL,lenR,specials:sqSpecials()};
  let sc=0;for(let i=0;i<3;i++){const s=SL.stats(SL.quickBoard(cfg),R);sc+=2*Math.abs(s.minutes-target)/target+(spreadOK(s.spread)?0:.35)+(s.stuck?5:0);}
  if(!best||sc<best.sc)best={sc,cfg};}
 return best.cfg;}
function build(){P=pick();mode='result';regen(true);}
function regen(full){syncSize();B=SL.generate({...P,specials:sqSpecials(),mid:A.photo==='mid',keep:A.keep});if(full||!$('#st'))renderResult();else{draw();renderStats();}}
// ── תוצאה ──
function renderResult(){const app=$('#app');
 app.innerHTML=`<div class="tilt"><div class="board" id="bd"></div></div><p class="hint" id="markHint" hidden>לחצו על משבצות שבהן יש פנים — הסולמות והחבלים יעקפו אותן. לחיצה נוספת מבטלת.</p>
 <div class="hint" id="legend"></div>
 <div class="row"><button class="btn p" id="again">בנו לוח שוב</button><button class="btn" id="edit">שנו לוח וסגנון</button></div>
 <div class="lbl">לשדרג את המשחק</div>
 <div class="ups"><button class="up ${A.sq.some(q=>q.key==='q'||q.key==='t')?'on':''}" id="upCards"><img src="${FLI('red_question_mark')}" alt=""><span>${A.cards.length?'הקלפים ('+A.cards.length+')':'קלפים: שאלות ומשימות'}</span></button><button class="up ${A.sq.some(q=>q.key!=='q'&&q.key!=='t')?'on':''}" id="upSq"><img src="${FLI('gem_stone')}" alt=""><span>משבצות משלכם</span></button><button class="up ${A.photo!=='none'?'on':''}" id="upPhoto"><img src="${FLI('sun')}" alt=""><span>תמונה על הלוח</span></button><button class="up" id="upNum"><img src="${FLI('blue_circle')}" alt="" onerror="this.style.display='none'"><span>המספרים ורקע המספרים</span></button><button class="up ${A.dice==='two'||A.end!=='over'?'on':''}" id="upDice"><img src="${FLI('game_die')}" alt=""><span>קוביות וסיום</span></button></div>
 <div id="st"></div>
 <details id="dSq"><summary>⭐ משבצות משלכם</summary>${sqBody()}</details>
 <details id="dPhoto"><summary>📷 תמונה על הלוח</summary><div class="seg" data-k="photo">${[['none','בלי'],['full','על כל הלוח'],['mid','באמצע']].map(([v,t])=>`<button data-v="${v}" class="${A.photo===v?'on':''}">${t}</button>`).join('')}</div><input type="file" id="img2" accept="image/*">
  <div class="row" id="markRow" hidden><button class="btn" id="mark">סמנו איפה הפנים</button><button class="btn" id="clearKeep">נקו סימון</button></div></details>
 <details id="dNum"><summary>🔢 המספרים</summary>${numBody(false)}</details>
 <details id="dDice"><summary>🎲 קוביות וסיום</summary><div class="lbl">קוביות</div>${chips('dice',[['one','קובייה אחת'],['two','שתי קוביות']])}<div class="lbl">איך מנצחים</div>${chips('end',A.dice==='two'?[['over','עובר את הסוף = ניצח'],['bounce','עובר קופץ אחורה']]:[['over','עובר את הסוף = ניצח'],['exact','בדיוק לסוף'],['bounce','עובר קופץ אחורה']])}<p class="hint">${A.dice==='two'?'בשתי קוביות אין "בדיוק לסוף": מי שעומד משבצת לפני הסוף לא יוכל לסיים.':'שתי קוביות = משחק כפול מהיר, ונחיתה על חבל פחות שכיחה.'}</p></details>
 <details id="fine"><summary>⚙️ כוונון עדין</summary>
  <div class="lbl">גודל הלוח</div><div class="seg" data-k="size">${Object.entries(SIZES).map(([v,t])=>`<button data-v="${v}" class="${A.size==v?'on':''}">${t}</button>`).join('')}</div>
  <div class="lbl">סולמות</div><div class="rng">כמה<b id="vnL">${P.nL}</b><input type="range" id="nL" min="0" max="14" value="${P.nL}"></div><div class="seg" data-k="lenL">${lenSeg('lenL')}</div>
  <div class="lbl">חבלים</div><div class="rng">כמה<b id="vnR">${P.nR}</b><input type="range" id="nR" min="0" max="14" value="${P.nR}"></div><div class="seg" data-k="lenR">${lenSeg('lenR')}</div>
  <div class="lbl">עיצוב</div>${styleBody(false)}
 </details>`;
 draw();renderStats();bindStyle(app);bindSq(app);updateMarkUI();bindTilt(app);
 $('#again').onclick=()=>regen(false);$('#edit').onclick=renderHome;
 $('#upCards').onclick=()=>{if(!A.sq.some(q=>q.key==='q'||q.key==='t')){A.sq.push(SQ_Q(),SQ_T());B=SL.generate({...P,specials:sqSpecials(),mid:A.photo==='mid',keep:A.keep});}mode='cards';renderCards();};
 $('#upSq').onclick=()=>{const d=$('#dSq');d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});};
 $('#upPhoto').onclick=()=>{const d=$('#dPhoto');d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});};
 $('#upNum').onclick=()=>{const d=$('#dNum');d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});};
 $('#upDice').onclick=()=>{const d=$('#dDice');d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});};
 app.querySelectorAll('#dDice .seg button').forEach(b=>b.onclick=()=>{const k=b.closest('.seg').dataset.k;A[k]=b.dataset.v;if(k==='dice'&&A.dice==='two'&&A.end==='exact')A.end='bounce';renderResult();$('#dDice').open=true;});
 app.querySelectorAll('details input[type=range]').forEach(r=>{r.oninput=()=>{P[r.id]=+r.value;$('#v'+r.id).textContent=r.value;};r.onchange=()=>regen(false);});
 app.querySelectorAll('.seg[data-k="lenL"],.seg[data-k="lenR"],.seg[data-k="photo"],.seg[data-k="size"]').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{const k=sg.dataset.k;if(k==='photo')A.photo=b.dataset.v;else if(k==='size'){A.size=+b.dataset.v;A.keep=[];P=pick();renderResult();return;}else P[k]=b.dataset.v;sg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));updateMarkUI();regen(false);}));
 $('#img2').onchange=e=>loadImg(e,()=>{if(A.photo==='none'){A.photo='full';app.querySelectorAll('.seg[data-k="photo"] button').forEach(x=>x.classList.toggle('on',x.dataset.v==='full'));updateMarkUI();}});
 let marking=false;$('#mark').onclick=()=>{marking=!marking;$('#mark').textContent=marking?'סיימתי לסמן':'סמנו איפה הפנים';$('#bd').classList.toggle('mark',marking);$('#bd').parentElement.classList.toggle('tilt',!marking);$('#markHint').hidden=!marking;if(marking)$('#bd').scrollIntoView({behavior:'smooth',block:'start'});};
 $('#clearKeep').onclick=()=>{A.keep=[];regen(false);};
 $('#bd').onclick=e=>{if(!marking)return;const r=$('#bd').getBoundingClientRect(),N_=SL.N,c=Math.floor((e.clientX-r.left)/r.width*N_),row=N_-1-Math.floor((e.clientY-r.top)/r.height*N_),k=row*N_+c;const i=A.keep.indexOf(k);if(i<0)A.keep.push(k);else A.keep.splice(i,1);regen(false);};
 snScroll();}
// ── מסך הקלפים ──
function renderCards(){const app=$('#app'),cnt=k=>B&&B.S?Object.values(B.S).filter(x=>x===k).length:0,nQ=cnt('q'),nT=cnt('t');
 const want={q:A.sq.some(q=>q.key==='q')?Math.max(8,nQ*2):0,t:A.sq.some(q=>q.key==='t')?Math.max(8,nT*2):0,a:4};
 app.innerHTML=`<div class="step"><div class="eyebrow">הקלפים של המשחק</div><h2 class="q">שאלות, משימות ופעילויות</h2>
 <p class="help">בלוח יש ${nQ} משבצות ? ו-${nT} משבצות !. נבנה חפיסה שמתאימה, ואתם מתקנים, מוחקים ומוסיפים משלכם.</p>
 <div class="lbl">לאיזה אירוע</div><div class="seg" data-k="theme">${Object.entries(THEMES).map(([v,t])=>`<button data-v="${v}" class="${A.theme===v?'on':''}">${t}</button>`).join('')}</div>
 <div class="fld" id="nameFld" ${A.theme==='birthday'?'':'hidden'}><label for="bname">מי חוגג? (השם ייכנס לקלפים)</label><input type="text" id="bname" value="${A.name.replace(/"/g,'&quot;')}" placeholder="נועה"></div>
 <div class="row"><button class="btn p" id="gen">${A.cards.length?'בנו חפיסה חדשה':'בנו לי חפיסה'}</button><span class="hint" style="align-self:center">${want.q} שאלות · ${want.t} משימות · ${want.a} פעילויות</span></div>
 <div class="deck" id="deck"></div>
 <div class="row"><button class="btn" data-add="q">+ שאלה</button><button class="btn" data-add="t">+ משימה</button><button class="btn" data-add="a">+ פעילות</button></div>
 <div class="nav"><button class="btn" id="toBoard">חזרה ללוח</button><span class="hint">${A.cards.length} קלפים</span></div></div>`;
 drawDeck();
 app.querySelectorAll('.seg[data-k="theme"] button').forEach(b=>b.onclick=()=>{A.theme=b.dataset.v;app.querySelectorAll('.seg[data-k="theme"] button').forEach(x=>x.classList.toggle('on',x===b));$('#nameFld').hidden=A.theme!=='birthday';});
 $('#bname').oninput=e=>{A.name=e.target.value;};
 $('#gen').onclick=()=>{A.cards=[...cardsFor('q',A.theme,want.q,A.name),...cardsFor('t',A.theme,want.t,A.name),...cardsFor('a',A.theme,want.a,A.name)];renderCards();};
 app.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{A.cards.push({type:b.dataset.add,text:''});drawDeck();const t=$('#deck').lastElementChild.querySelector('.tx');t&&t.focus();});
 $('#toBoard').onclick=()=>{mode='result';if(B)renderResult();else renderHome();};
 snScroll();}
function drawDeck(){const pal=PALS[A.pal]||PALS.navy,col={q:pal.d,t:pal.l,a:'#2f6b3a'},sym={q:'?',t:'!',a:'★'};
 $('#deck').innerHTML=A.cards.map((c,i)=>`<div class="card" style="--cardc:${col[c.type]}"><div class="hd"><span>${CTYPES[c.type]}</span><b>${sym[c.type]}</b></div><div class="tx" contenteditable="true" data-i="${i}" data-ph="כתבו כאן…">${c.text.replace(/</g,'&lt;')}</div><div class="ft">עיצובישי</div><button class="x" data-i="${i}" aria-label="מחיקה">×</button></div>`).join('')||'<p class="hint" style="grid-column:1/3">עדיין אין קלפים. לחצו "בנו לי חפיסה" או הוסיפו קלף.</p>';
 $('#deck').querySelectorAll('.tx').forEach(t=>t.oninput=()=>{A.cards[+t.dataset.i].text=t.textContent;});
 $('#deck').querySelectorAll('.x').forEach(x=>x.onclick=()=>{A.cards.splice(+x.dataset.i,1);drawDeck();});}
function updateMarkUI(){$('#markRow').hidden=A.photo!=='full';}
function renderStats(){const lg=$('#legend');if(lg)lg.innerHTML=A.sq.map(q=>`<span style="display:inline-block;margin-left:10px"><b>${q.img?'●':q.icon?`<img src="${FLI(q.icon)}" alt="" style="width:16px;height:16px;vertical-align:-3px">`:q.sym}</b> ${q.name||'משבצת'}: ${ruleText(q.rule)}</span>`).join('');const S=SL.stats(B,rules()),dram=S.spread<=14?'צפוי':S.spread<=30?'מאוזן':'הרבה הפתעות',lvl=Math.min(100,Math.round(S.spread/60*100));
 $('#st').innerHTML=`<div class="stats"><div class="m"><div class="l">משחק ממוצע</div><div class="v">${S.minutes}</div><div class="s">דקות · ${S.mean} תורות</div></div><div class="m"><div class="l">מהיר</div><div class="v">${S.p10}</div><div class="s">תורות</div></div><div class="m"><div class="l">ארוך</div><div class="v">${S.p90}</div><div class="s">תורות</div></div></div>
 <div class="lbl">הפתעות: ${dram}</div><div class="meter"><i style="width:${lvl}%"></i></div>
 <div class="why">לוח ${A.size*A.size} משבצות: <b>${Object.keys(B.L).length} סולמות ${LEN[P.lenL]}</b> ו-<b>${Object.keys(B.R).length} ${DOWN[A.down]} ${LEN[P.lenR]}</b>${A.sq.map(q=>`, ${Object.values(B.S||{}).filter(k=>k===q.key).length} ${q.name||'משבצות'} (${ruleText(q.rule)})`).join('')} — ל-${A.players===5?'5+':A.players===3?'3–4':A.players} שחקנים עם ${A.dice==='one'?'קובייה אחת':'שתי קוביות'}${A.end==='exact'?', בדיוק ל-100':A.end==='bounce'?', קפיצה חזרה':''}.${B.complete&&A.sq.every(q=>Object.values(B.S||{}).filter(k=>k===q.key).length>=q.count)?'':' לא נמצא מקום לכל מה שביקשתם — הקטנו מעט את הכמות.'}</div>`;}
function lenSeg(k){return Object.entries(LEN).map(([v,t])=>`<button data-v="${v}" class="${P[k]===v?'on':''}">${t}</button>`).join('');}
// ── ציור ──
function tile(x,y,s,fill,pal,inMid){const st=A.tiles||'grid';
 if(st==='chips'){const g=s*.08,r=s*.18;return `<rect x="${x+g}" y="${y+g}" width="${s-2*g}" height="${s-2*g}" rx="${r}" fill="${fill==='none'?'rgba(255,255,255,.35)':fill}" stroke="${pal.t}" stroke-opacity=".35" stroke-width=".35"/>`;}
 if(st==='glossy'){const g=s*.05;return `<rect x="${x+g}" y="${y+g}" width="${s-2*g}" height="${s-2*g}" rx="${s*.08}" fill="${fill==='none'?'rgba(255,255,255,.3)':fill}" stroke="${pal.t}" stroke-opacity=".3" stroke-width=".3"/><path d="M${x+g+s*.08} ${y+g+s*.1} h${s-2*g-s*.16} q${s*.06} 0 ${s*.04} ${s*.08} q${-s*.25} ${s*.22} ${-(s-2*g-s*.28)} ${s*.1} z" fill="#fff" opacity=".28"/>`;}
 return `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fill}" stroke="${pal.t}" stroke-opacity="${inMid?.5:.25}" stroke-width=".25"/>`;}
function motif(id,x,y,s,col){const c=x+s/2,cy=y+s/2,r=s*.22;
 if(id==='heart')return `<path d="M${c} ${cy+r*.9} C${c-r*1.6} ${cy-r*.3} ${c-r*.7} ${cy-r*1.4} ${c} ${cy-r*.5} C${c+r*.7} ${cy-r*1.4} ${c+r*1.6} ${cy-r*.3} ${c} ${cy+r*.9}Z" fill="${col}" opacity=".18"/>`;
 if(id==='star'){let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;d+=(i?'L':'M')+(c+rr*Math.cos(a))+' '+(cy+rr*Math.sin(a));}return `<path d="${d}Z" fill="${col}" opacity=".2"/>`;}
 if(id==='wave')return `<path d="M${x+s*.15} ${cy} q${s*.12} ${-s*.12} ${s*.24} 0 t${s*.24} 0 t${s*.24} 0" fill="none" stroke="${col}" stroke-width="${s*.05}" opacity=".25" stroke-linecap="round"/>`;
 if(id==='leaf')return `<path d="M${c} ${cy+r} C${c-r*1.3} ${cy} ${c-r*.6} ${cy-r*1.3} ${c} ${cy-r*1.1} C${c+r*.6} ${cy-r*1.3} ${c+r*1.3} ${cy} ${c} ${cy+r}Z" fill="${col}" opacity=".18"/>`;
 if(id==='candy')return `<circle cx="${c}" cy="${cy}" r="${r*.8}" fill="${col}" opacity=".2"/><path d="M${c-r*1.4} ${cy-r*.5} l${r*.6} ${r*.5} l${-r*.6} ${r*.5}Z M${c+r*1.4} ${cy-r*.5} l${-r*.6} ${r*.5} l${r*.6} ${r*.5}Z" fill="${col}" opacity=".2"/>`;
 if(id==='confetti')return [0,1,2].map(i=>`<rect x="${x+s*(.2+i*.25)}" y="${y+s*(.3+(i%2)*.3)}" width="${s*.12}" height="${s*.06}" rx="${s*.02}" fill="${col}" opacity=".3" transform="rotate(${-30+i*35} ${x+s*(.26+i*.25)} ${y+s*(.33+(i%2)*.3)})"/>`).join('');
 if(id==='candle')return `<rect x="${c-r*.25}" y="${cy-r*.5}" width="${r*.5}" height="${r*1.6}" rx="${r*.1}" fill="${col}" opacity=".2"/><ellipse cx="${c}" cy="${cy-r*.9}" rx="${r*.3}" ry="${r*.45}" fill="${col}" opacity=".3"/>`;
 return '';}
function draw(sel='#bd',grid=10){HEADTOP='';const pal=PALS[A.pal]||PALS.navy,Nn=SL.N,s=100/Nn;LK=grid===10?Math.min(1.5,s/10):1;const ctr=n=>{const p=SL.rc(n);return[p.c*s+s/2,(Nn-1-p.r)*s+s/2];};let g='',defs='',top='';
 const mid=A.photo==='mid',full=A.photo==='full',m0=Math.round(Nn*.3),m1=Math.round(Nn*.7)-1,mx=m0*s,mw=(m1-m0+1)*s,E=Nn*Nn;
 if(A.photoURL)defs+=`<pattern id="ph${grid}" patternUnits="userSpaceOnUse" x="${mid?mx:0}" y="${mid?mx:0}" width="${mid?mw:100}" height="${mid?mw:100}"><image href="${A.photoURL}" x="0" y="0" width="${mid?mw:100}" height="${mid?mw:100}" preserveAspectRatio="xMidYMid slice"/></pattern>`;
 if(grid!==10){const rcv=n=>({c:3-((n-1)%4),r:Math.floor((n-1)/4)}),c4=n=>{const p=rcv(n);return[p.c*25+12.5,(3-p.r)*25+12.5];};
  for(let n=1;n<=16;n++){const p=rcv(n),x=p.c*25,y=(3-p.r)*25;g+=`<rect x="${x}" y="${y}" width="25" height="25" fill="${(p.c+p.r)%2?pal.b:pal.a}" stroke="${pal.t}" stroke-opacity=".25" stroke-width=".3"/>`;if(decoList().length&&(n*7)%3===0)g+=`<image href="${FLI(decoList()[n%decoList().length])}" x="${x+5}" y="${y+9}" width="14" height="14"/>`;else if(pal.m&&(n*7)%3===0)g+=motif(pal.m,x,y,25,pal.d);top+=numLabel(n,x,y,25,pal);}
  g+=ladder(c4(2),c4(10),pal)+down(c4(15),c4(5),pal);top+=badge(c4(7),{sym:'?',key:'q'},pal,25)+badge(c4(12),{sym:'!',key:'t'},pal,25);
  {const out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true"><defs>${defs}</defs>${g}${top}${HEADTOP}</svg>`;if(sel)$(sel).innerHTML=out;return out;}}
 const art=A.art&&ART[A.art]?ART[A.art]:null;
 if(art&&!full)g+=`<image href="${art.bg}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>`;
 else if(!full&&(A.tiles==='chips'||A.tiles==='glossy'))g+=`<rect x="0" y="0" width="100" height="100" fill="${pal.d}" opacity=".85"/>`;
 if(A.frame&&!(A.bg!=='off'&&BGS[A.preset]&&!full))g+=`<rect x="0" y="0" width="100" height="100" fill="${pal.a}"/><path d="${[...Array(40).keys()].map(i=>`M${i*2.5} 0 l1.25 2 l1.25 -2`).join(' ')} ${[...Array(40).keys()].map(i=>`M${i*2.5} 100 l1.25 -2 l1.25 2`).join(' ')} ${[...Array(40).keys()].map(i=>`M0 ${i*2.5} l2 1.25 l-2 1.25`).join(' ')} ${[...Array(40).keys()].map(i=>`M100 ${i*2.5} l-2 1.25 l2 1.25`).join(' ')}" fill="${pal.t}" opacity=".85"/>`;
 if(full)g+=`<rect x="0" y="0" width="100" height="100" fill="${A.photoURL?'url(#ph10)':pal.b}"/><rect x="0" y="0" width="100" height="100" fill="#fff" opacity="${A.photoURL?.38:0}"/>`;
 if(mid)g+=`<rect x="${mx}" y="${mx}" width="${mw}" height="${mw}" fill="${A.photoURL?'url(#ph10)':pal.b}"/>`;
 for(let n=1;n<=E;n++){const p=SL.rc(n),x=p.c*s,y=(Nn-1-p.r)*s,inMid=mid&&p.c>=m0&&p.c<=m1&&p.r>=m0&&p.r<=m1,kept=full&&A.keep.includes(p.r*Nn+p.c);
  g+=tile(x,y,s,full||inMid?'none':art?'rgba(255,255,255,.14)':pal.four?[pal.a,pal.b,pal.c3,pal.c4][((n*2654435761)>>>0)%4]:(p.c+p.r)%2?pal.b:pal.a,pal,inMid);
  const dec=decoList();
  const freeCell=!inMid&&!(B.S&&B.S[n])&&n!==1&&n!==E&&!B.L[n]&&!B.R[n]&&!Object.values(B.L).includes(n)&&!Object.values(B.R).includes(n);
  if(art&&freeCell&&((n*7919)%9)<2){const im=art.deco[(n*31)%art.deco.length];g+=`<image href="${im}" x="${x+s*.18}" y="${y+s*.34}" width="${s*.64}" height="${s*.6}" preserveAspectRatio="xMidYMid meet"/>`;}
  else if(dec.length&&!art&&freeCell&&((n*7919)%5)<2)g+=`<image href="${FLI(dec[(n*31)%dec.length])}" x="${x+s*.22}" y="${y+s*.36}" width="${s*.56}" height="${s*.56}" preserveAspectRatio="xMidYMid meet"/>`;
  else if(pal.m&&!dec.length&&!inMid&&!full&&!(B.S&&B.S[n])&&n!==1&&n!==E&&((n*7919)%7)<2)g+=motif(pal.m,x,y,s,pal.d);
  if(kept)g+=`<rect x="${x+.4}" y="${y+.4}" width="${s-.8}" height="${s-.8}" rx="1" fill="none" stroke="${pal.l}" stroke-width=".6" stroke-dasharray="1.5 1"/>`;
  top+=numLabel(n,x,y,s,pal);
  if(n===E||n===1){const lab=n===E?'סיום':'התחלה',cx=x+s*.62,cy=y+s*(A.numPos==='center'?.8:.68),rr=s*.21;top+=`<image href="${FLI(n===E?'trophy':'chequered_flag')}" x="${x+s*.05}" y="${y+s*.42}" width="${s*.36}" height="${s*.36}"/><circle cx="${cx}" cy="${cy}" r="${rr}" fill="${n===E?pal.l:pal.d}" stroke="#fff" stroke-width="${s*.03}"/><text x="${cx}" y="${cy+rr*.38}" font-size="${rr*(n===E?.9:.58)}" text-anchor="middle" font-family="Secular One,sans-serif" fill="#fff">${lab}</text>`;}
  if(B.S&&B.S[n]){const q=sqOf(B.S[n]),bx=x+s*.76,by=y+s*.77;if(q)top+=A.numPos==='center'?`<g transform="translate(${bx} ${by}) scale(${.072*s}) translate(${-bx} ${-by})">${badge([bx,by],q,pal,10,n)}</g>`:badge([x+s/2,y+s*.62],q,pal,s,n);}}
 if(mid)g+=`<rect x="${mx}" y="${mx}" width="${mw}" height="${mw}" fill="none" stroke="${pal.l}" stroke-width=".8"/>`;
 for(const a in B.L)g+=ladder(ctr(+a),ctr(B.L[a]),pal);
 for(const a in B.R)g+=down(ctr(+a),ctr(B.R[a]),pal,+a);
 const bgA=A.bg!=='off'&&BGS[A.preset]&&!full;const vb=bgA?'-15.8 -15.8 131.6 131.6':A.frame?'-3 -3 106 106':'0 0 100 100';if(bgA)g=`<image href="${BGS[A.preset]}" x="-15.8" y="-15.8" width="131.6" height="131.6" preserveAspectRatio="none"/><rect x="-.6" y="-.6" width="101.2" height="101.2" rx="1.2" fill="${A.preset==='space'?'#0b1340':'#fff'}" opacity=".55"/>`+g;
 const out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="לוח סולמות וחבלים"><defs>${defs}</defs>${A.frame?`<rect x="-3" y="-3" width="106" height="106" fill="${pal.a}"/>`:''}${g}${top}${HEADTOP}</svg>`;if(sel){$(sel).innerHTML=out;if(sel==='#bd')snTouch();}return out;}
function numLabel(n,x,y,s,pal){const k=s/10,bg=A.numBg||'white',f=`'${A.numFont}',Heebo,sans-serif`;
 const fillBg=bg==='pal'?pal.d:bg==='dark'?'#1c2333':'#fff',col=A.numColor||(bg==='pal'||bg==='dark'?'#fff':pal.t);
 if(A.numPos==='center'){const t=`<text x="${x+s/2}" y="${y+s*.56}" font-size="${(n>=100?3.4:4.4)*k}" text-anchor="middle" font-family="${f}" font-weight="700" fill="${col}" ${bg==='none'?`stroke="${pal.b}" stroke-width="${.9*k}" paint-order="stroke" stroke-linejoin="round"`:''}>${n}</text>`;
  return bg==='none'?t:`<rect x="${x+1.6*k}" y="${y+1.4*k}" width="${s-3.2*k}" height="${s-2.8*k}" rx="${1.2*k}" fill="${fillBg}" opacity=".92"/>`+t;}
 const w=(n>=100?6:n>=10?5:3.6)*k;
 if(bg==='none')return `<text x="${x+(.5*k+w/2)}" y="${y+3.1*k}" font-size="${2.9*k}" text-anchor="middle" font-family="${f}" font-weight="700" fill="${col}" stroke="${pal.b}" stroke-width="${.7*k}" paint-order="stroke" stroke-linejoin="round">${n}</text>`;
 return `<rect x="${x+.5*k}" y="${y+.5*k}" width="${w}" height="${3.4*k}" rx="${.7*k}" fill="${fillBg}" opacity=".92"/><text x="${x+(.5*k+w/2)}" y="${y+3.1*k}" font-size="${2.9*k}" text-anchor="middle" font-family="${f}" font-weight="700" fill="${col}">${n}</text>`;}
function badge([cx,cy],q,pal,s=10,n=0){const c=q.color||(q.key==='t'?pal.l:pal.d),k=s/10,ch=q.sym||'★';
 if(A.preset==='vintage'&&(q.key==='q'||q.key==='t')&&!q.img){const r=3.3*k;return `<image href="snakes/vintage/${q.key==='q'?'note_q':'note_x'}.png" x="${cx-r}" y="${cy-r}" width="${2*r}" height="${2*r}" transform="rotate(-6 ${cx} ${cy})"/>`;}
 if(q.icon&&!q.img){const r=3.2*k;return `<circle cx="${cx}" cy="${cy}" r="${r+.4*k}" fill="#fff" opacity=".85"/><image href="${FLI(q.icon)}" x="${cx-r}" y="${cy-r}" width="${2*r}" height="${2*r}"/>`;}
 if(q.img){const r=3.2*k,id='cp'+n;return `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r+.5*k}" fill="#fff"/><image href="${q.img}" x="${cx-r}" y="${cy-r}" width="${2*r}" height="${2*r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${.5*k}"/>`;}
 if(A.badge==='fill')return `<rect x="${cx-s/2+.9*k}" y="${cy-s/2+4.2*k}" width="${s-1.8*k}" height="${s-5.1*k}" rx="${1*k}" fill="${c}" opacity=".9"/><text x="${cx}" y="${cy+2.6*k}" font-size="${4.8*k}" text-anchor="middle" font-family="Secular One,sans-serif" fill="#fff">${ch}</text>`;
 if(A.badge==='note'){const r=3.1*k;return `<g transform="rotate(-8 ${cx} ${cy})"><rect x="${cx-r}" y="${cy-r}" width="${2*r}" height="${2*r}" fill="#fff6c2" stroke="#d9c25a" stroke-width="${.35*k}"/><path d="M${cx+r} ${cy+r-1.4*k} l${-1.4*k} ${1.4*k} v${-1.4*k} z" fill="#e8d47a"/><text x="${cx}" y="${cy+1.5*k}" font-size="${4.4*k}" text-anchor="middle" font-family="Secular One,sans-serif" fill="${c}">${ch}</text></g>`;}
 return `<circle cx="${cx}" cy="${cy}" r="${2.7*k}" fill="#fff" stroke="${c}" stroke-width="${.5*k}"/><text x="${cx}" y="${cy+1.5*k}" font-size="${4.4*k}" text-anchor="middle" font-family="Secular One,sans-serif" fill="${c}">${ch}</text>`;}
let HEADTOP=''; // ראשי נחש שמצוירים מעל שכבת המספרים
let LK=1; // קנה מידה של עובי הקווים לפי גודל המשבצת (לוח 36 → קווים עבים יותר)
function ladder([x1,y1],[x2,y2],pal){if(A.ladder==='art'&&LADS[A.preset])return artLadder([x1,y1],[x2,y2],LADS[A.preset]);const art=A.art&&ART[A.art];if(art){const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy)+2*LK,w=3.6*LK,ang=Math.atan2(dy,dx)*180/Math.PI-90,cx=(x1+x2)/2,cy=(y1+y2)/2,id='ld'+Math.round(x1*7+y1*13+l);
  return `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" x="${cx-w/2}" y="${cy-l/2}" width="${w}" height="${w/art.ladderAspect}"><image href="${art.ladder}" x="0" y="0" width="${w}" height="${w/art.ladderAspect}" preserveAspectRatio="none"/></pattern></defs><rect x="${cx-w/2}" y="${cy-l/2}" width="${w}" height="${l}" fill="url(#${id})" transform="rotate(${ang} ${cx} ${cy})"/>`;}
 const K=LK,dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy),nx=-dy/l*1.6*K,ny=dx/l*1.6*K,st=A.ladder;let g='';
 const col=st==='neon'?['#e63946','#2a9d8f','#f4a261','#8338ec','#06d6a0'][Math.round(x1*7+y1*3)%5]:st==='rope'?'#8b5a2b':pal.l;
 const rail=(sg,w,c,dash)=>`<line x1="${x1+sg*nx}" y1="${y1+sg*ny}" x2="${x2+sg*nx}" y2="${y2+sg*ny}" stroke="${c}" stroke-width="${w*K}" stroke-linecap="round"${dash?` stroke-dasharray="${1.2*K} ${.8*K}"`:''}/>`;
 g+=rail(1,2.3,'#fff')+rail(-1,2.3,'#fff')+rail(1,1.1,col,st==='rope')+rail(-1,1.1,col,st==='rope');
 const k=Math.max(2,Math.round(l/(3.2*K)));for(let i=1;i<k;i++){const cx=x1+dx*i/k,cy=y1+dy*i/k;g+=`<line x1="${cx+nx}" y1="${cy+ny}" x2="${cx-nx}" y2="${cy-ny}" stroke="#fff" stroke-width="${1.8*K}"/><line x1="${cx+nx}" y1="${cy+ny}" x2="${cx-nx}" y2="${cy-ny}" stroke="${st==='rope'?'#8b5a2b':col}" stroke-width="${(st==='rope'?.7:.9)*K}"/>`;}
 return g;}
// ירידה בצורת S: עקומה אחת שיוצאת מהראש, מתנדנדת פעם לכל צד, ונוחתת בזנב. נשארת בתוך רצועת המסלול
function sPath([x1,y1],[x2,y2],amp,seed){const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l,sgn=seed%2?1:-1,a=Math.min(amp*LK,l/4);
 return `M${x1} ${y1} C${x1+dx*.3+nx*a*sgn} ${y1+dy*.3+ny*a*sgn} ${x1+dx*.7-nx*a*sgn} ${y1+dy*.7-ny*a*sgn} ${x2} ${y2}`;}
function bez([x1,y1],[x2,y2],amp,seed){const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l,sgn=seed%2?1:-1,a=Math.min(amp*LK,l/4);
 const P=[[x1,y1],[x1+dx*.3+nx*a*sgn,y1+dy*.3+ny*a*sgn],[x1+dx*.7-nx*a*sgn,y1+dy*.7-ny*a*sgn],[x2,y2]];
 const pt=t=>{const u=1-t;return[u*u*u*P[0][0]+3*u*u*t*P[1][0]+3*u*t*t*P[2][0]+t*t*t*P[3][0],u*u*u*P[0][1]+3*u*u*t*P[1][1]+3*u*t*t*P[2][1]+t*t*t*P[3][1]];};
 const pts=[];for(let i=0;i<=60;i++)pts.push(pt(i/60));return pts;}
function artSnake([x1,y1],[x2,y2],seed,art){const pts=bez([x1,y1],[x2,y2],3,seed),th=3.2*LK;let g='';
 const segs=pts.length-1,lens=[];let total=0;for(let i=0;i<segs;i++){const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);lens.push(l);total+=l;}
 const hh=th*3.3,hw=hh*art.headAspect,tl=Math.min(th*4.5,total*.35),tw=th*1.45;
 let acc=0;for(let i=0;i<segs;i++){const [ax,ay]=pts[i],[bx,by]=pts[i+1],l=lens[i],ang=Math.atan2(by-ay,bx-ax)*180/Math.PI;
  if(acc>th*.1&&acc<total-tl*.9){g+=`<image href="${art.body}" x="${ax-.15}" y="${ay-th/2}" width="${l+.3}" height="${th}" preserveAspectRatio="none" transform="rotate(${ang} ${ax} ${ay})"/>`;}acc+=l;}
 const n=pts.length-1,[tx,ty]=pts[n],[px,py]=pts[n-6],tang=Math.atan2(ty-py,tx-px),tface=tang+Math.PI,tflip=Math.cos(tface)<0?-1:1;
 g+=`<image href="${art.tail}" x="${tx-tl}" y="${ty-tw/2}" width="${tl}" height="${tw}" preserveAspectRatio="none" transform="translate(${tx} ${ty}) rotate(${tface*180/Math.PI}) scale(1 ${tflip}) translate(${-tx} ${-ty})"/>`;
 const [hx,hy]=pts[0],[qx,qy]=pts[6],hang=Math.atan2(qy-hy,qx-hx)*180/Math.PI,rot=hang-90,flip=Math.cos(rot*Math.PI/180)<0?-1:1; // בתמונה: הצוואר יוצא למטה (+y), הראש פונה ימינה-למעלה
 g+=`<image href="${art.head}" x="${hx-hw*.27}" y="${hy-hh}" width="${hw}" height="${hh}" preserveAspectRatio="none" transform="translate(${hx} ${hy}) rotate(${rot}) scale(${flip} 1) translate(${-hx} ${-hy})"/>`;
 return g;}
function down([x1,y1],[x2,y2],pal,seed=0){if(A.down==='snake'&&HEADS[A.preset])return headSnake([x1,y1],[x2,y2],seed,HEADS[A.preset]);const art=A.art&&ART[A.art];if(art)return artSnake([x1,y1],[x2,y2],seed,art);const K=LK,dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l,c=pal.d,ang=Math.atan2(dy,dx)*180/Math.PI;
 if(A.down==='slide'){const d=sPath([x1,y1],[x2,y2],2.2,seed);return `<path d="${d}" fill="none" stroke="#fff" stroke-width="${4.8*K}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${3.4*K}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${1*K}" stroke-linecap="round"/><rect x="${-2.4*K}" y="${-1*K}" width="${4.8*K}" height="${2*K}" rx="${.6*K}" fill="${c}" transform="translate(${x1} ${y1}) rotate(${ang})"/><ellipse cx="${x2}" cy="${y2+1*K}" rx="${2.6*K}" ry="${1.1*K}" fill="${c}" opacity=".5"/>`;}
 if(A.down==='snake'){const d=sPath([x1,y1],[x2,y2],3,seed),tx=x1-dx/l*2.4*K,ty=y1-dy/l*2.4*K;
  return `<path d="${d}" fill="none" stroke="#fff" stroke-width="${3.8*K}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${2.5*K}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${.7*K}" stroke-dasharray="${1.4*K} ${1.4*K}"/><ellipse cx="${x1}" cy="${y1}" rx="${2.4*K}" ry="${1.8*K}" fill="${c}" transform="rotate(${ang} ${x1} ${y1})"/><circle cx="${x1+nx*.8*K-dx/l*.5*K}" cy="${y1+ny*.8*K-dy/l*.5*K}" r="${.45*K}" fill="#fff"/><circle cx="${x1-nx*.8*K-dx/l*.5*K}" cy="${y1-ny*.8*K-dy/l*.5*K}" r="${.45*K}" fill="#fff"/><path d="M${tx} ${ty} l${(-dx/l*1.2+nx*.6)*K} ${(-dy/l*1.2+ny*.6)*K} M${tx} ${ty} l${(-dx/l*1.2-nx*.6)*K} ${(-dy/l*1.2-ny*.6)*K}" stroke="#e63946" stroke-width="${.4*K}" fill="none"/>`;}
 const d=sPath([x1,y1],[x2,y2],2.4,seed);
 return `<path d="${d}" fill="none" stroke="#fff" stroke-width="${2.6*K}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${1.2*K}" stroke-linecap="round" stroke-dasharray="${2.2*K} ${1.1*K}"/><circle cx="${x1}" cy="${y1}" r="${1.5*K}" fill="#fff" stroke="${c}" stroke-width="${.7*K}"/><circle cx="${x2}" cy="${y2}" r="${1.2*K}" fill="${c}"/>`;}

// ── חיבור לסטודיו ──
function snScroll(){if(HOST&&HOST.scrollIntoView)HOST.scrollIntoView({behavior:'smooth',block:'start'});}
function snSync(){A=SN;if(!A.preset)A.preset='classic';if(A.P)P=A.P;if(A.board)B=A.board;if(!Array.isArray(A.sq))A.sq=[];if(!Array.isArray(A.keep))A.keep=[];if(!Array.isArray(A.cards))A.cards=[];}
let _touchT=0;function snTouch(){A.P=P;A.board=B;A.screen=mode;clearTimeout(_touchT);_touchT=setTimeout(()=>{if(typeof rerender==='function')rerender();},30);}
// ── רסטר: ה-SVG של הלוח (עם תמונות ופונטים מוטמעים) → תמונה אחת לתצוגה ול-PDF ──
const _assetCache=new Map();
function snDataURL(url){if(_assetCache.has(url))return _assetCache.get(url);const p=fetch(url).then(r=>{if(!r.ok)throw new Error(url);return r.blob();}).then(b=>new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.readAsDataURL(b);}));_assetCache.set(url,p);return p;}
const _fontCache=new Map();
function snFontCSS(fam){if(_fontCache.has(fam))return _fontCache.get(fam);
 const p=(async()=>{try{const css=await (await fetch('https://fonts.googleapis.com/css2?family='+encodeURIComponent(fam).replace(/%20/g,'+')+':wght@400;700&display=swap')).text();
  const blocks=[...css.matchAll(/\/\*\s*(hebrew|latin)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)];let out='';
  for(const m of blocks){const b=m[2],u=(b.match(/url\(([^)]+)\)/)||[])[1];if(!u)continue;const d=await snDataURL(u.replace(/["']/g,''));out+='@font-face{'+b.replace(/url\([^)]+\)/,'url('+d+')')+'}';}
  return out;}catch(e){return '';}})();
 _fontCache.set(fam,p);return p;}
let _raster={key:'',img:null,busy:false,pending:false};
async function snRasterize(svg){const urls=[...new Set([...svg.matchAll(/href="(snakes\/[^"]+)"/g)].map(m=>m[1]))];const map={};await Promise.all(urls.map(async u=>{try{map[u]=await snDataURL(u);}catch(e){map[u]='';}}));
 let s=svg.replace(/href="(snakes\/[^"]+)"/g,(m,u)=>'href="'+(map[u]||'')+'"');
 const fams=[...new Set([A.numFont||'Heebo','Heebo','Secular One'])];const fcss=(await Promise.all(fams.map(snFontCSS))).join('');
 s=s.replace('<defs>','<defs><style>'+fcss+'</style>');
 const W=3000,img=new Image();const url=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'}));
 await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
 const c=document.createElement('canvas');c.width=W;c.height=W;c.getContext('2d').drawImage(img,0,0,W,W);URL.revokeObjectURL(url);return c;}
function snReady(){return new Promise(res=>{const tick=()=>{const im=snRaster();if(im)res(im);else setTimeout(tick,120);};tick();});}
function snRaster(){const svg=draw(null,10);if(svg===_raster.key&&_raster.img)return _raster.img;
 if(_raster.busy){_raster.pending=true;return _raster.key===svg?_raster.img:null;}
 _raster.busy=true;snRasterize(svg).then(c=>{_raster={key:svg,img:c,busy:false,pending:false};if(typeof rerender==='function')rerender();}).catch(e=>{console.warn('רסטר הלוח נכשל',e);_raster.busy=false;});
 return null;}
const SN_BOARD={blankW:260,blankH:265,diy:190,card:{w:63,h:88,r:3}}; // לוח לודו זיקית 8805 (שני חצאים 13×26.5) או דף A4
function snDrawBoard(ctx,W){const im=snRaster();if(im){ctx.drawImage(im,0,0,W,W);return;}ctx.fillStyle='#f1ecdd';ctx.fillRect(0,0,W,W);ctx.fillStyle='#14294D';ctx.font=(W*.05)+'px Heebo';ctx.textAlign='center';ctx.fillText('מצייר את הלוח…',W/2,W/2);}
function snBoardItem(W){return{w:W,h:W,pts:shapePts('rect',W,W),draw(ctx){snDrawBoard(ctx,W);}};}
function snHalf(kk){const W=SN_BOARD.blankW,H=SN_BOARD.blankH,hw=W/2;return{w:hw,h:H,pts:shapePts('rect',hw,H),draw(ctx){ctx.save();ctx.beginPath();ctx.rect(0,0,hw,H);ctx.clip();ctx.translate(-kk*hw,(H-W)/2);snDrawBoard(ctx,W);ctx.restore();}};}
function snCardItem(c,i){const d=SN_BOARD.card,pts=shapePts('rounded',d.w,d.h,d.r),pal=PALS[A.pal]||PALS.navy,col={q:pal.d,t:pal.l,a:'#2f6b3a'}[c.type],sym={q:'?',t:'!',a:'★'}[c.type];
 return{w:d.w,h:d.h,pts,draw(ctx){const P=pathOf(pts),{w,h}=d;ctx.save();ctx.clip(P);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);const bh=h*.12;ctx.fillStyle=col;ctx.fillRect(0,0,w,bh);
  drawTextBox(ctx,CTYPES[c.type],{family:'Secular One',weight:400,color:'#fff',x:w*.08,y:bh*.15,w:w*.6,h:bh*.7,maxLines:1});drawTextBox(ctx,sym,{family:'Secular One',weight:400,color:'#fff',x:w*.72,y:bh*.05,w:w*.22,h:bh*.9,maxLines:1});
  drawTextBox(ctx,c.text||'',{family:A.cardFont||'Heebo',weight:500,color:'#1a1a1a',x:w*.08,y:bh+h*.1,w:w*.84,h:h*.62,maxLines:7});
  drawTextBox(ctx,'עיצובישי',{family:'Secular One',weight:400,color:'#8d93a3',x:w*.2,y:h*.9,w:w*.6,h:h*.06,maxLines:1});
  ctx.restore();ctx.strokeStyle=col;ctx.lineWidth=.6;ctx.stroke(P);}};}
function snEnsureStyle(){if(document.getElementById('sn-style'))return;const st=document.createElement('style');st.id='sn-style';st.textContent=SN_CSS;document.head.appendChild(st);}
function snHost(){snEnsureStyle();HOST=document.createElement('div');HOST.id='sn-app';HOST.addEventListener('click',()=>setTimeout(snTouch,0),true);HOST.addEventListener('input',()=>setTimeout(snTouch,0),true);
 syncSize();mode=A.screen||mode;if(!(B&&P))mode='home';if(mode==='cards')renderCards();else if(mode==='result')renderResult();else if(mode==='style')renderStyle();else if(mode==='game')renderGame();else renderHome();return HOST;}
window.SN_DEFAULTS=SN_DEFAULTS;
window.Snakes={id:'snakes',printShop:false,adminOnly:false,label:'🪜 סולמות וחבלים',
 intro:'🪜 בוחרים לוח וצבעים, סולמות ונחשים, עונים על שאלות המשחק — והמחולל מסדר את הלוח לפי סטטיסטיקה. אחר כך משדרגים: קלפים, משבצות משלכם, תמונה.',
 fonts:()=>[A&&A.numFont,A&&A.cardFont,'Secular One','Heebo'],
 ready(){snSync();return snReady();},
 build(){snSync();if(!B){P=P||{...TPL.family.P};syncSize();B=SL.generate({...P,specials:sqSpecials()});A.board=B;A.P=P;}
  const items=A.mode==='blank'?[snHalf(0),snHalf(1)]:[snBoardItem(SN_BOARD.diy)];
  const r=paginate(items,{allowRot:false,label:'לוח'});if(A.mode==='blank')r.pages.forEach(p=>p.cut=false);
  if(A.cards.length){const pc=paginate(A.cards.map(snCardItem),{allowRot:false,label:'קלפים'});r.pages=r.pages.concat(pc.pages);}
  r.summary=(A.mode==='blank'?'לוח לודו 8805 בשני חצאים · ':'לוח 19×19 ס"מ על A4 · ')+(A.cards.length?A.cards.length+' קלפים':'בלי קלפים')+' · '+SIZES[A.size];return r;},
 panel(){snSync();return[snHost(),
  sec('🖨️ על מה מדפיסים',false,seg(A,'mode',[['blank','🪵 לוח לודו מוכן 8805 (26×26.5)'],['diy','✂️ דף A4 — אני גוזר']]),
   el('p',{class:'hint'},A.mode==='blank'?'הלוח בשני חצאים 13×26.5 ס"מ לסובלימציה על לוח הלודו של זיקית. הקלפים 63×88 בדפים נפרדים.':'לוח 19×19 ס"מ על דף A4 אחד, והקלפים 63×88 בדפים נפרדים.'),
   A.cards.length?fontSel(A,'cardFont','פונט הקלפים',()=>(A.cards[0]||{}).text||'שאלה'):null,
   A.mode==='blank'&&isAdmin?[tog(A,'mirror','הפוך במראה (לנייר סובלימציה)'),el('button',{type:'button',class:'btn gold',on:{click:()=>sublimationSheetsPDF([snHalf(0),snHalf(1)],'snakes-8805',{mirror:A.mirror})}},'⬇️ קובץ לסובלימציה (הלוח)')]:null),
  sec('איך משחקים',false,el('div',{class:'rules'},
   el('p',{},el('b',{},'המטרה: '),'להגיע ראשונים ל-'+(A.size*A.size)+'.'),
   el('p',{},el('b',{},'משחקים: '),'מטילים '+(A.dice==='one'?'קובייה':'שתי קוביות')+' ומתקדמים. תחתית סולם — מטפסים לראשו. ראש '+({rope:'חבל',slide:'מגלשה',snake:'נחש'})[A.down]+' — יורדים לסופו.'+A.sq.map(q=>' משבצת '+(q.sym||'★')+' ('+(q.name||'')+') — '+ruleText(q.rule)+'.').join('')),
   el('p',{},el('b',{},'סיום: '),({over:'מי שעובר את הסוף ניצח.',exact:'צריך להגיע בדיוק לסוף; מי שעובר נשאר במקום.',bounce:'מי שעובר את הסוף קופץ אחורה בעודף.'})[A.end]))),
  A.mode==='blank'?null:printSection()];}
};

})();
