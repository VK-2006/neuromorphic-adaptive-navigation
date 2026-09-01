#!/usr/bin/env node
'use strict';

const http=require('http');
const fs=require('fs');
const path=require('path');
const {chromium}=require('../backend/node_modules/playwright');

const ROOT=path.resolve(__dirname,'..');
const FRONT=path.join(ROOT,'frontend');
const PUBLIC=path.join(FRONT,'public');
const ASSETS=path.join(FRONT,'assets');
const PORT=Number(process.env.NAVORA_UI_AUDIT_PORT||5097);
const BASE=`http://127.0.0.1:${PORT}`;

const pages=['index.html','register.html','verify-email.html','login.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html','shared-journey.html','offline.html','admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html'];
if(pages.length!==27)throw new Error(`UI sweep expected 27 pages, found ${pages.length}`);

const auth=new Set(['register.html','verify-email.html','login.html','forgot-password.html','verify-otp.html','reset-password.html']);
const publicPages=new Set(['index.html','shared-journey.html','offline.html',...auth]);
const adminPages=new Set(['admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html']);

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};

function safeFile(root,rel){
  const p=path.resolve(root,'.'+rel);
  return p===root||p.startsWith(root+path.sep)?p:null;
}
function serveFile(res,p){
  if(!p||!fs.existsSync(p)||!fs.statSync(p).isFile()){
    res.writeHead(404,{'content-type':'text/plain'});res.end('not found');return;
  }
  res.writeHead(200,{'content-type':mime[path.extname(p).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(p).pipe(res);
}
const socketStub=`
(function(){
  function socket(){
    const handlers=new Map();
    return {
      connected:false,id:'ui-audit-socket',
      on(name,fn){handlers.set(name,fn);return this;},
      off(name){handlers.delete(name);return this;},
      once(name,fn){handlers.set(name,fn);return this;},
      emit(name,payload,ack){if(typeof ack==='function')ack({ok:true});return this;},
      connect(){this.connected=true;handlers.get('connect')?.();return this;},
      disconnect(){this.connected=false;handlers.get('disconnect')?.();return this;}
    };
  }
  window.io=socket;
})();`;

const server=http.createServer((req,res)=>{
  const u=new URL(req.url,BASE),pathname=decodeURIComponent(u.pathname);
  if(pathname==='/socket.io/socket.io.js'){
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
    res.end(socketStub);return;
  }
  if(pathname==='/service-worker.js')return serveFile(res,path.join(FRONT,'service-worker.js'));
  if(pathname==='/manifest.json')return serveFile(res,path.join(FRONT,'manifest.json'));
  if(pathname.startsWith('/assets/'))return serveFile(res,safeFile(ASSETS,pathname.slice('/assets'.length)));
  if(pathname==='/'||pathname==='/index.html')return serveFile(res,path.join(PUBLIC,'index.html'));
  if(pathname.endsWith('.html'))return serveFile(res,safeFile(PUBLIC,pathname));
  res.writeHead(404,{'content-type':'text/plain'});res.end('not found');
});

function mock(pathname,method,page){
  if(pathname==='/api/v1/users/me')return publicPages.has(page)?{status:401,data:null}:{status:200,data:{id:'ui-user',_id:'ui-user',name:'UI Audit',email:'audit@example.test',role:adminPages.has(page)?'ADMIN':'USER',emailVerified:true,preferences:{}}};
  if(pathname==='/api/v1/auth/refresh')return{status:401,data:null};
  if(pathname==='/api/v1/auth/config')return{status:200,data:{google:{enabled:false,clientId:null}}};
  if(pathname==='/api/v1/auth/email/status')return{status:200,data:{configured:true,providerReachable:true,senderRegistered:true,senderActive:true}};
  if(pathname==='/api/v1/users/dashboard')return{status:200,data:{metrics:{safetyTrend:84,routeMemories:6,successfulJourneys:8,verifiedHazardsAvoided:2,unreadNotifications:1},trend:[{label:'A',safety:71},{label:'B',safety:84}],recentJourneys:[],recentMemories:[]}};
  if(pathname==='/api/v1/journeys')return{status:200,data:[]};
  if(pathname.startsWith('/api/v1/journeys/shared/'))return{status:200,data:{status:'ACTIVE',destination:{label:'Audit destination'},distanceCovered:100,distanceRemaining:900,updatedAt:new Date().toISOString(),emergencyActive:false,lastKnownPosition:{lat:17.38,lng:78.48}}};
  if(['/api/v1/memory','/api/v1/notifications','/api/v1/devices','/api/v1/trusted-contacts'].includes(pathname))return{status:200,data:[]};
  if(pathname==='/api/v1/admin/overview'||pathname==='/api/v1/admin/health')return{status:200,data:{}};
  if(['/api/v1/admin/users','/api/v1/admin/devices','/api/v1/admin/hazards','/api/v1/admin/chat/reports','/api/v1/admin/audit'].includes(pathname))return{status:200,data:[]};
  if(pathname.startsWith('/api/v1/chat/rooms')||pathname==='/api/v1/chat/blocks')return{status:200,data:[]};
  if(pathname==='/api/v1/geocoding/status')return{status:200,data:{effective:'nominatim',typeahead:false}};
  if(pathname.startsWith('/api/v1/geocoding/reverse'))return{status:200,data:{label:'Audit point',name:'Audit point',lat:17.38,lng:78.48}};
  if(pathname.startsWith('/api/v1/hazards/nearby'))return{status:200,data:[]};
  if(pathname==='/api/v1/live/readiness')return{status:200,data:{ai:{reachable:true,safetyEligible:false},routing:{live:true,provider:'osrm'},warnings:[]}};
  if(method==='GET')return{status:200,data:{}};
  return{status:200,data:{}};
}
function fulfillJson(route,m){
  return route.fulfill({status:m.status,contentType:'application/json',body:JSON.stringify({success:m.status<400,data:m.data})});
}

async function open(browser,page,width,theme){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.addInitScript(theme=>localStorage.setItem('navora-theme',theme),theme);
  const p=await context.newPage();
  const errors=[];
  p.on('pageerror',e=>errors.push(e.stack||e.message));

  await p.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===BASE&&url.pathname.startsWith('/api/v1/')){
      return fulfillJson(route,mock(url.pathname,req.method(),page));
    }
    if(url.origin!==BASE){
      const type=req.resourceType();
      if(type==='stylesheet')return route.fulfill({status:200,contentType:'text/css',body:''});
      if(type==='script')return route.fulfill({status:200,contentType:'text/javascript',body:''});
      if(type==='image')return route.abort();
      return route.abort();
    }
    return route.continue();
  });

  const suffix=page==='shared-journey.html'?'?token=ui-audit':'';
  await p.goto(`${BASE}/${page}${suffix}`,{waitUntil:'domcontentloaded',timeout:30000});
  await p.waitForTimeout(420);

  const m=await p.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
    theme:document.documentElement.dataset.theme,
    premium:window.NavoraPremiumUI?.version||null,
    bodyPage:document.body.dataset.uiPage||'',
    premiumCss:[...document.styleSheets].some(s=>String(s.href||'').includes('/assets/css/premium-ui.css'))
  }));

  if(errors.length)throw new Error(errors.join(' | '));
  if(m.scrollWidth>m.clientWidth+3)throw new Error(`horizontal overflow ${m.scrollWidth}>${m.clientWidth}`);
  if(m.theme!==theme)throw new Error(`theme mismatch ${m.theme} != ${theme}`);
  if(m.premium!=='12.3.4')throw new Error(`premium UI runtime mismatch: ${m.premium}`);
  if(!m.premiumCss)throw new Error('premium CSS stylesheet missing');
  await context.close();
}

