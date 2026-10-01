/* ════════════════════════════════════════════════════════════════════════════
   js/ai-image.js — בינה מלאכותית לתמונות, בדפדפן (משותף; היום רק הסטודיו טוען אותו)
   הסרת רקע אוטומטית + הגדלת תמונה ×4. כל המודלים ברישיון שמתיר שימוש מסחרי.
   נפרד מ-js/lineart.js בכוונה: lineart.js נצרך גם ע"י הדאבל, ושינוי בו מחייב לגעת בדאבל.
   אותו מנוע ואותו דפוס (טעינה בלחיצה, Worker, Cache API, SHA-256, ביטול) — וה-‎.wasm נלקח גם
   מהמטמון של ציור הקווים ('lineart-v1') אם כבר ירד שם, כדי לא להוריד 11MB פעמיים.

   מודלים (כולם מ-Hugging Face, נעוצים לקומיט + בדיקת SHA-256 אחרי ההורדה):
   • אנשים  — MODNet (Ke et al., AAAI 2022), Apache-2.0 — github.com/ZHKKKe/MODNet
               קובץ: Xenova/modnet @fa2fa54 onnx/model_fp16.onnx (12.4MB)
   • חפצים  — U²-Net small (u2netp; Qin et al. 2020), Apache-2.0 — github.com/xuebinqin/U-2-Net
               קובץ: edgetools/u2netp @25dee37 u2netp.onnx (4.4MB) — זהה בבייטים לקובץ של rembg
               (danielgatis/rembg release v0.0.0; SHA-256 309c8469…). ⛔ jilijeanlouis/test-u2net לא זהה — לא להשתמש.
   • הגדלה  — Real-ESRGAN realesr-general-x4v3 (Xintao Wang et al.), BSD-3-Clause — github.com/xinntao/Real-ESRGAN
               קובץ: CoderViking/realesr-general-x4v3-onnx @c6a9717 (4.6MB) — המשקלים זהים (הפרש 0) ל-.pth הרשמי v0.2.5.0.
   מנוע: onnxruntime-web 1.22.0 (MIT © Microsoft), Wasm בחוט אחד.
   ⛔ מודל ברישיון לא-מסחרי (RMBG של Bria, U²-Net Portrait/APDrawing, AnimeGAN…) לא נכנס לכאן.

   API (window.AIImage):
     removeBg(src,{mode:'person'|'object',onProgress,signal}) → canvas בגודל המקור עם שקיפות
     upscale(src,{onProgress,signal}) → canvas ×4 (נחתך לצלע ארוכה UPSCALE_MAX_OUT)
     heMessage(err) · device() · cancelAll() · UPSCALE_MAX_IN
   onProgress({phase:'download'|'init'|'process', loaded,total, done,of})
   ════════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.AIImage)return;
  const ORT_BASE='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',ORT_JS=ORT_BASE+'ort.wasm.min.js',WASM_URL=ORT_BASE+'ort-wasm-simd-threaded.wasm',WASM_SIZE=11210254;
  const HF='https://huggingface.co/';
  const MODELS={
    person:{url:HF+'Xenova/modnet/resolve/fa2fa546052fba4c08921230a26cc69a333fca12/onnx/model_fp16.onnx',sha:'25f165da9bfd30830a575f1f0490f1acd995975cb349bc02f3d79332e1fe5cf6',size:12984781},
    object:{url:HF+'edgetools/u2netp/resolve/25dee37ab19c5b6ad64ba6578eba63f1ae07720c/u2netp.onnx',sha:'309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',size:4574861},
    upscale:{url:HF+'CoderViking/realesr-general-x4v3-onnx/resolve/c6a971706797c7502945a2b4c4274fce4900d4ab/realesr-general-x4v3.onnx',sha:'1940a93ee08283a0a7286183186357b1688fe9fa8ede74604b424586aaddf112',size:4866417}};
  const CACHE='ai-image-v1',CACHES_RO=['lineart-v1']; // שינוי מודל/מנוע = שם מטמון חדש
  const UPSCALE_MAX_IN=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')?400:640,UPSCALE_MAX_OUT=4096,TILE=128,PAD=10; // הגדלה: זמן ∝ פיקסלים — מעבר ל-640 זה דקות בטלפון

  const abortErr=()=>{const e=new Error('aborted');e.name='AbortError';return e;};
  const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function fetchCached(url,{onBytes,signal,sha}={}){
    let cache=null;
    try{cache=await caches.open(CACHE);let hit=await cache.match(url);
      if(!hit)for(const n of CACHES_RO){try{hit=await (await caches.open(n)).match(url);if(hit)break;}catch(e){}}
      if(hit){const b=await hit.arrayBuffer();onBytes&&onBytes(b.byteLength,b.byteLength);return b;}}catch(e){cache=null;}
    const r=await fetch(url,{signal,mode:'cors',credentials:'omit'});if(!r.ok)throw new Error('http '+r.status);
    const total=+r.headers.get('content-length')||0;let buf;
    if(r.body&&r.body.getReader){const rd=r.body.getReader(),parts=[];let got=0;
      for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;onBytes&&onBytes(got,total);}
      buf=new Uint8Array(got);let o=0;for(const p of parts){buf.set(p,o);o+=p.length;}buf=buf.buffer;}
    else buf=await r.arrayBuffer();
    if(sha&&crypto.subtle){const h=hex(await crypto.subtle.digest('SHA-256',buf));if(h!==sha)throw new Error('checksum');}
    if(cache)try{await cache.put(url,new Response(buf.slice(0),{headers:{'content-type':'application/octet-stream'}}));}catch(e){}
    return buf;}

  // Worker אחד, כמה sessions (אחד לכל מודל שנטען)
  const WORKER_SRC=`const S={};let inited=false;
self.onmessage=async e=>{const m=e.data;try{
  if(m.type==='init'){if(!inited){importScripts(m.ortUrl);ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=m.base;ort.env.wasm.wasmBinary=m.wasm;inited=true;}postMessage({type:'ok'});}
  else if(m.type==='load'){if(!S[m.key])S[m.key]=await ort.InferenceSession.create(m.model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});postMessage({type:'ok'});}
  else if(m.type==='run'){const s=S[m.key],t0=performance.now();const res=await s.run({[s.inputNames[0]]:new ort.Tensor('float32',m.data,m.dims)});const o=res[s.outputNames[0]];
    const data=new Float32Array(o.data);postMessage({type:'done',data,dims:o.dims,ms:performance.now()-t0},[data.buffer]);}
}catch(err){postMessage({type:'error',message:String(err&&err.message||err)});}};`;
  let worker=null,inited=null;const loaded={};
  function kill(){if(worker){try{worker.terminate();}catch(e){}}worker=null;inited=null;for(const k in loaded)delete loaded[k];}
  function talk(msg,transfer,signal){return new Promise((ok,no)=>{const w=worker,onAbort=()=>{kill();no(abortErr());};
    if(signal){if(signal.aborted)return onAbort();signal.addEventListener('abort',onAbort,{once:true});}
    w.onmessage=e=>{signal&&signal.removeEventListener('abort',onAbort);const d=e.data;d.type==='error'?no(new Error(d.message)):ok(d);};
    w.onerror=e=>{signal&&signal.removeEventListener('abort',onAbort);kill();no(new Error(e.message||'worker'));};
    w.postMessage(msg,transfer||[]);});}
  async function ensure(key,onProgress,signal){
    if(loaded[key])return loaded[key];
    const M=MODELS[key],inner=new AbortController();if(signal){if(signal.aborted)throw abortErr();signal.addEventListener('abort',()=>inner.abort(),{once:true});}
    const p=(async()=>{
      const prog={w:[0,inited?0:WASM_SIZE],m:[0,M.size]},tick=()=>onProgress&&onProgress({phase:'download',loaded:prog.w[0]+prog.m[0],total:prog.w[1]+prog.m[1]});
      const [wasm,model]=await Promise.all([inited?null:fetchCached(WASM_URL,{signal:inner.signal,onBytes:(g,t)=>{prog.w=[g,t||prog.w[1]];tick();}}),
        fetchCached(M.url,{signal:inner.signal,sha:M.sha,onBytes:(g,t)=>{prog.m=[g,t||prog.m[1]];tick();}})]);
      onProgress&&onProgress({phase:'init'});
      if(!worker)worker=new Worker(URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'})));
      if(!inited){inited=talk({type:'init',ortUrl:ORT_JS,base:ORT_BASE,wasm},[wasm],signal);}
      await inited;await talk({type:'load',key,model},[model],signal);})().catch(e=>{inner.abort();delete loaded[key];throw e;});
    loaded[key]=p;return p;}

  const natW=s=>s.naturalWidth||s.videoWidth||s.width,natH=s=>s.naturalHeight||s.videoHeight||s.height;
  function canvasOf(src,w,h,fill){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');if(fill){x.fillStyle=fill;x.fillRect(0,0,w,h);}x.imageSmoothingQuality='high';x.drawImage(src,0,0,w,h);return c;}
  function toCHW(c,norm){const w=c.width,h=c.height,px=c.getContext('2d').getImageData(0,0,w,h).data,n=w*h,d=new Float32Array(3*n);
    for(let i=0;i<n;i++)for(let ch=0;ch<3;ch++)d[ch*n+i]=norm(px[i*4+ch]/255,ch);return d;}

  // הסרת רקע: מסכה מהמודל → הגדלה חלקה לגודל המקור → ערוץ שקיפות. אנשים = MODNet (עד 512, כפולה של 32); חפצים = u2netp (320×320 קבוע).
  async function removeBg(src,{mode='person',onProgress,signal}={}){
    const key=mode==='object'?'object':'person';await ensure(key,onProgress,signal);
    const sw=natW(src),sh=natH(src);let w,h,data;
    if(key==='person'){const k=512/Math.max(sw,sh),r32=v=>Math.max(32,Math.round(v/32)*32);w=r32(sw*k);h=r32(sh*k);data=toCHW(canvasOf(src,w,h,'#fff'),v=>(v-.5)/.5);}
    else{w=h=320;const M=[.485,.456,.406],S=[.229,.224,.225];data=toCHW(canvasOf(src,w,h,'#fff'),(v,ch)=>(v-M[ch])/S[ch]);}
    onProgress&&onProgress({phase:'process'});
    const out=await talk({type:'run',key,data,dims:[1,3,h,w]},[data.buffer],signal);let m=out.data;
    if(key==='object'){let lo=1e9,hi=-1e9;for(const v of m){if(v<lo)lo=v;if(v>hi)hi=v;}const s=1/Math.max(1e-6,hi-lo);m=m.map(v=>(v-lo)*s);}
    const mw=out.dims[3],mh=out.dims[2],mc=document.createElement('canvas');mc.width=mw;mc.height=mh;const mx=mc.getContext('2d'),mi=mx.createImageData(mw,mh);
    for(let i=0;i<mw*mh;i++){const a=Math.max(0,Math.min(255,Math.round(m[i]*255)));mi.data[i*4]=mi.data[i*4+1]=mi.data[i*4+2]=0;mi.data[i*4+3]=a;}mx.putImageData(mi,0,0);
    const res=canvasOf(src,sw,sh),rx=res.getContext('2d');rx.globalCompositeOperation='destination-in';rx.imageSmoothingQuality='high';rx.drawImage(mc,0,0,sw,sh);
    return{canvas:res,ms:Math.round(out.ms),model:key};}

  // הגדלה ×4 באריחים (128px + שוליים 10px כדי שלא ייראו תפרים). תמונה גדולה מ-UPSCALE_MAX_IN מוקטנת קודם.
  async function upscale(src,{onProgress,signal}={}){
    await ensure('upscale',onProgress,signal);
    const sw=natW(src),sh=natH(src),k=Math.min(1,UPSCALE_MAX_IN/Math.max(sw,sh)),W=Math.max(1,Math.round(sw*k)),H=Math.max(1,Math.round(sh*k));
    const base=canvasOf(src,W,H),bx=base.getContext('2d'),out=document.createElement('canvas');out.width=W*4;out.height=H*4;const ox=out.getContext('2d');
    const alpha=(()=>{const d=bx.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=16)if(d[i]<250)return true;return false;})();
    const tiles=[];for(let y=0;y<H;y+=TILE)for(let x=0;x<W;x+=TILE)tiles.push([x,y]);let ms=0;
    for(let t=0;t<tiles.length;t++){if(signal&&signal.aborted)throw abortErr();onProgress&&onProgress({phase:'process',done:t,of:tiles.length});
      const [x,y]=tiles[t],x0=Math.max(0,x-PAD),y0=Math.max(0,y-PAD),x1=Math.min(W,x+TILE+PAD),y1=Math.min(H,y+TILE+PAD),tw=x1-x0,th=y1-y0;
      const tc=document.createElement('canvas');tc.width=tw;tc.height=th;const tx=tc.getContext('2d');tx.fillStyle='#fff';tx.fillRect(0,0,tw,th);tx.drawImage(base,x0,y0,tw,th,0,0,tw,th);
      const data=toCHW(tc,v=>v),r=await talk({type:'run',key:'upscale',data,dims:[1,3,th,tw]},[data.buffer],signal);ms+=r.ms;
      const OW=r.dims[3],OH=r.dims[2],img=new ImageData(OW,OH),o=r.data,n=OW*OH;
      for(let i=0;i<n;i++){img.data[i*4]=Math.max(0,Math.min(255,o[i]*255));img.data[i*4+1]=Math.max(0,Math.min(255,o[n+i]*255));img.data[i*4+2]=Math.max(0,Math.min(255,o[2*n+i]*255));img.data[i*4+3]=255;}
      const oc=document.createElement('canvas');oc.width=OW;oc.height=OH;oc.getContext('2d').putImageData(img,0,0);
      const cx=(x-x0)*4,cy=(y-y0)*4,cw=Math.min(TILE,W-x)*4,ch=Math.min(TILE,H-y)*4;ox.drawImage(oc,cx,cy,cw,ch,x*4,y*4,cw,ch);
      await new Promise(r=>setTimeout(r,0));}
    if(alpha){ox.globalCompositeOperation='destination-in';ox.imageSmoothingQuality='high';ox.drawImage(base,0,0,W*4,H*4);ox.globalCompositeOperation='source-over';} // שקיפות נשמרת (אחרי הסרת רקע)
    let res=out;const L=Math.max(out.width,out.height);if(L>UPSCALE_MAX_OUT){const s=UPSCALE_MAX_OUT/L;res=canvasOf(out,Math.round(out.width*s),Math.round(out.height*s));}
    return{canvas:res,ms:Math.round(ms),tiles:tiles.length,inW:W,inH:H};}

  function heMessage(err){const m=String(err&&(err.message||err)||'');
    if(err&&err.name==='AbortError')return 'בוטל.';
    if(/memory|allocation|RangeError|OOM/i.test(m))return 'אין מספיק זיכרון במכשיר הזה. נסו תמונה קטנה יותר, או ממחשב.';
    if(/checksum/.test(m))return 'קובץ המודל הגיע פגום. נסו שוב.';
    if(/http|fetch|network|Failed to fetch|Load failed/i.test(m))return 'ההורדה נכשלה — בדקו את החיבור לאינטרנט ונסו שוב.';
    if(/WebAssembly|wasm|worker|import/i.test(m))return 'הדפדפן הזה לא מצליח להריץ את הכלי. נסו בכרום מעודכן.';
    return 'הפעולה נכשלה. התמונה המקורית נשארה כמו שהיא.';}
  function device(){const ua=navigator.userAgent||'',mob=/Android|iPhone|iPad|Mobile/i.test(ua);
    return (mob?'mobile':'desktop')+' · '+(navigator.hardwareConcurrency||'?')+' cores'+(navigator.deviceMemory?' · '+navigator.deviceMemory+'GB':'');}
  window.AIImage={removeBg,upscale,heMessage,device,cancelAll:kill,UPSCALE_MAX_IN,MODELS,
    credits:'הסרת רקע: MODNet (Apache-2.0) · U²-Net (Apache-2.0) · הגדלה: Real-ESRGAN (BSD-3) · onnxruntime-web (MIT)'};
})();
