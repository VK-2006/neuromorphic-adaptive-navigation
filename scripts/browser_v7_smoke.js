const {chromium}=require('../backend/node_modules/playwright');
const BASE=(process.argv[2]||'https://navora-backend-clzp.onrender.com').replace(/\/$/,'');
const assert=(x,m)=>{if(!x)throw new Error(m)};
const fulfill=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data})});
async function waitClass(p,c){await p.waitForFunction(x=>document.body.classList.contains(x),c,{timeout:15000})}
async function main(){
 const browser=await chromium.launch({headless:true}),fail=[];
 const test=async(name,fn)=>{try{await fn();console.log('PASS ',name)}catch(e){fail.push(`${name}: ${e.message}`);console.error('FAIL ',name,'—',e.message)}};

 await test('anonymous protected page redirects to login',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();
  await p.goto(BASE+'/dashboard.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForURL(/login\.html\?returnTo=/,{timeout:15000});assert(p.url().includes('dashboard.html'),'returnTo missing');await c.close();
 });

 await test('register -> verify -> login -> dashboard button wiring',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
  await p.route('**/api/v1/auth/register',r=>fulfill(r,{delivery:{delivery:'live'}}));
  await p.route('**/api/v1/auth/email/status',r=>fulfill(r,{configured:true,providerReachable:true,senderRegistered:true,senderActive:true}));
  await p.route('**/api/v1/auth/verify-email',r=>fulfill(r,{verified:true}));
  await p.route('**/api/v1/auth/login',r=>fulfill(r,{loggedIn:true}));
  await p.route('**/api/v1/auth/config',r=>fulfill(r,{google:{enabled:false,clientId:null}}));
  await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await p.goto(BASE+'/register.html',{waitUntil:'domcontentloaded',timeout:60000});await waitClass(p,'navora-auth');
  assert(await p.locator('link[href="/assets/css/navora-v7.css"]').count()===1,'V7/V9 application CSS missing');
  assert(await p.locator('script[src="/assets/js/worldclass-ui.js"]').count()===0,'old runtime loaded');
  await p.fill('#name','Browser User');await p.fill('#email','browser@example.com');
  await p.fill('#password','StrongPass123!');await p.fill('#confirm-password','StrongPass123!');
  await p.click('#register-form button[type="submit"]');await p.waitForURL(/verify-email\.html/,{timeout:10000});
  await p.fill('#otp','123456');await p.click('#verify-form button[type="submit"]');await p.waitForURL(/login\.html/,{timeout:10000});
  await p.route('**/api/v1/users/me',r=>fulfill(r,{id:'u1',name:'Browser User',email:'browser@example.com',role:'USER',emailVerified:true,preferences:{}}));
  await p.route('**/api/v1/users/dashboard',r=>fulfill(r,{metrics:{safetyTrend:null,routeMemories:0,successfulJourneys:0,verifiedHazardsAvoided:0},trend:[],recentJourneys:[],recentMemories:[]}));
  await p.fill('#email','browser@example.com');await p.fill('#password','StrongPass123!');await p.click('#login-form button[type="submit"]');
  await p.waitForURL(/dashboard\.html/,{timeout:10000});await waitClass(p,'navora-app');assert(await p.locator('.nav-links a[href="map.html"]').count()===1,'application navigation missing');
  assert(errs.length===0,'page errors: '+errs.join(' | '));await c.close();
 });

 await test('Google GIS wiring uses window.google without name shadowing',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage(),errs=[];
  p.on('pageerror',e=>errs.push(e.stack||e.message));
  await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await p.addInitScript(()=>{window.__navoraGoogleInit=false;window.google={accounts:{id:{initialize(options){window.__navoraGoogleInit=!!options?.client_id},renderButton(host){host.dataset.googleRendered='true'}}}}});
  await p.route('**/api/v1/auth/config',r=>fulfill(r,{google:{enabled:true,clientId:'browser-google-client'}}));
  await p.goto(BASE+'/login.html',{waitUntil:'domcontentloaded',timeout:60000});await waitClass(p,'navora-auth');
  await p.waitForFunction(()=>document.querySelector('#google-signin')?.dataset.googleRendered==='true',null,{timeout:10000});
  assert(await p.evaluate(()=>window.__navoraGoogleInit)===true,'Google GIS initialize was not called with client id');
  assert(errs.length===0,'Google wiring page errors: '+errs.join(' | '));await c.close();
 });

 await test('map route selection -> journey browser wiring',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();
  await p.route('**/api/v1/users/me',r=>fulfill(r,{id:'u1',name:'Route User',email:'route@example.com',role:'USER',emailVerified:true,preferences:{}}));
  await p.route('**/api/v1/geocoding/status',r=>fulfill(r,{effective:'tomtom',typeahead:true}));
  await p.route('**/api/v1/geocoding/reverse?*',r=>fulfill(r,{name:'Point',label:'Point',lat:17.385,lng:78.4867}));
  await p.route('**/api/v1/hazards/nearby?*',r=>fulfill(r,[]));
  await p.route('**/api/v1/routes/compare',r=>fulfill(r,{mode:'live',recommendedRouteId:'r1',routes:[{id:'r1',databaseId:'db-r1',label:'Recommended route',mode:'live',coordinates:[{lat:17.385,lng:78.4867},{lat:17.395,lng:78.4967}],distance:1800,duration:300,trafficDuration:330,trafficDelay:30,trafficSeverity:'LIGHT',trafficMode:'live',safetyScore:92,acoScore:.88,familiarity:.4,routeTypes:['SAFEST'],steps:[],explanation:{reasons:['Lower hazard exposure'],metrics:{}}}]}));
  await p.route('**/api/v1/journeys',r=>r.request().method()==='POST'?fulfill(r,{_id:'j1'},201):r.continue());
  await p.route('**/api/v1/journeys/j1/start',r=>fulfill(r,{_id:'j1',mode:'LIVE',status:'ACTIVE'}));
  await p.route('**/api/v1/journeys/j1',r=>fulfill(r,{journey:{_id:'j1',mode:'LIVE',status:'ACTIVE',distanceCovered:0,distanceRemaining:1800},route:{_id:'db-r1',label:'Recommended route',coordinates:[{lat:17.385,lng:78.4867},{lat:17.395,lng:78.4967}],distance:1800,trafficDuration:330,safetyScore:92}}));
  await p.route('**/api/v1/live/readiness',r=>fulfill(r,{ai:{reachable:true,safetyEligible:false},routing:{live:true,provider:'osrm'},warnings:[]}));
  await p.goto(BASE+'/map.html',{waitUntil:'domcontentloaded',timeout:60000});await waitClass(p,'navora-app');
  await p.waitForFunction(()=>document.querySelector('#source')?.dataset.lat,{timeout:15000});await p.click('#route-form button[type="submit"]');
  await p.locator('.route-card').first().waitFor({timeout:15000});await p.click('#begin-selected-journey');await p.waitForURL(/journey\.html/,{timeout:15000});
  await p.waitForFunction(()=>document.querySelector('#journey-title')?.textContent.includes('Recommended'),null,{timeout:10000});await c.close();
 });

 await test('World Chat REST send works when realtime is unavailable',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();
  await p.route('**/api/v1/users/me',r=>fulfill(r,{id:'u1',name:'Chat User',email:'chat@example.com',role:'USER',emailVerified:true}));
  await p.route('**/api/v1/chat/rooms*',r=>fulfill(r,[{_id:'global-db',name:'Global',type:'GLOBAL'}]));
  await p.route('**/api/v1/chat/blocks',r=>fulfill(r,[]));
  await p.route('**/api/v1/chat/messages/global?*',r=>fulfill(r,{room:{_id:'global-db',name:'Global',type:'GLOBAL'},messages:[],hasMore:false}));
  await p.route('**/api/v1/chat/messages/global',r=>r.request().method()==='POST'?fulfill(r,{id:'m1',roomId:'global',content:'Hello Navora V9',createdAt:new Date().toISOString(),user:{id:'u1',name:'Chat User'},reactions:[]},201):r.continue());
  await p.goto(BASE+'/world-chat.html',{waitUntil:'domcontentloaded',timeout:60000});await waitClass(p,'navora-app');await p.locator('#chat-input').waitFor({timeout:15000});
  await p.fill('#chat-input','Hello Navora V9');await p.click('#chat-form button[type="submit"]');await p.waitForFunction(()=>document.querySelector('#message-list')?.textContent.includes('Hello Navora V9'),null,{timeout:10000});await c.close();
 });

 await test('service worker uses V9 network-first build',async()=>{
  const r=await fetch(BASE+'/service-worker.js',{headers:{'cache-control':'no-cache'}}),t=await r.text();
  assert(r.ok,'HTTP '+r.status);assert(t.includes('navora-v9-functional-e2e-1'),'V9 cache id missing');assert(t.includes('networkFirst'),'networkFirst missing');
 });
 await browser.close();
 if(fail.length){console.error('\nNAVORA CORE BROWSER E2E: FAIL');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
 console.log('\nNAVORA CORE BROWSER E2E: PASS');
}
main().catch(e=>{console.error(e);process.exit(1)});
