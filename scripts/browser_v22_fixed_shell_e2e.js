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
      const spacer=document.createElement('div');
      spacer.style.height='1800px';
      panel?.appendChild(spacer);
      if(panel){panel.style.scrollBehavior='auto';void panel.scrollHeight;await new Promise(r=>requestAnimationFrame(r));panel.scrollTop=700;}
    }
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const after={top:nav.getBoundingClientRect().top,left:nav.getBoundingClientRect().left};
    return{missing:false,before,after,position:getComputedStyle(nav).position,navLinksOverflowY:getComputedStyle(links).overflowY,bodyScrollY:scrollY};
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
    spacer.style.height='2400px';spacer.style.minHeight='2400px';spacer.style.width='1px';spacer.setAttribute('aria-hidden','true');
    shell.appendChild(spacer);
    shell.style.scrollBehavior='auto';
    void shell.scrollHeight;
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const before=nav.getBoundingClientRect().top;
    const scrollHeight=shell.scrollHeight,clientHeight=shell.clientHeight;
    shell.scrollTop=Math.min(900,Math.max(0,scrollHeight-clientHeight));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const style=getComputedStyle(shell);
    const ui=getComputedStyle(document.documentElement).getPropertyValue('--ui-scroll').trim();
    const motion=getComputedStyle(document.documentElement).getPropertyValue('--motion-scroll').trim();
    return{missing:false,before,after:nav.getBoundingClientRect().top,bodyScrollY:scrollY,shellScrollTop:shell.scrollTop,scrollHeight,clientHeight,computedHeight:style.height,overflow:style.overflowY,display:style.display,ui,motion};
  });
  if(errors.length)throw new Error(`${page}: page errors: ${errors.join(' | ')}`);
  assert(!result.missing,`${page}: page-shell missing`);
  assert(Math.abs(result.before-result.after)<0.5,`${page}: nav moved during right-pane scroll`);
  assert(result.bodyScrollY===0,`${page}: body scrolled while page-shell scrolled`);
  assert(result.scrollHeight>result.clientHeight,`${page}: no overflow range scrollHeight=${result.scrollHeight} clientHeight=${result.clientHeight} height=${result.computedHeight} overflow=${result.overflow} display=${result.display}`);
  assert(result.shellScrollTop>400,`${page}: page-shell scrollTop=${result.shellScrollTop} range=${result.scrollHeight-result.clientHeight} height=${result.computedHeight} overflow=${result.overflow} display=${result.display}`);
  assert(result.overflow==='auto'||result.overflow==='scroll',`${page}: page-shell overflow=${result.overflow}`);
  assert(result.ui&&result.ui!=='0%'&&result.ui!=='0.000%',`${page}: --ui-scroll did not update (${result.ui})`);
  assert(Number(result.motion)>0,`${page}: --motion-scroll did not update (${result.motion})`);
  await context.close();
}


