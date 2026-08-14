import{api,toast}from'./api.js';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const dt=x=>{if(!x)return'—';const d=new Date(x);return Number.isNaN(d.getTime())?'—':d.toLocaleString()};
async function overview(){
  const host=document.getElementById('admin-overview');if(!host)return;
  try{const d=obj(await api('/admin/overview'));for(const[k,v]of Object.entries(d)){const el=document.querySelector(`[data-admin-metric="${CSS.escape(k)}"]`);if(el)el.textContent=String(v??'—')}}catch(e){toast(e.message,'error')}
}
async function health(){
  const host=document.getElementById('admin-health-data');if(!host)return;
  try{
    const d=obj(await api('/admin/health'));
    const entries=Object.entries(d);
    host.innerHTML=entries.length?entries.map(([k,raw])=>{const v=obj(raw),status=String(v.status??raw??'unknown');return`<tr><td>${esc(k)}</td><td class="${status==='ok'?'status-ok':'status-warn'}">${esc(status)}</td><td>${esc(v.detail||'')}</td></tr>`}).join(''):'<tr><td colspan="3">No health data.</td></tr>';
  }catch(e){host.innerHTML='<tr><td colspan="3">Health data unavailable.</td></tr>';toast(e.message,'error')}
}
async function users(){
  const host=document.getElementById('admin-users-data');if(!host)return;
  try{
    const rows=arr(await api('/admin/users'));
    host.innerHTML=rows.length?rows.map(u=>`<tr data-id="${esc(u?._id)}"><td><strong>${esc(u?.name)}</strong><br><small>${esc(u?.email)}</small></td><td><select class="input role" aria-label="Role"><option ${u?.role==='USER'?'selected':''}>USER</option><option ${u?.role==='ADMIN'?'selected':''}>ADMIN</option></select></td><td>${u?.emailVerified?'Yes':'No'}</td><td>${u?.disabledAt?'<span class="status-warn">Disabled</span>':'<span class="status-ok">Active</span>'}</td><td class="admin-table-actions"><button type="button" class="btn-navora btn-ghost save">Save role</button><button type="button" class="btn-navora btn-ghost toggle">${u?.disabledAt?'Enable':'Disable'}</button></td></tr>`).join(''):'<tr><td colspan="5">No users.</td></tr>';
    host.querySelectorAll('tr[data-id]').forEach(tr=>{
      tr.querySelector('.save')?.addEventListener('click',()=>patchUser(tr.dataset.id,{role:tr.querySelector('.role')?.value||'USER'}));
      tr.querySelector('.toggle')?.addEventListener('click',()=>patchUser(tr.dataset.id,{disabled:tr.querySelector('.toggle')?.textContent==='Disable'}));
    });
  }catch(e){host.innerHTML='<tr><td colspan="5">Users unavailable.</td></tr>';toast(e.message,'error')}
}
async function patchUser(id,body){try{await api(`/admin/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});toast('User updated','success');await users()}catch(e){toast(e.message,'error')}}
async function hazards(){
  const host=document.getElementById('admin-hazards-data');if(!host)return;
  try{
    const rows=arr(await api('/admin/hazards'));host.innerHTML=rows.length?'':'<tr><td colspan="7">No hazards.</td></tr>';
    for(const h of rows){const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(h?.type)}</td><td>${esc(h?.status)}</td><td>${Math.round((Number(h?.confidence)||0)*100)}%</td><td>${esc(h?.snnRiskLevel||'—')}</td><td>${Number(h?.trustScore||0).toFixed(2)}</td><td>${esc(h?.userId?.name||'Local AI')}</td><td class="admin-table-actions"><button type="button" class="btn-navora verify">Verify</button><button type="button" class="btn-navora btn-ghost reject">Reject</button></td>`;tr.querySelector('.verify')?.addEventListener('click',()=>reviewHazard(h?._id,'VERIFIED'));tr.querySelector('.reject')?.addEventListener('click',()=>reviewHazard(h?._id,'REJECTED'));host.appendChild(tr)}
  }catch(e){host.innerHTML='<tr><td colspan="7">Hazards unavailable.</td></tr>';toast(e.message,'error')}
}
async function reviewHazard(id,status){try{await api(`/admin/hazards/${encodeURIComponent(id)}/verify`,{method:'POST',body:JSON.stringify({status})});toast(`Hazard ${status.toLowerCase()}`,'success');await hazards()}catch(e){toast(e.message,'error')}}
async function reports(){
  const host=document.getElementById('admin-chat-data');if(!host)return;
  try{
    const rows=arr(await api('/admin/chat/reports'));host.innerHTML=rows.length?'':'<tr><td colspan="6">No chat reports.</td></tr>';
    for(const r of rows){const tr=document.createElement('tr');tr.innerHTML=`<td>${dt(r?.createdAt)}</td><td>${esc(r?.reporterId?.name||'User')}</td><td class="moderation-content">${esc(r?.messageId?.content||'[message unavailable]')}<br><small>by ${esc(r?.messageId?.userId?.name||'User')}</small></td><td>${esc(r?.reason)}</td><td>${esc(r?.status)}</td><td class="admin-table-actions"><button data-s="REVIEWED" type="button" class="btn-navora btn-ghost">Reviewed</button><button data-s="DISMISSED" type="button" class="btn-navora btn-ghost">Dismiss</button><button data-s="ACTIONED" type="button" class="btn-navora">Remove</button></td>`;tr.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>reviewReport(r?._id,b.dataset.s)));host.appendChild(tr)}
  }catch(e){host.innerHTML='<tr><td colspan="6">Chat reports unavailable.</td></tr>';toast(e.message,'error')}
}
async function reviewReport(id,status){try{await api(`/admin/chat/reports/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})});toast('Moderation action saved','success');await reports()}catch(e){toast(e.message,'error')}}
async function audit(){
  const host=document.getElementById('admin-audit-data');if(!host)return;
  try{const rows=arr(await api('/admin/audit'));host.innerHTML=rows.length?rows.map(x=>`<tr><td>${dt(x?.createdAt)}</td><td>${esc(x?.action)}</td><td>${esc(x?.actorId?.name||'system')}</td><td>${esc(x?.targetType||'—')}</td><td>${esc(x?.result||'—')}</td></tr>`).join(''):'<tr><td colspan="5">No audit entries.</td></tr>'}catch(e){host.innerHTML='<tr><td colspan="5">Audit data unavailable.</td></tr>';toast(e.message,'error')}
}
async function devices(){
  const host=document.getElementById('admin-devices-data');if(!host)return;
  try{const rows=arr(await api('/admin/devices'));host.innerHTML=rows.length?rows.map(d=>`<tr><td>${esc(d?.userId?.name||'User')}<br><small>${esc(d?.userId?.email||'')}</small></td><td>${esc(d?.name)}</td><td>${esc(d?.deviceType)}</td><td>${d?.battery==null?'—':Math.round(Number(d.battery)||0)+'%'}</td><td>${esc(arr(d?.capabilities).join(' · '))}</td><td>${dt(d?.lastSeenAt||d?.updatedAt)}</td></tr>`).join(''):'<tr><td colspan="6">No devices.</td></tr>'}catch(e){host.innerHTML='<tr><td colspan="6">Devices unavailable.</td></tr>';toast(e.message,'error')}
}
overview();health();users();devices();hazards();reports();audit();
