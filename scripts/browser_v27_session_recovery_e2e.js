const {chromium}=require('../backend/node_modules/playwright');

const BASE=(process.argv[2]||'http://127.0.0.1:5000').replace(/\/$/,'');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const error=message=>console.error(`::error title=V27 session recovery E2E::${String(message).replace(/\r?\n/g,'%0A')}`);

function json(route,status,data,message){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data,message})});
}

async function scenario(browser,kind){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:800}});
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.stack||e.message));
  await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await page.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/v1/users/me'){
      if(kind==='service')return json(route,503,null,'Temporary service failure');
      return json(route,401,null,'Authentication required');
    }
    if(path==='/api/v1/auth/refresh')return json(route,401,null,'Session expired');
    if(path==='/api/v1/auth/config')return json(route,200,{google:{enabled:false,clientId:null}});
    if(path==='/api/v1/auth/email/status')return json(route,200,{configured:false,note:'Test mode'});
    return json(route,200,{});
  });

  await page.goto(`${BASE}/dashboard.html`,{waitUntil:'domcontentloaded',timeout:60000});
  if(kind==='service'){
    await page.waitForURL(url=>url.pathname.endsWith('/offline.html')&&url.searchParams.get('reason')==='service',{timeout:15000});
    await page.waitForFunction(()=>document.querySelector('.page-head h1')?.textContent.includes('Live services temporarily unavailable'),null,{timeout:10000});
    const state=await page.evaluate(()=>({
      returnTo:sessionStorage.getItem('navora:returnTo'),
      retry:new URL(document.querySelector('.page-head a.btn-navora')?.href||'',location.href).pathname.split('/').pop(),
      title:document.querySelector('.page-head h1')?.textContent||''
    }));
    assert(state.returnTo==='dashboard.html',`503: returnTo=${state.returnTo}`);
    assert(state.retry==='dashboard.html',`503: retry=${state.retry}`);
    assert(state.title.includes('Live services temporarily unavailable'),`503: title=${state.title}`);
  }else{
    await page.waitForURL(url=>url.pathname.endsWith('/login.html')&&url.searchParams.get('returnTo')==='dashboard.html',{timeout:15000});
    const returnTo=await page.evaluate(()=>sessionStorage.getItem('navora:returnTo'));
    assert(returnTo==='dashboard.html',`401: returnTo=${returnTo}`);
  }
  assert(!pageErrors.length,`${kind}: page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    await scenario(browser,'service');
    await scenario(browser,'auth');
    console.log('V27 SESSION RECOVERY E2E PASS: service/network failures use recovery UI; real 401 uses Login');
  }catch(e){error(e.stack||e.message);process.exitCode=1}
  finally{await browser.close()}
})();
