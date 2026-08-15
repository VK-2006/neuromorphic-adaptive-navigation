import {api,toast} from './api.js';

let gpsWatch=null,stream=null,webrtcPc=null,webrtcPeerId=null,inferenceTimer=null,simulationTimer=null,adaptiveTimer=null;
let lastInferenceAt=0,inferenceCount=0,inferenceBusy=false;
let map,userMarker,routeLine,coveredLine,remainingLine,socket,headingLine=null;
let route=[],routeDoc=null,journey=null,progress=0,lastSpoken='',pendingReroute=null,rerouteBusy=false,voiceEnabled=false,lastPosition=null;
let wakeLock=null,trackingInFlight=false,pendingTracking=null,trackingTimer=null,lastTrackingSentAt=0,lastTrackingPosition=null;
let arrivalSamples=0,liveReadiness=null,aiWarningShown=false,gpsWarningShown=false;
const jid=()=>sessionStorage.getItem('journeyId');
const offlineKey=()=>`navora:live-pending:${jid()||'none'}`;

const journeyControlIds=['start-camera','stop-camera','detection-toggle','start-journey','pause-journey','complete-journey','sos','voice-toggle','recenter','fullscreen-journey','share-journey','revoke-share','connect-webrtc','accept-reroute','decline-reroute'];
function setJourneyControls(enabled){journeyControlIds.forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!enabled});const share=document.getElementById('open-mobile-share');if(share){share.setAttribute('aria-disabled',String(!enabled));share.style.pointerEvents=enabled?'':'none';share.style.opacity=enabled?'':'0.55'}}
function showNoJourneyState(message='Plan and select a route before opening Live Journey.'){setJourneyControls(false);const pane=document.querySelector('.navigation-pane');if(!pane||pane.querySelector('.navora-state-panel'))return;const box=document.createElement('div');box.className='navora-state-panel';box.innerHTML=`<h3>No active journey</h3><p class="muted">${message}</p><a class="btn-navora" href="map.html">Plan a route</a>`;pane.prepend(box)}

