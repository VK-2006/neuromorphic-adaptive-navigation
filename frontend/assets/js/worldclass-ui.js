/* NAVORA World-Class UI Runtime v5 — presentation/accessibility only. */
(()=>{
  'use strict';
  const d=document, root=d.documentElement, body=d.body;
  if(!body || body.dataset.worldclassReady==='1') return;
  body.dataset.worldclassReady='1';

  const life=new AbortController();
  const signal=life.signal;
  const observers=[];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  const small=matchMedia('(max-width: 820px)').matches;
  const saveData=Boolean(navigator.connection?.saveData);
  const pageFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const page=pageFile.replace(/\.html$/,'')||'index';
  const isAdmin=page==='admin'||page.startsWith('admin-');
  const authPages=new Set(['login','register','forgot-password','verify-email','verify-otp','reset-password','shared-journey']);
  const $=(s,c=d)=>c.querySelector(s);
  const $$=(s,c=d)=>[...c.querySelectorAll(s)];
  const node=(tag,cls,attrs={})=>{
    const n=d.createElement(tag); if(cls)n.className=cls;
    Object.entries(attrs).forEach(([k,v])=>{if(k==='text')n.textContent=v;else if(k==='html')n.innerHTML=v;else if(v!==undefined&&v!==null)n.setAttribute(k,String(v))});
    return n;
  };
  const on=(target,type,fn,opts={})=>target?.addEventListener(type,fn,{...opts,signal});
  const watch=(observer,target,opts)=>{observer.observe(target,opts);observers.push(observer);return observer};
  body.dataset.wcPage=page;
  body.classList.add('wc-app');

  const userNav=[
    ['dashboard.html','Dashboard','⌂'],['map.html','Navigate','↗'],['journey.html','Journey','◉'],['world-chat.html','Community','◎'],['memory.html','Memory','◇'],['history.html','History','◷'],['settings.html','Settings','⚙']
  ];
  const adminNav=[
    ['admin.html','Overview','▦'],['admin-users.html','Users','◌'],['admin-hazards.html','Hazards','△'],['admin-health.html','Health','◉']
  ];

  function pageIndex(){
    const files=[...authPages,'index','dashboard','map','journey','journey-replay','memory','history','notifications','profile','settings','world-chat','offline','admin','admin-users','admin-hazards','admin-chat','admin-health','admin-audit'];
    const i=Math.max(0,files.indexOf(page)); return `NAVORA / ${String(i+1).padStart(2,'0')}`;
  }

  function globalAtmosphere(){
    body.prepend(node('div','wc-ambient',{'aria-hidden':'true'}));
    body.append(node('div','wc-scroll-progress',{'aria-hidden':'true'}));
    if(fine&&!small&&!reduce) body.append(node('div','wc-pointer-light',{'aria-hidden':'true'}));

    let scrollQueued=false;
    const updateScroll=()=>{scrollQueued=false;const max=Math.max(1,d.documentElement.scrollHeight-innerHeight);root.style.setProperty('--wc-scroll',`${Math.min(100,scrollY/max*100)}%`)};
    on(window,'scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScroll)}},{passive:true});
    updateScroll();

    if(fine&&!small&&!reduce){
      let queued=false,x=innerWidth/2,y=innerHeight/2;
      on(window,'pointermove',e=>{x=e.clientX;y=e.clientY;if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;root.style.setProperty('--wc-pointer-x',`${x}px`);root.style.setProperty('--wc-pointer-y',`${y}px`)})}},{passive:true});
    }
  }

  function networkCanvas(){
    if(reduce||small||saveData||(navigator.deviceMemory&&navigator.deviceMemory<=2)) return;
    const canvas=node('canvas','',{'id':'wc-network-field','aria-hidden':'true'}); body.prepend(canvas);
    const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true}); if(!ctx){canvas.remove();return}
    const count=innerWidth>1500?32:26;
    const pts=Array.from({length:count},()=>({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*.00012,vy:(Math.random()-.5)*.00009,p:.4+Math.random()*.8}));
    let w=0,h=0,dpr=1,raf=0,last=0,visible=true,running=true;
    const start=()=>{if(running&&!raf&&visible&&!d.hidden)raf=requestAnimationFrame(frame)};
    const resize=()=>{dpr=Math.min(devicePixelRatio||1,1.35);w=innerWidth;h=innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0)};
    const colors=()=>root.dataset.theme==='dark'?{node:'rgba(246,196,83,.25)',line:'rgba(192,132,252,.075)',hot:'rgba(246,196,83,.44)'}:{node:'rgba(6,27,70,.16)',line:'rgba(7,143,87,.06)',hot:'rgba(255,122,0,.29)'};
    const frame=t=>{
      raf=0;
      if(!running||!visible||d.hidden)return;
      if(t-last<32){start();return} last=t; ctx.clearRect(0,0,w,h);const c=colors();
      pts.forEach(p=>{p.x=(p.x+p.vx+1)%1;p.y=(p.y+p.vy+1)%1});
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
        const a=pts[i],b=pts[j],dx=(a.x-b.x)*w,dy=(a.y-b.y)*h,dist=Math.hypot(dx,dy);
        if(dist<175){ctx.globalAlpha=(1-dist/175)*.6;ctx.strokeStyle=c.line;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke()}
      }
      ctx.globalAlpha=1;pts.forEach((p,i)=>{const pulse=.7+.3*Math.sin(t*.0015+i);ctx.fillStyle=i%8===0?c.hot:c.node;ctx.beginPath();ctx.arc(p.x*w,p.y*h,1.1+p.p+pulse*.55,0,Math.PI*2);ctx.fill()});start();
    };
    resize();on(window,'resize',resize,{passive:true});
    if('IntersectionObserver'in window){const io=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)start()},{threshold:0});watch(io,body)}
    on(window,'visibilitychange',()=>{if(!d.hidden)start()});
    start();
    on(window,'pagehide',()=>{running=false;cancelAnimationFrame(raf);raf=0;canvas.remove()},{once:true});
  }

  function enhanceHeadings(){
    $$('.page-head').forEach(h=>h.dataset.wcIndex=pageIndex());
    const head=$('.page-head');
    if(head&&!head.querySelector('.wc-live-pulse')&&!authPages.has(page)){
      const target=head.querySelector(':scope > div');
      if(target){const pulse=node('span','wc-live-pulse',{text:'PRODUCT SYSTEM / LIVE UI'});target.append(pulse)}
    }
  }

  function heroPipeline(){
    if(page!=='index')return;
    const hero=$('.hero');const copy=hero?.firstElementChild;if(!copy||copy.querySelector('.wc-hero-pipeline'))return;
    const rail=node('div','wc-hero-pipeline',{'aria-label':'Navora intelligence pipeline'});
    const steps=[
      ['01','Neuromorphic','SNN risk processing'],['02','Memory','CRM + DTW experience'],['03','Optimization','ACO route decision']
    ];
    steps.forEach(([n,t,s])=>rail.append(node('span','',{'data-step':n,html:`${t}<small>${s}</small>`})));
    copy.append(rail);
    const shell=$('.three-shell');if(shell){shell.setAttribute('aria-label','Interactive three-dimensional route and neural-network visualization');shell.setAttribute('role','img')}
  }

  function authVisual(){
    const shell=$('.auth-shell');if(!shell||shell.querySelector('.auth-visual'))return;
    const copy={
      login:['Adaptive navigation, secured.','Access your route memory, devices and live navigation intelligence through a protected account boundary.'],
      register:['Build the identity behind the route.','Create secure access first; successful journeys can then contribute to familiarity and adaptive route intelligence.'],
      'forgot-password':['Recover access without weakening trust.','The recovery flow uses expiring verification and avoids exposing account state beyond the intended response.'],
      'verify-email':['Verify before route history is attached.','Email verification protects the identity that will own journeys, preferences, memories and device metadata.'],
      'verify-otp':['Confirm the recovery challenge.','The one-time challenge is time-bound and verified server-side before a reset token can be issued.'],
      'reset-password':['Re-establish secure access.','Set the new credential and return to navigation without changing the underlying account data.'],
      'shared-journey':['Journey status, intentionally scoped.','Trusted-contact views expose only the limited journey state associated with the secure sharing flow.']
    };
    const [title,text]=copy[page]||['Navigation intelligence, protected.','Navora keeps the experience futuristic without weakening access controls.'];
    const aside=node('aside','auth-visual',{'aria-label':'Navora product identity'});
    aside.innerHTML=`<div class="auth-orbit" aria-hidden="true"></div><div class="auth-visual-content"><div class="auth-visual-brand"><span class="brand-mark" aria-hidden="true"></span><span>NAVORA / TRUSTED ACCESS</span></div><h2>${title}</h2><p>${text}</p><div class="auth-tech"><span>SNN risk</span><span>CRM + DTW</span><span>ACO routing</span><span>Privacy-aware</span></div></div>`;
    shell.prepend(aside);
  }

  function passwordToggles(){
    $$('input[type="password"]').forEach(input=>{
      if(input.parentElement?.classList.contains('wc-password-wrap'))return;
      const wrap=node('div','wc-password-wrap');input.parentNode.insertBefore(wrap,input);wrap.append(input);
      const btn=node('button','wc-password-toggle',{'type':'button','aria-label':'Show password','text':'◉'});wrap.append(btn);
      on(btn,'click',()=>{const reveal=input.type==='password';input.type=reveal?'text':'password';btn.setAttribute('aria-label',reveal?'Hide password':'Show password');btn.textContent=reveal?'◎':'◉'});
    });
  }

  function activeNav(){
    $$('.nav-links a').forEach(a=>{const href=(a.getAttribute('href')||'').toLowerCase();const active=href===pageFile;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page')});
  }

  function commandPalette(){
    if(authPages.has(page)||$('.wc-command-backdrop'))return;
    const nav=$('.navora-nav');if(!nav)return;
    const trigger=node('button','wc-command-trigger',{'type':'button','aria-label':'Open quick navigation','aria-haspopup':'dialog',html:'<span class="wc-system-dot"></span><span>Quick</span><kbd>⌘K</kbd>'});
    const theme=nav.querySelector('[data-theme-toggle]');nav.insertBefore(trigger,theme||null);

    const backdrop=node('div','wc-command-backdrop',{'role':'presentation'});
    const dialog=node('section','wc-command',{'role':'dialog','aria-modal':'true','aria-label':'Quick navigation'});
    dialog.innerHTML='<div class="wc-command-head"><span aria-hidden="true">⌕</span><input class="wc-command-input" autocomplete="off" placeholder="Navigate to a Navora workspace…" aria-label="Search navigation commands"></div><div class="wc-command-list" role="listbox"></div>';
    backdrop.append(dialog);body.append(backdrop);
    const input=$('.wc-command-input',dialog),list=$('.wc-command-list',dialog);
    const items=(isAdmin?adminNav:userNav).concat(isAdmin?[]:[['profile.html','Profile','◌'],['notifications.html','Notifications','•']]);
    const render=q=>{
      list.textContent='';const filtered=items.filter(([,label])=>label.toLowerCase().includes(q.toLowerCase()));
      if(!filtered.length){list.append(node('div','wc-command-empty',{text:'No matching workspace.'}));return}
      filtered.forEach(([href,label,icon],i)=>{const b=node('button','wc-command-item',{'type':'button','role':'option','aria-selected':i===0?'true':'false',html:`<span>${icon} &nbsp; ${label}</span><small>${href.replace('.html','')}</small>`});b.dataset.href=href;list.append(b)});
    };
    const open=()=>{backdrop.classList.add('open');render('');setTimeout(()=>input.focus({preventScroll:true}),0)};
    const close=()=>{backdrop.classList.remove('open');trigger.focus()};
    on(trigger,'click',open);
    on(backdrop,'pointerdown',e=>{if(e.target===backdrop)close()});
    on(input,'input',()=>render(input.value));
    on(list,'click',e=>{const b=e.target.closest('.wc-command-item');if(b?.dataset.href)location.href=b.dataset.href});
    on(d,'keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();backdrop.classList.contains('open')?close():open();return}
      if(e.key==='Escape'&&backdrop.classList.contains('open')){e.preventDefault();close();return}
      if(backdrop.classList.contains('open')&&e.key==='Tab'){const focusable=[input,...$$('.wc-command-item',list)];if(focusable.length){const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&d.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&d.activeElement===last){e.preventDefault();first.focus()}}return}
      if(!backdrop.classList.contains('open')||!['ArrowDown','ArrowUp','Enter'].includes(e.key))return;
      const buttons=$$('.wc-command-item',list);if(!buttons.length)return;
      let i=Math.max(0,buttons.findIndex(b=>b.getAttribute('aria-selected')==='true'));
      if(e.key==='Enter'){e.preventDefault();location.href=buttons[i].dataset.href;return}
      e.preventDefault();buttons[i].setAttribute('aria-selected','false');i=(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[i].setAttribute('aria-selected','true');buttons[i].scrollIntoView({block:'nearest'});
    });
  }

  function mobileBottom(){
    if(authPages.has(page)||isAdmin||$('.wc-mobile-bottom'))return;
    const nav=node('nav','wc-mobile-bottom',{'aria-label':'Primary mobile navigation'});
    const picks=[['dashboard.html','⌂','Home'],['map.html','↗','Navigate'],['journey.html','◉','Journey'],['memory.html','◇','Memory']];
    picks.forEach(([href,icon,label])=>{const a=node('a','',{href,'aria-label':label,html:`<span aria-hidden="true">${icon}</span>${label}`});if(href===pageFile)a.classList.add('active');nav.append(a)});body.append(nav);
  }

  function themeMeta(){
    const meta=$('meta[name="theme-color"]')||(()=>{const m=node('meta','',{name:'theme-color'});d.head.append(m);return m})();
    const sync=()=>{meta.content=root.dataset.theme==='dark'?'#08050d':'#ffffff';$$('[data-theme-toggle]').forEach(b=>{const choice=root.dataset.themeChoice||'system';b.setAttribute('aria-label',`Theme: ${choice}. Activate to change theme.`)})};
    sync();on(window,'navora:theme',sync);
  }

  function interactionLayer(){
    on(d,'pointerdown',e=>{
      const btn=e.target.closest('.btn-navora');if(!btn||reduce||btn.disabled)return;
      const r=btn.getBoundingClientRect(),size=Math.max(r.width,r.height)*1.45;
      const ripple=node('span','wc-ripple',{'aria-hidden':'true'});ripple.style.width=ripple.style.height=size+'px';ripple.style.left=(e.clientX-r.left)+'px';ripple.style.top=(e.clientY-r.top)+'px';btn.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
    });
    if(!fine||reduce)return;
    let current=null,queued=false,px=0,py=0;
    on(d,'pointermove',e=>{
      px=e.clientX;py=e.clientY;const candidate=e.target.closest('.card,.route-card,.data-row');
      if(candidate!==current){current?.style.setProperty('--wc-tilt-x','0deg');current?.style.setProperty('--wc-tilt-y','0deg');current=candidate}
      if(!current||queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(!current)return;const r=current.getBoundingClientRect();const x=(px-r.left)/Math.max(1,r.width),y=(py-r.top)/Math.max(1,r.height);current.style.setProperty('--wc-card-x',`${x*100}%`);current.style.setProperty('--wc-card-y',`${y*100}%`);if(!current.closest('.map-layout,.journey-layout')){current.style.setProperty('--wc-tilt-y',`${(x-.5)*2.1}deg`);current.style.setProperty('--wc-tilt-x',`${-(y-.5)*1.7}deg`)}})
    },{passive:true});
    on(d,'pointerout',e=>{if(current&&e.relatedTarget&&!current.contains(e.relatedTarget)){current.style.setProperty('--wc-tilt-x','0deg');current.style.setProperty('--wc-tilt-y','0deg');current=null}},{passive:true});
  }

  function reveals(){
    const candidates=$$('.page-head,.hero > div,.three-shell,.card,.route-card,.chat-side-card,.camera-pane,.navigation-pane').filter(n=>!n.closest('.leaflet-pane'));
    if(reduce||!('IntersectionObserver'in window)){candidates.forEach(n=>n.classList.add('wc-visible'));return}
    candidates.forEach((n,i)=>{n.classList.add('wc-reveal');n.style.transitionDelay=`${Math.min((i%5)*45,180)}ms`});
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('wc-visible');io.unobserve(e.target)}}),{threshold:.045,rootMargin:'70px 0px -10px'});candidates.forEach(n=>io.observe(n));observers.push(io);
  }

  function metricStates(){
    const metrics=$$('.metric,.admin-stat');
    const sync=n=>n.classList.toggle('wc-pending',(n.textContent||'').trim()==='—'||(n.textContent||'').trim()==='');
    metrics.forEach(n=>{sync(n);const mo=new MutationObserver(()=>sync(n));watch(mo,n,{childList:true,subtree:true,characterData:true})});
  }

  function emptyStates(){
    const labels={
      'route-list':'No route alternatives yet. Enter a source and destination to calculate routes.',
      'hazard-list':'No nearby community hazards are currently listed.',
      'memory-list':'No route memories yet. Completed journeys can build familiarity over time.',
      'notification-list':'No notifications right now.',
      'recent-journeys':'No completed journeys yet.',
      'recent-memories':'No route memories yet.',
      'message-list':'No messages in this room yet.',
      'room-list':'No authorized rooms are currently available.',
      'blocked-list':'No blocked users.',
      'replay-events':'No replay events are available for the selected journey.'
    };
    Object.entries(labels).forEach(([id,text])=>{const n=d.getElementById(id);if(n)n.dataset.wcEmpty=text});
  }

  function networkState(){
    const banner=node('div','wc-network-banner',{'role':'status','aria-live':'polite'});body.append(banner);
    const navDot=()=>$('.wc-system-dot');
    let timer=0;
    const render=()=>{
      clearTimeout(timer);const online=navigator.onLine;banner.className='wc-network-banner'+(online?'':' offline');banner.textContent=online?'Connection restored':'You are offline. Navora will use available cached UI where supported.';banner.classList.add('show');navDot()?.classList.toggle('offline',!online);timer=setTimeout(()=>banner.classList.remove('show'),online?2400:5200);
    };
    on(window,'online',render);on(window,'offline',render);if(!navigator.onLine)render();
  }

  function mapExperience(){
    if(page!=='map')return;
    const map=$('#map');const section=map?.parentElement;if(map){map.setAttribute('role','region');map.setAttribute('aria-label','Interactive route comparison map')}
    if(section&&!section.querySelector('.wc-map-status'))section.append(node('div','wc-map-status',{'aria-hidden':'true','text':'MAP / ROUTE GRAPH READY'}));
    const routeList=$('#route-list');
    if(routeList){const mo=new MutationObserver(()=>{$$('.route-card',routeList).forEach((c,i)=>{c.style.animationDelay=`${Math.min(i*55,220)}ms`;c.classList.add('wc-route-enter')})});watch(mo,routeList,{childList:true,subtree:true})}
    if(map){const mo=new MutationObserver(()=>{$$('.leaflet-overlay-pane svg path',map).forEach(p=>p.classList.add('wc-route-path'))});watch(mo,map,{childList:true,subtree:true})}
    const form=$('#route-form');if(form)form.setAttribute('aria-label','Route comparison preferences');
  }

  function journeyExperience(){
    if(page!=='journey')return;
    const risk=$('#risk');
    if(risk){const sync=()=>{const text=(risk.textContent||'').toLowerCase();let level='low';const n=parseFloat(text);if(text.includes('high')||(!Number.isNaN(n)&&n>=.67))level='high';else if(text.includes('medium')||(!Number.isNaN(n)&&n>=.34))level='medium';body.dataset.risk=level};sync();const mo=new MutationObserver(sync);watch(mo,risk,{childList:true,subtree:true,characterData:true})}
    $('#journey-map')?.setAttribute('aria-label','Live journey navigation map');
  }

  function memoryExperience(){
    if(page!=='memory')return;
    const stages=$('.research-stages');if(stages&&!stages.querySelector('.wc-neural-strip'))stages.append(node('div','wc-neural-strip',{'aria-hidden':'true'}));
    $('#three-research')?.setAttribute('aria-label','Three-dimensional neuromorphic, route-memory and swarm-intelligence visualization');
  }

  function dynamicAccessibility(){
    $$('[data-theme-toggle]').forEach(b=>{if(!b.getAttribute('aria-label'))b.setAttribute('aria-label','Change theme')});
    $$('.icon-btn').forEach(b=>{if(!b.getAttribute('aria-label')&&!b.textContent.trim())b.setAttribute('aria-label','Action')});
    $$('input,select,textarea').forEach(input=>{
      if(input.getAttribute('aria-label')||input.getAttribute('aria-labelledby'))return;
      const label=input.id&&d.querySelector(`label[for="${CSS.escape(input.id)}"]`);if(label)return;
      const previous=input.previousElementSibling;if(previous?.tagName==='LABEL')input.setAttribute('aria-label',previous.textContent.trim());
    });
    $$('.card').forEach(c=>{if(c.querySelector('button,a,input,select,textarea'))c.classList.add('wc-interactive-card')});
  }

  function navWatcher(){
    const nav=$('.navora-nav');if(!nav)return;activeNav();
    const syncMobile=()=>body.classList.toggle('wc-nav-open',Boolean(nav.querySelector('.nav-links.mobile-open')));
    const mo=new MutationObserver(()=>{activeNav();syncMobile()});watch(mo,nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    on(d,'click',e=>{if(e.target.closest('.mobile-nav-toggle'))requestAnimationFrame(syncMobile)});
    on(d,'keydown',e=>{if(e.key==='Escape'&&nav.querySelector('.nav-links.mobile-open'))nav.querySelector('.mobile-nav-toggle')?.click()});
  }

  function bootstrapIntegration(){
    const bs=window.bootstrap;if(!bs?.Tooltip)return;
    const tips=[];
    const targets=[...$$('[data-theme-toggle]'),$('.wc-command-trigger'),$('#recenter'),$('#fullscreen-journey'),$('#voice-toggle')].filter(Boolean);
    targets.forEach(el=>{
      if(!el.getAttribute('title')){
        const label=el.getAttribute('aria-label')||(el.textContent||'').trim();
        if(label)el.setAttribute('title',label);
      }
      if(!el.getAttribute('title'))return;
      el.setAttribute('data-bs-toggle','tooltip');
      try{tips.push(bs.Tooltip.getOrCreateInstance(el,{container:'body',trigger:'hover focus',delay:{show:260,hide:60}}))}catch{}
    });
    on(window,'pagehide',()=>tips.forEach(t=>{try{t.dispose()}catch{}}),{once:true});
  }

  function gsapMotion(){
    const g=window.gsap;if(!g||reduce)return;
    try{
      g.fromTo('.navora-nav',{y:-14,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out',clearProps:'transform,opacity'});
      const intro=page==='index'?'.hero h1,.hero .lead,.hero-actions,.wc-hero-pipeline':'.page-head > *';
      if($$(intro).length)g.fromTo(intro,{y:16,opacity:0},{y:0,opacity:1,duration:.58,stagger:.07,ease:'power2.out',delay:.08,clearProps:'transform,opacity'});
      const routeList=$('#route-list');
      if(routeList){
        const mo=new MutationObserver(()=>{const cards=$$('.route-card',routeList).slice(-5);if(cards.length)g.fromTo(cards,{x:-12,opacity:0},{x:0,opacity:1,duration:.38,stagger:.045,ease:'power2.out',clearProps:'transform,opacity'})});
        watch(mo,routeList,{childList:true});
      }
      const risk=$('#risk');
      if(risk){const mo=new MutationObserver(()=>g.fromTo(risk,{scale:.96},{scale:1,duration:.28,ease:'back.out(1.8)',clearProps:'transform'}));watch(mo,risk,{childList:true,subtree:true,characterData:true})}
    }catch{}
  }

  function aosMotion(){
    if(!window.AOS||reduce)return;
    const candidates=$$('.page-head,.hero,.auth-shell,.map-layout,.journey-layout,.three-shell,.data-list').filter(n=>!n.closest('.leaflet-pane'));
    candidates.forEach((n,i)=>{if(!n.dataset.aos){n.dataset.aos=i%2?'fade-up':'fade-in';n.dataset.aosDuration=String(520+Math.min(i%4,3)*55);n.dataset.aosOnce='true'}});
    try{window.AOS.init({once:true,offset:18,duration:560,easing:'ease-out-cubic',disable:()=>matchMedia('(prefers-reduced-motion: reduce)').matches});requestAnimationFrame(()=>window.AOS.refreshHard())}catch{}
  }

  function lottieMotion(){
    if(page!=='index'||reduce||!window.lottie)return;
    const host=$('#lottie-status');if(!host||host.dataset.lottieReady==='1')return;host.dataset.lottieReady='1';
    let anim=null;
    try{anim=window.lottie.loadAnimation({container:host,renderer:'svg',loop:true,autoplay:true,path:'/assets/animations/navora-pulse.json',rendererSettings:{progressiveLoad:true,preserveAspectRatio:'xMidYMid meet'}})}catch{}
    on(window,'pagehide',()=>{try{anim?.destroy()}catch{}},{once:true});
  }

  function init(){
    globalAtmosphere();networkCanvas();themeMeta();enhanceHeadings();heroPipeline();authVisual();passwordToggles();commandPalette();mobileBottom();interactionLayer();reveals();metricStates();emptyStates();networkState();mapExperience();journeyExperience();memoryExperience();dynamicAccessibility();navWatcher();bootstrapIntegration();gsapMotion();aosMotion();lottieMotion();
  }

  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true,signal});else init();
  on(window,'pagehide',()=>{life.abort();observers.forEach(o=>o.disconnect?.())},{once:true});
})();
