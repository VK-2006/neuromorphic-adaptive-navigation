import{api,toast}from'./api.js';

const mapEl=document.getElementById('map');
let map,routeLayers=[],hazardLayers=[],selected=null,selectedRoute=null,currentRoutes=[],sourceMarker,destMarker;
let searchTimers={},geocodingCaps={typeahead:false,effective:'nominatim'};
const fallbackSource=[17.385,78.4867],fallbackDest=[17.4375,78.4483];

const arr=v=>Array.isArray(v)?v:[];
const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
function safeStoredArray(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function safeStoredObject(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:null}catch{return null}}

function showMapUnavailable(){
  if(mapEl)mapEl.innerHTML='<div class="navora-state-panel"><h3>Map unavailable</h3><p class="muted">Leaflet could not load. Reconnect and reload before planning a live route.</p></div>';
  const submit=document.querySelector('#route-form button[type="submit"]');if(submit)submit.disabled=true;
  const use=document.getElementById('use-location');if(use)use.disabled=true;
}

async function loadSavedPreferences(){
  let p=safeStoredObject('navora:preferences');
  try{
    const u=await api('/users/me');
    if(u?.preferences){p=u.preferences;try{localStorage.setItem('navora:preferences',JSON.stringify(p))}catch{}}
  }catch{}
  if(!p)return;
  for(const [k,key] of [['safety','safety'],['traffic','traffic'],['familiarity','familiarity']]){
    const el=document.getElementById(`${k}-pref`),out=document.getElementById(`${k}-value`);
    const n=Number(p[key]);if(el&&Number.isFinite(n)){el.value=String(Math.round(clamp01(n)*100));if(out)out.textContent=`${el.value}%`}
  }
}

function setStartEnabled(enabled,reason='Calculate and select a persisted route first.'){
  const b=document.getElementById('begin-selected-journey');if(!b)return;
  b.disabled=!enabled;b.title=enabled?'Start the selected saved route as a journey.':reason;
}

async function init(){
  setStartEnabled(false);
  document.getElementById('begin-selected-journey')?.addEventListener('click',beginJourney);
  document.getElementById('route-form')?.addEventListener('submit',loadRoutes);
  document.getElementById('use-location')?.addEventListener('click',useLocation);
  document.getElementById('refresh-hazards')?.addEventListener('click',loadNearbyHazards);
  ['safety','traffic','familiarity'].forEach(k=>{
    const el=document.getElementById(`${k}-pref`),out=document.getElementById(`${k}-value`);
    const paint=()=>{if(el&&out)out.textContent=`${el.value}%`};el?.addEventListener('input',paint);paint();
  });
  await loadSavedPreferences();
  if(!mapEl||!window.L){showMapUnavailable();return}
  try{
    map=window.L.map('map',{zoomControl:false}).setView(fallbackSource,12);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
    window.L.control.zoom({position:'bottomright'}).addTo(map);
    sourceMarker=window.L.marker(fallbackSource,{draggable:true}).addTo(map);
    destMarker=window.L.marker(fallbackDest,{draggable:true}).addTo(map);
    map.on('click',async e=>{destMarker.setLatLng(e.latlng);await syncField('destination',e.latlng)});
    sourceMarker.on('dragend',()=>syncField('source',sourceMarker.getLatLng()));
    destMarker.on('dragend',()=>syncField('destination',destMarker.getLatLng()));
    setCoords('source',...fallbackSource,'Current source');setCoords('destination',...fallbackDest,'Destination');
    syncField('source',sourceMarker.getLatLng());syncField('destination',destMarker.getLatLng());
    setupGeocoding();
  }catch(e){showMapUnavailable();toast(`Map initialization failed: ${e.message}`,'error')}
}