async function checkResponsiveNoOverlap(browser,page,width){
  const opened=await browserPage(browser,page,{width,height:900});
  const context=opened.context,p=opened.p,errors=opened.errors;
  const result=await p.evaluate(()=>{
    const nav=document.querySelector('body > .navora-nav');
    const main=document.querySelector('body > main');
    const bar=document.querySelector('body > .live-field-bar:not(.hidden)');
    const toggle=document.querySelector('.nav-mobile-toggle');
    if(!nav||!main)return{missing:true};
    const nr=nav.getBoundingClientRect(),mr=main.getBoundingClientRect(),br=bar?.getBoundingClientRect();
    return{
      missing:false,
      nav:{left:nr.left,right:nr.right,width:nr.width},
      main:{left:mr.left,right:mr.right,width:mr.width},
      bar:br?{left:br.left,right:br.right,width:br.width}:null,
      viewport:innerWidth,
      navTransform:getComputedStyle(nav).transform,
      toggleDisplay:toggle?getComputedStyle(toggle).display:'missing',
      bodyScrollX:scrollX,
      documentWidth:document.documentElement.scrollWidth
    };
  });
  if(errors.length)throw new Error(page+' @ '+width+'px: page errors: '+errors.join(' | '));
  assert(!result.missing,page+' @ '+width+'px: nav/main missing');
  assert(result.navTransform==='none',page+' @ '+width+'px: desktop nav transform='+result.navTransform);
  assert(result.toggleDisplay==='none',page+' @ '+width+'px: mobile toggle visible on desktop');
  assert(result.main.left+0.5>=result.nav.right,page+' @ '+width+'px: main overlaps rail ('+result.main.left+' < '+result.nav.right+')');
  assert(result.main.right<=result.viewport+0.5,page+' @ '+width+'px: main exceeds viewport ('+result.main.right+' > '+result.viewport+')');
  if(result.bar){
    assert(result.bar.left+0.5>=result.nav.right,page+' @ '+width+'px: status bar overlaps rail');
    assert(result.bar.right<=result.viewport+0.5,page+' @ '+width+'px: status bar exceeds viewport');
  }
  assert(result.bodyScrollX===0,page+' @ '+width+'px: horizontal window scroll='+result.bodyScrollX);
  assert(result.documentWidth<=result.viewport+1,page+' @ '+width+'px: document width='+result.documentWidth+' viewport='+result.viewport);
  await context.close();
}

async function checkJourneyMobileNoOverlap(browser){
  const opened=await browserPage(browser,'journey.html',{width:390,height:844});
  const context=opened.context,p=opened.p,errors=opened.errors;
  const result=await p.evaluate(()=>{
    const toggle=document.querySelector('.nav-mobile-toggle');
    const bar=document.querySelector('body > .live-field-bar');
    const chip=bar?.querySelector('.chip');
    const main=document.querySelector('body > main.journey-layout');
    if(!toggle||!bar||!chip||!main)return{missing:true};
    const tr=toggle.getBoundingClientRect(),cr=chip.getBoundingClientRect(),mr=main.getBoundingClientRect();
    const overlaps=!(tr.right<=cr.left||tr.left>=cr.right||tr.bottom<=cr.top||tr.top>=cr.bottom);
    return{missing:false,overlaps,toggleRight:tr.right,chipLeft:cr.left,mainLeft:mr.left,mainRight:mr.right,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth};
  });
  if(errors.length)throw new Error('mobile journey: page errors: '+errors.join(' | '));
  assert(!result.missing,'mobile journey: toggle/status/main missing');
  assert(!result.overlaps,'mobile journey: drawer toggle overlaps first status chip ('+result.toggleRight+' > '+result.chipLeft+')');
  assert(result.mainLeft>=-0.5&&result.mainRight<=result.viewport+0.5,'mobile journey: main exceeds viewport');
  assert(result.documentWidth<=result.viewport+1,'mobile journey: horizontal overflow '+result.documentWidth+' > '+result.viewport);
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
  for(const width of [821,900,1024]){
    for(const page of ['dashboard.html','map.html','journey.html']){
      try{await checkResponsiveNoOverlap(browser,page,width);console.log('PASS responsive-no-overlap',page,width)}
      catch(error){failures.push(error.message);ghaError(error.message);console.error('FAIL responsive-no-overlap',page,width,'—',error.message)}
    }
  }
  try{await checkJourneyMobileNoOverlap(browser);console.log('PASS mobile journey no-overlap')}
  catch(error){failures.push(error.message);ghaError(error.message);console.error('FAIL mobile journey no-overlap —',error.message)}
  try{await mobileDrawer(browser);console.log('PASS mobile fixed drawer')}catch(error){failures.push(error.message);ghaError(error.message);console.error('FAIL mobile fixed drawer —',error.message)}
  await browser.close();
  if(failures.length){console.error('\nNAVORA V22 FIXED-SHELL BROWSER E2E: FAIL');failures.forEach(f=>console.error(' -',f));process.exit(1)}
  console.log('\nNAVORA V22 FIXED-SHELL BROWSER E2E: PASS');
}
main().catch(error=>{ghaError(error.message||error);console.error(error);process.exit(1)});
