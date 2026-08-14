#!/usr/bin/env node
'use strict';
const path=require('path');
const {spawn}=require('child_process');
const crypto=require('crypto');

const ROOT=path.resolve(__dirname,'..');
const BACKEND=path.join(ROOT,'backend');
const PORT=Number(process.env.NAVORA_E2E_PORT||5055);
const BASE=`http://127.0.0.1:${PORT}`;
const stamp=Date.now();
const dbName=`navora_e2e_${stamp}_${Math.floor(Math.random()*10000)}`;
const mongoUri=process.env.NAVORA_E2E_MONGODB_URI||`mongodb://127.0.0.1:27017/${dbName}`;
const email=`navora.e2e.${stamp}@example.test`;
const password='NavoraE2E!12345';
const password2='NavoraE2E!67890';
const jar=new Map();
let child=null;

function assert(cond,msg){if(!cond)throw new Error(msg)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function cookieHeader(){return [...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; ')}
function captureCookies(res){
  let rows=[];
  if(typeof res.headers.getSetCookie==='function')rows=res.headers.getSetCookie();
  else {const raw=res.headers.get('set-cookie');if(raw)rows=[raw]}
  for(const row of rows){const first=String(row).split(';',1)[0];const i=first.indexOf('=');if(i<=0)continue;const name=first.slice(0,i).trim(),value=first.slice(i+1).trim();if(value)jar.set(name,value);else jar.delete(name)}
}
async function request(url,{method='GET',body,auth=true,expectStatus}={}){
  const headers={accept:'application/json'};
  if(body!==undefined)headers['content-type']='application/json';
  if(auth&&jar.size)headers.cookie=cookieHeader();
  const res=await fetch(BASE+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  captureCookies(res);
  const text=await res.text();let json=null;try{json=text?JSON.parse(text):null}catch{}
  if(expectStatus!=null)assert(res.status===expectStatus,`${method} ${url}: expected ${expectStatus}, got ${res.status}: ${text.slice(0,300)}`);
  else assert(res.ok,`${method} ${url}: HTTP ${res.status}: ${text.slice(0,300)}`);
  return json;
}
async function waitHealth(){
  const end=Date.now()+25000;let last='';
  while(Date.now()<end){
    try{const r=await fetch(BASE+'/health');const j=await r.json();if(j.status==='ok'&&j.database==='connected')return j;last=JSON.stringify(j)}catch(e){last=e.message}
    await sleep(350);
  }
  throw new Error(`backend/MongoDB readiness timeout: ${last}`);
}
function startBackend(){
  const env={...process.env,
    NODE_ENV:'development',PORT:String(PORT),MONGODB_URI:mongoUri,
    JWT_ACCESS_SECRET:'e2e-access-'+crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET:'e2e-refresh-'+crypto.randomBytes(32).toString('hex'),
    FRONTEND_URL:BASE,SOCKET_CORS_ORIGIN:BASE,
    AI_SERVICE_URL:process.env.AI_SERVICE_URL||'http://127.0.0.1:8000',
    ROUTING_PROVIDER:'mock',TRAFFIC_PROVIDER:'',TRAFFIC_API_KEY:'',
    BREVO_API_KEY:'',BREVO_SENDER_EMAIL:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',
    SIMULATION_MODE:'true',LIVE_REQUIRE_VALIDATED_AI:'true',
    WEBAUTHN_RP_ID:'localhost',WEBAUTHN_ORIGIN:BASE,
    LOG_LEVEL:'warn'
  };
  child=spawn(process.execPath,[path.join(BACKEND,'src/server.js')],{cwd:BACKEND,env,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>process.env.NAVORA_E2E_VERBOSE&&process.stdout.write('[backend] '+d));
  child.stderr.on('data',d=>process.env.NAVORA_E2E_VERBOSE&&process.stderr.write('[backend] '+d));
  child.on('exit',(code,signal)=>{if(code&&code!==0)console.error(`backend exited code=${code} signal=${signal}`)});
}
async function socketRoundTrip(journeyId){
  const io=require(require.resolve('socket.io-client',{paths:[BACKEND]}));
  const socket=io(BASE,{transports:['websocket'],extraHeaders:{Cookie:cookieHeader()},reconnection:false,timeout:6000});
  const wait=(event,ms=6000)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error(`socket timeout: ${event}`)),ms);socket.once(event,(...args)=>{clearTimeout(t);resolve(args)})});
  try{
    await wait('connect');
    const joined=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('journey join timeout')),5000);socket.emit('journey:join',{journeyId},ack=>{clearTimeout(t);resolve(ack)})});
    assert(joined?.ok===true,'Socket.IO journey ownership join failed');
    const chatJoined=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('chat join timeout')),5000);socket.emit('chat:join',{roomId:'global'},ack=>{clearTimeout(t);resolve(ack)})});
    assert(chatJoined?.ok===true,'Socket.IO global chat join failed');
    const messageP=wait('chat:message');
    const content=`Navora E2E ${Date.now()}`;socket.emit('chat:send',{roomId:'global',content});
    const [msg]=await messageP;assert(msg?.content===content,'Socket.IO chat round-trip failed');
  }finally{socket.disconnect()}
}
async function makeAdmin(){
  const mongoose=require(require.resolve('mongoose',{paths:[BACKEND]}));
  const User=require(path.join(BACKEND,'src/models/User'));
  await mongoose.connect(mongoUri,{serverSelectionTimeoutMS:5000});
  await User.updateOne({email},{$set:{role:'ADMIN'}});
  await mongoose.disconnect();
}
async function dropDb(){
  try{
    const mongoose=require(require.resolve('mongoose',{paths:[BACKEND]}));
    await mongoose.connect(mongoUri,{serverSelectionTimeoutMS:3000});
    await mongoose.connection.dropDatabase();await mongoose.disconnect();
  }catch(e){console.warn('E2E cleanup warning:',e.message)}
}
async function aiSmoke(){
  const aiBase=process.env.AI_SERVICE_URL||'http://127.0.0.1:8000';
  try{
    const health=await fetch(aiBase+'/health');assert(health.ok,'AI /health failed');
    const risk=await fetch(aiBase+'/api/v1/risk/predict',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({features:{objectClass:'road blockage',confidence:.95,estimatedDistance:3,relativeSpeed:10,userSpeed:12,objectPersistence:.9,trafficDensity:.8,hazardFrequency:.7,visibility:.4,weatherRisk:.4,roadCondition:.9,verifiedReports:4}})});
    assert(risk.ok,`AI risk HTTP ${risk.status}`);const j=await risk.json();assert(Number.isFinite(Number(j.score))&&j.level,'AI risk response invalid');return true;
  }catch(e){console.warn('AI direct smoke WARNING:',e.message);return false}
}
async function main(){
  console.log('Navora runtime E2E: starting isolated backend + MongoDB test database');
  startBackend();await waitHealth();
  const aiUp=await aiSmoke();

  const reg=await request('/api/v1/auth/register',{method:'POST',auth:false,body:{name:'Navora E2E',email,password},expectStatus:201});
  const otp=reg?.data?.delivery?.developmentOtp;assert(/^\d{6}$/.test(String(otp||'')),'Development verification OTP was not returned; E2E forces Brevo off');
  await request('/api/v1/auth/verify-email',{method:'POST',auth:false,body:{email,otp:String(otp)}});
  await request('/api/v1/auth/login',{method:'POST',auth:false,body:{email,password}});
  const me=await request('/api/v1/users/me');assert(me?.data?.email===email,'Authenticated profile mismatch');
  await request('/api/v1/auth/refresh',{method:'POST'});

  const source={lat:17.3850,lng:78.4867},destination={lat:17.4375,lng:78.4483};
  const cmp=await request('/api/v1/routes/compare',{method:'POST',body:{source,destination,preferences:{safety:.8,traffic:.6,familiarity:.5},simulation:true}});
  const routes=cmp?.data?.routes||[];assert(routes.length>=3,'Route comparison did not return alternatives');
  const selected=routes.find(r=>r.id===cmp.data.recommendedRouteId);assert(selected?.databaseId,'Authenticated route was not persisted');

  const created=await request('/api/v1/journeys',{method:'POST',body:{routeId:selected.databaseId,mode:'SIMULATION',source,destination},expectStatus:201});
  const journeyId=created?.data?._id;assert(journeyId,'Journey create failed');
  await request(`/api/v1/journeys/${journeyId}/start`,{method:'POST'});

  const points=selected.coordinates||[];assert(points.length>=3,'Selected route has insufficient geometry');
  for(const p of [points[0],points[Math.floor(points.length/2)],points.at(-1)]){
    const tr=await request('/api/v1/tracking/update',{method:'POST',body:{journeyId,lat:p.lat,lng:p.lng,accuracy:8,heading:90,speed:8,timestamp:Date.now()}});
    assert(Number.isFinite(Number(tr?.data?.distanceRemaining)),'Tracking result missing distanceRemaining');
  }

  const rr=await request('/api/v1/routes/reroute',{method:'POST',body:{journeyId,currentLocation:points[Math.floor(points.length/2)],preferences:{safety:.8,traffic:.6,familiarity:.5}}});
  assert(Array.isArray(rr?.data?.routes),'Reroute comparison missing route alternatives');

  await socketRoundTrip(journeyId);
  const restChat=await request('/api/v1/chat/messages/global',{method:'POST',body:{content:`Navora REST chat ${Date.now()}`},expectStatus:201});
  assert(restChat?.data?.content,'REST chat fallback failed');
  const chatHistory=await request('/api/v1/chat/messages/global');
  assert((chatHistory?.data?.messages||[]).some(x=>x.id===restChat.data.id),'REST chat message was not persisted');
  const readiness=await request('/api/v1/live/readiness');assert(readiness?.data?.ai,'Live readiness response missing AI state');

  await request('/api/v1/trusted-contacts',{method:'POST',body:{name:'E2E Contact',phone:'+910000000000',relationship:'Test',sharePermission:true},expectStatus:201});
  const sos=await request('/api/v1/sos',{method:'POST',body:{journeyId,location:{lat:points.at(-1).lat,lng:points.at(-1).lng,accuracy:8,timestamp:Date.now()}}});
  assert(sos?.data?.emergencyActive===true,'SOS flow did not activate journey emergency state');

  await request(`/api/v1/journeys/${journeyId}/complete`,{method:'POST',body:{success:true,userFeedback:.9}});
  const memory=await request('/api/v1/memory');assert((memory?.data||[]).length>=1,'CRM was not updated after completed journey');
  const replay=await request(`/api/v1/journeys/${journeyId}/replay`);assert((replay?.data?.events||[]).length>=2,'Journey replay events missing');

  const forgot=await request('/api/v1/auth/forgot-password',{method:'POST',auth:false,body:{email}});
  const resetOtp=forgot?.data?.developmentOtp;assert(/^\d{6}$/.test(String(resetOtp||'')),'Password-reset development OTP missing');
  const verified=await request('/api/v1/auth/verify-reset-otp',{method:'POST',auth:false,body:{email,otp:String(resetOtp)}});
  const resetToken=verified?.data?.resetToken;assert(resetToken,'Reset token missing');
  await request('/api/v1/auth/reset-password',{method:'POST',auth:false,body:{resetToken,password:password2}});
  jar.clear();await request('/api/v1/auth/login',{method:'POST',auth:false,body:{email,password:password2}});

  await makeAdmin();jar.clear();await request('/api/v1/auth/login',{method:'POST',auth:false,body:{email,password:password2}});
  const admin=await request('/api/v1/admin/overview');assert(admin?.data,'Admin RBAC/overview failed after role promotion');

  console.log('RUNTIME_E2E PASS: auth/OTP/refresh/reset, Mongo persistence, route/ACO pipeline, journey/tracking/reroute, Socket.IO/chat, readiness, SOS/trusted contact, CRM/replay, admin RBAC'+(aiUp?', AI direct smoke':' (AI unavailable warning)'));
}
main().then(async()=>{if(child){child.kill('SIGTERM');await sleep(400)}await dropDb();process.exit(0)}).catch(async e=>{console.error('RUNTIME_E2E FAIL:',e.stack||e);if(child){child.kill('SIGTERM');await sleep(400)}await dropDb();process.exit(1)});
