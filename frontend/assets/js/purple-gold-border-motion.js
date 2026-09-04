/* NAVORA v9.3 - Purple x Gold page-aware border motion repair */
(()=>{
  'use strict';
  const body=document.body;if(!body)return;
  if(body.dataset.pgV93==='1')return;
  body.dataset.pgV93='1';

  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase().replace(/\.html$/,'')||'index';
  const groups={
    home:new Set(['index']),
    auth:new Set(['login','register','forgot-password','reset-password','verify-email','verify-otp']),
    dashboard:new Set(['dashboard','memory','history','notifications','profile','settings']),
    map:new Set(['map']),
    journey:new Set(['journey','journey-replay','shared-journey']),
    admin:new Set(['admin','admin-audit','admin-chat','admin-hazards','admin-health','admin-users']),
    chat:new Set(['world-chat']),devices:new Set(['devices']),offline:new Set(['offline'])
  };
  let group='data';
  for(const [name,set] of Object.entries(groups))if(set.has(page)){group=name;break}
  body.classList.add(`pg-page-${group}`);body.dataset.pgPage=page;body.dataset.pgGroup=group;

  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const nodes=(scope,s)=>{
    const out=[];if(scope instanceof Element&&scope.matches(s))out.push(scope);
    out.push(...$$(s,scope));return out;
  };
  const skip=el=>!el||el.closest('.leaflet-control,.leaflet-pane,.leaflet-popup-pane')||el.dataset.pgBorder==='off';

  const observed=new WeakSet();
  const io=!reduce&&'IntersectionObserver'in window
    ?new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('pg-in-view',entry.isIntersecting)),
      {rootMargin:'120px 0px 120px 0px',threshold:.01})
    :null;
  const observeEnergy=el=>{
    if(io){if(!observed.has(el)){observed.add(el);io.observe(el)}}
    else el.classList.add('pg-in-view');
  };
  const role=(el,name)=>{
    if(skip(el))return;
    el.classList.add('pg-border-energy',name);el.dataset.pgBorderRole=name;observeEnergy(el);
  };

  function decorateOne(el){
    if(skip(el))return;

    if(el.matches('button,a.btn-navora,[role="button"]')){
      role(el,'pg-border-btn');
      const primary=(el.matches('button[type="submit"]')||el.classList.contains('btn-navora'))&&!el.classList.contains('btn-ghost')&&!el.classList.contains('danger');
      el.classList.toggle('pg-primary-energy',primary);
      if(el.classList.contains('danger')||el.id==='sos'||el.getAttribute('data-variant')==='danger')el.classList.add('pg-danger-edge');
    }

    if(el.matches('.route-card')) role(el,'pg-route-signal');
    else if(el.matches('.card,.auth-card,.stat-card,.metric-card,.dashboard-card')){
      role(el,'pg-border-card');
      if(el.matches('.auth-card')||group==='auth')el.classList.add('pg-auth-aura');
      if(el.querySelector('.metric')||el.matches('.stat-card,.metric-card'))el.classList.add('pg-metric-orbit');
      if(group==='admin')el.classList.add('pg-admin-restraint');
    }

    if(el.matches('.camera-pane')){
      el.classList.add('pg-safe-edge');
    }else if(el.matches('.navigation-pane,.panel,.glass-panel,.journey-stats,.reroute-panel,.share-box,.field-safety-note,.data-list,.chat-panel,.device-card,.table-responsive')){
      if(!el.classList.contains('card')&&!el.classList.contains('route-card')){
        role(el,group==='map'||group==='journey'?'pg-route-signal':'pg-border-panel');
        if(group==='admin')el.classList.add('pg-admin-restraint');
      }
    }

    if(el.matches('table'))el.classList.add('pg-table-edge');
    if(el.matches('input,textarea,select,.input,.select,.form-control'))el.classList.add('pg-focus-energy');
    if(el.matches('.chip,.badge,.status-pill,[data-status]'))el.classList.add('pg-chip-energy');
  }

  const selector=[
    'button','a.btn-navora','[role="button"]','.card','.auth-card','.route-card','.stat-card','.metric-card','.dashboard-card',
    '.camera-pane','.navigation-pane','.panel','.glass-panel','.journey-stats','.reroute-panel','.share-box','.field-safety-note',
    '.data-list','.chat-panel','.device-card','.table-responsive','table','input','textarea','select','.input','.select','.form-control',
    '.chip','.badge','.status-pill','[data-status]'
  ].join(',');

  function decorate(scope=document){nodes(scope,selector).forEach(decorateOne)}
  function syncActiveNav(){
    $$('.nav-links a,nav a').forEach(a=>{
      let target='';
      try{target=new URL(a.getAttribute('href')||'',location.href).pathname.split('/').pop()||''}catch{}
      a.classList.toggle('pg-active-nav',target===(page==='index'?'index.html':`${page}.html`));
    });
  }
  decorate();syncActiveNav();

  const mo=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof Element)decorate(node)}));
    syncActiveNav();
  });
  mo.observe(body,{childList:true,subtree:true});

  addEventListener('pagehide',()=>{io?.disconnect();mo.disconnect()},{once:true});

  window.NavoraPurpleGoldMotion={
    page,group,dynamic:true,
    get counts(){return{
      buttons:document.querySelectorAll('.pg-border-btn').length,
      cards:document.querySelectorAll('.pg-border-card').length,
      routeSignals:document.querySelectorAll('.pg-route-signal').length,
      panels:document.querySelectorAll('.pg-border-panel').length,
      focusFields:document.querySelectorAll('.pg-focus-energy').length,
      chips:document.querySelectorAll('.pg-chip-energy').length
    }}
  };
})();
