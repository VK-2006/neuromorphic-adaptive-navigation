const {chromium}=require('../backend/node_modules/playwright');
const BASE=(process.argv[2]||'http://127.0.0.1:5000').replace(/\/$/,'');
const pages=['index.html','register.html','verify-email.html','login.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html','camera-share.html','shared-journey.html','offline.html','admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html'];
if(pages.length!==28)throw new Error(`V8 page contract expected 28 pages, found ${pages.length}`);
const auth=new Set(['register.html','verify-email.html','login.html','forgot-password.html','verify-otp.html','reset-password.html']);
const publicPages=new Set(['index.html','shared-journey.html','offline.html',...auth]);
const adminPages=new Set(['admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html']);
const ok=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data})});
function mock(path,method,page){
  if(path==='/api/v1/users/me')return publicPages.has(page)?{status:401,data:null}:{status:200,data:{id:'sweep-user',_id:'sweep-user',name:'Sweep User',email:'sweep@example.com',role:adminPages.has(page)?'ADMIN':'USER',emailVerified:true,preferences:{}}};
  if(path==='/api/v1/auth/refresh')return{status:401,data:null};
  if(path==='/api/v1/auth/config')return{status:200,data:{google:{enabled:false,clientId:null}}};
  if(path==='/api/v1/auth/email/status')return{status:200,data:{configured:true,providerReachable:true,senderRegistered:true,senderActive:true}};
  if(path==='/api/v1/users/dashboard')return{status:200,data:{metrics:{safetyTrend:null,routeMemories:0,successfulJourneys:0,verifiedHazardsAvoided:0},trend:[],recentJourneys:[],recentMemories:[]}};
  if(path==='/api/v1/journeys')return{status:200,data:[]};
  if(path.startsWith('/api/v1/journeys/shared/'))return{status:200,data:{status:'ACTIVE',destination:{label:'Sweep destination'},distanceCovered:100,distanceRemaining:900,updatedAt:new Date().toISOString(),emergencyActive:false,lastKnownPosition:{lat:17.38,lng:78.48}}};
  if(path==='/api/v1/memory'||path==='/api/v1/notifications'||path==='/api/v1/devices'||path==='/api/v1/trusted-contacts')return{status:200,data:[]};
  if(path==='/api/v1/admin/overview')return{status:200,data:{}};
  if(path==='/api/v1/admin/health')return{status:200,data:{}};
  if(['/api/v1/admin/users','/api/v1/admin/devices','/api/v1/admin/hazards','/api/v1/admin/chat/reports','/api/v1/admin/audit'].includes(path))return{status:200,data:[]};
  if(path.startsWith('/api/v1/chat/rooms'))return{status:200,data:[]};
  if(path==='/api/v1/chat/blocks')return{status:200,data:[]};
  if(path==='/api/v1/geocoding/status')return{status:200,data:{effective:'tomtom',typeahead:false}};
  if(path.startsWith('/api/v1/geocoding/reverse'))return{status:200,data:{label:'Sweep point',name:'Sweep point',lat:17.38,lng:78.48}};
  if(path.startsWith('/api/v1/hazards/nearby'))return{status:200,data:[]};
  if(path==='/api/v1/live/readiness')return{status:200,data:{ai:{reachable:true,safetyEligible:false},routing:{live:true,provider:'osrm'},warnings:[]}};
  if(method==='GET')return{status:200,data:{}};
  return{status:200,data:{}};
}
async function contextFor(browser,page,{corruptStorage=false,blockLeaflet=false}={}){
  const c=await browser.newContext({serviceWorkers:'block'});
  await c.addInitScript(({corruptStorage})=>{
    if(corruptStorage){
      localStorage.setItem('navoraChatUnread','{bad-json');
      localStorage.setItem('navora:recent-routes','{bad-json');
      localStorage.setItem('navora:preferences','{bad-json');
      localStorage.setItem('navora:last-route-request','{bad-json');
      localStorage.setItem('navora:last-route-query','{bad-json');
    }
  },{corruptStorage});
  const p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.stack||e.message));
  if(blockLeaflet)await p.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await p.route('**/api/v1/**',r=>{
    const u=new URL(r.request().url()),m=mock(u.pathname+u.search,r.request().method(),page);
    return ok(r,m.data,m.status);
  });
  return{c,p,errors};
}
async function main(){
  const browser=await chromium.launch({headless:true}),fail=[];
  const test=async(name,fn)=>{try{await fn();console.log('PASS ',name)}catch(e){fail.push(`${name}: ${e.message}`);console.error('FAIL ',name,'—',e.message)}};
  for(const page of pages){
    await test(`initial-load ${page}`,async()=>{
      const {c,p,errors}=await contextFor(browser,page);
      const suffix=page==='shared-journey.html'?'?token=sweep':'';
      await p.goto(`${BASE}/${page}${suffix}`,{waitUntil:'domcontentloaded',timeout:60000});
      await p.waitForTimeout(900);
      if(page==='index.html'||page==='offline.html'||page==='shared-journey.html'){
        if(!p.url().includes(page))throw new Error(`public page redirected unexpectedly to ${p.url()}`);
      }
      if(errors.length)throw new Error(errors.join(' | '));
      await c.close();
    });
  }
  await test('corrupted localStorage does not crash Offline or World Chat',async()=>{
    for(const page of ['offline.html','world-chat.html']){
      const {c,p,errors}=await contextFor(browser,page,{corruptStorage:true});
      await p.goto(`${BASE}/${page}`,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(900);
      if(errors.length)throw new Error(`${page}: ${errors.join(' | ')}`);await c.close();
    }
  });
  await test('Replay degrades safely when Leaflet is unavailable',async()=>{
    const {c,p,errors}=await contextFor(browser,'journey-replay.html',{blockLeaflet:true});
    await p.goto(`${BASE}/journey-replay.html`,{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(900);
    if(errors.length)throw new Error(errors.join(' | '));
    const text=await p.locator('#replay-map').innerText();if(!/Map unavailable/i.test(text))throw new Error('Replay did not expose Leaflet fallback state');
    await c.close();
  });
  await browser.close();
  if(fail.length){console.error('\nNAVORA V8 FULL-PAGE RUNTIME SWEEP: FAIL');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
  console.log('\nNAVORA V8 FULL-PAGE RUNTIME SWEEP: PASS');
}
main().catch(e=>{console.error(e);process.exit(1)});
