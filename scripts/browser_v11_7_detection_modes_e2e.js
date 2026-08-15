const {chromium}=require('../backend/node_modules/playwright');
const BASE=(process.argv[2]||'http://127.0.0.1:5000').replace(/\/$/,'');
const assert=(x,m)=>{if(!x)throw new Error(m)};
const fulfill=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status<400,data})});

async function authUser(page){
  await page.route('**/api/v1/users/me',r=>fulfill(r,{
    id:'u1',_id:'u1',name:'Detection User',email:'detect@example.com',
    role:'USER',emailVerified:true,preferences:{safety:.8,traffic:.6,familiarity:.4}
  }));
}

async function main(){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));

  await authUser(page);
  await page.addInitScript(()=>{
    sessionStorage.setItem('journeyId','j1');
    window.tf={};
    window.cocoSsd={load:async()=>({detect:async()=>[{class:'person',score:.91,bbox:[10,10,100,200]}]})};
  });

  await page.route('**/api/v1/journeys/j1',r=>fulfill(r,{
    journey:{_id:'j1',mode:'LIVE',status:'PAUSED'},
    route:{_id:'r1',label:'Route',coordinates:[{lat:17.38,lng:78.48},{lat:17.39,lng:78.49}],distance:1000,trafficDuration:300,safetyScore:90}
  }));
  await page.route('**/api/v1/live/readiness',r=>fulfill(r,{ai:{reachable:true,safetyEligible:false},routing:{live:true,provider:'osrm'},warnings:[]}));
  await page.route('**/api/v1/live/webrtc-config',r=>fulfill(r,{iceServers:[],turnConfigured:false}));
  await page.route('**/api/v1/roboflow/status',r=>fulfill(r,{configured:true,workspace:'beast-9esfw',workflowId:'yolo-world-small-demo'}));

  let rawDetectNetwork=0,localAnalyzeCalls=0,localAnalyzeBody=null,cloudCalls=0,cloudBody=null;
  await page.route('**/api/v1/hazards/detect',r=>{rawDetectNetwork++;return fulfill(r,{})});
  await page.route('**/api/v1/hazards/analyze',async r=>{
    localAnalyzeCalls++;
    localAnalyzeBody=JSON.parse(r.request().postData()||'{}');
    return fulfill(r,{detections:localAnalyzeBody.detections||[],risk:{score:.2,level:'LOW',validated:false},safetyEligible:false,detectorValidated:false,riskValidated:false});
  });
  await page.route('**/api/v1/roboflow/analyze',async r=>{
    cloudCalls++;
    cloudBody=JSON.parse(r.request().postData()||'{}');
    return fulfill(r,{
      inference:{detections:[{objectClass:'car',confidence:.88,x:100,y:80,width:120,height:70}]},
      risk:{score:.44,level:'MEDIUM',validated:false,mode:'development/heuristic-fallback'},
      detectorValidated:false,riskValidated:false,safetyEligible:false,canAffectLive:false,researchOnly:true,hazardId:null,
      privacy:{cloudProcessed:true,provider:'Roboflow',explicitConsent:true}
    });
  });

  await page.goto(BASE+'/journey.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.NavoraDetectionMode?.cloudConfigured?.()===true,null,{timeout:10000});
  assert(await page.locator('#detection-mode').inputValue()==='local','Journey must default to Private Local mode');
  assert(!(await page.locator('#cloud-detection-consent').isChecked()),'Cloud consent must default to unchecked');

  await page.evaluate(()=>{
    const v=document.getElementById('camera-video');
    Object.defineProperty(v,'videoWidth',{configurable:true,value:640});
    Object.defineProperty(v,'videoHeight',{configurable:true,value:480});
  });

  const localResult=await page.evaluate(()=>fetch('/api/v1/hazards/detect',{
    method:'POST',credentials:'include',headers:{'content-type':'application/json'},
    body:JSON.stringify({image:'data:image/jpeg;base64,LOCAL_FRAME_MUST_NOT_LEAVE',journeyId:'j1',location:{lat:17.38,lng:78.48,speed:3}})
  }).then(async r=>({status:r.status,body:await r.json()})));

  assert(localResult.status===200,'Local detector request failed');
  assert(rawDetectNetwork===0,'Raw /hazards/detect request reached the network');
  assert(localAnalyzeCalls===1,'Local metadata /hazards/analyze was not called exactly once');
  assert(localAnalyzeBody&&!('image' in localAnalyzeBody),'Local mode leaked an image to Navora metadata endpoint');
  assert(localAnalyzeBody.context?.frameTransmitted===false,'Local privacy marker missing');
  assert(cloudCalls===0,'Cloud endpoint was called while local mode was selected');

  await page.selectOption('#detection-mode','cloud');
  assert(!(await page.locator('#cloud-detection-consent').isChecked()),'Selecting cloud must not auto-grant consent');

  const blocked=await page.evaluate(()=>fetch('/api/v1/hazards/detect',{
    method:'POST',credentials:'include',headers:{'content-type':'application/json'},
    body:JSON.stringify({image:'data:image/jpeg;base64,CLOUD_BLOCKED_WITHOUT_CONSENT',journeyId:'j1',location:{lat:17.38,lng:78.48,speed:3}})
  }).then(async r=>({status:r.status,body:await r.json()})));

  assert(blocked.status===422,'Cloud request without consent must be rejected locally');
  assert(cloudCalls===0,'Roboflow endpoint was called without consent');

  await page.check('#cloud-detection-consent');

  const firstCloud=await page.evaluate(()=>fetch('/api/v1/hazards/detect',{
    method:'POST',credentials:'include',headers:{'content-type':'application/json'},
    body:JSON.stringify({image:'data:image/jpeg;base64,CLOUD_FRAME_ALLOWED',journeyId:'j1',location:{lat:17.38,lng:78.48,speed:3}})
  }).then(async r=>({status:r.status,body:await r.json()})));

  assert(firstCloud.status===200,'Consented cloud request failed');
  assert(cloudCalls===1,'Roboflow analyze should be called exactly once');
  assert(cloudBody?.consentToCloudProcessing===true,'Explicit consent flag was not sent');
  assert(typeof cloudBody?.image==='string'&&cloudBody.image.includes('CLOUD_FRAME_ALLOWED'),'Cloud mode did not send the selected snapshot');
  assert(firstCloud.body?.data?.detections?.[0]?.objectClass==='car','Cloud response was not normalized for journey.js');

  const secondCloud=await page.evaluate(()=>fetch('/api/v1/hazards/detect',{
    method:'POST',credentials:'include',headers:{'content-type':'application/json'},
    body:JSON.stringify({image:'data:image/jpeg;base64,CLOUD_FRAME_THROTTLED',journeyId:'j1',location:{lat:17.38,lng:78.48,speed:3}})
  }).then(async r=>({status:r.status,body:await r.json()})));

  assert(secondCloud.status===200,'Throttled cloud response should use cached successful result');
  assert(cloudCalls===1,'Cloud throttling failed; provider was called again inside 2.5 seconds');

  await page.uncheck('#cloud-detection-consent');
  assert((await page.locator('#detection-toggle').getAttribute('data-enabled'))==='false','Removing cloud consent must disable detection');
  assert(!errors.length,'Journey page errors: '+errors.join(' | '));

  console.log('PASS  local mode keeps frames browser-local and sends metadata only');
  console.log('PASS  cloud mode is unavailable without explicit consent');
  console.log('PASS  consented cloud mode sends snapshot to /roboflow/analyze');
  console.log('PASS  cloud response is normalized for journey risk UI');
  console.log('PASS  cloud provider calls are throttled to <= 1 per 2.5 seconds');
  console.log('PASS  removing consent disables cloud detection');
  console.log('NAVORA V11.7 DETECTION-MODE E2E: PASS');

  await context.close();
  await browser.close();
}
main().catch(e=>{console.error('NAVORA V11.7 DETECTION-MODE E2E: FAIL');console.error(e.stack||e.message);process.exit(1)});
