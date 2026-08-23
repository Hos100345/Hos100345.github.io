// ============================================================
// ספריית סמלים — חיפוש בעברית + בורר סגנון, זמינה לכל הלקוחות.
// AI (js/ai-symbols.js, מנהל בלבד) לא בוטל — זו ברירת מחדל שקודמת
// לו: איכות אחידה, בלי בעיות ספירה/עקביות סגנון שה-AI לא פותר.
//
// אינדקס עברי אחד (emoji-he.json, מקור: unicode-org/cldr) נטען פעם
// אחת, lazy, בפתיחה הראשונה של המודאל. בורר הסגנון קובע רק מאיזה CDN
// נטען קובץ התמונה — ה-URL בלבד, לא האינדקס עצמו.
//
// ⛔ CORS: fetch→blob→createImageBitmap בלבד. אסור img.src=cdnUrl+drawImage
// ישיר — זה מזהם את ה-canvas (SecurityError ב-toBlob/toDataURL, שבור רק
// בשלב הייצוא/PDF, מאוחר ומטעה). ⛔ PNG בלבד — לאימוג'י יש רקע שקוף.
// ============================================================

(function(){
  'use strict';

  const CDN='https://cdn.jsdelivr.net/gh/';

  const STYLES={
    twemoji:{
      label:'מעוגל וצבעוני',
      credit:'Twemoji — CC-BY 4.0',
      url:(hex)=>`${CDN}jdecked/twemoji@main/assets/svg/${hex.toLowerCase()}.svg`,
      thumb:(hex)=>`${CDN}jdecked/twemoji@main/assets/72x72/${hex.toLowerCase()}.png`,
    },
    openmoji:{
      label:'קווי ורך',
      credit:'OpenMoji — CC-BY-SA 4.0',
      // OpenMoji דורש HEX באותיות גדולות — שונה מ-Twemoji/Noto. מקור קבוע לשגיאות 404 אם מתבלבלים.
      url:(hex)=>`${CDN}hfg-gmuend/openmoji@master/color/618x618/${hex.toUpperCase()}.png`,
      thumb:(hex)=>`${CDN}hfg-gmuend/openmoji@master/color/72x72/${hex.toUpperCase()}.png`,
    },
    noto:{
      label:'נקי ומודרני',
      credit:'Noto Emoji — Apache 2.0',
      url:(hex)=>`${CDN}googlefonts/noto-emoji@main/svg/emoji_u${hex.toLowerCase()}.svg`,
      thumb:(hex)=>`${CDN}googlefonts/noto-emoji@main/png/72/emoji_u${hex.toLowerCase()}.png`,
    },
  };
  const DEFAULT_STYLE='twemoji';
  const RENDER_SIZE=512;   // מספיק להדפסה, לא מנפח את IndexedDB

  let INDEX=null,INDEX_PROMISE=null;
  function loadIndex(){
    if(INDEX)return Promise.resolve(INDEX);
    if(!INDEX_PROMISE){
      INDEX_PROMISE=fetch('js/emoji-he.json').then(r=>{
        if(!r.ok)throw new Error('טעינת אינדקס הסמלים נכשלה ('+r.status+')');
        return r.json();
      }).then(data=>{INDEX=data;return INDEX;});
    }
    return INDEX_PROMISE;
  }

  // חיפוש מקומי על עד ~1,536 רשומות — מיידי, בלי index libraries או debounce כבד.
  function search(q){
    q=String(q||'').trim();
    if(!INDEX)return[];
    if(!q)return INDEX.slice(0,60);
    const hits=[];
    for(const r of INDEX){
      if(r.n===q){hits.unshift(r);continue;}
      if(r.k.some(w=>w.startsWith(q))){hits.push(r);continue;}
      if(r.k.some(w=>w.includes(q)))hits.push(r);
    }
    return hits.slice(0,60);
  }

  // createImageBitmap על SVG blob לא נתמך בכל הדפדפנים (בעיקר Safari ישן) — נופל ל-Image רגיל.
  async function decode(blob){
    try{return await createImageBitmap(blob);}
    catch(e){
      const u=URL.createObjectURL(blob);
      try{
        const img=new Image();
        await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=u;});
        return img;
      }finally{setTimeout(()=>URL.revokeObjectURL(u),0);}
    }
  }

  async function toFile(rec,styleKey){
    const style=STYLES[styleKey]||STYLES[DEFAULT_STYLE];
    const url=style.url(rec.h);
    let resp;
    try{resp=await fetch(url);}
    catch(e){throw new Error('הורדת הסמל נכשלה — בדקו חיבור לאינטרנט');}
    if(!resp.ok)throw new Error('הסמל לא נמצא ('+resp.status+')');
    const blob=await resp.blob();
    const bmp=await decode(blob);

    const cv=document.createElement('canvas');
    cv.width=cv.height=RENDER_SIZE;
    const ctx=cv.getContext('2d');
    const pad=RENDER_SIZE*0.06;
    const box=RENDER_SIZE-pad*2;
    const bw=bmp.width||bmp.naturalWidth,bh=bmp.height||bmp.naturalHeight;
    const s=Math.min(box/bw,box/bh);
    const w=bw*s,h=bh*s;
    ctx.drawImage(bmp,(RENDER_SIZE-w)/2,(RENDER_SIZE-h)/2,w,h);

    const out=await new Promise(res=>cv.toBlob(res,'image/png'));   // PNG חובה — שקיפות
    const stamp=Date.now().toString(36).slice(-4);   // מונע דילוג בשקט ע"י buildDupIndex על אותו סמל
    return new File([out],`emo-${styleKey}-${rec.h}-${stamp}.png`,{type:'image/png'});
  }

  // ── DOM ──
  let btn,modal,closeBtn,qInp,stylesWrap,grid,emptyBox,emptyAiBtn,addBtn;
  let curStyle=DEFAULT_STYLE;
  const selected=new Map();   // hex -> rec
  let searchTimer=0;

  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function renderStylePills(){
    stylesWrap.innerHTML=Object.keys(STYLES).map(key=>
      `<button type="button" class="sbt${key===curStyle?' on':''}" data-style="${key}" style="flex:1">${escHtml(STYLES[key].label)}</button>`
    ).join('');
  }

  function updateAddBtn(){
    addBtn.textContent=`הוסף נבחרים (${selected.size})`;
    addBtn.disabled=selected.size===0;
  }

  function renderResults(q){
    const hits=search(q);
    if(!hits.length&&q.trim()){
      grid.innerHTML='';
      emptyBox.hidden=false;
      return;
    }
    emptyBox.hidden=true;
    // תצוגה מקדימה = thumb 72px מהסגנון הנבחר, לא r.c (תו המערכת) — אחרת החלפת
    // סגנון לא נראית משתנה בכלל, גם כשההוספה בפועל כן משתמשת בסגנון הנכון.
    grid.innerHTML=hits.map(r=>{
      const sel=selected.has(r.h);
      return `<div class="emo-tile" data-hex="${r.h}" style="cursor:pointer;text-align:center;padding:.5rem .3rem;border-radius:var(--rs);border:2px solid ${sel?'var(--indigo)':'var(--border)'};background:${sel?'rgba(99,102,241,.08)':'transparent'}">
        <img src="${STYLES[curStyle].thumb(r.h)}" alt="${escHtml(r.n)}" loading="lazy"
             width="44" height="44" data-cp="${r.c}"
             style="width:44px;height:44px;object-fit:contain;display:block;margin:0 auto">
        <div style="font-size:.68rem;color:var(--muted);margin-top:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.n)}</div>
      </div>`;
    }).join('');
  }

  function currentQuery(){return qInp.value||'';}

  function onGridClick(e){
    const tile=e.target.closest('.emo-tile');if(!tile)return;
    const hex=tile.dataset.hex;
    if(selected.has(hex))selected.delete(hex);
    else{
      const rec=INDEX.find(r=>r.h===hex);
      if(rec)selected.set(hex,rec);
    }
    renderResults(currentQuery());
    updateAddBtn();
  }

  function onStylesClick(e){
    const b=e.target.closest('.sbt');if(!b)return;
    curStyle=b.dataset.style;
    renderStylePills();
    renderResults(currentQuery());   // מרענן את התמונות בפועל — לא רק את הכפתור הפעיל
    // בכוונה לא מאפסים את selected — החלפת סגנון לא מאפסת בחירה.
  }

  // תמונה שבורה ברשת (סמל שחסר בסט הנוכחי) נופלת לתו האימוג'י של המערכת.
  // מאזין מואצל על הרשת, לא onerror inline לכל <img> — 'error' לא עולה בבועות,
  // capture:true חובה כדי לתפוס אותו במיכל.
  function onGridError(e){
    const img=e.target;
    if(!img||img.tagName!=='IMG'||img.dataset.fellBack)return;
    img.dataset.fellBack='1';
    const span=document.createElement('span');
    span.textContent=img.dataset.cp||'';
    span.style.cssText='font-size:2rem;line-height:44px;display:block;text-align:center';
    img.replaceWith(span);
  }

  async function onAdd(){
    if(!selected.size)return;
    const recs=Array.from(selected.values());
    addBtn.disabled=true;
    const prevLabel=addBtn.textContent;
    addBtn.textContent='מוסיף…';
    const files=[];
    const failed=[];
    for(const rec of recs){
      try{files.push(await toFile(rec,curStyle));}
      catch(e){failed.push(rec.n+' — '+((e&&e.message)||e));}
    }
    if(files.length)await window.dobbleAddFiles(files);
    if(typeof window.toast==='function'){
      if(files.length)window.toast(`נוספו ${files.length} סמלים למאגר ✓`+(failed.length?` · ${failed.length} נכשלו`:''),failed.length?'warn':'ok');
      if(!files.length&&failed.length)window.toast('הוספת הסמלים נכשלה: '+failed.join(', '),'err');
    }
    selected.clear();
    renderResults(currentQuery());
    updateAddBtn();
    addBtn.textContent=prevLabel;
  }

  function openAiFallback(){
    const query=currentQuery().trim();
    const aiBtn=document.getElementById('ai-symbols-btn');
    if(!aiBtn)return;
    aiBtn.click();   // מריץ את openModal() הקיים ב-ai-symbols.js (לא נוגעים בקובץ עצמו)
    const ta=document.getElementById('ai-sym-ta');
    if(ta&&query)ta.value=query;
    closeModal();
  }

  function openModal(){
    modal.hidden=false;
    qInp.value='';
    renderStylePills();
    emptyBox.hidden=true;
    updateAddBtn();
    // נבדק בכל פתיחה, לא רק ב-init(): באתחול הדף authSession עדיין לא נפתר
    // (Supabase getSession אסינכרוני), ולכן בדיקה חד-פעמית הייתה נשארת שגויה למנהל שנכנס אחר כך.
    emptyAiBtn.hidden=!(typeof window.isAdminUser==='function'&&window.isAdminUser());
    qInp.focus();
    loadIndex().then(()=>{renderResults('');}).catch(e=>{
      console.warn('emoji-lib loadIndex:',e);
      grid.innerHTML='';
      emptyBox.hidden=false;
      if(typeof window.toast==='function')window.toast('טעינת ספריית הסמלים נכשלה','err');
    });
  }
  function closeModal(){modal.hidden=true;}

  function init(){
    btn=document.getElementById('emoji-lib-btn');
    modal=document.getElementById('emoji-lib-modal');
    if(!btn||!modal)return;
    closeBtn=document.getElementById('emoji-lib-x');
    qInp=document.getElementById('emoji-lib-q');
    stylesWrap=document.getElementById('emoji-lib-styles');
    grid=document.getElementById('emoji-lib-grid');
    emptyBox=document.getElementById('emoji-lib-empty');
    emptyAiBtn=document.getElementById('emoji-lib-ai-btn');
    addBtn=document.getElementById('emoji-lib-add');

    btn.addEventListener('click',openModal);
    closeBtn.addEventListener('click',closeModal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
    qInp.addEventListener('input',()=>{
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>renderResults(currentQuery()),120);
    });
    stylesWrap.addEventListener('click',onStylesClick);
    grid.addEventListener('click',onGridClick);
    grid.addEventListener('error',onGridError,true);   // capture — 'error' לא עולה בבועות
    addBtn.addEventListener('click',onAdd);
    emptyAiBtn.addEventListener('click',openAiFallback);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
