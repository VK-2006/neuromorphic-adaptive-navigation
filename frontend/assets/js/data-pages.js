
import{api,toast}from'./api.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const when=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString()};
const km=v=>Number.isFinite(Number(v))?`${(Number(v)/1000).toFixed(1)} km`:'—';
const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v)*100)}%`:'—';
const safety=j=>j?.averageRisk!=null?`${Math.round(100*(1-Number(j.averageRisk)))}%`:'—';
const replayable=j=>['COMPLETED','ACTIVE','PAUSED'].includes(String(j?.status||'').toUpperCase());
const labelOf=p=>p?.label||p?.name||(Number.isFinite(Number(p?.lat))?`${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}`:'—');

let detailMap=null,detailLayers=[];

function dialog(){
  return $('journey-detail-dialog');
}
function closeDialog(){
  const x=dialog();if(x?.open)x.close();
}
function eventText(e){
  const type=String(e?.type||'EVENT').replaceAll('_',' ');
  const detail=[
    e?.reason,e?.hazardType,e?.risk&&`Risk ${e.risk}`,e?.safetyScore!=null&&`Safety ${Math.round(num(e.safetyScore))}%`,
    e?.trafficSeverity&&`Traffic ${e.trafficSeverity}`,e?.success!=null&&`Success ${e.success?'yes':'no'}`
  ].filter(Boolean).join(' · ');
  return `<div class="journey-event"><time>${when(e?.at)}</time><div><strong>${esc(type)}</strong>${detail?`<div class="muted">${esc(detail)}</div>`:''}</div></div>`;
}
function renderDetailMap(bundle){
  const host=$('journey-detail-map');if(!host||!window.L)return;
  if(!detailMap){
    detailMap=L.map(host,{zoomControl:true,attributionControl:true}).setView([17.385,78.4867],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(detailMap);
  }
  detailLayers.forEach(x=>x.remove?.());detailLayers=[];
  const route=bundle?.currentRoute||bundle?.route||bundle?.originalRoute;
  const coords=arr(route?.coordinates).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)));
  if(coords.length>1){
    const line=L.polyline(coords.map(p=>[p.lat,p.lng]),{weight:6,opacity:.9}).addTo(detailMap);detailLayers.push(line);
    detailMap.fitBounds(line.getBounds(),{padding:[30,30]});
  }
  const points=arr(bundle?.points).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lng)));
  if(points.length>1){
    const line=L.polyline(points.map(p=>[p.lat,p.lng]),{weight:3,opacity:.7,dashArray:'5 6'}).addTo(detailMap);detailLayers.push(line);
    if(!coords.length)detailMap.fitBounds(line.getBounds(),{padding:[30,30]});
  }
  arr(bundle?.hazards).forEach(h=>{
    const lat=Number(h?.location?.coordinates?.[1]),lng=Number(h?.location?.coordinates?.[0]);
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const m=L.circleMarker([lat,lng],{radius:7,weight:2,fillOpacity:.55}).addTo(detailMap);
      m.bindTooltip(`${esc(h?.type||'Hazard')} · ${esc(h?.snnRiskLevel||'UNKNOWN')}`);detailLayers.push(m);
    }
  });
  setTimeout(()=>detailMap?.invalidateSize(),80);
}
async function openJourneyDetail(id){
  if(!id)return;
  const dlg=dialog(),body=$('journey-detail-content');if(!dlg||!body)return;
  body.innerHTML='<div class="empty-state">Loading complete journey details…</div>';
  if(typeof dlg.showModal==='function'&&!dlg.open)dlg.showModal();else dlg.setAttribute('open','');
  try{
    const b=await api(`/journeys/${encodeURIComponent(id)}/replay`),j=b?.journey||{},route=b?.currentRoute||b?.route||{};
    $('journey-detail-title').textContent=route?.label||j?.selectedRouteSnapshot?.label||'Journey details';
    const duration=j?.startedAt&&j?.completedAt?Math.max(0,(new Date(j.completedAt)-new Date(j.startedAt))/1000):null;
    body.innerHTML=`
      <div class="journey-detail-grid">
        <div class="px-stat"><small>Status</small><strong>${esc(j?.status||'—')}</strong></div>
        <div class="px-stat"><small>Mode</small><strong>${esc(j?.mode||'—')}</strong></div>
        <div class="px-stat"><small>Safety</small><strong>${safety(j)}</strong></div>
        <div class="px-stat"><small>Distance</small><strong>${km(j?.totalDistance||route?.distance)}</strong></div>
        <div class="px-stat"><small>Average risk</small><strong>${pct(j?.averageRisk)}</strong></div>
        <div class="px-stat"><small>Maximum risk</small><strong>${pct(j?.maximumRisk)}</strong></div>
        <div class="px-stat"><small>Hazards</small><strong>${num(j?.hazardCount)}</strong></div>
        <div class="px-stat"><small>Reroutes</small><strong>${num(j?.reroutes)}</strong></div>
      </div>
      <section class="grid grid-2">
        <div class="card">
          <h3>Journey</h3>
          <div class="px-info-list">
            <div><span>Source</span><strong>${esc(labelOf(j?.source))}</strong></div>
            <div><span>Destination</span><strong>${esc(labelOf(j?.destination))}</strong></div>
            <div><span>Created</span><strong>${when(j?.createdAt)}</strong></div>
            <div><span>Started</span><strong>${when(j?.startedAt)}</strong></div>
            <div><span>Completed</span><strong>${when(j?.completedAt)}</strong></div>
            <div><span>Duration</span><strong>${duration==null?'—':`${Math.round(duration/60)} min`}</strong></div>
            <div><span>Traffic</span><strong>${esc(j?.lastTrafficSeverity||route?.trafficSeverity||'UNKNOWN')}</strong></div>
            <div><span>Provider</span><strong>${esc(route?.provider||j?.selectedRouteSnapshot?.provider||'—')}</strong></div>
          </div>
        </div>
        <div class="card">
          <h3>Route intelligence</h3>
          <div class="px-info-list">
            <div><span>Route safety</span><strong>${route?.safetyScore!=null?`${Math.round(num(route.safetyScore))}%`:'—'}</strong></div>
            <div><span>ACO score</span><strong>${route?.acoScore!=null?num(route.acoScore).toFixed(3):'—'}</strong></div>
            <div><span>Familiarity</span><strong>${pct(route?.familiarity)}</strong></div>
            <div><span>Historical safety</span><strong>${pct(route?.historicalSafety)}</strong></div>
            <div><span>Traffic duration</span><strong>${route?.trafficDuration?`${Math.round(num(route.trafficDuration)/60)} min`:'—'}</strong></div>
            <div><span>Decision events</span><strong>${arr(j?.decisionEvents).length}</strong></div>
          </div>
        </div>
      </section>
      <section><h3>Journey route</h3><div id="journey-detail-map"></div></section>
      <section><h3>Decision & hazard timeline</h3><div class="journey-timeline">${arr(b?.events).length?arr(b.events).map(eventText).join(''):'<div class="empty-state">No decision events or hazards were recorded.</div>'}</div></section>
    `;
    renderDetailMap(b);
  }catch(e){body.innerHTML=`<div class="empty-state">Could not load journey details: ${esc(e.message)}</div>`;toast(e.message,'error')}
}
async function history(){
  const h=$('history-body');if(!h)return;
  try{
    const rows=arr(await api('/journeys'));
    h.innerHTML=rows.length?rows.map(j=>`<tr>
      <td>${when(j?.createdAt)}</td>
      <td>${esc(j?.selectedRouteSnapshot?.label||'Adaptive route')}</td>
      <td>${esc(j?.mode||'—')}</td>
      <td>${km(j?.totalDistance)}</td>
      <td>${safety(j)}</td>
      <td>${num(j?.hazardCount)}</td>
      <td>${num(j?.reroutes)}</td>
      <td><span class="chip">${esc(String(j?.status||'—').toUpperCase())}</span></td>
      <td><div class="history-actions"><button class="btn-navora btn-ghost" type="button" data-journey-detail="${esc(j?._id)}">View details</button>${replayable(j)?`<a class="btn-navora btn-ghost" data-replay="${esc(j?._id)}" href="journey-replay.html?journey=${encodeURIComponent(j?._id||'')}">Replay</a>`:''}</div></td>
    </tr>`).join(''):'<tr><td colspan="9">No journeys yet. Plan and complete a route to build history.</td></tr>';
    h.querySelectorAll('[data-journey-detail]').forEach(b=>b.addEventListener('click',()=>openJourneyDetail(b.dataset.journeyDetail)));
    const requested=new URLSearchParams(location.search).get('journey');if(requested)openJourneyDetail(requested);
  }catch(e){h.innerHTML='<tr><td colspan="9">Journey history is temporarily unavailable.</td></tr>';toast(e.message,'error')}
}
async function memory(){
  const h=$('memory-list');if(!h)return;
  try{
    const [rows,summary]=await Promise.all([api('/memory'),api('/memory/summary').catch(()=>null)]);
    const list=arr(rows);
    const s=summary||{};
    const stats={
      count:Number.isFinite(Number(s.count))?Number(s.count):list.length,
      familiarity:Number.isFinite(Number(s.averageFamiliarity))?Number(s.averageFamiliarity):(list.length?list.reduce((a,x)=>a+num(x?.familiarity),0)/list.length:0),
      safety:Number.isFinite(Number(s.averageHistoricalSafety))?Number(s.averageHistoricalSafety):(list.length?list.reduce((a,x)=>a+num(x?.historicalSafety),0)/list.length:0),
      last:s.lastTravelledAt||list[0]?.lastTravelledAt
    };
    setSummary('memory-count',stats.count);
    setSummary('memory-familiarity',pct(stats.familiarity));
    setSummary('memory-safety',pct(stats.safety));
    setSummary('memory-last',stats.last?new Date(stats.last).toLocaleDateString():'—');
    h.classList.add('px-route-memory');
    h.innerHTML=list.length?list.map(m=>{
      const title=m?.routeLabel||'Learned route';
      const src=labelOf(m?.source),dst=labelOf(m?.destination);
      return`<article class="data-row px-memory-row">
        <div>
          <div style="display:flex;justify-content:space-between;gap:12px"><strong>${esc(title)}</strong><span class="chip">${Math.round(num(m?.familiarity)*100)}% familiar</span></div>
          <div class="muted">${esc(src)} → ${esc(dst)}</div>
          <small class="muted">${esc(m?.provider||'Route provider')} · Last travelled ${when(m?.lastTravelledAt)} · ${km(m?.distance)}</small>
          <div class="history-actions" style="margin-top:10px">
            ${m?.lastJourneyId?`<a class="btn-navora btn-ghost" href="history.html?journey=${encodeURIComponent(m.lastJourneyId)}">Open last journey</a>`:''}
          </div>
        </div>
        <div class="px-memory-metrics">
          ${mini('Journeys',num(m?.journeyCount))}
          ${mini('Successful',num(m?.successfulJourneyCount))}
          ${mini('Historical safety',pct(m?.historicalSafety))}
          ${mini('Reliability',pct(m?.reliability))}
          ${mini('Avg risk',pct(m?.averageRisk))}
          ${mini('Max risk',pct(m?.maximumRisk))}
          ${mini('Hazard frequency',num(m?.hazardFrequency).toFixed(2))}
          ${mini('Reroute frequency',pct(m?.rerouteFrequency))}
          ${mini('Feedback',pct(m?.userFeedback))}
        </div>
      </article>`;
    }).join(''):`<div class="empty-state"><h3>No learned route memories yet</h3><p>CRM is created from completed journeys. Plan a route, start Live Journey, and complete it so Navora can update familiarity, historical safety, reliability, risk and reroute experience.</p><a class="btn-navora" href="map.html">Plan first journey</a></div>`;
  }catch(e){h.innerHTML='<div class="empty-state">Route memory is temporarily unavailable.</div>';toast(e.message,'error')}
}
function mini(label,value){return`<div class="px-mini"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`}
function setSummary(id,value){const el=$(id);if(el)el.textContent=value}
async function notifications(){
  const h=$('notification-list');if(!h)return;
  try{
    const rows=arr(await api('/notifications'));
    h.innerHTML=rows.length?rows.map(n=>`<button class="data-row" type="button" style="text-align:left;width:100%;color:inherit" data-read="${esc(n?._id)}"${n?.readAt?' disabled aria-disabled="true"':''}><strong>${esc(n?.title||n?.type||'Notification')}</strong><div>${esc(n?.message||'')}</div><small class="muted">${when(n?.createdAt)}${n?.readAt?' · read':' · unread'}</small></button>`).join(''):'<div class="empty-state">No notifications.</div>';
    h.querySelectorAll('[data-read]').forEach(b=>b.addEventListener('click',async()=>{
      const id=b.dataset.read;if(!id||b.disabled)return;b.disabled=true;
      try{const n=await api(`/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'});b.style.opacity='.65';const small=b.querySelector('small');if(small)small.textContent=`${when(n?.createdAt||Date.now())} · read`;b.removeAttribute('data-read');b.setAttribute('aria-disabled','true')}catch(e){b.disabled=false;b.removeAttribute('aria-disabled');toast(e.message,'error')}
    }));
  }catch(e){h.innerHTML='<div class="empty-state">Notifications are temporarily unavailable.</div>';toast(e.message,'error')}
}
$('journey-detail-close')?.addEventListener('click',closeDialog);
history();memory();notifications();
