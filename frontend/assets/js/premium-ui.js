(function(){
  'use strict';

  const root=document.documentElement;
  const body=document.body;
  if(!body)return;

  const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const finePointer=()=>window.matchMedia?.('(pointer: fine)').matches===true;
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const page=file.replace(/\.html$/,'')||'index';

  body.dataset.uiPage=page;

  let pageEntered=false;
  let bootObserver=null;
  function enterWhenReady(){
    if(pageEntered||body.classList.contains('navora-booting'))return;
    pageEntered=true;
    body.classList.remove('ui-page-exit');
    body.classList.add('ui-page-enter');
  }
  bootObserver=new MutationObserver(()=>enterWhenReady());
  bootObserver.observe(body,{attributes:true,attributeFilter:['class']});
  // app-shell.js is a module and may add navora-booting just after this deferred
  // script runs. A short delay avoids consuming the page-enter animation while
  // the authenticated shell is still hidden.
  setTimeout(enterWhenReady,120);

  const themeMeta=document.querySelector('meta[name="theme-color"]');
  function syncThemeMeta(){
    const dark=root.dataset.theme==='dark';
    if(themeMeta)themeMeta.setAttribute('content',dark?'#0B0712':'#F7F3EA');
  }
  syncThemeMeta();

  const ambient=document.createElement('div');
  ambient.className='ui-ambient';
  ambient.setAttribute('aria-hidden','true');
  ambient.innerHTML='<span class="ui-orb ui-orb-a"></span><span class="ui-orb ui-orb-b"></span><span class="ui-orb ui-orb-c"></span>';
  body.prepend(ambient);

  const progress=document.createElement('div');
  progress.className='ui-scroll-progress';
  progress.setAttribute('aria-hidden','true');
  body.appendChild(progress);

  const transitionOverlay=document.createElement('div');
  transitionOverlay.className='ui-transition-overlay';
  transitionOverlay.setAttribute('aria-hidden','true');
  body.appendChild(transitionOverlay);

  let pointerLight=null;
  if(finePointer()&&!reduce()){
    pointerLight=document.createElement('div');
    pointerLight.className='ui-pointer-light';
    pointerLight.setAttribute('aria-hidden','true');
    body.appendChild(pointerLight);
  }

  let scrollTick=0;
  function paintScroll(){
    scrollTick=0;
    const d=document.documentElement;
    const max=Math.max(1,d.scrollHeight-d.clientHeight);
    const pct=Math.max(0,Math.min(100,100*d.scrollTop/max));
    root.style.setProperty('--ui-scroll',`${pct}%`);
  }
  addEventListener('scroll',()=>{
    if(!scrollTick)scrollTick=requestAnimationFrame(paintScroll);
  },{passive:true});
  paintScroll();

  if(pointerLight){
    let pointerTick=0,px=innerWidth/2,py=innerHeight/2;
    addEventListener('pointermove',e=>{
      px=e.clientX;py=e.clientY;
      if(pointerTick)return;
      pointerTick=requestAnimationFrame(()=>{
        pointerTick=0;
        root.style.setProperty('--ui-pointer-x',`${px}px`);
        root.style.setProperty('--ui-pointer-y',`${py}px`);
      });
    },{passive:true});
  }

  const revealSelector=[
    '.page-head',
    '.hero > div',
    '.grid > .card',
    '.data-list > *',
    '.auth-card',
    '.three-shell',
    '.route-panel > *',
    '.route-card',
    '.journey-stats',
    '.reroute-panel:not(.hidden)',
    '.chat-side-card',
    '.admin-links',
    '.table-wrap',
    '.card:has(table)'
  ].join(',');

  const observed=new WeakSet();
  const io=!reduce()&&'IntersectionObserver'in window
    ?new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add('ui-in');
          io.unobserve(entry.target);
        }
      }
    },{threshold:.08,rootMargin:'0px 0px -5% 0px'})
    :null;

  function enhanceReveal(scope=document){
    const nodes=scope.querySelectorAll?.(revealSelector)||[];
    let n=0;
    for(const el of nodes){
      if(observed.has(el))continue;
      observed.add(el);
      el.classList.add('ui-reveal');
      el.style.setProperty('--ui-delay',`${Math.min(280,(n%7)*46)}ms`);
      n++;
      if(io)io.observe(el);
      else el.classList.add('ui-in');
    }
  }
  enhanceReveal();

  const listIds=[
    'recent-journeys','recent-memories','device-list','memory-list',
    'notification-list','blocked-list','hazard-list','room-list'
  ];
  for(const id of listIds){
    const el=document.getElementById(id);
    if(!el)continue;
    if(!el.children.length)el.classList.add('ui-loading-list');
    const mo=new MutationObserver(()=>{
      if(el.children.length||el.textContent.trim())el.classList.remove('ui-loading-list');
      enhanceReveal(el);
    });
    mo.observe(el,{childList:true,subtree:true});
    setTimeout(()=>el.classList.remove('ui-loading-list'),7000);
  }

  const dynamicObserver=new MutationObserver(records=>{
    for(const rec of records){
      for(const node of rec.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches?.('.route-card,.data-row,.card,.reroute-panel,.message,.chat-message'))enhanceReveal(node.parentElement||document);
        else enhanceReveal(node);
      }
    }
  });
  dynamicObserver.observe(body,{childList:true,subtree:true});

  const metricObserver=new MutationObserver(records=>{
    for(const rec of records){
      const el=rec.target.nodeType===1?rec.target:rec.target.parentElement;
      if(!el?.matches?.('.metric,.admin-stat'))continue;
      el.classList.remove('ui-number-pop');
      void el.offsetWidth;
      el.classList.add('ui-number-pop');
    }
  });
  document.querySelectorAll('.metric,.admin-stat').forEach(el=>metricObserver.observe(el,{childList:true,characterData:true,subtree:true}));

  document.addEventListener('click',e=>{
    const bluetooth=e.target.closest?.('[data-bluetooth-pair]');
    if(bluetooth){
      bluetooth.classList.add('ui-device-searching');
      setTimeout(()=>bluetooth.classList.remove('ui-device-searching'),6000);
    }
  });

  function eligibleInternalLink(a,e){
    if(!a||e.defaultPrevented||e.button!==0)return false;
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return false;
    if(a.hasAttribute('download'))return false;
    if(a.target&&a.target!=='_self')return false;
    const href=a.getAttribute('href');
    if(!href||href.startsWith('#')||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return false;
    let url;
    try{url=new URL(a.href,location.href)}catch{return false}
    if(url.origin!==location.origin)return false;
    if(url.pathname===location.pathname&&url.search===location.search&&url.hash)return false;
    return true;
  }

  document.addEventListener('click',e=>{
    const a=e.target.closest?.('a[href]');
    if(!eligibleInternalLink(a,e))return;

    const supportsCrossDocument=typeof CSS!=='undefined'&&typeof CSS.supports==='function'&&CSS.supports('view-transition-name: none')&&'startViewTransition'in document;
    if(supportsCrossDocument)return;

    e.preventDefault();
    body.classList.add('ui-page-exit');
    const target=a.href;
    setTimeout(()=>location.href=target,reduce()?0:205);
  });

  addEventListener('pageshow',()=>{
    pageEntered=false;
    enterWhenReady();
  });

  addEventListener('navora:theme',()=>{
    syncThemeMeta();
    body.classList.add('ui-theme-changing');
    setTimeout(()=>body.classList.remove('ui-theme-changing'),360);
  });

  if(finePointer()&&!reduce()){
    document.addEventListener('pointermove',e=>{
      const card=e.target.closest?.('.card');
      if(!card||card.closest('.map-layout,.journey-layout,.chat-layout')||card.matches('.auth-card'))return;
      const r=card.getBoundingClientRect();
      const rx=((e.clientY-r.top)/r.height-.5)*-2.0;
      const ry=((e.clientX-r.left)/r.width-.5)*2.0;
      card.style.setProperty('--ui-tilt-x',`${rx}deg`);
      card.style.setProperty('--ui-tilt-y',`${ry}deg`);
    },{passive:true});
    document.addEventListener('pointerout',e=>{
      const card=e.target.closest?.('.card');
      if(card){card.style.removeProperty('--ui-tilt-x');card.style.removeProperty('--ui-tilt-y');}
    },{passive:true});
  }

  addEventListener('pagehide',()=>{
    io?.disconnect();
    bootObserver?.disconnect();
    dynamicObserver.disconnect();
    metricObserver.disconnect();
    if(scrollTick)cancelAnimationFrame(scrollTick);
  },{once:true});

  window.NavoraPremiumUI={
    version:'12.3.4',
    page,
    enhanceReveal,
    syncThemeMeta
  };
})();