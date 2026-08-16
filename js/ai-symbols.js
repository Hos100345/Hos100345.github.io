// ============================================================
// מחולל סמלים ב-AI — שלב 0, מנהל בלבד.
// השער האמיתי בצד שרת (Edge Function image-gateway). isAdminUser() כאן
// קובע רק את נראות הכפתור — ניתן לזייף ב-DevTools, אבל הבקשה עדיין
// תיחסם ב-403 בשרת. ראו CLAUDE.md, סעיף "אילוצים קריטיים".
//
// נטען אחרי הסקריפט הראשי — משתמש בנקודת הכניסה המפורשת window.dobbleAddFiles
// (S עצמו נשאר const פנימי, לא ייחשף), וב-window.SB/authSession/isAdminUser/toast
// שכבר נגישים כברירת מחדל (var/function ברמת סקריפט קלאסי).
// ============================================================

(function(){
  'use strict';

  const STYLES=[
    {value:'vector',label:'וקטור שטוח'},
    {value:'cartoon',label:'קריקטורה חמודה'},
    {value:'sticker',label:'מדבקה חתוכה'},
    {value:'doodle',label:'קווי יד'},
  ];
  const RATE_LIMIT_MS=2000;   // קצב קבוע — יש טוקן בצד שרת, קצב סביר בלי סיכון חסימה

  let btn,modal,closeBtn,ta,styleSel,seedInp,goBtn,barWrap,bar,statusEl,grid,lastFailed=[];

  function notify(msg,type){
    if(typeof window.toast==='function')window.toast(msg,type);
    else if(type==='err')console.error(msg);else console.log(msg);
  }

  function refreshVisibility(){
    if(!btn)return;
    btn.hidden=!(typeof window.isAdminUser==='function'&&window.isAdminUser());
  }
  window.dobbleRefreshAiButton=refreshVisibility;

  function parseLines(text){
    return String(text||'').split('\n').map(l=>l.trim()).filter(Boolean).map(line=>{
      const idx=line.indexOf(',');
      const he=(idx===-1?line:line.slice(0,idx)).trim();
      const en=(idx===-1?'':line.slice(idx+1)).trim();
      return {he,en};
    }).filter(x=>x.he);
  }

  function safeLabel(he){
    return String(he||'symbol').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,24)||'symbol';
  }

  async function callGateway(item,style,seed){
    const cfg=window.SUPABASE_CONFIG||{};
    const base=cfg.url||'';
    if(!base||!window.SB||!window.authSession)throw new Error('צריך להתחבר כמנהל');
    let res;
    try{
      res=await fetch(base+'/functions/v1/image-gateway',{
        method:'POST',
        headers:{'Content-Type':'application/json',
          'Authorization':'Bearer '+window.authSession.access_token,
          'apikey':cfg.anonKey||''},
        body:JSON.stringify({action:'generate',text:item.he,english:item.en,style,seed})
      });
    }catch(err){
      throw new Error('לא הצלחתי להגיע ל-image-gateway. ודאו ב-Supabase שהפונקציה פרוסה ושיש חיבור לאינטרנט.');
    }
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||('שגיאה '+res.status));
    return data;   // {url, cached, cacheKey}
  }

  async function urlToFile(url,name){
    const res=await fetch(url,{mode:'cors'});
    if(!res.ok)throw new Error('הורדת התמונה נכשלה: '+res.status);
    const blob=await res.blob();
    return new File([blob],name,{type:'image/jpeg'});
  }

  function addPreviewTile(url,label,ok){
    const tile=document.createElement('div');
    tile.style.cssText='border-radius:.5rem;overflow:hidden;border:1px solid var(--border);aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:'+(ok?'#fff':'#fef2f2');
    tile.title=label;
    if(ok&&url){
      const img=document.createElement('img');
      img.src=url;img.style.cssText='width:100%;height:100%;object-fit:cover';
      tile.appendChild(img);
    }else{
      tile.textContent='⚠️';
      tile.style.fontSize='1.4rem';
    }
    grid.appendChild(tile);
  }

  async function runBatch(items,style,seed){
    goBtn.disabled=true;
    barWrap.style.display='block';
    grid.innerHTML='';
    bar.style.width='0%';
    const files=[];
    const failed=[];
    let done=0;
    for(const item of items){
      statusEl.textContent=`מייצר ${done+1}/${items.length}: ${item.he}…`;
      try{
        const data=await callGateway(item,style,seed);
        const key8=String(data.cacheKey||'').slice(0,8)||Math.random().toString(36).slice(2,10);
        // חותמת-זמן קצרה בנוסף למפתח הקאש: פגיעת קאש (אותו seed שוב) מחזירה אותו cacheKey,
        // ובלעדיה שם הקובץ יהיה זהה לפעם הקודמת ויידלג בשקט ע"י buildDupIndex() (ראו סעיף 4.3).
        const stamp=Date.now().toString(36).slice(-4);
        const name=`ai-${key8}-${stamp}-${safeLabel(item.he)}.jpg`;
        const file=await urlToFile(data.url,name);
        files.push(file);
        addPreviewTile(data.url,item.he,true);
      }catch(e){
        failed.push(item);
        addPreviewTile(null,item.he+' — '+((e&&e.message)||'שגיאה'),false);
      }
      done++;
      bar.style.width=Math.round(done/items.length*100)+'%';
      if(done<items.length)await new Promise(r=>setTimeout(r,RATE_LIMIT_MS));
    }
    if(files.length){
      await window.dobbleAddFiles(files);   // addFiles עושה Array.from — מערך רגיל מספיק, בלי DataTransfer
    }
    statusEl.textContent=failed.length
      ? `הושלם: ${files.length} נוצרו, ${failed.length} נכשלו — לחצו "יצירה" שוב כדי לנסות שוב את הכושלים בלבד`
      : `הושלם: ${files.length} סמלים נוספו למאגר ✓`;
    goBtn.disabled=false;
    if(failed.length){
      ta.value=failed.map(x=>x.he+(x.en?(', '+x.en):'')).join('\n');
    }
  }

  function openModal(){
    ta.value='';
    seedInp.value=String(Math.floor(Math.random()*1000000));
    grid.innerHTML='';
    statusEl.textContent='';
    barWrap.style.display='none';
    bar.style.width='0%';
    lastFailed=[];
    modal.hidden=false;
    ta.focus();
  }
  function closeModal(){ modal.hidden=true; }

  async function onGo(){
    const items=parseLines(ta.value);
    if(!items.length){ notify('נא להזין לפחות שורה אחת','err'); return; }
    const style=styleSel.value;
    const seed=Number(seedInp.value)||1;
    try{
      await runBatch(items,style,seed);
    }catch(e){
      notify('היצירה נכשלה: '+((e&&e.message)||e),'err');
      goBtn.disabled=false;
    }
  }

  function init(){
    btn=document.getElementById('ai-symbols-btn');
    modal=document.getElementById('ai-symbols-modal');
    if(!btn||!modal)return;
    closeBtn=document.getElementById('ai-sym-x');
    ta=document.getElementById('ai-sym-ta');
    styleSel=document.getElementById('ai-sym-style');
    seedInp=document.getElementById('ai-sym-seed');
    goBtn=document.getElementById('ai-sym-go');
    barWrap=document.getElementById('ai-sym-barwrap');
    bar=document.getElementById('ai-sym-bar');
    statusEl=document.getElementById('ai-sym-status');
    grid=document.getElementById('ai-sym-grid');

    styleSel.innerHTML=STYLES.map(s=>`<option value="${s.value}">${s.label}</option>`).join('');

    btn.addEventListener('click',openModal);
    closeBtn.addEventListener('click',closeModal);
    modal.addEventListener('click',e=>{ if(e.target===modal)closeModal(); });
    goBtn.addEventListener('click',onGo);

    refreshVisibility();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