function setCoords(id,lat,lng,label){
  const el=document.getElementById(id);if(!el)return;
  el.dataset.lat=Number(lat);el.dataset.lng=Number(lng);if(label)el.value=label;
}
async function syncField(id,ll){
  setCoords(id,ll.lat,ll.lng,`${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`);
  try{
    const place=await api(`/geocoding/reverse?lat=${encodeURIComponent(ll.lat)}&lng=${encodeURIComponent(ll.lng)}`);
    const el=document.getElementById(id);
    if(el&&Math.abs(Number(el.dataset.lat)-ll.lat)<1e-6)setCoords(id,ll.lat,ll.lng,place.label||`${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`);
  }catch{}
}
async function setupGeocoding(){
  try{geocodingCaps=(await api('/geocoding/status'))||geocodingCaps}catch{}
  ['source','destination'].forEach(bindAutocomplete);
}
function bindAutocomplete(id){
  const input=document.getElementById(id),box=document.getElementById(`${id}-suggestions`);if(!input||!box)return;
  input.addEventListener('input',()=>{
    delete input.dataset.lat;delete input.dataset.lng;clearTimeout(searchTimers[id]);const q=input.value.trim();
    if(q.length<2){box.innerHTML='';return}
    if(!geocodingCaps.typeahead){box.innerHTML='<div class="suggestion muted">Press Enter to search places</div>';return}
    searchTimers[id]=setTimeout(()=>searchPlaces(id,q),450);
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape')box.innerHTML='';
    if(e.key==='Enter'&&!input.dataset.lat&&input.value.trim().length>=2){e.preventDefault();clearTimeout(searchTimers[id]);searchPlaces(id,input.value.trim())}
  });
}
async function searchPlaces(id,q){
  const input=document.getElementById(id),box=document.getElementById(`${id}-suggestions`);if(!map||!input||!box)return;
  try{
    const center=map.getCenter(),items=arr(await api(`/geocoding/search?q=${encodeURIComponent(q)}&lat=${center.lat}&lng=${center.lng}&limit=6`));
    if(input.value.trim()!==q)return;
    box.innerHTML=items.map((x,i)=>`<button type="button" class="suggestion" role="option" data-i="${i}"><strong>${esc(x.name)}</strong><small>${esc(x.label)}</small></button>`).join('')||'<div class="suggestion muted">No matching places</div>';
    box.querySelectorAll('button[data-i]').forEach(b=>b.addEventListener('click',()=>choosePlace(id,items[Number(b.dataset.i)])));
  }catch(e){box.innerHTML=`<div class="suggestion muted">Search unavailable · ${esc(e.message)}</div>`}
}
function choosePlace(id,p){
  const marker=id==='source'?sourceMarker:destMarker;if(!marker||!map)return;
  marker.setLatLng([p.lat,p.lng]);setCoords(id,p.lat,p.lng,p.label||p.name);document.getElementById(`${id}-suggestions`).innerHTML='';map.setView([p.lat,p.lng],15);
}
function useLocation(){
  if(!navigator.geolocation)return toast('Geolocation is unavailable in this browser.','error');
  navigator.geolocation.getCurrentPosition(async p=>{
    if(!sourceMarker||!map)return;
    const c=[p.coords.latitude,p.coords.longitude];sourceMarker.setLatLng(c);map.setView(c,16);await syncField('source',sourceMarker.getLatLng());
    toast(`Live GPS source set · ±${Math.round(p.coords.accuracy||0)} m`,'success');
  },e=>toast(`Location unavailable: ${e.message}`,'error'),{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
}
function parseInput(id){
  const el=document.getElementById(id);if(!el)throw new Error(`${id} field unavailable`);
  const lat=Number(el.dataset.lat),lng=Number(el.dataset.lng);
  if(Number.isFinite(lat)&&Number.isFinite(lng))return{lat,lng};
  const parts=el.value.split(',').map(Number);
  if(parts.length===2&&parts.every(Number.isFinite)){setCoords(id,parts[0],parts[1],el.value);return{lat:parts[0],lng:parts[1]}}
  throw new Error(`Choose a ${id} suggestion or enter latitude,longitude`);
}

async function loadRoutes(e){
  e?.preventDefault();setStartEnabled(false);selected=null;selectedRoute=null;
  const form=document.getElementById('route-form'),submit=form?.querySelector('button[type="submit"]');
  if(submit){submit.disabled=true;submit.textContent='Calculating…'}
  try{
    const preferences={
      safety:Number(document.getElementById('safety-pref')?.value||70)/100,
      traffic:Number(document.getElementById('traffic-pref')?.value||60)/100,
      familiarity:Number(document.getElementById('familiarity-pref')?.value||50)/100
    };
    try{localStorage.setItem('navora:preferences',JSON.stringify(preferences))}catch{}
    const body={source:parseInput('source'),destination:parseInput('destination'),preferences,simulation:Boolean(document.getElementById('simulation')?.checked)};
    const data=await api('/routes/compare',{method:'POST',body:JSON.stringify(body)});
    render(arr(data?.routes),data?.recommendedRouteId,data?.mode);
    const entry={source:{...body.source,label:document.getElementById('source').value},destination:{...body.destination,label:document.getElementById('destination').value},preferences:body.preferences,simulation:body.simulation,at:Date.now()};
    try{
      localStorage.setItem('navora:last-route-query',JSON.stringify(entry));
      const recent=safeStoredArray('navora:recent-routes').filter(x=>x?.source?.label!==entry.source.label||x?.destination?.label!==entry.destination.label);
      recent.unshift(entry);localStorage.setItem('navora:recent-routes',JSON.stringify(recent.slice(0,8)));
    }catch{}
    await loadNearbyHazards();
    toast(data?.mode==='simulation'?'SIMULATION MODE routes loaded':'Road routes loaded',data?.mode==='simulation'?'warning':'success');
  }catch(err){toast(err.message,'error')}
  finally{if(submit){submit.disabled=false;submit.textContent='Find live routes'}}
}

async function loadNearbyHazards(){
  const host=document.getElementById('hazard-list');if(!host||!map||!window.L)return;
  hazardLayers.forEach(x=>x.remove());hazardLayers=[];
  let center;try{center=parseInput('source')}catch{const c=map.getCenter();center={lat:c.lat,lng:c.lng}}
  try{
    const rows=arr(await api(`/hazards/nearby?lat=${encodeURIComponent(center.lat)}&lng=${encodeURIComponent(center.lng)}&radius=5000`));
    host.innerHTML=rows.length?'':'<div class="empty-state">No nearby community hazards.</div>';
    for(const h of rows){
      const lat=Number(h?.location?.coordinates?.[1]),lng=Number(h?.location?.coordinates?.[0]);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
      const marker=window.L.circleMarker([lat,lng],{radius:8,weight:3,fillOpacity:.55}).addTo(map);
      marker.bindTooltip(`${esc(h.type)} · ${esc(h.status)} · ${Math.round((h.trustScore||0)*100)}% trust`);hazardLayers.push(marker);
      const row=document.createElement('div');row.className='data-row';
      row.innerHTML=`<strong>${esc(h.type)}</strong><div class="muted">${esc(h.status)} · ${esc(h.snnRiskLevel||'UNKNOWN')} risk · ${Math.round((h.trustScore||0)*100)}% trust · ${h.nearbyConfirmations||0} nearby confirmation(s)</div><div class="toolbar"><button type="button" class="btn-navora btn-ghost" data-confirm="${esc(h._id)}">Confirm nearby</button></div>`;
      row.querySelector('[data-confirm]')?.addEventListener('click',()=>confirmHazard(h._id));host.appendChild(row);
    }
  }catch(e){host.innerHTML='<div class="muted">Community hazards are temporarily unavailable.</div>'}
}

async function confirmHazard(id){
  if(!navigator.geolocation)return toast('Geolocation is required for a nearby confirmation','error');
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      await api(`/hazards/${encodeURIComponent(id)}/confirm`,{method:'POST',body:JSON.stringify({confirmed:true,location:{lat:pos.coords.latitude,lng:pos.coords.longitude}})});
      toast('Nearby hazard confirmation recorded','success');await loadNearbyHazards();
    }catch(e){toast(e.message,'error')}
  },e=>toast(`Confirmation location unavailable: ${e.message}`,'error'),{enableHighAccuracy:false,maximumAge:60000,timeout:8000});
}

