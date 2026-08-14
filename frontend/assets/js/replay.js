import{api,toast}from'./api.js';
let map,marker,hazardLayer,routeLayers=[],timer=null,pos=0,speed=1,data=null;
const $=id=>document.getElementById(id),slider=$('replay-slider');
const arr=v=>Array.isArray(v)?v:[];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function leafletReady(){return Boolean(window.L&&map)}
function mapUnavailable(){const host=$('replay-map');if(host)host.innerHTML='<div class="navora-state-panel"><h3>Map unavailable</h3><p class="muted">Leaflet could not load. Replay details remain available.</p></div>'}
async function init(){
  if(window.L){
    try{map=window.L.map('replay-map').setView([17.385,78.4867],12);window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);hazardLayer=window.L.layerGroup().addTo(map)}catch(e){map=null;hazardLayer=null;mapUnavailable();toast(`Replay map: ${e.message}`,'warning')}
  }else mapUnavailable();
  try{
    const rows=arr(await api('/journeys')),sel=$('replay-journey');
    if(sel)rows.filter(j=>['COMPLETED','ACTIVE','PAUSED'].includes(j?.status)).forEach(j=>{const o=document.createElement('option');o.value=j._id;o.textContent=`${j.createdAt?new Date(j.createdAt).toLocaleString():'—'} · ${j.mode||'—'} · ${j.status||'—'}`;sel.appendChild(o)});
    const preferred=sessionStorage.getItem('lastCompletedJourneyId');
    if(preferred&&rows.some(j=>String(j?._id)===String(preferred))&&sel){sel.value=preferred;await load(preferred)}
  }catch(e){toast(e.message,'error')}
  bind();
}
function bind(){
  $('replay-journey')?.addEventListener('change',e=>load(e.target.value));
  $('play')?.addEventListener('click',play);
  $('pause')?.addEventListener('click',()=>clearInterval(timer));
  $('restart')?.addEventListener('click',()=>{pos=0;render()});
  slider?.addEventListener('input',()=>{pos=Number(slider.value)/10;render()});
  $('replay-speed')?.addEventListener('change',e=>speed=Math.max(.1,Number(e.target.value)||1));
}
function clearRoutes(){routeLayers.forEach(x=>{try{x.remove()}catch{}});routeLayers=[]}
function drawRoutes(){
  clearRoutes();if(!leafletReady()||!data)return;
  const routes=arr(data.routeHistory).length?arr(data.routeHistory):[data.originalRoute,data.currentRoute].filter(Boolean);
  routes.forEach(r=>{if(!arr(r?.coordinates).length)return;const isOriginal=String(r?._id)===String(data.originalRoute?._id),isCurrent=String(r?._id)===String(data.currentRoute?._id);const line=window.L.polyline(r.coordinates.map(p=>[p.lat,p.lng]),{weight:isCurrent?7:5,opacity:isCurrent?.95:.55,dashArray:isOriginal&&!isCurrent?'9 8':undefined}).addTo(map).bindTooltip(`${isOriginal?'Original':isCurrent?'Final':'Reroute'} · ${r.label||'route'} · ACO ${Number(r.acoScore||0).toFixed(2)}`);routeLayers.push(line)});
  const group=routeLayers.length?window.L.featureGroup(routeLayers):null;if(group?.getBounds?.().isValid())map.fitBounds(group.getBounds(),{padding:[30,30]});
}
function detail(e={}){const parts=[];if(e.reason)parts.push(e.reason);if(e.trafficSeverity||e.severity)parts.push(`Traffic ${e.trafficSeverity||e.severity}`);if(Number.isFinite(Number(e.acoScore)))parts.push(`ACO ${Number(e.acoScore).toFixed(2)}`);if(Number.isFinite(Number(e.safetyScore)))parts.push(`Safety ${Math.round(e.safetyScore)}%`);if(Number.isFinite(Number(e.snnHazardRisk)))parts.push(`SNN ${(Number(e.snnHazardRisk)*100).toFixed(0)}%`);if(Number.isFinite(Number(e.dtwSimilarity)))parts.push(`DTW ${(Number(e.dtwSimilarity)*100).toFixed(0)}%`);if(Number.isFinite(Number(e.emaHistoricalSafety)))parts.push(`EMA ${(Number(e.emaHistoricalSafety)*100).toFixed(0)}%`);if(e.hazardType)parts.push(e.hazardType);if(e.risk)parts.push(`Risk ${e.risk}`);return parts.join(' · ')}
async function load(id){
  if(!id)return;clearInterval(timer);pos=0;
  try{
    data=(await api(`/journeys/${encodeURIComponent(id)}/replay`))||{};
    hazardLayer?.clearLayers?.();drawRoutes();
    for(const h of arr(data.hazards)){const c=h?.location?.coordinates;if(leafletReady()&&Array.isArray(c)&&c.length>=2)window.L.circleMarker([c[1],c[0]],{radius:7}).bindPopup(`${esc(h.type)} · ${esc(h.snnRiskLevel||'')} · trust ${Math.round((Number(h.trustScore)||0)*100)}%`).addTo(hazardLayer)}
    const events=arr(data.events),reroutes=events.filter(e=>e?.type==='REROUTE_ACCEPTED').length,traffic=events.filter(e=>e?.type==='TRAFFIC_CHANGE').length,aco=events.filter(e=>e?.type==='ACO_REEVALUATION').length,points=arr(data.points),hazards=arr(data.hazards);
    if($('replay-summary'))$('replay-summary').textContent=`${data.journey?.mode||'—'} · ${points.length} GPS points · ${hazards.length} hazards · ${reroutes} reroutes · ${aco} ACO decisions · ${traffic} traffic changes`;
    if($('replay-events'))$('replay-events').innerHTML=events.map(e=>`<div class="event-item"><strong>${esc(e?.type)}</strong><div class="muted">${e?.at?new Date(e.at).toLocaleString():''}${detail(e)?' · '+esc(detail(e)):''}</div></div>`).join('')||'<div class="empty-state">No recorded decision events.</div>';
    render();
  }catch(e){data=null;toast(e.message,'error')}
}
function render(){
  if(!data)return;if(slider)slider.value=Math.round(pos*10);if($('replay-position'))$('replay-position').textContent=`${Math.round(pos)}%`;
  const pts=arr(data.points);
  if(pts.length){const idx=Math.min(pts.length-1,Math.floor((pts.length-1)*pos/100)),c=pts[idx]?.location?.coordinates;if(leafletReady()&&Array.isArray(c)&&c.length>=2){const ll=[c[1],c[0]];if(!marker)marker=window.L.circleMarker(ll,{radius:9}).addTo(map);else marker.setLatLng(ll)}if($('replay-event'))$('replay-event').textContent=`GPS ${idx+1}/${pts.length} · ${(Number(pts[idx]?.speed||0)*3.6).toFixed(1)} km/h`}
  const ev=arr(data.events);if(ev.length){const e=ev[Math.min(ev.length-1,Math.floor((ev.length-1)*pos/100))];if($('replay-event'))$('replay-event').textContent=`${e?.type||'Event'}${detail(e)?' · '+detail(e):''}`}
}
function play(){clearInterval(timer);if(!data)return toast('Select a journey first','warning');timer=setInterval(()=>{pos=Math.min(100,pos+.35*speed);render();if(pos>=100)clearInterval(timer)},60)}
addEventListener('pagehide',()=>{clearInterval(timer);clearRoutes()});init();
