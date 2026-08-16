import{api,toast}from'./api.js';

let map,marker,hazardLayer,routeLayers=[],timer=null,pos=0,speed=1,data=null,timeline={start:0,end:0,duration:0};
const $=id=>document.getElementById(id),slider=$('replay-slider');
const arr=v=>Array.isArray(v)?v:[];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const ms=v=>{const n=new Date(v).getTime();return Number.isFinite(n)?n:null};

function leafletReady(){return Boolean(window.L&&map)}
function mapUnavailable(){const host=$('replay-map');if(host)host.innerHTML='<div class="navora-state-panel"><h3>Map unavailable</h3><p class="muted">Leaflet could not load. Replay details remain available.</p></div>'}
function replayable(j){return['COMPLETED','ACTIVE','PAUSED'].includes(String(j?.status||'').toUpperCase())}

async function init(){
  if(window.L){
    try{map=window.L.map('replay-map').setView([17.385,78.4867],12);window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);hazardLayer=window.L.layerGroup().addTo(map)}
    catch(e){map=null;hazardLayer=null;mapUnavailable();toast(`Replay map: ${e.message}`,'warning')}
  }else mapUnavailable();
  try{
    const rows=arr(await api('/journeys')),sel=$('replay-journey');
    if(sel)rows.filter(replayable).forEach(j=>{const o=document.createElement('option');o.value=j._id;o.textContent=`${j.createdAt?new Date(j.createdAt).toLocaleString():'—'} · ${j.mode||'—'} · ${j.status||'—'}`;sel.appendChild(o)});
    const requested=new URLSearchParams(location.search).get('journey');
    const preferred=requested||sessionStorage.getItem('lastCompletedJourneyId');
    if(preferred&&rows.some(j=>String(j?._id)===String(preferred)&&replayable(j))&&sel){sel.value=preferred;await load(preferred)}
  }catch(e){toast(e.message,'error')}
  bind();
}
function bind(){
  $('replay-journey')?.addEventListener('change',e=>load(e.target.value));
  $('play')?.addEventListener('click',play);$('pause')?.addEventListener('click',()=>clearInterval(timer));
  $('restart')?.addEventListener('click',()=>{pos=0;render()});
  slider?.addEventListener('input',()=>{pos=Number(slider.value)/10;render()});
  $('replay-speed')?.addEventListener('change',e=>speed=Math.max(.1,Number(e.target.value)||1));
}
function clearRoutes(){routeLayers.forEach(x=>{try{x.remove()}catch{}});routeLayers=[]}
function drawRoutes(){
  clearRoutes();if(!leafletReady()||!data)return;
  const routes=arr(data.routeHistory).length?arr(data.routeHistory):[data.originalRoute,data.currentRoute].filter(Boolean);
  routes.forEach(r=>{
    const coords=arr(r?.coordinates).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)));if(coords.length<2)return;
    const isOriginal=String(r?._id)===String(data.originalRoute?._id),isCurrent=String(r?._id)===String(data.currentRoute?._id);
    const line=window.L.polyline(coords.map(p=>[p.lat,p.lng]),{weight:isCurrent?7:5,opacity:isCurrent ? .95 : .55,dashArray:isOriginal&&!isCurrent?'9 8':undefined}).addTo(map).bindTooltip(`${isOriginal?'Original':isCurrent?'Final':'Reroute'} · ${esc(r.label||'route')} · ACO ${Number(r.acoScore||0).toFixed(2)}`);
    routeLayers.push(line);
  });
  const group=routeLayers.length?window.L.featureGroup(routeLayers):null;if(group?.getBounds?.().isValid())map.fitBounds(group.getBounds(),{padding:[30,30]});
}
function detail(e={}){
  const parts=[];if(e.reason)parts.push(e.reason);if(e.trafficSeverity||e.severity)parts.push(`Traffic ${e.trafficSeverity||e.severity}`);
  if(Number.isFinite(Number(e.acoScore)))parts.push(`ACO ${Number(e.acoScore).toFixed(2)}`);
  if(Number.isFinite(Number(e.safetyScore)))parts.push(`Safety ${Math.round(e.safetyScore)}%`);
  if(Number.isFinite(Number(e.snnHazardRisk)))parts.push(`SNN ${(Number(e.snnHazardRisk)*100).toFixed(0)}%`);
  if(Number.isFinite(Number(e.dtwSimilarity)))parts.push(`DTW ${(Number(e.dtwSimilarity)*100).toFixed(0)}%`);
  if(Number.isFinite(Number(e.emaHistoricalSafety)))parts.push(`EMA ${(Number(e.emaHistoricalSafety)*100).toFixed(0)}%`);
  if(e.hazardType)parts.push(e.hazardType);if(e.risk)parts.push(`Risk ${e.risk}`);return parts.join(' · ');
}
function pointTime(p){return ms(p?.capturedAt??p?.timestamp??p?.createdAt)}
function eventTime(e){return ms(e?.at??e?.createdAt)}
function buildTimeline(){
  const times=[
    ms(data?.journey?.startedAt),ms(data?.journey?.createdAt),ms(data?.journey?.completedAt),
    ...arr(data?.points).map(pointTime),...arr(data?.events).map(eventTime)
  ].filter(Number.isFinite);
  timeline.start=times.length?Math.min(...times):Date.now();timeline.end=times.length?Math.max(...times):timeline.start+1;timeline.duration=Math.max(1,timeline.end-timeline.start);
}
function currentTime(){return timeline.start+timeline.duration*Math.max(0,Math.min(100,pos))/100}
function interpolatePoint(time){
  const pts=arr(data?.points).map(p=>({p,t:pointTime(p)})).filter(x=>Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);
  if(!pts.length)return null;if(time<=pts[0].t)return pts[0].p;if(time>=pts.at(-1).t)return pts.at(-1).p;
  let lo=pts[0],hi=pts.at(-1);
  for(let i=1;i<pts.length;i++){if(pts[i].t>=time){lo=pts[i-1];hi=pts[i];break}}
  const a=lo.p?.location?.coordinates,b=hi.p?.location?.coordinates;if(!Array.isArray(a)||!Array.isArray(b))return lo.p;
  const ratio=Math.max(0,Math.min(1,(time-lo.t)/Math.max(1,hi.t-lo.t)));
  return{...lo.p,location:{...lo.p.location,coordinates:[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio]},speed:Number(lo.p?.speed||0)+(Number(hi.p?.speed||0)-Number(lo.p?.speed||0))*ratio};
}
function activeEvent(time){
  const events=arr(data?.events).map(e=>({e,t:eventTime(e)})).filter(x=>Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);
  let latest=null;for(const x of events){if(x.t<=time)latest=x.e;else break}return latest;
}
async function load(id){
  if(!id)return;clearInterval(timer);pos=0;data=null;clearRoutes();hazardLayer?.clearLayers?.();marker?.remove?.();marker=null;
  if($('replay-summary'))$('replay-summary').textContent='Loading replay…';
  if($('replay-events'))$('replay-events').innerHTML='';
  if($('replay-event'))$('replay-event').textContent='Loading journey…';
  try{
    data=(await api(`/journeys/${encodeURIComponent(id)}/replay`))||{};drawRoutes();buildTimeline();
    for(const h of arr(data.hazards)){const c=h?.location?.coordinates;if(leafletReady()&&Array.isArray(c)&&c.length>=2)window.L.circleMarker([c[1],c[0]],{radius:7}).bindPopup(`${esc(h.type)} · ${esc(h.snnRiskLevel||'')} · trust ${Math.round((Number(h.trustScore)||0)*100)}%`).addTo(hazardLayer)}
    const events=arr(data.events),reroutes=events.filter(e=>e?.type==='REROUTE_ACCEPTED').length,traffic=events.filter(e=>e?.type==='TRAFFIC_CHANGE').length,aco=events.filter(e=>e?.type==='ACO_REEVALUATION').length,points=arr(data.points),hazards=arr(data.hazards);
    if($('replay-summary'))$('replay-summary').textContent=`${data.journey?.mode||'—'} · ${points.length} GPS points · ${hazards.length} hazards · ${reroutes} reroutes · ${aco} ACO decisions · ${traffic} traffic changes · timestamp-synchronized`;
    if($('replay-events'))$('replay-events').innerHTML=events.map(e=>`<div class="event-item"><strong>${esc(e?.type)}</strong><div class="muted">${e?.at?new Date(e.at).toLocaleString():''}${detail(e)?' · '+esc(detail(e)):''}</div></div>`).join('')||'<div class="empty-state">No recorded decision events.</div>';
    render();
  }catch(e){data=null;if($('replay-summary'))$('replay-summary').textContent='Replay unavailable.';if($('replay-event'))$('replay-event').textContent='Could not load journey';toast(e.message,'error')}
}
function render(){
  if(!data)return;if(slider)slider.value=Math.round(pos*10);if($('replay-position'))$('replay-position').textContent=`${Math.round(pos)}%`;
  const t=currentTime(),p=interpolatePoint(t);
  if(p){
    const c=p?.location?.coordinates;if(leafletReady()&&Array.isArray(c)&&c.length>=2){const ll=[c[1],c[0]];if(!marker)marker=window.L.circleMarker(ll,{radius:9}).addTo(map);else marker.setLatLng(ll)}
    if($('replay-event'))$('replay-event').textContent=`${new Date(t).toLocaleTimeString()} · GPS ${(Number(p?.speed||0)*3.6).toFixed(1)} km/h`;
  }
  const e=activeEvent(t);if(e&&$('replay-event'))$('replay-event').textContent=`${new Date(t).toLocaleTimeString()} · ${e.type||'Event'}${detail(e)?' · '+detail(e):''}`;
}
function play(){
  clearInterval(timer);if(!data)return toast('Select a journey first','warning');
  const pctPerSecond=100000/Math.max(1000,timeline.duration);
  timer=setInterval(()=>{pos=Math.min(100,pos+pctPerSecond*speed*.06);render();if(pos>=100)clearInterval(timer)},60);
}
addEventListener('pagehide',()=>{clearInterval(timer);clearRoutes();marker?.remove?.();hazardLayer?.clearLayers?.()});init();