async function main(){
  await new Promise((resolve,reject)=>server.listen(PORT,'127.0.0.1',err=>err?reject(err):resolve()));
  let browser;
  const failures=[];
  try{
    browser=await chromium.launch({headless:true});

    for(const page of pages){
      for(const theme of ['light','dark']){
        for(const width of [1440,375]){
          try{await open(browser,page,width,theme);console.log('PASS',page,theme,width)}
          catch(e){failures.push(`${page} ${theme} ${width}: ${e.message}`);console.error('FAIL',page,theme,width,e.message)}
        }
      }
    }

    const critical=['index.html','login.html','dashboard.html','map.html','journey.html','devices.html','memory.html','world-chat.html','admin.html'];
    for(const page of critical){
      for(const theme of ['light','dark']){
        for(const width of [1200,1024,768,480,320]){
          try{await open(browser,page,width,theme);console.log('PASS breakpoint',page,theme,width)}
          catch(e){failures.push(`${page} ${theme} ${width}: ${e.message}`);console.error('FAIL breakpoint',page,theme,width,e.message)}
        }
      }
    }
  }finally{
    await browser?.close().catch(()=>{});
    await new Promise(resolve=>server.close(()=>resolve()));
  }

  if(failures.length){
    console.error('\nNAVORA UI PHASE 2 BROWSER SWEEP: FAIL');
    failures.forEach(x=>console.error(' - '+x));
    process.exit(1);
  }
  console.log('\nNAVORA UI PHASE 2 BROWSER SWEEP: PASS');
  console.log('27 pages: light/dark at 1440 and 375 PASS');
  console.log('Critical pages: 1200/1024/768/480/320 in light+dark PASS');
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
