const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function safeJson(key,fallback){
  try{const raw=localStorage.getItem(key);if(!raw)return fallback;const value=JSON.parse(raw);return value??fallback}catch{return fallback}
}
function when(v){const d=new Date(v);return Number.isNaN(d.getTime())?'Unknown time':d.toLocaleString()}
function retryTarget(){
  const raw=sessionStorage.getItem('navora:returnTo')||'dashboard.html';
  try{
    const u=new URL(raw,location.origin),file=u.pathname.split('/').pop();
    if(u.origin!==location.origin||!file?.endsWith('.html')||file==='offline.html')return'dashboard.html';
    return file+u.search+u.hash;
  }catch{return'dashboard.html'}
}
const recentRaw=safeJson('navora:recent-routes',[]);
const recent=Array.isArray(recentRaw)?recentRaw:[];
const prefs=safeJson('navora:preferences',null);
const last=safeJson('navora:last-route-request',null)||safeJson('navora:last-route-query',null);
const reason=new URLSearchParams(location.search).get('reason');
const retry=$('.page-head a.btn-navora');if(retry)retry.href=retryTarget();
if(reason==='service'){
  const title=$('.page-head h1'),intro=$('.page-head p');
  if(title)title.textContent='Live services temporarily unavailable';
  if(intro)intro.textContent='Navora could not verify your protected session because the backend returned a service error. Your local route/settings cache remains readable; retry when live services recover.';
}else if(reason==='network'){
  const intro=$('.page-head p');if(intro)intro.textContent='Navora could not reach live services. Your local route/settings cache remains readable; reconnect, then retry the protected page.';
}
if($('#offline-last-route'))$('#offline-last-route').innerHTML=last&&typeof last==='object'?`<strong>${esc(last.source?.label||'Source')}</strong> → <strong>${esc(last.destination?.label||'Destination')}</strong><br><small>Saved locally ${when(last.at)}</small>`:'No last route is stored on this device.';
if($('#offline-recent'))$('#offline-recent').innerHTML=recent.length?recent.map(x=>`<div class="data-row"><strong>${esc(x?.source?.label||'Source')}</strong> → ${esc(x?.destination?.label||'Destination')}<br><small>${when(x?.at)}</small></div>`).join(''):'<div class="muted">No recent routes stored.</div>';
if($('#offline-settings'))$('#offline-settings').textContent=prefs&&typeof prefs==='object'?`Safety ${Math.round((Number(prefs.safety)||0)*100)}% · Traffic ${Math.round((Number(prefs.traffic)||0)*100)}% · Familiarity ${Math.round((Number(prefs.familiarity)||0)*100)}% · Theme ${localStorage.getItem('navora-theme')||'system'}`:`Theme ${localStorage.getItem('navora-theme')||'system'}; route preferences not stored yet.`;
window.addEventListener('online',()=>{if(retry)retry.textContent='Connection restored · retry'});
