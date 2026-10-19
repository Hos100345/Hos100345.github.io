// D-83 שלב 2 — התנהגות נגישה אחידה לכל החלונות (dobble.html ו-pencil-stickers.html).
// חלון = `.modal-bg` (מחולל) או `.modal-overlay` (מדבקות), נפתח/נסגר דרך `hidden` או `style.display`.
// הקובץ לא נוגע בלוגיקה של החלונות — רק צופה בפתיחה/סגירה ומוסיף:
//   • role="dialog" + aria-modal + aria-labelledby (פעם אחת, באתחול)
//   • מיקוד נכנס לחלון בפתיחה, Tab מסתובב רק בתוכו, מה שמאחוריו `inert`
//   • Esc = כפתור הסגירה של החלון (data-esc="<selector>" · "self" = לחלון יש טיפול משלו · "none" = לא נסגר ב-Esc)
//   • בסגירה המיקוד חוזר לכפתור שפתח את החלון
//   • קישור "דלג לתוכן" (.skip-link)
(function(){
  'use strict';
  var SEL='.modal-bg,.modal-overlay';
  var FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
  var stack=[],openers=new Map(),inerted=[],escTop=null;

  function all(){return Array.prototype.slice.call(document.querySelectorAll(SEL));}
  function isOpen(m){return !m.hidden&&getComputedStyle(m).display!=='none';}
  function cardOf(m){return m.querySelector('.modal-card,.modal')||m.firstElementChild;}
  function top(){return stack[stack.length-1]||null;}
  function visible(el){return !!(el.getClientRects().length)&&getComputedStyle(el).visibility!=='hidden';}
  function focusables(m){return Array.prototype.slice.call(m.querySelectorAll(FOCUSABLE)).filter(function(e){return !e.closest('[inert],[hidden]')&&visible(e);});}
  var isEn=function(){return (document.documentElement.lang||'').toLowerCase().indexOf('en')===0;};

  function setup(m){
    if(m._a11y)return;m._a11y=1;
    var c=cardOf(m);if(!c)return;
    if(!c.hasAttribute('role'))c.setAttribute('role','dialog');
    c.setAttribute('aria-modal','true');
    if(!c.hasAttribute('aria-labelledby')&&!c.hasAttribute('aria-label')){
      var h=c.querySelector('.modal-title,h1,h2,h3,[id$="-title"]');
      if(h){if(!h.id)h.id=(m.id||'dlg')+'-ttl';c.setAttribute('aria-labelledby',h.id);}
    }
    var x=c.querySelector('.modal-x');
    if(x&&!x.hasAttribute('aria-label')&&!/[A-Za-z֐-׿]/.test(x.textContent))x.setAttribute('aria-label',isEn()?'Close':'סגירה');
  }

  function setInert(){
    inerted.forEach(function(e){e.removeAttribute('inert');});inerted=[];
    var t=top();if(!t)return;
    Array.prototype.slice.call(document.body.children).forEach(function(ch){
      if(ch===t||ch.contains(t))return;
      if(/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(ch.tagName))return;
      if(ch.hasAttribute('inert')||ch.matches('[aria-live],[role="status"],[role="alert"]'))return;
      ch.setAttribute('inert','');inerted.push(ch);
    });
    // חלון שמוצג בתוך עטיפה אחרת — מנטרלים את שאר ילדי העטיפה
    if(t.parentElement&&t.parentElement!==document.body){
      Array.prototype.slice.call(t.parentElement.children).forEach(function(ch){
        if(ch===t||ch.contains(t)||ch.hasAttribute('inert'))return;
        ch.setAttribute('inert','');inerted.push(ch);
      });
    }
  }

  function focusIn(m){
    var c=cardOf(m);if(!c)return;
    if(m.contains(document.activeElement)&&document.activeElement!==m)return;   // החלון כבר מיקד משהו בעצמו
    var el=m.querySelector('[data-autofocus]');
    if(!el){var f=focusables(m);el=f.filter(function(e){return !e.classList.contains('modal-x');})[0]||f[0];}
    if(!el){if(!c.hasAttribute('tabindex'))c.setAttribute('tabindex','-1');el=c;}
    try{el.focus({preventScroll:true});}catch(_){el.focus();}
  }

  function sync(){
    var opened=all().filter(isOpen),closedTop=null,wasTop=top();
    opened.forEach(function(m){
      if(stack.indexOf(m)>=0)return;
      setup(m);
      var a=document.activeElement;
      openers.set(m,a&&a!==document.body&&!m.contains(a)?a:null);
      stack.push(m);
    });
    stack.slice().forEach(function(m){
      if(opened.indexOf(m)>=0)return;
      stack.splice(stack.indexOf(m),1);
      if(m===wasTop)closedTop=m;
    });
    setInert();
    if(top()&&top()!==wasTop)focusIn(top());
    if(closedTop){
      var o=openers.get(closedTop);openers.delete(closedTop);
      var back=(top()&&!top().contains(o))?null:o;
      if(back&&document.contains(back)&&visible(back)&&!back.closest('[inert]')){try{back.focus({preventScroll:true});}catch(_){back.focus();}}
      else if(top())focusIn(top());
      else{                                              // אין כפתור שפתח (למשל חלון פתיחה אוטומטי) — המיקוד לתוכן הראשי, לא נשאר באוויר
        var mn=document.getElementById('main');
        if(mn&&!mn.closest('[inert]')){if(!mn.hasAttribute('tabindex'))mn.setAttribute('tabindex','-1');try{mn.focus({preventScroll:true});}catch(_){mn.focus();}}
      }
    }
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')escTop=top();                   // נרשם לפני שאר המטפלים: מי היה העליון ברגע הלחיצה
    if(e.key!=='Tab')return;
    var t=top();if(!t)return;
    var f=focusables(t);
    if(!f.length){e.preventDefault();var c=cardOf(t);if(c){if(!c.hasAttribute('tabindex'))c.setAttribute('tabindex','-1');c.focus();}return;}
    var first=f[0],last=f[f.length-1],a=document.activeElement;
    if(!t.contains(a)){e.preventDefault();(e.shiftKey?last:first).focus();}
    else if(e.shiftKey&&(a===first||a===cardOf(t))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&a===last){e.preventDefault();first.focus();}
  },true);

  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape'||e.defaultPrevented||e.isComposing)return;
    var t=escTop;escTop=null;if(!t)return;
    var pol=t.getAttribute('data-esc');
    if(pol==='self'||pol==='none')return;
    setTimeout(function(){                               // אחרי שמטפלי Esc של הדף רצו — אם החלון עדיין פתוח, סוגרים
      if(!isOpen(t)||top()!==t)return;
      var b=t.querySelector(pol||'.modal-x');
      if(b&&!b.disabled)b.click();
    },0);
  });

  document.addEventListener('focusin',function(e){       // רשת ביטחון לדפדפן בלי inert
    var t=top();if(!t||t.contains(e.target)||e.target.closest('[aria-live],[role="status"],[role="alert"]'))return;
    focusIn(t);
  });

  document.addEventListener('click',function(e){
    var s=e.target.closest&&e.target.closest('.skip-link');if(!s)return;
    var id=(s.getAttribute('href')||'').slice(1),tg=id&&document.getElementById(id);if(!tg)return;
    e.preventDefault();if(!tg.hasAttribute('tabindex'))tg.setAttribute('tabindex','-1');
    tg.focus();try{tg.scrollIntoView({block:'start'});}catch(_){}
  });

  function boot(){
    all().forEach(setup);
    var mo=new MutationObserver(sync);
    all().forEach(function(m){mo.observe(m,{attributes:true,attributeFilter:['hidden','style','class']});});
    sync();
    new MutationObserver(function(muts){            // חלונות שנוספים לדף אחרי הטעינה
      var added=false;
      muts.forEach(function(r){Array.prototype.forEach.call(r.addedNodes,function(n){
        if(n.nodeType!==1)return;
        var ms=n.matches&&n.matches(SEL)?[n]:Array.prototype.slice.call(n.querySelectorAll?n.querySelectorAll(SEL):[]);
        ms.forEach(function(m){setup(m);mo.observe(m,{attributes:true,attributeFilter:['hidden','style','class']});added=true;});
      });});
      if(added)sync();
    }).observe(document.body,{childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
