const { chromium } = require('../backend/node_modules/playwright');

const BASE=(process.argv[2]||'http://127.0.0.1:5000').replace(/\/$/,'');
const PAGES=[
  'index.html','login.html','register.html','forgot-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html','admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html'
];
const APP=new Set(PAGES.filter(p=>!['index.html','login.html','register.html','forgot-password.html'].includes(p)));
const ADMIN=new Set(['admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html']);
const VIEWPORTS=[{name:'desktop',width:1440,height:900},{name:'tablet',width:1024,height:900},{name:'mobile',width:390,height:844},{name:'landscape',width:844,height:390}];
const assert=(v,m)=>{if(!v)throw new Error(m)};
function mock(path,page){
  const admin=ADMIN.has(page);
  if(path==='/api/v1/users/me')return{role:admin?'ADMIN':'USER',emailVerified:true,name:'Browser User',email:'browser@example.com',preferences:{}};
  if(path==='/api/v1/auth/config')return{google:{enabled:false,clientId:null}};
  if(path==='/api/v1/users/dashboard')return{metrics:{safetyTrend:null,routeMemories:0,successfulJourneys:0,verifiedHazardsAvoided:0,unreadNotifications:0},trend:[],recentJourneys:[],recentMemories:[]};
  if(path==='/api/v1/journeys'||path==='/api/v1/memory'||path==='/api/v1/notifications'||path==='/api/v1/devices'||path==='/api/v1/trusted-contacts')return[];
  if(path==='/api/v1/admin/overview'||path==='/api/v1/admin/health')return{};
  if(path.startsWith('/api/v1/admin/'))return[];
  if(path.startsWith('/api/v1/chat/rooms')||path==='/api/v1/chat/blocks')return[];
  if(path==='/api/v1/geocoding/status')return{effective:'nominatim',typeahead:false};
  if(path.startsWith('/api/v1/hazards/nearby'))return[];
  if(path==='/api/v1/live/readiness')return{ai:{reachable:true,safetyEligible:false},routing:{live:true,provider:'osrm'},warnings:[]};
  return{};
}
async function test(browser,page,vp){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:vp.width,height:vp.height}});
  const p=await context.newPage();const errors=[];const failed=[];
  p.on('pageerror',e=>errors.push(e.stack||e.message));
  await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await p.route('**/api/v1/**',r=>{const u=new URL(r.request().url());return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:mock(u.pathname,page)})})});
  await p.goto(`${BASE}/${page}`,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});
  const result=await p.evaluate(()=>{
    const root=document.documentElement,body=document.body;
    const scrollWidth=root.scrollWidth,clientWidth=root.clientWidth;
    const shell=document.querySelector('.page-shell, .map-layout, .journey-layout, .chat-layout');
    const nav=document.querySelector('.navora-nav');
    const frames=[...document.querySelectorAll('.camera-pane,#map,#journey-map,.replay-map,#journey-detail-map,.three-shell,#three-hero,#three-research,.media-frame,.video-frame')];
    const grids=[...document.querySelectorAll('.grid,.grid-2,.grid-3,.grid-4,.journey-layout,.map-layout,.replay-grid,.chat-layout')];
    const overflow=[];
    const isScrollableRegion=(el)=>{
      let current=el;
      while(current && current !== document.body){
        if(current.tagName==='TABLE' && (current.classList.contains('pg-table-edge') || current.classList.contains('table-modern'))){
          return true;
        }
        const className=typeof current.className==='string' ? current.className : '';
        const isKnownScrollableWrapper=/\b(table-wrap|table-responsive|data-table-wrap|live-field-bar)\b/.test(className);
        if(isKnownScrollableWrapper){
          const style=getComputedStyle(current);
          const overflowX=style.overflowX || style.overflow;
          if(overflowX==='auto' || overflowX==='scroll' || overflowX==='overlay') return true;
        }
        current=current.parentElement;
      }
      return false;
    };
    const isClosedMobileNav=(el)=>{
      const navEl=el.closest('.navora-nav');
      if(!navEl) return false;
      if(document.body.classList.contains('nav-open')) return false;
      const style=getComputedStyle(navEl);
      return style.transform !== 'none' || style.translate !== 'none';
    };
    const isClosedProfileDock=(el)=>{
      const profile=el.closest('.navora-profile-global-v17');
      if(!profile) return false;
      if(document.body.classList.contains('nav-open')) return false;
      const style=getComputedStyle(profile);
      return style.transform !== 'none' || style.translate !== 'none' || style.opacity === '0';
    };
    const isMapToggleClosed=(el)=>{
      const toggle=el.closest('.obs-map-sheet-toggle');
      if(!toggle) return false;
      return !document.body.classList.contains('obs-map-sheet-open');
    };
    for(const el of [...document.querySelectorAll('body *')]){
      const r=el.getBoundingClientRect();
      const isAmbient=el.closest('.ui-ambient, .ui-orb, [aria-hidden="true"]') !== null;
      const isLeaflet=el.closest('.leaflet-pane, .leaflet-map-pane, .leaflet-control-container, .leaflet-control, .leaflet-proxy, .leaflet-zoom-animated, .leaflet-tile-pane, .leaflet-marker-pane, .leaflet-overlay-pane') !== null;
      const liveBar=el.closest('.live-field-bar');
      const liveBarScrollable=Boolean(liveBar && (getComputedStyle(liveBar).overflowX === 'auto' || getComputedStyle(liveBar).overflowX === 'scroll'));
      const skip = isAmbient || isLeaflet || isClosedMobileNav(el) || isClosedProfileDock(el) || isMapToggleClosed(el) || liveBarScrollable || isScrollableRegion(el);
      if((r.right>innerWidth+2||r.left<-2)&&!skip)overflow.push({tag:el.tagName,cls:String(el.className||'').slice(0,100),right:Math.round(r.right),left:Math.round(r.left)});
      if(overflow.length>8)break
    }
    return{
      width:innerWidth,scrollWidth,clientWidth,bodyClass:body.className,
      shell:Boolean(shell),nav:Boolean(nav),styleLoaded:Boolean(document.querySelector('link[data-navora-ui-layout-v23]')),
      frameCount:frames.length,framed:frames.filter(el=>{const s=getComputedStyle(el);return s.borderRadius!=='0px'&&s.overflow==='hidden'}).length,
      gridCount:grids.length,overflow,bodyScrollY:scrollY
    };
  });
  if(errors.length)failed.push(`page errors: ${errors.slice(0,3).join(' | ')}`);
  assert(result.styleLoaded,`${page}@${vp.name}: V23 stylesheet not loaded`);
  assert(result.scrollWidth<=result.clientWidth+2,`${page}@${vp.name}: horizontal page overflow ${result.scrollWidth}>${result.clientWidth}`);
  assert(result.overflow.length===0,`${page}@${vp.name}: ${JSON.stringify(result.overflow)}`);
  assert(result.bodyScrollY===0,`${page}@${vp.name}: body scrollY=${result.bodyScrollY}`);
  if(APP.has(page))assert(result.shell&&result.nav,`${page}@${vp.name}: authenticated shell missing`);
  if(result.frameCount>0)assert(result.framed===result.frameCount,`${page}@${vp.name}: media frames ${result.framed}/${result.frameCount} not framed`);
  if(failed.length)throw new Error(failed.join(' | '));
  await context.close();
  return result;
}
(async()=>{
  const browser=await chromium.launch({headless:true});const failures=[];let passes=0;
  for(const vp of VIEWPORTS){for(const page of PAGES){try{await test(browser,page,vp);passes++;console.log(`PASS ${vp.name} ${page}`)}catch(e){failures.push(`${vp.name} ${page}: ${e.message}`);console.error(`FAIL ${vp.name} ${page}: ${e.message}`)}}}
  await browser.close();
  console.log(`\nNAVORA V23 ALL-PAGES UI E2E: ${failures.length?'FAIL':'PASS'} (${passes}/${PAGES.length*VIEWPORTS.length})`);
  if(failures.length){failures.forEach(f=>console.error(` - ${f}`));process.exit(1)}
})();