function validCoords(r){return arr(r?.coordinates).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)))}
function render(routes,recommendedId,mode){
  currentRoutes=routes;routeLayers.forEach(x=>x.remove());routeLayers=[];
  const list=document.getElementById('route-list');if(!list)return;list.innerHTML='';
  if(!routes.length){list.innerHTML='<div class="empty-state">No route candidates were returned.</div>';setStartEnabled(false);return}
  const darkTheme=document.documentElement.dataset.theme==='dark';
  const palette=darkTheme?['#A78BFA','#8B5CF6','#6D28D9','#C4B5FD','#8F839D']:['#8E5C8E','#6E3B6E','#B86B77','#A977A9','#8C808A'];
  const selectedRouteColor=darkTheme?'#D4AF37':'#B58A32';
  routes.forEach((r,i)=>{
    const coords=validCoords(r);if(coords.length<2)return;
    const line=window.L.polyline(coords.map(p=>[p.lat,p.lng]),{weight:r.id===recommendedId?8:5,opacity:r.id===recommendedId?.95:.65,color:r.id===recommendedId?selectedRouteColor:palette[i%palette.length]}).addTo(map);
    routeLayers.push(line);
    if(arr(r.congestedSegments).length>1){const congestion=window.L.polyline(r.congestedSegments.map(p=>[p.lat,p.lng]),{weight:9,opacity:.55,color:'#d64545',dashArray:'4 6'}).addTo(map);routeLayers.push(congestion)}
    line.on('click',()=>select(r.id));
    const card=document.createElement('div');card.className='route-card'+(r.id===recommendedId?' selected':'');card.dataset.id=r.id;
    const tags=arr(r.routeTypes).map(t=>`<span class="chip">${esc(t)}</span>`).join('');
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px"><strong>${esc(r.label)}</strong><span>${Math.round(Number(r.safetyScore)||0)}% safe</span></div><div class="muted">${((Number(r.distance)||0)/1000).toFixed(1)} km · ${Math.round((Number(r.trafficDuration)||0)/60)} min · ${esc(r.trafficSeverity||'UNKNOWN')}</div><div class="route-badges">${tags}<span class="chip">ACO ${Number(r.acoScore||0).toFixed(2)}</span><span class="chip">Familiar ${Math.round((r.familiarity||0)*100)}%</span><span class="chip">${esc((mode||r.mode||'unknown').toUpperCase())}</span></div>`;
    card.onclick=()=>select(r.id);list.appendChild(card);
  });
  const all=routes.flatMap(validCoords);if(all.length>1)map.fitBounds(window.L.latLngBounds(all.map(p=>[p.lat,p.lng])),{padding:[40,40]});
  select(recommendedId||routes[0]?.id);
}