async function init(){
  if(!document.getElementById('journey-map'))return;
  if(window.L){
    map=L.map('journey-map',{zoomControl:true}).setView([17.385,78.4867],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
  }
  bind();
  setupFieldEnvironment();
  await enumerateCameras();
  loadVoices();
  window.speechSynthesis?.addEventListener?.('voiceschanged',loadVoices);
  const id=jid();
  if(!id){
    showNoJourneyState();
    document.getElementById('journey-title').textContent='No active journey';
    setFieldChip('field-mode','NO JOURNEY');
    toast('Plan a real route first, then start a saved journey.','warning');
    return;
  }
  try{
    const d=await api(`/journeys/${id}`);
    journey=d?.journey||null;routeDoc=d?.route||null;if(!journey)throw new Error('Journey data is unavailable.');
    voiceEnabled=localStorage.getItem('navora:voice-enabled')!=='false'&&journey.mode==='LIVE';
    updateVoiceButton();
    renderJourney();setJourneyControls(true);
    connectSocket();
    await loadLiveReadiness();
    startAdaptiveReevaluation();
    if(journey.mode==='SIMULATION'){
      document.getElementById('sim-banner').classList.remove('hidden');
      setFieldChip('field-mode','SIMULATION');
      startSimulation();
    }else{
      setFieldChip('field-mode','LIVE FIELD');
      if(journey.status==='ACTIVE'){
        startGps();
        requestWakeLock();
      }
    }
  }catch(e){setJourneyControls(false);showNoJourneyState(e.message);toast(e.message,'error')}
}

function bind(){
  document.getElementById('start-camera')?.addEventListener('click',startCamera);
  document.getElementById('stop-camera')?.addEventListener('click',stopCamera);
  document.getElementById('detection-toggle')?.addEventListener('click',toggleDetection);
  document.getElementById('start-journey')?.addEventListener('click',resumeJourney);
  document.getElementById('pause-journey')?.addEventListener('click',pauseJourney);
  document.getElementById('complete-journey')?.addEventListener('click',()=>completeJourney());
  document.getElementById('sos')?.addEventListener('click',sendSos);
  document.getElementById('voice-toggle')?.addEventListener('click',toggleVoice);
  document.getElementById('recenter')?.addEventListener('click',()=>lastPosition&&map?.setView([lastPosition.lat,lastPosition.lng],17));
  document.getElementById('fullscreen-journey')?.addEventListener('click',enterFullscreen);
  document.getElementById('share-journey')?.addEventListener('click',shareJourney);
  document.getElementById('revoke-share')?.addEventListener('click',revokeShare);
  document.getElementById('connect-webrtc')?.addEventListener('click',connectWebRtcReceiver);
  const share=document.getElementById('open-mobile-share');if(share)share.href=`camera-share.html?journeyId=${encodeURIComponent(jid()||'')}`;
  document.getElementById('accept-reroute')?.addEventListener('click',acceptReroute);
  document.getElementById('decline-reroute')?.addEventListener('click',()=>{pendingReroute=null;document.getElementById('reroute-panel').classList.add('hidden')});
}

function setupFieldEnvironment(){
  setNetworkState();
  window.addEventListener('online',()=>{setNetworkState();flushTracking(true);toast('Connection restored; live tracking resumed.','success')});
  window.addEventListener('offline',()=>{setNetworkState();toast('Offline: route stays visible and the latest GPS fix will sync when connection returns.','warning')});
  document.addEventListener('visibilitychange',()=>{
    setFieldChip('foreground-state',document.hidden?'BACKGROUND':'FOREGROUND');
    if(!document.hidden&&journey?.mode==='LIVE'&&journey?.status==='ACTIVE')requestWakeLock();
  });
  const local=['localhost','127.0.0.1','::1'].includes(location.hostname);
  setFieldChip('secure-state',window.isSecureContext?(local?'LOCAL SECURE':'HTTPS SECURE'):'HTTPS REQUIRED');
}

async function loadLiveReadiness(){
  if(journey?.mode!=='LIVE')return;
  try{
    liveReadiness=await api('/live/readiness');
    const ai=liveReadiness.ai||{};
    setFieldChip('ai-state',ai.safetyEligible?'AI VALIDATED':ai.reachable?'AI RESEARCH ONLY':'AI OFFLINE');
    setFieldChip('route-provider-state',liveReadiness.routing?.live?String(liveReadiness.routing.provider||'LIVE').toUpperCase():'ROUTING NOT LIVE');
    if(liveReadiness.warnings?.length&&!aiWarningShown){
      aiWarningShown=true;
      toast(liveReadiness.warnings[0],'warning');
    }
  }catch(e){
    setFieldChip('ai-state','READINESS UNKNOWN');
    toast(`Live readiness check: ${e.message}`,'warning');
  }
}

function renderJourney(){
  document.getElementById('journey-status').textContent=journey.status;
  document.getElementById('journey-title').textContent=routeDoc?.label||'Adaptive journey';
  document.getElementById('journey-safety').textContent=routeDoc?.safetyScore!=null?`${Math.round(routeDoc.safetyScore)}%`:'—';
  route=routeDoc?.coordinates||[];
  drawRoute();
  if(journey.lastKnownPosition){lastPosition=journey.lastKnownPosition;updateMap(lastPosition)}
  applyProgress({distanceCovered:journey.distanceCovered||0,routeDistanceCovered:Math.max(0,(journey.distanceCovered||0)-(journey.distanceOffset||0)),distanceRemaining:journey.distanceRemaining??routeDoc?.distance??0,progress:(journey.totalDistance||routeDoc?.distance)?100*(journey.distanceCovered||0)/(journey.totalDistance||routeDoc.distance):0,etaSeconds:(routeDoc?.trafficDuration||0)*((journey.distanceRemaining??routeDoc?.distance??0)/(routeDoc?.distance||1))});
}

function drawRoute(){
  routeLine?.remove();coveredLine?.remove();remainingLine?.remove();
  if(!route.length||!map||!window.L)return;
  routeLine=L.polyline(route.map(p=>[p.lat,p.lng]),{weight:9,opacity:.28,className:'navora-route-base'}).addTo(map);
  remainingLine=L.polyline(route.map(p=>[p.lat,p.lng]),{weight:7,opacity:.94,className:'navora-route-live'}).addTo(map);
  map.fitBounds(routeLine.getBounds(),{padding:[40,40]});
}

function connectSocket(){
  if(!window.io||!jid())return;
  socket=window.io({withCredentials:true,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:800,reconnectionDelayMax:5000});
  socket.on('connect',()=>setFieldChip('socket-state','REALTIME ON'));
  socket.on('disconnect',()=>setFieldChip('socket-state','REALTIME RETRY'));
  socket.emit('journey:join',{journeyId:jid()},ack=>{if(!ack?.ok)toast('Journey socket authorization failed','error')});
  socket.emit('webrtc:join',{journeyId:jid()});
  socket.on('webrtc:signal',handleWebRtcSignal);
  socket.on('route:updated',({route:r})=>{routeDoc=r;route=r.coordinates||[];drawRoute();toast('Route updated across connected devices')});
  socket.on('hazard:alerts',alerts=>alerts?.forEach(a=>toast(`${a.risk||'HAZARD'}: ${a.type} ${a.distanceAhead} m ahead`,'warning')));
}

async function connectWebRtcReceiver(){
  if(!socket)return toast('Journey socket not connected','error');
  if(!window.RTCPeerConnection)return toast('WebRTC is not supported in this browser.','error');
  try{
    if(webrtcPc)webrtcPc.close();
    webrtcPc=new window.RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    webrtcPc.ontrack=e=>{stream=e.streams[0];const v=document.getElementById('camera-video');v.srcObject=stream;v.play();document.getElementById('camera-state').textContent='Mobile WebRTC ON';startInferenceLoop()};
    webrtcPc.onicecandidate=e=>{if(e.candidate&&webrtcPeerId)socket.emit('webrtc:signal',{journeyId:jid(),targetId:webrtcPeerId,signal:{type:'candidate',candidate:e.candidate}})};
    webrtcPc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(webrtcPc.connectionState))document.getElementById('camera-state').textContent='Mobile WebRTC disconnected'};
    socket.emit('webrtc:receiver-ready',{journeyId:jid()});toast('Waiting for your mobile camera peer…');
  }catch(e){toast(`WebRTC: ${e.message}`,'error')}
}

