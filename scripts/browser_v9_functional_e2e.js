const {chromium}=require('../backend/node_modules/playwright');
const BASE=(process.argv[2]||'http://127.0.0.1:5000').replace(/\/$/,'');
const assert=(x,m)=>{if(!x)throw new Error(m)};
const fulfill=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data})});
async function authUser(p,role='USER'){await p.route('**/api/v1/users/me',r=>fulfill(r,{id:'u1',_id:'u1',name:'V9 User',email:'v9@example.com',role,emailVerified:true,preferences:{safety:.82,traffic:.66,familiarity:.41}}))}
async function noGoogle(p){await p.route('**/api/v1/auth/config',r=>fulfill(r,{google:{enabled:false,clientId:null}}))}
async function main(){
 const browser=await chromium.launch({headless:true}),fails=[];
 const test=async(name,fn)=>{try{await fn();console.log('PASS ',name)}catch(e){fails.push(`${name}: ${e.message}`);console.error('FAIL ',name,'—',e.message)}};

 await test('register exposes real Google signup wiring',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
  await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await p.addInitScript(()=>{window.__googleText='';window.google={accounts:{id:{initialize(o){window.__googleClient=o.client_id},renderButton(host,o){host.dataset.googleRendered='1';window.__googleText=o.text}}}}});
  await p.route('**/api/v1/auth/config',r=>fulfill(r,{google:{enabled:true,clientId:'v9-google-client'}}));
  await p.goto(BASE+'/register.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(()=>document.querySelector('#google-signin')?.dataset.googleRendered==='1',null,{timeout:10000});
  assert(await p.evaluate(()=>window.__googleClient)==='v9-google-client','Google client id not initialized');
  assert(await p.evaluate(()=>window.__googleText)==='signup_with','Google button is not signup mode');
  assert(await p.locator('#confirm-password').count()===1,'confirm password missing');assert(!errs.length,'page errors '+errs.join(' | '));await c.close();
 });

 await test('register blocks mismatched passwords before API',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();let calls=0;
  await noGoogle(p);await p.route('**/api/v1/auth/register',r=>{calls++;return fulfill(r,{})});
  await p.goto(BASE+'/register.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.fill('#name','V9 User');await p.fill('#email','v9@example.com');await p.fill('#password','StrongPass123!');await p.fill('#confirm-password','DifferentPass123!');
  await p.click('#register-form button[type="submit"]');await p.waitForTimeout(300);
  assert(calls===0,'register API called despite mismatch');assert(/do not match/i.test(await p.locator('[data-form-status]').innerText()),'mismatch feedback missing');await c.close();
 });

 await test('reset OTP can be resent and direct email is recoverable',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();let calls=0;await noGoogle(p);
  await p.route('**/api/v1/auth/forgot-password',r=>{calls++;return fulfill(r,{accepted:true})});
  await p.goto(BASE+'/verify-otp.html',{waitUntil:'domcontentloaded',timeout:60000});await p.fill('#email','v9@example.com');await p.click('#resend-reset');await p.waitForTimeout(250);
  assert(calls===1,'reset resend did not call forgot-password');assert((await p.locator('#resend-reset').innerText()).includes('Resend in'),'cooldown missing');await c.close();
 });

 await test('map loads stored/user preferences and gates Start Journey',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();await authUser(p);
  await p.route('**/api/v1/geocoding/status',r=>fulfill(r,{effective:'tomtom',typeahead:false}));
  await p.route('**/api/v1/geocoding/reverse?*',r=>fulfill(r,{label:'Point'}));await p.route('**/api/v1/hazards/nearby?*',r=>fulfill(r,[]));
  await p.addInitScript(()=>localStorage.setItem('navora:preferences',JSON.stringify({safety:.11,traffic:.22,familiarity:.33})));
  await p.goto(BASE+'/map.html',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(600);
  assert(await p.locator('#safety-pref').inputValue()==='82','server preference not applied');assert(await p.locator('#traffic-pref').inputValue()==='66','traffic preference not applied');assert(await p.locator('#begin-selected-journey').isDisabled(),'start journey should be disabled before a route exists');await c.close();
 });

 await test('history does not offer replay for cancelled journeys',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();await authUser(p);
  await p.route('**/api/v1/journeys',r=>fulfill(r,[{_id:'c1',status:'CANCELLED',mode:'LIVE',createdAt:new Date().toISOString()},{_id:'ok1',status:'COMPLETED',mode:'LIVE',createdAt:new Date().toISOString()}]));
  await p.goto(BASE+'/history.html',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(400);
  assert(await p.locator('[data-replay]').count()===1,'cancelled journey still has replay link');await c.close();
 });

 await test('notification click changes unread UI to read',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();await authUser(p);
  await p.route('**/api/v1/notifications',r=>fulfill(r,[{_id:'n1',title:'Route alert',message:'Test',createdAt:new Date().toISOString(),readAt:null}]));
  await p.route('**/api/v1/notifications/n1/read',r=>fulfill(r,{_id:'n1',title:'Route alert',createdAt:new Date().toISOString(),readAt:new Date().toISOString()}));
  await p.goto(BASE+'/notifications.html',{waitUntil:'domcontentloaded',timeout:60000});await p.locator('[data-read="n1"]').click();await p.waitForTimeout(250);
  assert(/read/.test(await p.locator('#notification-list small').innerText())&&!/unread/.test(await p.locator('#notification-list small').innerText()),'notification UI stayed unread');await c.close();
 });

 await test('settings blocks share-enabled contact without email',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();await authUser(p);let posts=0;
  await p.route('**/api/v1/trusted-contacts',r=>{if(r.request().method()==='POST')posts++;return fulfill(r,[])});
  await p.goto(BASE+'/settings.html',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(250);await p.fill('#contact-name','Friend');await p.check('#contact-share');await p.click('#contact-form button[type="submit"]');await p.waitForTimeout(200);assert(posts===0,'unsafe contact was posted without email');await c.close();
 });

 
 await test('shared journey stops on revoked/expired token',async()=>{
  const c=await browser.newContext({serviceWorkers:'block'}),p=await c.newPage();let calls=0;
  await p.route('**/api/v1/journeys/shared/*',r=>{calls++;return fulfill(r,null,404)});
  await p.goto(BASE+'/shared-journey.html?token=expired',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForTimeout(600);
  assert(/expired|revoked/i.test(await p.locator('#shared-status').innerText()),'expired state missing');assert(calls===1,'revoked link kept polling immediately');await c.close();
 });

 await browser.close();
 if(fails.length){console.error('\nNAVORA V9 FUNCTIONAL E2E: FAIL');fails.forEach(x=>console.error(' - '+x));process.exit(1)}
 console.log('\nNAVORA V9 FUNCTIONAL E2E: PASS');
}
main().catch(e=>{console.error(e);process.exit(1)});
