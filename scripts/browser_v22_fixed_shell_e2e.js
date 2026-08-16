const {chromium}=require('../backend/node_modules/playwright');

const BASE=(process.argv[2]||'http://127.0.0.1:5000').replace(/\/$/,'');
const APP_PAGES=['dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html'];
const ADMIN_PAGES=['admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html'];
const SHELL_PAGES=new Set(['dashboard.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html',...ADMIN_PAGES]);
const assert=(value,message)=>{if(!value)throw new Error(message)};
const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data})});
const ghaError=message=>console.error(`::error title=V22 browser E2E::${String(message).replace(/\r?\n/g,'%0A')}`);

function apiMock(path,page){
  const admin=ADMIN_PAGES.includes(page);
  if(path==='/api/v1/users/me')return{status:200,data:{_id:'browser-user',id:'browser-user',name:'Browser User',email:'browser@example.com',role:admin?'ADMIN':'USER',emailVerified:true,preferences:{}}};
  if(path==='/api/v1/auth/config')return{status:200,data:{google:{enabled:false,clientId:null}}};
  if(path==='/api/v1/users/dashboard')return{status:200,data:{metrics:{safetyTrend:null,routeMemories:0,successfulJourneys:0,verifiedHazardsAvoided:0,unreadNotifications:0},trend:[],recentJourneys:[],recentMemories:[]}};
  if(path==='/api/v1/journeys')return{status:200,data:[]};
  if(path==='/api/v1/memory'||path==='/api/v1/notifications'||path==='/api/v1/devices'||path==='/api/v1/trusted-contacts')return{status:200,data:[]};
  if(path==='/api/v1/admin/overview'||path==='/api/v1/admin/health')return{status:200,data:{}};
  if(['/api/v1/admin/users','/api/v1/admin/devices','/api/v1/admin/hazards','/api/v1/admin/chat/reports','/api/v1/admin/audit'].includes(path))return{status:200,data:[]};
  if(path.startsWith('/api/v1/chat/rooms'))return{status:200,data:[]};
  if(path==='/api/v1/chat/blocks')return{status:200,data:[]};
  if(path==='/api/v1/geocoding/status')return{status:200,data:{effective:'nominatim',typeahead:false}};
  if(path.startsWith('/api/v1/hazards/nearby'))return{status:200,data:[]};
  if(path==='/api/v1/live/readiness')return{status:200,data:{ai:{reachable:true,safetyEligible:false},routing:{live:true,provider:'osrm'},warnings:[]}};
  return{status:200,data:{}};
}