async function handleWebRtcSignal({fromId,signal}){
  if(!webrtcPc)return;
  try{
    webrtcPeerId=fromId;
    if(signal.type==='offer'){
      await webrtcPc.setRemoteDescription(signal.sdp);const answer=await webrtcPc.createAnswer();await webrtcPc.setLocalDescription(answer);
      socket.emit('webrtc:signal',{journeyId:jid(),targetId:fromId,signal:{type:'answer',sdp:webrtcPc.localDescription}});
    }else if(signal.type==='candidate'&&signal.candidate)await webrtcPc.addIceCandidate(signal.candidate);
  }catch(e){toast(`WebRTC signal: ${e.message}`,'error')}
}

async function enumerateCameras(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try{
    const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const sel=document.getElementById('camera-select');if(!sel)return;
    sel.innerHTML='<option value="">Rear/default camera</option>';
    list.forEach((d,i)=>{const o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||`Camera ${i+1}`;sel.appendChild(o)});
  }catch{}
}

async function startCamera(){
  if(stream)return;
  if(!window.isSecureContext)return toast('Field camera requires HTTPS (localhost is allowed only for development).','error');
  if(!navigator.mediaDevices?.getUserMedia)return toast('Camera API is unavailable in this browser.','error');
  try{
    const deviceId=document.getElementById('camera-select')?.value;
    stream=await navigator.mediaDevices.getUserMedia({video:deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    const v=document.getElementById('camera-video');v.srcObject=stream;await v.play();await enumerateCameras();
    document.getElementById('camera-state').textContent='Camera ON';startInferenceLoop();
  }catch(e){toast(`Camera unavailable: ${e.message}`,'error')}
}

function startInferenceLoop(){if(inferenceTimer)clearInterval(inferenceTimer);inferenceTimer=setInterval(captureForInference,700)}

function stopCamera(){
  webrtcPc?.close();webrtcPc=null;webrtcPeerId=null;
  if(inferenceTimer)clearInterval(inferenceTimer);inferenceTimer=null;inferenceBusy=false;
  stream?.getTracks().forEach(t=>t.stop());stream=null;
  const v=document.getElementById('camera-video');if(v)v.srcObject=null;
  const state=document.getElementById('camera-state');if(state)state.textContent='Camera OFF';
  clearBoxes();
}

function toggleDetection(){
  const b=document.getElementById('detection-toggle');
  b.dataset.enabled=b.dataset.enabled==='true'?'false':'true';
  b.textContent=`Detection ${b.dataset.enabled==='true'?'ON':'OFF'}`;
  if(b.dataset.enabled==='false')clearBoxes();
  else if(liveReadiness?.ai&&!liveReadiness.ai.safetyEligible)toast('Camera AI is research-only until trained detector and SNN weights are marked validated. It will not auto-reroute a LIVE journey.','warning');
}

async function captureForInference(){
  const fps=document.getElementById('camera-fps');
  if(!stream||document.getElementById('detection-toggle')?.dataset.enabled==='false'||!navigator.onLine){if(fps)fps.textContent='AI 0 FPS';return}
  if(inferenceBusy)return;
  const v=document.getElementById('camera-video');if(!v?.videoWidth)return;
  inferenceBusy=true;inferenceCount++;
  const now=performance.now();if(!lastInferenceAt)lastInferenceAt=now;
  if(now-lastInferenceAt>=1000){if(fps)fps.textContent=`AI ${inferenceCount} req/s`;inferenceCount=0;lastInferenceAt=now}
  try{
    const c=document.getElementById('capture-canvas');const width=512;c.width=width;c.height=Math.max(288,Math.round(width*v.videoHeight/v.videoWidth));
    c.getContext('2d',{alpha:false}).drawImage(v,0,0,c.width,c.height);
    const image=c.toDataURL('image/jpeg',.52);
    const d=await api('/hazards/detect',{method:'POST',body:JSON.stringify({image,journeyId:jid(),location:lastPosition||null})});
    const safetyEligible=d.safetyEligible===true;
    document.getElementById('risk').textContent=`${safetyEligible?'Risk':'Research'} ${d.risk?.level||'LOW'} ${Math.round((d.risk?.score||0)*100)}%`;
    setFieldChip('ai-state',safetyEligible?'AI VALIDATED':'AI RESEARCH ONLY');
    drawBoxes(d.detections||[]);
    if(safetyEligible&&d.risk?.level==='CRITICAL'){
      speak('Critical validated hazard detected ahead.');
      if(!rerouteBusy&&!pendingReroute)requestReroute('validated critical camera-detected obstacle');
    }else if(safetyEligible&&d.risk?.level==='HIGH')speak('Validated high-risk obstacle detected ahead.');
  }catch(e){
    setFieldChip('ai-state','AI DEGRADED');
  }finally{inferenceBusy=false}
}

function clearBoxes(){const c=document.getElementById('overlay-canvas');c?.getContext('2d')?.clearRect(0,0,c.width,c.height)}
function drawBoxes(ds){
  const c=document.getElementById('overlay-canvas'),v=document.getElementById('camera-video');if(!c||!v)return;
  c.width=v.clientWidth;c.height=v.clientHeight;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);const uiAccent=getComputedStyle(document.documentElement).getPropertyValue('--ui-ai-accent').trim()||'#A99BFF';x.strokeStyle=uiAccent;x.fillStyle=uiAccent;x.font='14px sans-serif';
  ds.forEach(d=>{const b=d.boundingBox||[.1,.1,.2,.2];x.strokeRect(b[0]*c.width,b[1]*c.height,b[2]*c.width,b[3]*c.height);x.fillText(`${d.objectClass} ${Math.round(d.confidence*100)}%`,b[0]*c.width,Math.max(14,b[1]*c.height-4))});
}

async function resumeJourney(){
  if(!jid())return toast('Plan a route first','error');
  try{
    journey=await api(`/journeys/${jid()}/${journey?.status==='PAUSED'?'resume':'start'}`,{method:'POST'});
    document.getElementById('journey-status').textContent=journey.status;
    if(journey.mode==='SIMULATION')startSimulation();else{
      await requestWakeLock();startGps();flushTracking(true);
      if(voiceEnabled)speak('Live navigation started. Keep Navora visible for continuous field guidance.');
    }
    toast(journey.mode==='LIVE'?'Live journey active':'Simulation active','success');
  }catch(e){toast(e.message,'error')}
}

async function pauseJourney(){
  stopGps();stopSimulation();releaseWakeLock();if(!jid())return;
  try{journey=await api(`/journeys/${jid()}/pause`,{method:'POST'});document.getElementById('journey-status').textContent='PAUSED';toast('Journey paused')}catch(e){toast(e.message,'error')}
}

async function completeJourney({automaticSimulation=false,automaticArrival=false}={}){
  if(!jid())return;stopGps();stopSimulation();releaseWakeLock();
  if(!automaticSimulation&&!automaticArrival&&!confirm('Complete this journey and update Cognitive Route Memory / EMA?'))return;
  try{
    journey=await api(`/journeys/${jid()}/complete`,{method:'POST',body:JSON.stringify({success:true,userFeedback:.8})});
    document.getElementById('journey-status').textContent='COMPLETED';speak('Destination reached. Journey completed.');
    toast(automaticSimulation?'SIMULATION MODE: destination reached; CRM and EMA updated':automaticArrival?'Destination reached; journey completed and route memory updated':'Journey completed; CRM and EMA updated','success');
    sessionStorage.setItem('lastCompletedJourneyId',jid());
  }catch(e){toast(e.message,'error')}
}

function startGps(){
  if(gpsWatch!==null)return;
  if(!window.isSecureContext)return toast('Live GPS requires HTTPS on a field device.','error');
  if(!navigator.geolocation)return toast('Geolocation not supported','error');
  setFieldChip('gps-state','GPS STARTING');
  gpsWatch=navigator.geolocation.watchPosition(onPosition,e=>{setFieldChip('gps-state','GPS ERROR');toast(`GPS: ${e.message}`,'error')},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  toast('High-accuracy live GPS tracking started');
}

function stopGps(){if(gpsWatch!==null)navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;setFieldChip('gps-state','GPS PAUSED')}

function onPosition(p){
  const c=p.coords;
  lastPosition={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,heading:c.heading,speed:c.speed,altitude:c.altitude,timestamp:p.timestamp};
  setFieldChip('gps-state',`GPS ±${Math.round(c.accuracy||0)}m`);
  if((c.accuracy||0)>60&&!gpsWarningShown){gpsWarningShown=true;toast('GPS accuracy is weak. Route matching will wait for more reliable fixes where possible.','warning')}
  if((c.accuracy||0)<=35)gpsWarningShown=false;
  updateMap(lastPosition);queueTracking(lastPosition);
}

function queueTracking(pos,force=false){
  if(journey?.mode!=='LIVE'||journey?.status!=='ACTIVE')return;
  pendingTracking=pos;
  try{localStorage.setItem(offlineKey(),JSON.stringify(pos))}catch{}
  if(!navigator.onLine){setNetworkState();return}
  const now=Date.now();const moved=lastTrackingPosition?geoDistance(lastTrackingPosition,pos):Infinity;
  const due=force||!lastTrackingSentAt||now-lastTrackingSentAt>=2000||moved>=8;
  if(due)flushTracking(force);else if(!trackingTimer){trackingTimer=setTimeout(()=>{trackingTimer=null;flushTracking()},Math.max(250,2000-(now-lastTrackingSentAt)))}
}

async function flushTracking(force=false){
  if(trackingInFlight||!navigator.onLine||journey?.status!=='ACTIVE')return;
  if(!pendingTracking){
    try{const saved=JSON.parse(localStorage.getItem(offlineKey())||'null');if(saved)pendingTracking=saved}catch{}
  }
  if(!pendingTracking)return;
  const pos=pendingTracking;pendingTracking=null;trackingInFlight=true;
  try{
    const r=await api('/tracking/update',{method:'POST',body:JSON.stringify({journeyId:jid(),...pos})});
    lastTrackingSentAt=Date.now();lastTrackingPosition=pos;
    try{localStorage.removeItem(offlineKey())}catch{}
    applyProgress(r);
    if(r.rerouteRecommendation?.reroute&&!rerouteBusy)requestReroute(r.rerouteRecommendation.reason);
    if(r.arrival?.arrived){arrivalSamples+=1;if(arrivalSamples>=3&&journey?.status==='ACTIVE')completeJourney({automaticArrival:true})}else arrivalSamples=0;
  }catch(e){
    pendingTracking=pos;
    try{localStorage.setItem(offlineKey(),JSON.stringify(pos))}catch{}
    if(!String(e.message).includes('Authentication'))setFieldChip('network-state','SYNC RETRY');
  }finally{
    trackingInFlight=false;
    if(pendingTracking&&navigator.onLine)setTimeout(()=>flushTracking(force),400);
  }
}

function updateMap(p){
  if(!map)return;const ll=[p.lat,p.lng];
  if(!userMarker)userMarker=L.circleMarker(ll,{radius:9,weight:4,className:'navora-live-position'}).addTo(map);else userMarker.setLatLng(ll);
  if(Number.isFinite(p.heading)){
    headingLine?.remove();const rad=p.heading*Math.PI/180;const q=[p.lat+Math.cos(rad)*.0015,p.lng+Math.sin(rad)*.0015];headingLine=L.polyline([ll,q],{weight:3,className:'navora-heading-line'}).addTo(map);
  }
  map.panTo(ll,{animate:true,duration:.45});
}

function applyProgress(r){
  progress=r.progress||0;
  if(lastPosition?.speed!=null)document.getElementById('current-speed').textContent=`${Math.max(0,lastPosition.speed*3.6).toFixed(1)} km/h`;
  if(r.nextManeuver)document.getElementById('next-maneuver').textContent=`${r.nextManeuver.maneuver?.instruction||r.nextManeuver.maneuver?.type||'Continue'} · ${r.nextManeuver.distance} m`;
  if(r.alerts?.length)r.alerts.forEach(a=>{toast(`${a.risk||'HAZARD'}: ${a.type} ${a.distanceAhead} m ahead`,'warning');if(['HIGH','CRITICAL'].includes(a.risk))speak(`${a.risk.toLowerCase()} risk ${a.type} ahead.`)});
  document.getElementById('progress-bar').style.width=`${Math.max(0,Math.min(100,progress))}%`;
  document.getElementById('progress-text').textContent=`${Math.round(progress)}%`;
  document.getElementById('distance-covered').textContent=`${((r.distanceCovered||0)/1000).toFixed(2)} km`;
  document.getElementById('distance-remaining').textContent=`${((r.distanceRemaining||0)/1000).toFixed(2)} km`;
  document.getElementById('eta').textContent=`${Math.max(0,Math.round((r.etaSeconds||0)/60))} min`;
  document.getElementById('arrival-time').textContent=new Date(Date.now()+Math.max(0,r.etaSeconds||0)*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  document.getElementById('journey-traffic').textContent=r.traffic?.severity||routeDoc?.trafficSeverity||'UNKNOWN';
  document.getElementById('journey-heading').textContent=Number.isFinite(Number(lastPosition?.heading))?`${Math.round(lastPosition.heading)}°`:'—';
  if(r.safetyScore!=null)document.getElementById('journey-safety').textContent=`${Math.round(r.safetyScore)}%`;
  if(r.voicePrompt)speak(r.voicePrompt);
  splitRouteByDistance(r.routeDistanceCovered??r.distanceCovered??0);
}

function geoDistance(a,b){const R=6371000,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),la1=rad(a.lat),la2=rad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(h))}

function splitRouteByDistance(distanceCovered){
  if(route.length<2||!window.L||!map)return;let remaining=Math.max(0,Number(distanceCovered)||0),cut={...route[0]},idx=0;
  for(let i=0;i<route.length-1;i++){const len=geoDistance(route[i],route[i+1]);if(remaining<=len){const t=len?Math.max(0,Math.min(1,remaining/len)):0;cut={lat:route[i].lat+(route[i+1].lat-route[i].lat)*t,lng:route[i].lng+(route[i+1].lng-route[i].lng)*t};idx=i;break}remaining-=len;idx=i+1;cut={...route[Math.min(i+1,route.length-1)]}}
  const covered=[...route.slice(0,idx+1),cut].filter((p,i,a)=>i===0||p.lat!==a[i-1].lat||p.lng!==a[i-1].lng),left=[cut,...route.slice(idx+1)];
  coveredLine?.remove();remainingLine?.remove();
  if(covered.length>1)coveredLine=L.polyline(covered.map(p=>[p.lat,p.lng]),{weight:7,opacity:.95,dashArray:'1',className:'navora-route-covered'}).addTo(map);
  if(left.length>1)remainingLine=L.polyline(left.map(p=>[p.lat,p.lng]),{weight:7,opacity:.82,className:'navora-route-live'}).addTo(map);
}

async function requestReroute(reason='route safety change'){
  if(rerouteBusy||pendingReroute||!lastPosition||!navigator.onLine||journey?.mode!=='LIVE'&&journey?.mode!=='SIMULATION')return;
  rerouteBusy=true;
  try{
    const d=await api('/routes/reroute',{method:'POST',body:JSON.stringify({journeyId:jid(),currentLocation:lastPosition})});
    const alt=d.recommendedRoute;if(!d.shouldOffer||!alt?.databaseId||String(d.currentRoute?.databaseId)===String(alt.databaseId))return;
    pendingReroute={...d,reason};
    const host=document.getElementById('reroute-comparison');host.innerHTML=`<div class="data-row"><strong>Current</strong><div>${fmtKm(d.currentRoute?.distance)} · ${fmtMin(d.currentRoute?.trafficDuration)}</div><div>Safety ${Math.round(d.currentRoute?.safetyScore||0)}%</div></div><div class="data-row"><strong>${esc(alt.label)}</strong><div>${fmtKm(alt.distance)} · ${fmtMin(alt.trafficDuration)}</div><div>Safety ${Math.round(alt.safetyScore||0)}%</div></div>`;
    document.getElementById('reroute-reason').textContent=`Trigger: ${reason}. Route switch requires your confirmation.`;
    document.getElementById('reroute-panel').classList.remove('hidden');speak('Safer route found. Review the alternative before switching.');
  }catch(e){toast(`Reroute: ${e.message}`,'warning')}finally{rerouteBusy=false}
}

async function acceptReroute(){
  if(!pendingReroute?.recommendedRoute?.databaseId)return;
  try{
    const d=await api(`/journeys/${jid()}/route`,{method:'POST',body:JSON.stringify({routeId:pendingReroute.recommendedRoute.databaseId,reason:pendingReroute.reason})});
    journey=d.journey;routeDoc=d.route;route=routeDoc.coordinates||[];drawRoute();document.getElementById('journey-safety').textContent=`${Math.round(routeDoc.safetyScore||0)}%`;document.getElementById('reroute-panel').classList.add('hidden');pendingReroute=null;toast('Adaptive route switched','success');
  }catch(e){toast(e.message,'error')}
}

function toggleVoice(){voiceEnabled=!voiceEnabled;localStorage.setItem('navora:voice-enabled',String(voiceEnabled));updateVoiceButton();if(voiceEnabled)speak('Voice navigation enabled.')}
function updateVoiceButton(){const b=document.getElementById('voice-toggle');if(b)b.textContent=`Voice ${voiceEnabled?'ON':'OFF'}`}
function loadVoices(){const sel=document.getElementById('voice-select');if(!sel||!('speechSynthesis'in window))return;const voices=speechSynthesis.getVoices();const cur=sel.value;sel.innerHTML='<option value="">Default system voice</option>'+voices.map((v,i)=>`<option value="${i}">${esc(v.name)} · ${esc(v.lang)}</option>`).join('');sel.value=cur}
function speak(text){if(!voiceEnabled||!text||text===lastSpoken||!('speechSynthesis'in window))return;lastSpoken=text;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=document.getElementById('voice-language')?.value||'en-IN';u.volume=Number(document.getElementById('voice-volume')?.value||1);const idx=document.getElementById('voice-select')?.value;if(idx!=='')u.voice=speechSynthesis.getVoices()[Number(idx)]||null;speechSynthesis.speak(u)}

async function requestWakeLock(){
  if(journey?.mode!=='LIVE'||journey?.status!=='ACTIVE')return;
  if(!('wakeLock'in navigator)){setFieldChip('wake-state','WAKE N/A');return}
  try{
    if(wakeLock&&!wakeLock.released)return;
    wakeLock=await navigator.wakeLock.request('screen');setFieldChip('wake-state','SCREEN AWAKE');
    wakeLock.addEventListener('release',()=>setFieldChip('wake-state','WAKE RELEASED'),{once:true});
  }catch{setFieldChip('wake-state','WAKE BLOCKED')}
}
async function releaseWakeLock(){try{await wakeLock?.release()}catch{}wakeLock=null;setFieldChip('wake-state','WAKE OFF')}

async function enterFullscreen(){
  try{
    if(document.fullscreenElement)return document.exitFullscreen?.();
    await document.documentElement.requestFullscreen?.();
    await requestWakeLock();
  }catch(e){toast(`Full screen unavailable: ${e.message}`,'warning')}
}

async function shareJourney(){try{const d=await api(`/journeys/${jid()}/share`,{method:'POST',body:JSON.stringify({hours:4})});const absolute=new URL(d.url,location.origin).href;document.getElementById('share-url').textContent=absolute;document.getElementById('share-expiry').textContent=`Expires ${new Date(d.expiresAt).toLocaleTimeString()}`;try{await navigator.clipboard.writeText(absolute);toast('Secure share link copied')}catch{toast('Secure share link created')}}catch(e){toast(e.message,'error')}}
async function revokeShare(){try{await api(`/journeys/${jid()}/share`,{method:'DELETE'});document.getElementById('share-url').textContent='';document.getElementById('share-expiry').textContent='Revoked';toast('Share link revoked')}catch(e){toast(e.message,'error')}}
async function sendSos(){if(!confirm('Send SOS to trusted contacts with current/last known journey position?'))return;try{await api('/sos',{method:'POST',body:JSON.stringify({journeyId:jid(),location:lastPosition})});toast('SOS recorded and trusted-contact notifications queued','success')}catch(e){toast(e.message,'error')}}

function startSimulation(){if(simulationTimer||journey?.status==='PAUSED'||journey?.status==='COMPLETED')return;document.getElementById('sim-banner').classList.remove('hidden');let i=0;const coords=route.length?route:Array.from({length:15},(_,n)=>({lat:17.385+n*.003,lng:78.4867-n*.0025}));simulationTimer=setInterval(async()=>{if(i>=coords.length){stopSimulation();await completeJourney({automaticSimulation:true});return}const p=coords[i];lastPosition={lat:p.lat,lng:p.lng,accuracy:8,heading:300,speed:9,timestamp:Date.now()};updateMap(lastPosition);await sendSimulationTracking(lastPosition);try{const d=await api('/simulation/step',{method:'POST',body:JSON.stringify({journeyId:jid(),index:i,location:lastPosition})});if(d.event){const chip=document.getElementById('simulation-detection');chip?.classList.remove('hidden');if(chip)chip.textContent=`Sim ${d.event.detection.objectClass} · ${d.event.risk.level}`;document.getElementById('risk').textContent=`Risk ${d.event.risk.level} ${Math.round((d.event.risk.score||0)*100)}%`;toast(`SIMULATION: ${d.event.detection.objectClass} · ${d.event.risk.level} risk`,'warning');if(['HIGH','CRITICAL'].includes(d.event.risk.level)&&!pendingReroute&&!rerouteBusy)requestReroute(`simulation ${d.event.detection.objectClass}`)}}catch(e){console.debug('simulation step',e)}i++},1800)}
async function sendSimulationTracking(pos){try{const r=await api('/tracking/update',{method:'POST',body:JSON.stringify({journeyId:jid(),...pos})});applyProgress(r)}catch(e){if(!String(e.message).includes('Authentication'))console.debug(e)}}
function stopSimulation(){if(simulationTimer)clearInterval(simulationTimer);simulationTimer=null}
function startAdaptiveReevaluation(){if(adaptiveTimer)return;adaptiveTimer=setInterval(()=>{if(journey?.status==='ACTIVE'&&lastPosition&&navigator.onLine&&!pendingReroute&&!rerouteBusy)requestReroute('periodic ACO adaptive re-evaluation')},90000)}
function stopAdaptiveReevaluation(){if(adaptiveTimer)clearInterval(adaptiveTimer);adaptiveTimer=null}

function setNetworkState(){setFieldChip('network-state',navigator.onLine?'ONLINE':'OFFLINE')}
function setFieldChip(id,text){const el=document.getElementById(id);if(el)el.textContent=text}
function fmtKm(v){return `${((v||0)/1000).toFixed(1)} km`}
function fmtMin(v){return `${Math.round((v||0)/60)} min`}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

addEventListener('pagehide',()=>{stopGps();stopSimulation();stopAdaptiveReevaluation();stopCamera();releaseWakeLock();if(trackingTimer)clearTimeout(trackingTimer);socket?.disconnect();window.speechSynthesis?.cancel?.()});
init();
