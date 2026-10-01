/* ════════════════════════════════════════════════════════════════════════════
   js/lineart.js — ציור קווים מתמונה (משותף: הסטודיו עכשיו, הדאבל בהמשך — אותה שורת טעינה)
   כל הלוגיקה כאן: הורדה+מטמון, Worker, עיבוד, סף. הדף רק מחבר ממשק.

   מודל: Informative Drawings — Caroline Chan, Frédo Durand, Phillip Isola (CVPR 2022).
         רישיון MIT © 2022 Caroline Chan — https://github.com/carolineec/informative-drawings
         גרסת ONNX לדפדפן: josephrocca/image-to-line-art-js → huggingface.co/rocca/informative-drawings-line-art-onnx
         (נעוץ לקומיט + בדיקת SHA-256 אחרי ההורדה).
         ⛔ לא U2-Net Portrait — אומן על APDrawing, רישיון לא-מסחרי.
   מנוע: onnxruntime-web 1.22.0 (MIT © Microsoft) מ-jsdelivr, גרסה נעוצה. Wasm בלבד, חוט אחד
         (GitHub Pages לא שולח COOP/COEP, אז אין SharedArrayBuffer לריבוי חוטים).

   API (window.LineArt):
     run(src, {onProgress, signal, maxSide}) → {gray:Float32Array, w, h, ms, alpha:Uint8ClampedArray|null, aw, ah}
         src = canvas/img. onProgress({phase:'download'|'init'|'process', loaded, total}).
         signal = AbortSignal → ביטול (עוצר הורדה / מסיים את ה-Worker). הגדרות התמונה המקורית לא נוגעות.
     render(res, darkness 0–100, {maxSide}) → canvas שחור-לבן (עם שקיפות אם למקור הייתה)
     isCached() → Promise<boolean>   · heMessage(err) → הודעה בעברית   · device() → תיאור מכשיר לטלמטריה
   ════════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.LineArt)return;
  const ORT_VER='1.22.0',ORT_BASE='https://cdn.jsdelivr.net/npm/onnxruntime-web@'+ORT_VER+'/dist/';
  const ORT_JS=ORT_BASE+'ort.wasm.min.js',WASM_URL=ORT_BASE+'ort-wasm-simd-threaded.wasm';
  const MODEL_COMMIT='d38eccbd448cdcd228fb81d708506e5e60b41ccb';
  const MODEL_URL='https://huggingface.co/rocca/informative-drawings-line-art-onnx/resolve/'+MODEL_COMMIT+'/model.onnx';
  const MODEL_SHA256='1fef40b8f7126d827e30fbebccf95ae9b0b391795df926bf9366a821bad4f498'; // = X-Linked-Etag של Hugging Face
  const CACHE='lineart-v1';           // שינוי גרסת מודל/מנוע = שם מטמון חדש
  // צלע ארוכה לעיבוד, כפולה של 8 (המודל מקטין פי 4 ומגדיל חזרה). זמן ∝ פיקסלים: 512 ≈ 7 שנ' בדסקטופ איטי;
  // בטלפון 384 (≈ 0.56 מהזמן) — האיכות עדיין טובה, ההבדל בקווים דקים מאוד.
  const MAX_SIDE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')?384:512;

  const abortErr=()=>{const e=new Error('aborted');e.name='AbortError';return e;};
  const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');

  // הורדה עם התקדמות + Cache API: בפעם השנייה לא יורד שוב. אם Cache API לא זמין (גלישה בסתר וכו') — רשת בלבד.
  async function fetchCached(url,{onBytes,signal,sha}={}){
    let cache=null;try{cache=await caches.open(CACHE);const hit=await cache.match(url);if(hit){const b=await hit.arrayBuffer();onBytes&&onBytes(b.byteLength,b.byteLength);return b;}}catch(e){cache=null;}
    const r=await fetch(url,{signal,mode:'cors',credentials:'omit'});if(!r.ok)throw new Error('http '+r.status);
    const total=+r.headers.get('content-length')||0;let buf;
    if(r.body&&r.body.getReader){const rd=r.body.getReader(),parts=[];let got=0;
      for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;onBytes&&onBytes(got,total);}
      buf=new Uint8Array(got);let o=0;for(const p of parts){buf.set(p,o);o+=p.length;}buf=buf.buffer;}
    else buf=await r.arrayBuffer();
    if(sha&&crypto.subtle){const h=hex(await crypto.subtle.digest('SHA-256',buf));if(h!==sha)throw new Error('checksum');}
    if(cache)try{await cache.put(url,new Response(buf.slice(0),{headers:{'content-type':'application/octet-stream'}}));}catch(e){} // מכסה מלאה — לא חוסם
    return buf;}

  async function isCached(){try{const c=await caches.open(CACHE);return !!(await c.match(MODEL_URL))&&!!(await c.match(WASM_URL));}catch(e){return false;}}

  // ה-Worker נבנה מטקסט (Blob) כדי שכל הלוגיקה תישאר בקובץ הזה. ort נטען בתוכו מ-jsdelivr.
  const WORKER_SRC=`let session=null;
self.onmessage=async e=>{const m=e.data;try{
  if(m.type==='init'){importScripts(m.ortUrl);ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=m.base;ort.env.wasm.wasmBinary=m.wasm;
    session=await ort.InferenceSession.create(m.model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});postMessage({type:'ready'});}
  else if(m.type==='run'){const t0=performance.now(),inName=session.inputNames[0],outName=session.outputNames[0];
    const res=await session.run({[inName]:new ort.Tensor('float32',m.data,[1,3,m.h,m.w])}),o=res[outName];
    const data=new Float32Array(o.data);postMessage({type:'done',data,w:o.dims[3],h:o.dims[2],ms:performance.now()-t0},[data.buffer]);}
}catch(err){postMessage({type:'error',message:String(err&&err.message||err)});}};`;

  let worker=null,ready=null;
  function kill(){if(worker){try{worker.terminate();}catch(e){}}worker=null;ready=null;}
  function talk(msg,transfer,signal){return new Promise((ok,no)=>{
    const w=worker,onAbort=()=>{kill();no(abortErr());};
    if(signal){if(signal.aborted)return onAbort();signal.addEventListener('abort',onAbort,{once:true});}
    w.onmessage=e=>{signal&&signal.removeEventListener('abort',onAbort);const d=e.data;d.type==='error'?no(new Error(d.message)):ok(d);};
    w.onerror=e=>{signal&&signal.removeEventListener('abort',onAbort);kill();no(new Error(e.message||'worker'));};
    w.postMessage(msg,transfer||[]);});}

  function ensureEngine(onProgress,signal){
    if(ready)return ready;
    const inner=new AbortController();if(signal){if(signal.aborted)inner.abort();else signal.addEventListener('abort',()=>inner.abort(),{once:true});} // כשל באחת ההורדות עוצר גם את השנייה
    ready=(async()=>{
      const prog={wasm:[0,11210254],model:[0,17193338]};
      const tick=()=>onProgress&&onProgress({phase:'download',loaded:prog.wasm[0]+prog.model[0],total:prog.wasm[1]+prog.model[1]});
      const [wasm,model]=await Promise.all([
        fetchCached(WASM_URL,{signal:inner.signal,onBytes:(g,t)=>{prog.wasm=[g,t||prog.wasm[1]];tick();}}),
        fetchCached(MODEL_URL,{signal:inner.signal,sha:MODEL_SHA256,onBytes:(g,t)=>{prog.model=[g,t||prog.model[1]];tick();}})]);
      if(signal&&signal.aborted)throw abortErr();
      onProgress&&onProgress({phase:'init'});
      worker=new Worker(URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'})));
      await talk({type:'init',ortUrl:ORT_JS,base:ORT_BASE,wasm,model},[wasm,model],signal);
    })().catch(e=>{inner.abort();kill();throw e;});
    return ready;}

  const natW=s=>s.naturalWidth||s.videoWidth||s.width,natH=s=>s.naturalHeight||s.videoHeight||s.height;
  function hasAlpha(cv){try{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;for(let i=3;i<d.length;i+=16)if(d[i]<250)return true;}catch(e){}return false;}

  async function run(src,{onProgress,signal,maxSide=MAX_SIDE}={}){
    await ensureEngine(onProgress,signal);
    const sw=natW(src),sh=natH(src),k=Math.min(1,maxSide/Math.max(sw,sh)),r8=v=>Math.max(8,Math.round(v/8)*8);
    const w=r8(sw*k),h=r8(sh*k),cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');
    // שקיפות (אחרי הסרת רקע): נשמרת כמסכה בגודל המקור; המודל מקבל את התמונה על לבן
    const aw=Math.min(sw,1600),ah=Math.round(sh*aw/sw),ac=document.createElement('canvas');ac.width=aw;ac.height=ah;ac.getContext('2d').drawImage(src,0,0,aw,ah);
    let alpha=null;if(hasAlpha(ac)){const d=ac.getContext('2d').getImageData(0,0,aw,ah).data;alpha=new Uint8ClampedArray(aw*ah);for(let i=0;i<alpha.length;i++)alpha[i]=d[i*4+3];}
    x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(src,0,0,w,h);
    const px=x.getImageData(0,0,w,h).data,n=w*h,data=new Float32Array(3*n);
    // מתיחת בהירות (אחוזון 1–99 של הבהירות): בתמונה חשוכה המודל מחזיר קווים חלשים מאוד; בתמונה תקינה כמעט ללא שינוי
    const hist=new Uint32Array(256);for(let i=0;i<n;i++)hist[(px[i*4]*77+px[i*4+1]*150+px[i*4+2]*29)>>8]++;
    let lo=0,hi=255,acc=0;for(let v=0;v<256;v++){acc+=hist[v];if(acc>=n*.01){lo=v;break;}}acc=0;for(let v=255;v>=0;v--){acc+=hist[v];if(acc>=n*.01){hi=v;break;}}
    let sum=0;for(let v=0;v<256;v++)sum+=hist[v]*Math.max(0,Math.min(1,(v-lo)/Math.max(48,hi-lo)));
    // ואם התמונה עדיין חשוכה בממוצע — הרמת גאמה (רק לחשוכות: בממוצע 0.42 ומעלה אין שינוי)
    const mean=sum/n,gm=mean<.42?Math.max(.45,Math.log(.42)/Math.log(Math.max(.05,mean))):1;
    const span=Math.max(48,hi-lo),f=v=>Math.pow(Math.max(0,Math.min(1,(v-lo)/span)),gm);
    for(let i=0;i<n;i++){data[i]=f(px[i*4]);data[n+i]=f(px[i*4+1]);data[2*n+i]=f(px[i*4+2]);}
    onProgress&&onProgress({phase:'process'});
    const out=await talk({type:'run',data,w,h},[data.buffer],signal);
    return{gray:out.data,w:out.w,h:out.h,ms:Math.round(out.ms),alpha,aw,ah,sw,sh};}

  // סף: darkness 0–100 → כמה מהאפור הופך לקו. קצה רך (±0.06) כדי שהקווים לא ייצאו משוננים.
  // ההגדלה לגודל הסופי נעשית על מפת האפור, והסף אחריה — קווים חדים גם בהדפסה.
  function render(res,darkness,{maxSide=1200}={}){
    const g=document.createElement('canvas');g.width=res.w;g.height=res.h;const gx=g.getContext('2d'),gi=gx.createImageData(res.w,res.h);
    for(let i=0;i<res.gray.length;i++){const v=Math.max(0,Math.min(255,res.gray[i]*255));gi.data[i*4]=gi.data[i*4+1]=gi.data[i*4+2]=v;gi.data[i*4+3]=255;}gx.putImageData(gi,0,0);
    const k=Math.min(1,maxSide/Math.max(res.sw,res.sh)),W=Math.max(1,Math.round(res.sw*k)),H=Math.max(1,Math.round(res.sh*k));
    const out=document.createElement('canvas');out.width=W;out.height=H;const ox=out.getContext('2d');ox.imageSmoothingEnabled=true;ox.imageSmoothingQuality='high';ox.drawImage(g,0,0,W,H);
    const id=ox.getImageData(0,0,W,H),d=id.data,t=.35+Math.max(0,Math.min(100,darkness))/100*.6,lo=t-.06,hi=t+.06;
    let A=null;if(res.alpha){const ac=document.createElement('canvas');ac.width=res.aw;ac.height=res.ah;const am=ac.getContext('2d').createImageData(res.aw,res.ah);
      for(let i=0;i<res.alpha.length;i++){am.data[i*4+3]=res.alpha[i];}ac.getContext('2d').putImageData(am,0,0);
      const bc=document.createElement('canvas');bc.width=W;bc.height=H;const bx=bc.getContext('2d');bx.drawImage(ac,0,0,W,H);A=bx.getImageData(0,0,W,H).data;}
    for(let i=0;i<d.length;i+=4){const v=d[i]/255,s=v<=lo?0:v>=hi?1:(v-lo)/(hi-lo),c=Math.round(s*s*(3-2*s)*255);d[i]=d[i+1]=d[i+2]=c;d[i+3]=A?A[i+3]:255;}
    ox.putImageData(id,0,0);return out;}

  function heMessage(err){const m=String(err&&(err.message||err)||'');
    if(err&&err.name==='AbortError')return 'בוטל.';
    if(/memory|allocation|RangeError|OOM/i.test(m))return 'אין מספיק זיכרון במכשיר הזה לציור קווים. נסו תמונה קטנה יותר, או ממחשב.';
    if(/checksum/.test(m))return 'קובץ המודל הגיע פגום. נסו שוב.';
    if(/http|fetch|network|Failed to fetch|Load failed/i.test(m))return 'ההורדה נכשלה — בדקו את החיבור לאינטרנט ונסו שוב.';
    if(/WebAssembly|wasm|worker|import/i.test(m))return 'הדפדפן הזה לא מצליח להריץ ציור קווים. נסו בכרום מעודכן.';
    return 'ציור הקווים נכשל. התמונה המקורית נשארה כמו שהיא.';}
  function device(){const ua=navigator.userAgent||'',mob=/Android|iPhone|iPad|Mobile/i.test(ua);
    return (mob?'mobile':'desktop')+' · '+(navigator.hardwareConcurrency||'?')+' cores'+(navigator.deviceMemory?' · '+navigator.deviceMemory+'GB':'');}

  window.LineArt={run,render,isCached,heMessage,device,cancelAll:kill,MAX_SIDE,
    credits:'ציור קווים: Informative Drawings (Chan, Durand, Isola 2022, MIT) · onnxruntime-web (MIT)'};
})();