async function browserPage(browser,page,viewport={width:1440,height:900}){
  const context=await browser.newContext({serviceWorkers:'block',viewport});
  const errors=[];
  const p=await context.newPage();
  p.on('pageerror',error=>errors.push(error.stack||error.message));
  await p.route('https://accounts.google.com/gsi/client',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await p.route('**/api/v1/**',route=>{
    const url=new URL(route.request().url());
    const mock=apiMock(url.pathname,page);
    return reply(route,mock.data,mock.status);
  });
  await p.goto(`${BASE}/${page}`,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(()=>document.body.classList.contains('navora-app')||document.body.classList.contains('navora-admin'),null,{timeout:15000});
  // V22 is injected by the all-page profile loader after the legacy V20 layer.
  // Wait for the stylesheet to be parsed and visibly authoritative before taking
  // physical scroll measurements, especially on cockpit pages with no page-shell.
  await p.waitForFunction(()=>{
    const link=document.querySelector('link[data-navora-right-pane-v22]');
    const nav=document.querySelector('body > .navora-nav');
    return Boolean(link?.sheet&&nav&&getComputedStyle(nav).position==='fixed');
  },null,{timeout:15000});
  if(SHELL_PAGES.has(page))await p.waitForFunction(()=>Boolean(window.NavoraScrollSurfaceV22),null,{timeout:15000});
  return{context,p,errors};
}

async function checkNavFixed(browser,page){
  const {context,p,errors}=await browserPage(browser,page);
  const result=await p.evaluate(async()=>{
    const nav=document.querySelector('body > .navora-nav');
    const links=nav?.querySelector(':scope > .nav-links');
    const main=document.querySelector('body > main');
    if(!nav||!links||!main)return{missing:true};
    const before={top:nav.getBoundingClientRect().top,left:nav.getBoundingClientRect().left};
    window.scrollTo(0,800);
    if(main.classList.contains('map-layout')){
      const panel=main.querySelector('.route-panel');
      const spacer=document.createElement('div');spacer.style.height='1800px';panel?.appendChild(spacer);if(panel)panel.scrollTop=700;
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const after={top:nav.getBoundingClientRect().top,left:nav.getBoundingClientRect().left};
    return{
      missing:false,before,after,
      position:getComputedStyle(nav).position,
      navLinksOverflowY:getComputedStyle(links).overflowY,
      bodyScrollY:scrollY
    };
  });
  if(errors.length)throw new Error(`${page}: page errors: ${errors.join(' | ')}`);
  assert(!result.missing,`${page}: nav/main missing`);
  assert(result.position==='fixed',`${page}: nav position=${result.position}`);
  assert(Math.abs(result.before.top-result.after.top)<0.5,`${page}: nav moved vertically ${result.before.top} -> ${result.after.top}`);
  assert(Math.abs(result.before.left-result.after.left)<0.5,`${page}: nav moved horizontally`);
  assert(Math.abs(result.after.top)<0.5,`${page}: nav top=${result.after.top}`);
  assert(result.bodyScrollY===0,`${page}: body/window scrolled (${result.bodyScrollY})`);
  assert(result.navLinksOverflowY==='hidden',`${page}: normal-height Navigation Workspace overflow=${result.navLinksOverflowY}`);
  await context.close();
}

async function checkRightPaneScroll(browser,page){
  const {context,p,errors}=await browserPage(browser,page);
  const result=await p.evaluate(async()=>{
    const nav=document.querySelector('body > .navora-nav');
    const shell=document.querySelector('body > .page-shell');
    if(!nav||!shell)return{missing:true};
    const spacer=document.createElement('div');
    spacer.style.height='2400px';spacer.style.width='1px';spacer.setAttribute('aria-hidden','true');shell.appendChild(spacer);
    const before=nav.getBoundingClientRect().top;
    shell.scrollTop=900;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const ui=getComputedStyle(document.documentElement).getPropertyValue('--ui-scroll').trim();
    const motion=getComputedStyle(document.documentElement).getPropertyValue('--motion-scroll').trim();
    return{missing:false,before,after:nav.getBoundingClientRect().top,bodyScrollY:scrollY,shellScrollTop:shell.scrollTop,overflow:getComputedStyle(shell).overflowY,ui,motion};
  });
  if(errors.length)throw new Error(`${page}: page errors: ${errors.join(' | ')}`);
  assert(!result.missing,`${page}: page-shell missing`);
  assert(Math.abs(result.before-result.after)<0.5,`${page}: nav moved during right-pane scroll`);
  assert(result.bodyScrollY===0,`${page}: body scrolled while page-shell scrolled`);
  assert(result.shellScrollTop>400,`${page}: page-shell scrollTop=${result.shellScrollTop}`);
  assert(result.overflow==='auto'||result.overflow==='scroll',`${page}: page-shell overflow=${result.overflow}`);
  assert(result.ui&&result.ui!=='0%'&&result.ui!=='0.000%',`${page}: --ui-scroll did not update (${result.ui})`);
  assert(Number(result.motion)>0,`${page}: --motion-scroll did not update (${result.motion})`);
  await context.close();
}

async function mobileDrawer(browser){
  const {context,p,errors}=await browserPage(browser,'dashboard.html',{width:390,height:844});
  const toggle=p.locator('.nav-mobile-toggle');
  await toggle.waitFor({state:'visible',timeout:10000});await toggle.click();
  await p.waitForFunction(()=>document.body.classList.contains('nav-open'),null,{timeout:5000});
  const state=await p.evaluate(()=>{const nav=document.querySelector('body > .navora-nav'),shell=document.querySelector('body > .page-shell');return{position:getComputedStyle(nav).position,top:nav.getBoundingClientRect().top,bodyScroll:scrollY,shellOverflow:getComputedStyle(shell).overflowY}});
  if(errors.length)throw new Error(`mobile dashboard: ${errors.join(' | ')}`);
  assert(state.position==='fixed','mobile drawer is not viewport-fixed');
  assert(Math.abs(state.top)<0.5,`mobile drawer top=${state.top}`);
  assert(state.bodyScroll===0,`mobile body scroll=${state.bodyScroll}`);
  assert(state.shellOverflow==='auto'||state.shellOverflow==='scroll',`mobile page-shell overflow=${state.shellOverflow}`);
  await context.close();
}

async function main(){
  const browser=await chromium.launch({headless:true});const failures=[];
  for(const page of [...APP_PAGES,...ADMIN_PAGES]){
    try{await checkNavFixed(browser,page);console.log('PASS fixed-nav',page)}catch(error){failures.push(error.message);ghaError(error.message);console.error('FAIL fixed-nav',page,'—',error.message)}
  }
  for(const page of SHELL_PAGES){
    try{await checkRightPaneScroll(browser,page);console.log('PASS right-pane-scroll',page)}catch(error){failures.push(error.message);ghaError(error.message);console.error('FAIL right-pane-scroll',page,'—',error.message)}
  }
  try{await mobileDrawer(browser);console.log('PASS mobile fixed drawer')}catch(error){failures.push(error.message);ghaError(error.message);console.error('FAIL mobile fixed drawer —',error.message)}
  await browser.close();
  if(failures.length){console.error('\nNAVORA V22 FIXED-SHELL BROWSER E2E: FAIL');failures.forEach(f=>console.error(' -',f));process.exit(1)}
  console.log('\nNAVORA V22 FIXED-SHELL BROWSER E2E: PASS');
}
main().catch(error=>{ghaError(error.message||error);console.error(error);process.exit(1)});
