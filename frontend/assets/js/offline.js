const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function safeJson(key,fallback){
  try{const raw=localStorage.getItem(key);if(!raw)return fallback;const value=JSON.parse(raw);return value??fallback}catch{return fallback}
}
function when(v){const d=new Date(v);return Number.isNaN(d.getTime())?'Unknown time':d.toLocaleString()}
const recentRaw=safeJson('navora:recent-routes',[]);
const recent=Array.isArray(recentRaw)?recentRaw:[];
const prefs=safeJson('navora:preferences',null);
const last=safeJson('navora:last-route-request',null)||safeJson('navora:last-route-query',null);
if($('#offline-last-route'))$('#offline-last-route').innerHTML=last&&typeof last==='object'?`<strong>${esc(last.source?.label||'Source')}</strong> → <strong>${esc(last.destination?.label||'Destination')}</strong><br><small>Saved locally ${when(last.at)}</small>`:'No last route is stored on this device.';
if($('#offline-recent'))$('#offline-recent').innerHTML=recent.length?recent.map(x=>`<div class="data-row"><strong>${esc(x?.source?.label||'Source')}</strong> → ${esc(x?.destination?.label||'Destination')}<br><small>${when(x?.at)}</small></div>`).join(''):'<div class="muted">No recent routes stored.</div>';
if($('#offline-settings'))$('#offline-settings').textContent=prefs&&typeof prefs==='object'?`Safety ${Math.round((Number(prefs.safety)||0)*100)}% · Traffic ${Math.round((Number(prefs.traffic)||0)*100)}% · Familiarity ${Math.round((Number(prefs.familiarity)||0)*100)}% · Theme ${localStorage.getItem('navora-theme')||'system'}`:`Theme ${localStorage.getItem('navora-theme')||'system'}; route preferences not stored yet.`;
