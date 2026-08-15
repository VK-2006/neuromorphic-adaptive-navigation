/* NAVORA - Obsidian Intelligence Advanced Motion System v9.3 frontend repair */
(()=>{
  'use strict';
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const finePointer=window.matchMedia?.('(hover:hover) and (pointer:fine)').matches??false;
  const root=document.documentElement, body=document.body;
  if(!body) return;
  if(body.dataset.motionV93==='1') return;
  body.dataset.motionV93='1';
  body.classList.add('motion-v9-ready','motion-page-enter');

  const $$=(selector,scope=document)=>Array.from(scope.querySelectorAll(selector));
  const nodes=(scope,selector)=>{
    const out=[];
    if(scope instanceof Element && scope.matches(selector)) out.push(scope);
    out.push(...$$(selector,scope));
    return out;
  };

  const progress=document.createElement('div');
  progress.className='obs-motion-progress';
  progress.setAttribute('aria-hidden','true');
  body.prepend(progress);

  let scrollTicking=false;
  const updateScroll=()=>{
    scrollTicking=false;
    const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    root.style.setProperty('--motion-scroll',Math.min(1,Math.max(0,window.scrollY/max)).toFixed(4));
  };
  const onScroll=()=>{if(!scrollTicking){scrollTicking=true;requestAnimationFrame(updateScroll)}};
  if(!reduce){
    addEventListener('scroll',onScroll,{passive:true});
    addEventListener('resize',updateScroll,{passive:true});
    updateScroll();
  }

  const revealSelector=[
    'main > section','.page-head','.card','.route-card','.auth-card','.stat-card',
    '.metric-card','.dashboard-card','.panel','.glass-panel','.table-responsive',
    'table','.journey-panel','.hud-panel','.data-row'
  ].join(',');
  let revealIndex=0;
  const revealSeen=new WeakSet();
  const revealNow=el=>el.classList.add('motion-in');
  const revealIO=!reduce&&'IntersectionObserver'in window
    ?new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting) return;
        revealNow(entry.target);revealIO.unobserve(entry.target);
      });
    },{rootMargin:'0px 0px -7% 0px',threshold:.08})
    :null;

  function addReveal(el){
    if(revealSeen.has(el)||el.closest('.leaflet-pane')) return;
    revealSeen.add(el);
    el.classList.add('motion-reveal');
    el.style.setProperty('--motion-index',String(Math.min(revealIndex++%8,7)));
    if(revealIO) revealIO.observe(el); else revealNow(el);
  }

  const shineSeen=new WeakSet();
  function addShine(el){
    if(shineSeen.has(el)||el.closest('.leaflet-control')) return;
    shineSeen.add(el);el.classList.add('motion-shine');
  }

  const tiltSeen=new WeakSet();
  function addTilt(card){
    if(!finePointer||reduce||tiltSeen.has(card)||card.closest('.leaflet-container')) return;
    tiltSeen.add(card);card.classList.add('motion-tilt');
    let raf=0,lastEvent=null;
    const render=()=>{
      raf=0;if(!lastEvent)return;
      const rect=card.getBoundingClientRect();
      const px=Math.min(1,Math.max(0,(lastEvent.clientX-rect.left)/Math.max(1,rect.width)));
      const py=Math.min(1,Math.max(0,(lastEvent.clientY-rect.top)/Math.max(1,rect.height)));
      card.style.setProperty('--motion-tilt-x',`${((.5-py)*2.6).toFixed(2)}deg`);
      card.style.setProperty('--motion-tilt-y',`${((px-.5)*3.2).toFixed(2)}deg`);
      card.style.setProperty('--motion-pointer-x',`${(px*100).toFixed(1)}%`);
      card.style.setProperty('--motion-pointer-y',`${(py*100).toFixed(1)}%`);
    };
    card.addEventListener('pointermove',e=>{lastEvent=e;if(!raf)raf=requestAnimationFrame(render)},{passive:true});
    card.addEventListener('pointerleave',()=>{
      if(raf)cancelAnimationFrame(raf);raf=0;lastEvent=null;
      card.style.setProperty('--motion-tilt-x','0deg');
      card.style.setProperty('--motion-tilt-y','0deg');
      card.style.setProperty('--motion-pointer-x','50%');
      card.style.setProperty('--motion-pointer-y','50%');
    },{passive:true});
  }

  const videoSeen=new WeakSet();
  function bindVideo(video){
    if(videoSeen.has(video)) return;
    videoSeen.add(video);
    const sync=()=>{
      const container=video.closest('.camera-frame,.camera-shell,.video-shell,.camera-pane');
      if(!container)return;
      container.classList.toggle('motion-camera-live',!video.paused&&video.readyState>=2);
    };
    ['playing','pause','ended','loadeddata','emptied'].forEach(type=>video.addEventListener(type,sync));
    sync();
  }

  function drawPaths(scope){
    if(reduce)return;
    nodes(scope,'svg[data-motion-draw] path,svg.motion-draw path').forEach(path=>{
      if(path.dataset.motionDrawReady==='1')return;
      path.dataset.motionDrawReady='1';
      try{
        const length=Math.min(900,Math.max(24,path.getTotalLength()));
        path.classList.add('motion-path-draw');
        path.style.setProperty('--motion-path-length',length.toFixed(0));
      }catch{}
    });
  }

  function decorate(scope=document){
    nodes(scope,revealSelector).forEach(addReveal);
    nodes(scope,'button,.btn-navora,.icon-btn,[role="button"]').forEach(addShine);
    nodes(scope,'.card,.route-card,.auth-card,.stat-card,.metric-card,.dashboard-card').forEach(addTilt);
    nodes(scope,'video').forEach(bindVideo);
    drawPaths(scope);
    nodes(scope,'.hero h1,.auth-card h1,.page-title').forEach(el=>el.classList.add('motion-clip-reveal'));
    nodes(scope,'.hero,.hero-visual,.three-stage,[data-three-scene]').forEach(el=>el.classList.add('motion-parallax-soft'));
  }
  decorate();

  const onPointerDown=event=>{
    delete body.dataset.keyboardNav;
    if(reduce)return;
    const btn=event.target.closest?.('button,.btn-navora,.icon-btn,[role="button"]');
    if(!btn||btn.disabled||btn.getAttribute('aria-disabled')==='true'||btn.closest('.leaflet-control'))return;
    const rect=btn.getBoundingClientRect(),ripple=document.createElement('span');
    ripple.className='motion-ripple';
    ripple.style.left=`${event.clientX-rect.left}px`;
    ripple.style.top=`${event.clientY-rect.top}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  };
  document.addEventListener('pointerdown',onPointerDown,{passive:true});

  const onKeyDown=e=>{if(e.key==='Tab')body.dataset.keyboardNav='true'};
  document.addEventListener('keydown',onKeyDown);

  if(!reduce&&CSS.supports?.('animation-timeline: view()')){
    $$('.hero,main > section,.journey-cockpit,.map-layout').forEach(el=>el.classList.add('motion-view-linked'));
  }

  const mo=new MutationObserver(records=>{
    for(const record of records) record.addedNodes.forEach(node=>{if(node instanceof Element)decorate(node)});
  });
  mo.observe(body,{childList:true,subtree:true});

  addEventListener('pageshow',e=>{if(e.persisted)$$('.motion-reveal').forEach(revealNow)});
  addEventListener('pagehide',()=>{
    revealIO?.disconnect();mo.disconnect();
    document.removeEventListener('pointerdown',onPointerDown);
    document.removeEventListener('keydown',onKeyDown);
    if(!reduce){
      removeEventListener('scroll',onScroll);
      removeEventListener('resize',updateScroll);
    }
  },{once:true});

  window.NavoraMotionV93={dynamic:true,routeSelectionOwner:'map.js',reducedMotion:reduce};
})();
