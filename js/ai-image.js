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
   • מחיקת חפץ — MI-GAN (Sargsyan et al., ICCV 2023), MIT — github.com/Picsart-AI-Research/MI-GAN
               קובץ: andraniksargsyan/migan @406830d (המחבר עצמו) migan_pipeline_v2.onnx (26.8MB). קלט uint8 תמונה+מסכה, 255=להשאיר 0=למחוק.
   • צביעה  — DDColor tiny (Kang et al., ICCV 2023), Apache-2.0 — github.com/piddnad/DDColor
               קובץ: edgetools/ddcolor @4755ae9 ddcolor-tiny-fp16.onnx (129MB). אומת מול piddnad/ddcolor_paper_tiny (SHA-256 8a1277bc…):
               388/427 טנזורים זהים (fp16), השאר = פיצול q/k/v ונורמליזציות שמתקפלות בייצוא.
   • תיקון פנים — RestoreFormer++ (Wang et al., TPAMI 2023), Apache-2.0 — github.com/wzhouxiff/RestoreFormerPlusPlus
               קובץ: Saimon8420/restoreformer-pp-web @9e5912e int8 (71MB). ⚠️ אומן על FFHQ (NVIDIA, CC BY-NC-SA) — בסטודיו מנהל בלבד (🔒).
   • הגדלה  — Real-ESRGAN realesr-general-x4v3 (Xintao Wang et al.), BSD-3-Clause — github.com/xinntao/Real-ESRGAN
               קובץ: CoderViking/realesr-general-x4v3-onnx @c6a9717 (4.6MB) — המשקלים זהים (הפרש 0) ל-.pth הרשמי v0.2.5.0.
   v3 (02/10/2026):
   • מציאת פנים — YuNet 2023mar (OpenCV Zoo), MIT. opencv/face_detection_yunet @3cc26e7 (230KB) — SHA-256 זהה לקובץ ב-github.com/opencv/opencv_zoo.
   • סגנונות אמנות — Fast Neural Style (Johnson et al. 2016; ONNX Model Zoo), Apache-2.0. onnxmodelzoo/<style>-9 (6.7MB כל אחד) —
               SHA-256 זהה לקבצי github.com/onnx/models. הקובץ נעול ל-224×224: אחרי בדיקת SHA מחליפים 3 בייטים בכל מימד
               (dim_value=224 → denotation "h", אותו אורך) כך שהגובה/רוחב חופשיים. הקיזוזים (STYLE_PATCH) זהים ל-5 הקבצים, ונבדק שהבייטים שם הם 08 E0 01.
               "גשם" (rain-princess) = ציור של Leonid Afremov, מוגן בזכויות יוצרים → מנהל בלבד (🔒).
   • הגדלה לציורים — Real-ESRGAN x4plus_anime_6B, BSD-3. RekluzLabs/realesrgan_anime6b.onnx @d5377ec (18MB) — 192/192 משקלים זהים ל-.pth הרשמי (release v0.2.2.4).
   • הסרת רקע מדויקת — IS-Net general use (DIS, Qin et al. ECCV 2022), Apache-2.0 (המשקלים) / MIT (ההמרה של img.ly). imgly/isnet-general-onnx @440dea9 fp16 (88MB).
               ⛔ BiRefNet lite fp16 נבדק ונופל ב-onnxruntime-web (Wasm) — לא להשתמש.
   ⛔ RMBG-1.4 (BRIA, לא-מסחרי) נבדק: גרסת quantized משאירה כתמים, ו-IS-Net נותן תוצאה נקייה — לא נכנס.
   • 🔒 AnimeGANv2 face_paint_512_v2 (bryandlee, קוד MIT; מקור הנתונים לא ברור) — akhaliq/AnimeGANv2-ONNX @980ee34 (8.6MB). מנהל בלבד.
   מנוע: onnxruntime-web 1.22.0 (MIT © Microsoft), Wasm בחוט אחד.
   ⛔ מודל ברישיון לא-מסחרי נכנס רק עם admin:true, והסטודיו מציג אותו רק למנהל (🔒) — לא ללקוחות ולא להדפסה.

   API (window.AIImage):
     removeBg(src,{mode:'person'|'object',onProgress,signal}) → canvas בגודל המקור עם שקיפות
     upscale(src,{kind:'photo'|'art',onProgress,signal}) → canvas ×4 (נחתך לצלע ארוכה UPSCALE_MAX_OUT)
     removeBg(src,{mode:'person'|'object'|'precise'}) · detectFaces(src) → [{x,y,w,h,score}] בפיקסלים של המקור
     stylize(src,{style}) → canvas · STYLES · inpaint · colorize/colorRender · restoreFace
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
    // v2 (02/10/2026):
    inpaint:{url:HF+'andraniksargsyan/migan/resolve/406830d0fa60666da0071c342ad2fbc8f30c5c64/migan_pipeline_v2.onnx',sha:'6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b',size:28079181},
    color:{url:HF+'edgetools/ddcolor/resolve/4755ae9f1f7a35a9e7693b96c2a88f3432cb6ab0/ddcolor-tiny-fp16.onnx',sha:'2653da00dc15e54a45e5200b61dbf82ee9ceaf56b02bb9b9657569ac775e82e6',size:135444402},
    face:{url:HF+'Saimon8420/restoreformer-pp-web/resolve/9e5912e04026135bc1a7c8557a2da66f521a7b8e/restoreformer_pp_int8w.onnx',sha:'4b3983dba15b8dd26db1bc94be57558ca4d783424ca6f3715676ab53450bcb6c',size:74375477},
    // v3:
    faces:{url:HF+'opencv/face_detection_yunet/resolve/3cc26e7f1014a5ee5d74a42acee58bafc9d0a310/face_detection_yunet_2023mar.onnx',sha:'8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',size:232589},
    precise:{url:HF+'imgly/isnet-general-onnx/resolve/440dea96dd4a3b06bbbf5abec3e26569dd7ec49f/onnx/model_fp16.onnx',sha:'2eb4b5dda7ec41c617e59706e5aafa1f978c9a5f983d2518d9f0ae4d6eb04f20',size:88217533},
    upart:{url:HF+'RekluzLabs/realesrgan_anime6b.onnx/resolve/d5377ec6204295bca15f0a7967579dc5e25e2ae6/realesrgan_anime6b.onnx',sha:'45bd54934aeabe8df744c8fdacb9e8846c9b55cb4e60c499db77405d1625a667',size:18352469},
    s_mosaic:{url:HF+'onnxmodelzoo/mosaic-9/resolve/9a267ba8540fba8fb12bc78f3770e0fd9c923c56/mosaic-9.onnx',sha:'fa646dedade881243f8d5a2ceb7de2b93675b21fc24f7482894ac4851a9a0a47',size:6728029,patch:1},
    s_candy:{url:HF+'onnxmodelzoo/candy-9/resolve/f24fcf558bd4564360f41cf3b5321975a33f962f/candy-9.onnx',sha:'9d11a3529d1e547da6ae07201d93484dbab2ec0a3614535752c8f40f0fe2968a',size:6728029,patch:1},
    s_udnie:{url:HF+'onnxmodelzoo/udnie-9/resolve/ab74109f694dc8117f5e39a8571ac53bf83618f6/udnie-9.onnx',sha:'8656b6ce7dec8f22ee13c2d557d6b67bd6f550dde88d0f2e7c9972aeb765cc0d',size:6728029,patch:1},
    s_pointilism:{url:HF+'onnxmodelzoo/pointilism-9/resolve/d9c3c80c36d238db4155f3029f996ce62b3c101f/pointilism-9.onnx',sha:'5ee2b8d4d6bc60a777f54e0fe96a1b717360a004b79d56c67390d4a975b14d98',size:6728029,patch:1},
    s_rain:{admin:true,url:HF+'onnxmodelzoo/rain-princess-9/resolve/205625e4c00565b6c0946814de6165116b271e58/rain-princess-9.onnx',sha:'4162912e6f75fedef6f810ae989b9e10d3d5d43308dab34b027c850cf255e152',size:6728029,patch:1},
    s_anime:{admin:true,url:HF+'akhaliq/AnimeGANv2-ONNX/resolve/980ee341c8a3b45ae59bb10072a4f0383d96811a/face_paint_512_v2_0.onnx',sha:'1381b17ed988e14a1f3cf8954d88073c0884ff4b70128ebe599f0d6021bca63e',size:8594990},
    upscale:{url:HF+'CoderViking/realesr-general-x4v3-onnx/resolve/c6a971706797c7502945a2b4c4274fce4900d4ab/realesr-general-x4v3.onnx',sha:'1940a93ee08283a0a7286183186357b1688fe9fa8ede74604b424586aaddf112',size:4866417}};
  // סגנונות: הקיזוזים של dim_value=224 (08 E0 01) ב-input1/output1 — זהים בכל 5 הקבצים של ה-Model Zoo
  const STYLE_PATCH=[6725683,6725688,6728017,6728022];
  const STYLES=[{id:'mosaic',he:'פסיפס'},{id:'candy',he:'ממתק'},{id:'udnie',he:'קוביזם (פיקביה)'},{id:'pointilism',he:'נקודות'},{id:'rain',he:'גשם (Afremov)',admin:true},{id:'anime',he:'אנימה — פנים',admin:true}];
  const CACHE='ai-image-v1',CACHES_RO=['lineart-v1']; // שינוי מודל/מנוע = שם מטמון חדש
  const MOB=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||''),UPSCALE_MAX_IN=MOB?400:640,UPSCALE_ART_MAX_IN=MOB?200:320,UPSCALE_MAX_OUT=4096,TILE=128,PAD=10; // הגדלה: זמן ∝ פיקסלים — מעבר ל-640 זה דקות בטלפון

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
  else if(m.type==='run'){const s=S[m.key],t0=performance.now(),feeds={},ins=m.inputs||[{type:'float32',data:m.data,dims:m.dims}];
    ins.forEach((x,i)=>feeds[s.inputNames[i]]=new ort.Tensor(x.type,x.data,x.dims));
    if(m.all){const res=await s.run(feeds),all={},tr=[];for(const k of s.outputNames){const d=new Float32Array(res[k].data);all[k]=d;tr.push(d.buffer);}postMessage({type:'done',all,ms:performance.now()-t0},tr);return;}
    const res=await s.run(feeds,[s.outputNames[0]]);const o=res[s.outputNames[0]];
    const data=o.type==='uint8'?new Uint8Array(o.data):new Float32Array(o.data);postMessage({type:'done',data,dims:o.dims,ms:performance.now()-t0},[data.buffer]);}
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
      if(M.patch){const u=new Uint8Array(model);for(const o of STYLE_PATCH){if(u[o]!==8||u[o+1]!==0xE0||u[o+2]!==1)throw new Error('checksum');u[o]=0x1A;u[o+1]=1;u[o+2]=0x68;}}
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
    const key=['object','precise'].includes(mode)?mode:'person';await ensure(key,onProgress,signal);
    const sw=natW(src),sh=natH(src);let w,h,data;
    if(key==='precise'){w=h=1024;data=toCHW(canvasOf(src,w,h,'#fff'),v=>v-.5);} // IS-Net: ממוצע .5, סטיית תקן 1 (כמו rembg)
    else if(key==='person'){const k=512/Math.max(sw,sh),r32=v=>Math.max(32,Math.round(v/32)*32);w=r32(sw*k);h=r32(sh*k);data=toCHW(canvasOf(src,w,h,'#fff'),v=>(v-.5)/.5);}
    else{w=h=320;const M=[.485,.456,.406],S=[.229,.224,.225];data=toCHW(canvasOf(src,w,h,'#fff'),(v,ch)=>(v-M[ch])/S[ch]);}
    onProgress&&onProgress({phase:'process'});
    const out=await talk({type:'run',key,data,dims:[1,3,h,w]},[data.buffer],signal);let m=out.data;
    if(key!=='person'){let lo=1e9,hi=-1e9;for(const v of m){if(v<lo)lo=v;if(v>hi)hi=v;}const s=1/Math.max(1e-6,hi-lo);m=m.map(v=>(v-lo)*s);}
    const mw=out.dims[3],mh=out.dims[2],mc=document.createElement('canvas');mc.width=mw;mc.height=mh;const mx=mc.getContext('2d'),mi=mx.createImageData(mw,mh);
    for(let i=0;i<mw*mh;i++){const a=Math.max(0,Math.min(255,Math.round(m[i]*255)));mi.data[i*4]=mi.data[i*4+1]=mi.data[i*4+2]=0;mi.data[i*4+3]=a;}mx.putImageData(mi,0,0);
    const res=canvasOf(src,sw,sh),rx=res.getContext('2d');rx.globalCompositeOperation='destination-in';rx.imageSmoothingQuality='high';rx.drawImage(mc,0,0,sw,sh);
    return{canvas:res,ms:Math.round(out.ms),model:key};}

  // הגדלה ×4 באריחים. 'art' = מודל לציורים/קומיקס (anime 6B) — כבד פי ~8, לכן קלט קטן יותר (128px + שוליים 10px כדי שלא ייראו תפרים). תמונה גדולה מ-UPSCALE_MAX_IN מוקטנת קודם.
  async function upscale(src,{kind='photo',onProgress,signal}={}){
    const key=kind==='art'?'upart':'upscale';await ensure(key,onProgress,signal);
    const sw=natW(src),sh=natH(src),k=Math.min(1,(kind==='art'?UPSCALE_ART_MAX_IN:UPSCALE_MAX_IN)/Math.max(sw,sh)),W=Math.max(1,Math.round(sw*k)),H=Math.max(1,Math.round(sh*k));
    const base=canvasOf(src,W,H),bx=base.getContext('2d'),out=document.createElement('canvas');out.width=W*4;out.height=H*4;const ox=out.getContext('2d');
    const alpha=(()=>{const d=bx.getImageData(0,0,W,H).data;for(let i=3;i<d.length;i+=16)if(d[i]<250)return true;return false;})();
    const tiles=[];for(let y=0;y<H;y+=TILE)for(let x=0;x<W;x+=TILE)tiles.push([x,y]);let ms=0;
    for(let t=0;t<tiles.length;t++){if(signal&&signal.aborted)throw abortErr();onProgress&&onProgress({phase:'process',done:t,of:tiles.length});
      const [x,y]=tiles[t],x0=Math.max(0,x-PAD),y0=Math.max(0,y-PAD),x1=Math.min(W,x+TILE+PAD),y1=Math.min(H,y+TILE+PAD),tw=x1-x0,th=y1-y0;
      const tc=document.createElement('canvas');tc.width=tw;tc.height=th;const tx=tc.getContext('2d');tx.fillStyle='#fff';tx.fillRect(0,0,tw,th);tx.drawImage(base,x0,y0,tw,th,0,0,tw,th);
      const data=toCHW(tc,v=>v),r=await talk({type:'run',key,data,dims:[1,3,th,tw]},[data.buffer],signal);ms+=r.ms;
      const OW=r.dims[3],OH=r.dims[2],img=new ImageData(OW,OH),o=r.data,n=OW*OH;
      for(let i=0;i<n;i++){img.data[i*4]=Math.max(0,Math.min(255,o[i]*255));img.data[i*4+1]=Math.max(0,Math.min(255,o[n+i]*255));img.data[i*4+2]=Math.max(0,Math.min(255,o[2*n+i]*255));img.data[i*4+3]=255;}
      const oc=document.createElement('canvas');oc.width=OW;oc.height=OH;oc.getContext('2d').putImageData(img,0,0);
      const cx=(x-x0)*4,cy=(y-y0)*4,cw=Math.min(TILE,W-x)*4,ch=Math.min(TILE,H-y)*4;ox.drawImage(oc,cx,cy,cw,ch,x*4,y*4,cw,ch);
      await new Promise(r=>setTimeout(r,0));}
    if(alpha){ox.globalCompositeOperation='destination-in';ox.imageSmoothingQuality='high';ox.drawImage(base,0,0,W*4,H*4);ox.globalCompositeOperation='source-over';} // שקיפות נשמרת (אחרי הסרת רקע)
    let res=out;const L=Math.max(out.width,out.height);if(L>UPSCALE_MAX_OUT){const s=UPSCALE_MAX_OUT/L;res=canvasOf(out,Math.round(out.width*s),Math.round(out.height*s));}
    return{canvas:res,ms:Math.round(ms),tiles:tiles.length,inW:W,inH:H};}

  // מחיקת חפץ: מסכה = קנבס בגודל התמונה; כל פיקסל צבוע (alpha>0) = למחוק. ה-pipeline של MI-GAN חותך סביב המסכה בעצמו.
  async function inpaint(src,maskCv,{onProgress,signal,maxSide=2048}={}){
    await ensure('inpaint',onProgress,signal);
    const sw=natW(src),sh=natH(src),k=Math.min(1,maxSide/Math.max(sw,sh)),W=Math.max(8,Math.round(sw*k)),H=Math.max(8,Math.round(sh*k));
    const ic=canvasOf(src,W,H,'#fff'),px=ic.getContext('2d').getImageData(0,0,W,H).data,mc=canvasOf(maskCv,W,H),mp=mc.getContext('2d').getImageData(0,0,W,H).data,n=W*H;
    const img=new Uint8Array(3*n),mask=new Uint8Array(n);let any=false;
    for(let i=0;i<n;i++){img[i]=px[i*4];img[n+i]=px[i*4+1];img[2*n+i]=px[i*4+2];const hole=mp[i*4+3]>20;mask[i]=hole?0:255;if(hole)any=true;}
    if(!any)throw new Error('empty mask');
    onProgress&&onProgress({phase:'process'});
    const r=await talk({type:'run',key:'inpaint',inputs:[{type:'uint8',data:img,dims:[1,3,H,W]},{type:'uint8',data:mask,dims:[1,1,H,W]}]},[img.buffer,mask.buffer],signal);
    const o=r.data,id=new ImageData(W,H);for(let i=0;i<n;i++){id.data[i*4]=o[i];id.data[i*4+1]=o[n+i];id.data[i*4+2]=o[2*n+i];id.data[i*4+3]=255;}
    const oc=document.createElement('canvas');oc.width=W;oc.height=H;oc.getContext('2d').putImageData(id,0,0);
    // בגודל המקור: רק אזור המסכה מגיע מהתוצאה (בהגדלה), כל השאר נשאר חד מהמקור
    const res=canvasOf(src,sw,sh),rx=res.getContext('2d');if(k<1){const tmp=canvasOf(oc,sw,sh),tx=tmp.getContext('2d');tx.globalCompositeOperation='destination-in';tx.drawImage(maskCv,0,0,sw,sh);rx.drawImage(tmp,0,0);}else rx.drawImage(oc,0,0);
    return{canvas:res,ms:Math.round(r.ms)};}
  // צביעה: DDColor מנבא רק צבע (ab ב-Lab) ב-512×512; הבהירות (L) נשארת מהמקור ברזולוציה מלאה — חדות לא נפגעת.
  const M=[[.412453,.357580,.180423],[.212671,.715160,.072169],[.019334,.119193,.950227]],MI=[[3.240479,-1.53715,-.498535],[-.969256,1.875992,.041556],[.055648,-.204043,1.057311]],WN=[.950456,1,1.088754];
  const s2l=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4),l2s=c=>c<=.0031308?12.92*c:1.055*Math.pow(Math.max(0,c),1/2.4)-.055,fl=t=>t>.008856?Math.cbrt(t):7.787*t+16/116,fi=t=>{const t3=t*t*t;return t3>.008856?t3:(t-16/116)/7.787;};
  function rgb2lab(r,g,b){const R=s2l(r),G=s2l(g),B=s2l(b),x=(M[0][0]*R+M[0][1]*G+M[0][2]*B)/WN[0],y=M[1][0]*R+M[1][1]*G+M[1][2]*B,z=(M[2][0]*R+M[2][1]*G+M[2][2]*B)/WN[2];
    const fx=fl(x),fy=fl(y),fz=fl(z);return[y>.008856?116*Math.cbrt(y)-16:903.3*y,500*(fx-fy),200*(fy-fz)];}
  function lab2rgb(L,a,b){const fy=(L+16)/116,x=fi(fy+a/500)*WN[0],y=fi(fy),z=fi(fy-b/200)*WN[2];
    return[l2s(MI[0][0]*x+MI[0][1]*y+MI[0][2]*z),l2s(MI[1][0]*x+MI[1][1]*y+MI[1][2]*z),l2s(MI[2][0]*x+MI[2][1]*y+MI[2][2]*z)];}
  async function colorize(src,{onProgress,signal}={}){
    await ensure('color',onProgress,signal);
    const S=512,sc=canvasOf(src,S,S,'#fff'),p=sc.getContext('2d').getImageData(0,0,S,S).data,n=S*S,data=new Float32Array(3*n);
    for(let i=0;i<n;i++){const L=rgb2lab(p[i*4]/255,p[i*4+1]/255,p[i*4+2]/255)[0],g=lab2rgb(L,0,0);data[i]=g[0];data[n+i]=g[1];data[2*n+i]=g[2];}
    onProgress&&onProgress({phase:'process'});
    const r=await talk({type:'run',key:'color',data,dims:[1,3,S,S]},[data.buffer],signal);
    return{ab:r.data,abW:r.dims[3],abH:r.dims[2],ms:Math.round(r.ms),src};}
  // מרכיב את התמונה הצבועה בגודל המקור. strength 0–150: עוצמת הצבע (100 = כמו שהמודל חזה). זול — אפשר בכל תזוזת סליידר.
  function colorRender(res,strength=100,maxSide=2400){
    const src=res.src,sw=natW(src),sh=natH(src),k=Math.min(1,maxSide/Math.max(sw,sh)),W=Math.round(sw*k),H=Math.round(sh*k);
    const c=canvasOf(src,W,H),x=c.getContext('2d'),id=x.getImageData(0,0,W,H),d=id.data,aw=res.abW,ah=res.abH,ab=res.ab,s=strength/100;
    for(let yy=0;yy<H;yy++){const fy=(yy+.5)*ah/H-.5,y0=Math.max(0,Math.floor(fy)),y1=Math.min(ah-1,y0+1),ty=Math.max(0,fy-y0);
      for(let xx=0;xx<W;xx++){const fx=(xx+.5)*aw/W-.5,x0=Math.max(0,Math.floor(fx)),x1=Math.min(aw-1,x0+1),tx=Math.max(0,fx-x0),i=(yy*W+xx)*4;
        const bil=o=>{const a=ab[o+y0*aw+x0],b=ab[o+y0*aw+x1],c2=ab[o+y1*aw+x0],e=ab[o+y1*aw+x1];return (a*(1-tx)+b*tx)*(1-ty)+(c2*(1-tx)+e*tx)*ty;};
        const L=rgb2lab(d[i]/255,d[i+1]/255,d[i+2]/255)[0],rgb=lab2rgb(L,bil(0)*s,bil(aw*ah)*s);
        d[i]=Math.max(0,Math.min(255,rgb[0]*255));d[i+1]=Math.max(0,Math.min(255,rgb[1]*255));d[i+2]=Math.max(0,Math.min(255,rgb[2]*255));}}
    x.putImageData(id,0,0);return c;}
  // תיקון פנים: קלט = תמונה של פנים (חתוכה בערך בריבוע). 512×512, [-1,1]. מחזיר בגודל המקור (או 512 אם המקור קטן יותר).
  async function restoreFace(src,{onProgress,signal}={}){
    await ensure('face',onProgress,signal);
    const S=512,sc=canvasOf(src,S,S,'#fff'),data=toCHW(sc,v=>v*2-1);onProgress&&onProgress({phase:'process'});
    const r=await talk({type:'run',key:'face',data,dims:[1,3,S,S]},[data.buffer],signal),o=r.data,n=S*S,id=new ImageData(S,S);
    for(let i=0;i<n;i++)for(let ch=0;ch<3;ch++)id.data[i*4+ch]=Math.max(0,Math.min(255,(o[ch*n+i]+1)*127.5));for(let i=0;i<n;i++)id.data[i*4+3]=255;
    const oc=document.createElement('canvas');oc.width=oc.height=S;oc.getContext('2d').putImageData(id,0,0);
    const sw=natW(src),sh=natH(src),k=Math.max(1,S/Math.max(sw,sh));return{canvas:canvasOf(oc,Math.round(sw*k),Math.round(sh*k)),ms:Math.round(r.ms)};}

  // מציאת פנים (YuNet): קלט 640×640 BGR 0–255 (התמונה מוקטנת ומרופדת), פענוח לפי 3 רשתות (8/16/32) + NMS.
  async function detectFaces(src,{onProgress,signal,minScore=.6}={}){
    await ensure('faces',onProgress,signal);
    const S=640,sw=natW(src),sh=natH(src),k=S/Math.max(sw,sh),c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,S,S);x.drawImage(src,0,0,sw*k,sh*k);
    const p=x.getImageData(0,0,S,S).data,n=S*S,data=new Float32Array(3*n);for(let i=0;i<n;i++){data[i]=p[i*4+2];data[n+i]=p[i*4+1];data[2*n+i]=p[i*4];}
    onProgress&&onProgress({phase:'process'});
    const outs=await talk({type:'run',key:'faces',data,dims:[1,3,S,S],all:true},[data.buffer],signal),O=outs.all,boxes=[];
    for(const st of [8,16,32]){const cols=S/st,cls=O['cls_'+st],obj=O['obj_'+st],bb=O['bbox_'+st],cnt=cls.length;
      for(let i=0;i<cnt;i++){const sc=Math.sqrt(Math.min(1,Math.max(0,cls[i]))*Math.min(1,Math.max(0,obj[i])));if(sc<minScore)continue;
        const col=i%cols,row=(i/cols)|0,cx=(col+bb[i*4])*st,cy=(row+bb[i*4+1])*st,w=Math.exp(bb[i*4+2])*st,h=Math.exp(bb[i*4+3])*st;
        boxes.push({x:(cx-w/2)/k,y:(cy-h/2)/k,w:w/k,h:h/k,score:sc});}}
    boxes.sort((a,b)=>b.score-a.score);const keep=[],iou=(a,b)=>{const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)),I=ix*iy;return I/(a.w*a.h+b.w*b.h-I);};
    for(const b of boxes)if(keep.every(q=>iou(q,b)<.3))keep.push(b);
    return keep.filter(b=>b.x+b.w>0&&b.y+b.h>0&&b.x<sw&&b.y<sh).sort((a,b)=>a.x-b.x);}
  // סגנונות אמנות. Fast Neural Style: קלט/פלט RGB 0–255, כל גודל (אחרי התיקון). אנימה-פנים: 512×512 קבוע, [-1,1].
  const STYLE_MAX=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')?720:1024;
  async function stylize(src,{style='mosaic',onProgress,signal,maxSide=STYLE_MAX}={}){
    const key='s_'+style;if(!MODELS[key])throw new Error('style');await ensure(key,onProgress,signal);
    const sw=natW(src),sh=natH(src);let W,H,data,dims;
    if(style==='anime'){W=H=512;data=toCHW(canvasOf(src,W,H,'#fff'),v=>v*2-1);}
    else{const k=Math.min(1,maxSide/Math.max(sw,sh)),r4=v=>Math.max(16,Math.round(v/4)*4);W=r4(sw*k);H=r4(sh*k);data=toCHW(canvasOf(src,W,H,'#fff'),v=>v*255);}
    dims=[1,3,H,W];onProgress&&onProgress({phase:'process'});
    const r=await talk({type:'run',key,data,dims},[data.buffer],signal),o=r.data,OW=r.dims[3],OH=r.dims[2],n=OW*OH,id=new ImageData(OW,OH),f=style==='anime'?v=>(v+1)*127.5:v=>v;
    for(let i=0;i<n;i++){id.data[i*4]=Math.max(0,Math.min(255,f(o[i])));id.data[i*4+1]=Math.max(0,Math.min(255,f(o[n+i])));id.data[i*4+2]=Math.max(0,Math.min(255,f(o[2*n+i])));id.data[i*4+3]=255;}
    const oc=document.createElement('canvas');oc.width=OW;oc.height=OH;oc.getContext('2d').putImageData(id,0,0);
    const L=Math.max(sw,sh),k2=Math.min(1,maxSide/L);return{canvas:canvasOf(oc,Math.round(sw*k2),Math.round(sh*k2)),ms:Math.round(r.ms),model:key};}
  // שילוב סגנון עם המקור (0–100%) — זול, לסליידר
  function blend(orig,styled,pct){const c=canvasOf(orig,styled.width,styled.height),x=c.getContext('2d');x.globalAlpha=Math.max(0,Math.min(1,pct/100));x.drawImage(styled,0,0);return c;}

  function heMessage(err){const m=String(err&&(err.message||err)||'');
    if(err&&err.name==='AbortError')return 'בוטל.';
    if(/memory|allocation|RangeError|OOM/i.test(m))return 'אין מספיק זיכרון במכשיר הזה. נסו תמונה קטנה יותר, או ממחשב.';
    if(/checksum/.test(m))return 'קובץ המודל הגיע פגום. נסו שוב.';
    if(/empty mask/.test(m))return 'קודם מסמנים באצבע את מה שרוצים למחוק.';
    if(/http|fetch|network|Failed to fetch|Load failed/i.test(m))return 'ההורדה נכשלה — בדקו את החיבור לאינטרנט ונסו שוב.';
    if(/WebAssembly|wasm|worker|import/i.test(m))return 'הדפדפן הזה לא מצליח להריץ את הכלי. נסו בכרום מעודכן.';
    return 'הפעולה נכשלה. התמונה המקורית נשארה כמו שהיא.';}
  function device(){const ua=navigator.userAgent||'',mob=/Android|iPhone|iPad|Mobile/i.test(ua);
    return (mob?'mobile':'desktop')+' · '+(navigator.hardwareConcurrency||'?')+' cores'+(navigator.deviceMemory?' · '+navigator.deviceMemory+'GB':'');}
  window.AIImage={removeBg,upscale,inpaint,colorize,colorRender,restoreFace,detectFaces,stylize,blend,STYLES,heMessage,device,cancelAll:kill,UPSCALE_MAX_IN,UPSCALE_ART_MAX_IN,MODELS,
    credits:'הסרת רקע: MODNet, U²-Net (Apache-2.0) · הגדלה: Real-ESRGAN (BSD-3) · מחיקת חפץ: MI-GAN (MIT) · צביעה: DDColor (Apache-2.0) · onnxruntime-web (MIT)'};
})();
