import{api,toast}from'./api.js';
const byId=id=>document.getElementById(id),list=v=>Array.isArray(v)?v:[],num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function set(id,v){const el=byId(id);if(el)el.textContent=v}
function renderList(id,arr,fn){const h=byId(id);if(!h)return;const rows=list(arr);h.innerHTML=rows.length?rows.map(x=>`<div class="data-row">${fn(x||{})}</div>`).join(''):'<div class="empty-state">No stored data yet.</div>'}
async function load(){
  try{
    const d=(await api('/users/dashboard'))||{},m=d.metrics||{},trend=list(d.trend);
    set('metric-safety',m.safetyTrend==null?'—':`${Math.round(num(m.safetyTrend))}%`);
    set('metric-memory',Math.max(0,num(m.routeMemories)));set('metric-success',Math.max(0,num(m.successfulJourneys)));
    set('metric-avoided',Math.max(0,num(m.verifiedHazardsAvoided)));set('metric-unread',Math.max(0,num(m.unreadNotifications)));
    renderList('recent-journeys',d.recentJourneys,j=>`<strong>${String(j.status||'Unknown')}</strong><div class="muted">${String(j.mode||'—')} · ${(num(j.distanceCovered)/1000).toFixed(1)} km covered · ${j.createdAt?new Date(j.createdAt).toLocaleDateString():'—'}</div>`);
    renderList('recent-memories',d.recentMemories,r=>`<strong>Familiarity ${Math.round(num(r.familiarity)*100)}%</strong><div class="muted">Journeys ${Math.max(0,num(r.journeyCount))} · historical safety ${Math.round(num(r.historicalSafety)*100)}%</div>`);
    const canvas=byId('safety-chart'),empty=byId('trend-empty');
    if(window.Chart&&canvas&&trend.length){try{new window.Chart(canvas,{type:'line',data:{labels:trend.map(x=>x?.label||''),datasets:[{label:'Historical safety',data:trend.map(x=>num(x?.safety)),tension:.35,fill:false}]},options:{responsive:true,plugins:{legend:{display:true}},scales:{y:{min:0,max:100}}}});empty?.classList.add('hidden')}catch(e){empty?.classList.remove('hidden');toast(`Chart unavailable: ${e.message}`,'warning')}}else empty?.classList.remove('hidden');
  }catch(e){['metric-safety','metric-memory','metric-success','metric-avoided','metric-unread'].forEach(id=>set(id,'—'));toast(e.message,'error')}
}
load();