function select(id){
  selected=id;selectedRoute=currentRoutes.find(r=>r.id===id)||null;
  document.querySelectorAll('.route-card').forEach(x=>x.classList.toggle('selected',x.dataset.id===id));
  if(!selectedRoute){setStartEnabled(false);return}
  try{sessionStorage.setItem('selectedRouteId',id);if(selectedRoute.databaseId)sessionStorage.setItem('selectedRouteDbId',selectedRoute.databaseId)}catch{}
  renderWhy(selectedRoute);renderSteps(selectedRoute);
  setStartEnabled(Boolean(selectedRoute.databaseId),selectedRoute.databaseId?'':'Sign in and calculate routes again so the route can be persisted.');
}

function renderWhy(rec){
  const why=document.getElementById('why-route');if(!why)return;
  const arrival=new Date(Date.now()+(Number(rec.trafficDuration)||0)*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),m=rec.explanation?.metrics||{};
  why.innerHTML=`<h3>WHY THIS ROUTE?</h3><div class="metric">${Math.round(Number(rec.safetyScore)||0)}%</div><div class="route-badges"><span class="chip">SNN ${Math.round((m.snnHazardRisk??rec.snnHazardRisk??0)*100)}%</span><span class="chip">Hazards ${Math.round((m.hazardExposure??rec.hazardExposure??0)*100)}%</span><span class="chip">DTW ${Math.round((m.dtwSimilarity??rec.dtwSimilarity??0)*100)}%</span><span class="chip">EMA safety ${Math.round((m.historicalSafety??rec.historicalSafety??0)*100)}%</span><span class="chip">ACO ${Number(rec.acoScore||0).toFixed(2)}</span></div><p>${arr(rec.explanation?.reasons).map(x=>'✓ '+esc(x)).join('<br>')}</p><p class="muted">ETA ${Math.round((Number(rec.trafficDuration)||0)/60)} min · Arrival ${arrival} · Delay ${Math.round((Number(rec.trafficDelay)||0)/60)} min · Traffic ${esc(rec.trafficMode||'unknown')}</p><div id="turn-by-turn"></div><div class="toolbar"><button id="begin-selected-journey" class="btn-navora" type="button">Start selected journey</button></div>`;
  const b=document.getElementById('begin-selected-journey');b?.addEventListener('click',beginJourney);if(b)b.disabled=!rec.databaseId;
}

function renderSteps(route){
  const host=document.getElementById('turn-by-turn');if(!host||!route)return;
  const steps=arr(route.steps).slice(0,8);
  host.innerHTML=steps.length?`<h4>Turn-by-turn</h4>${steps.map((s,i)=>`<div class="route-card"><strong>${i+1}. ${esc(s.maneuver?.instruction||[s.maneuver?.type,s.maneuver?.modifier].filter(Boolean).join(' ')||'Continue')}</strong><div class="muted">${esc(s.name||s.maneuver?.name||'')} · ${Math.round(s.distance||0)} m</div></div>`).join('')}`:'<p class="muted">Turn instructions are unavailable from this provider for this route.</p>';
}

async function beginJourney(){
  if(!selectedRoute)return toast('Calculate and select a route first','warning');
  try{
    const source=parseInput('source'),destination=parseInput('destination');
    if(!selectedRoute.databaseId)throw new Error('A persisted route is required. Sign in and calculate routes again.');
    const j=await api('/journeys',{method:'POST',body:JSON.stringify({routeId:selectedRoute.databaseId,mode:selectedRoute.mode==='simulation'?'SIMULATION':'LIVE',source,destination})});
    if(!j?._id)throw new Error('Journey creation did not return an ID.');
    sessionStorage.setItem('journeyId',j._id);await api(`/journeys/${j._id}/start`,{method:'POST'});location.href='journey.html';
  }catch(e){toast(e.message.includes('Authentication')?'Sign in before starting a saved journey.':e.message,'error')}
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
init();
