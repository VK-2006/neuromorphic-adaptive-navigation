import{api,toast}from'./api.js';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const dt=x=>{if(!x)return'—';const d=new Date(x);return Number.isNaN(d.getTime())?'—':d.toLocaleString()};
const userRows=v=>{if(Array.isArray(v))return v;if(Array.isArray(v?.users))return v.users;if(Array.isArray(v?.data))return v.data;if(Array.isArray(v?.data?.users))return v.data.users;return[]};
const userLocation=u=>[u?.city,u?.country].filter(Boolean).join(', ')||'—';
function userActions(u){
  const id=esc(u?._id),disabled=Boolean(u?.disabledAt);
  return`<button type="button" class="btn-navora btn-ghost view" data-id="${id}">View profile</button><button type="button" class="btn-navora btn-ghost save">Save role</button><button type="button" class="btn-navora btn-ghost toggle">${disabled?'Unblock':'Block'}</button>`;
}
function userRow(u){
  const role=u?.role==='ADMIN'?'ADMIN':'USER',disabled=Boolean(u?.disabledAt);
  return`<tr data-id="${esc(u?._id)}" data-role="${role}" data-disabled="${disabled}"><td><strong>${esc(u?.name||'Unnamed user')}</strong><br><small>${esc(u?.email||'—')}</small></td><td><select class="input role" aria-label="Role for ${esc(u?.name||u?.email)}"><option ${role==='USER'?'selected':''}>USER</option><option ${role==='ADMIN'?'selected':''}>ADMIN</option></select></td><td>${esc(u?.phone||'—')}</td><td>${esc(userLocation(u))}</td><td>${u?.emailVerified?'Verified':'Not verified'}</td><td>${disabled?'<span class="status-warn">Blocked</span>':'<span class="status-ok">Active</span>'}</td><td>${dt(u?.lastLoginAt)}</td><td class="admin-table-actions">${userActions(u)}</td></tr>`;
}
function bindUserRows(host){
  host.querySelectorAll('tr[data-id]').forEach(tr=>{
    tr.querySelector('.view')?.addEventListener('click',()=>{
      const cells=[...tr.querySelectorAll('td')].map(cell=>cell.textContent.trim()).join(' · ');
      toast(cells,'info');
    });
    tr.querySelector('.save')?.addEventListener('click',()=>{
      const next=tr.querySelector('.role')?.value||'USER';
      if(tr.dataset.role==='ADMIN'&&next==='USER'&&!confirm('Demote this administrator to USER? Last-admin and self-demotion rules are enforced by the backend.'))return;
      patchUser(tr.dataset.id,{role:next});
    });
    tr.querySelector('.toggle')?.addEventListener('click',()=>{
      const disable=tr.dataset.disabled!=='true';
      if(disable&&!confirm('Block this user account? The user will lose authenticated access.'))return;
      patchUser(tr.dataset.id,{disabled:disable});
    });
  });
}
async function overview(){const host=document.getElementById('admin-overview');if(!host)return;try{const d=obj(await api('/admin/overview'));for(const[k,v]of Object.entries(d)){const el=document.querySelector(`[data-admin-metric="${CSS.escape(k)}"]`);if(el)el.textContent=String(v??'—')}}catch(e){toast(e.message,'error')}}
async function health(){const host=document.getElementById('admin-health-data');if(!host)return;try{const d=obj(await api('/admin/health')),entries=Object.entries(d);host.innerHTML=entries.length?entries.map(([k,raw])=>{const v=obj(raw),status=String(v.status??raw??'unknown');return`<tr><td>${esc(k)}</td><td class="${status==='ok'?'status-ok':'status-warn'}">${esc(status)}</td><td>${esc(v.detail||'')}</td></tr>`}).join(''):'<tr><td colspan="3">No health data.</td></tr>'}catch(e){host.innerHTML='<tr><td colspan="3">Health data unavailable.</td></tr>';toast(e.message,'error')}}
async function users(){
  const adminHost=document.getElementById('admin-users-admin-data'),userHost=document.getElementById('admin-users-user-data'),legacyHost=document.getElementById('admin-users-data'),errorHost=document.getElementById('admin-users-error');
  if(!adminHost&&!userHost&&!legacyHost)return;
  try{
    const rows=userRows(await api('/admin/users')),admins=rows.filter(u=>u?.role==='ADMIN'),usersOnly=rows.filter(u=>u?.role!=='ADMIN');
    const render=(host,list)=>{if(!host)return;host.innerHTML=list.length?list.map(userRow).join(''):`<tr><td colspan="${host===legacyHost?'5':'8'}">No ${host===adminHost?'admin accounts':'normal users'}.</td></tr>`;bindUserRows(host)};
    if(adminHost||userHost){render(adminHost,admins);render(userHost,usersOnly)}else if(legacyHost)render(legacyHost,rows)
    if(errorHost)errorHost.classList.add('hidden');
  }catch(e){
    const message=`Unable to load users: ${e.message||'Server error'}`;
    if(errorHost){errorHost.textContent=message;errorHost.classList.remove('hidden')}
    [adminHost,userHost,legacyHost].forEach(host=>{if(host)host.innerHTML=`<tr><td colspan="${host===legacyHost?'5':'8'}">${esc(message)}</td></tr>`});
    console.error('Admin users load failed',e);toast(message,'error')
  }
}
async function patchUser(id,body){try{await api(`/admin/users/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)});toast('User updated','success');await users()}catch(e){toast(e.message,'error')}}
async function hazards(){const host=document.getElementById('admin-hazards-data');if(!host)return;try{const rows=arr(await api('/admin/hazards'));host.innerHTML=rows.length?'':'<tr><td colspan="7">No hazards.</td></tr>';for(const h of rows){const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(h?.type)}</td><td>${esc(h?.status)}</td><td>${Math.round((Number(h?.confidence)||0)*100)}%</td><td>${esc(h?.snnRiskLevel||'—')}</td><td>${Number(h?.trustScore||0).toFixed(2)}</td><td>${esc(h?.userId?.name||'Local AI')}</td><td class="admin-table-actions"><button type="button" class="btn-navora verify">Verify</button><button type="button" class="btn-navora btn-ghost reject">Reject</button></td>`;tr.querySelector('.verify')?.addEventListener('click',()=>confirm('Verify this hazard report?')&&reviewHazard(h?._id,'VERIFIED'));tr.querySelector('.reject')?.addEventListener('click',()=>confirm('Reject this hazard report and update reporter reputation?')&&reviewHazard(h?._id,'REJECTED'));host.appendChild(tr)}}catch(e){host.innerHTML='<tr><td colspan="7">Hazards unavailable.</td></tr>';toast(e.message,'error')}}
async function reviewHazard(id,status){try{await api(`/admin/hazards/${encodeURIComponent(id)}/verify`,{method:'POST',body:JSON.stringify({status})});toast(`Hazard ${status.toLowerCase()}`,'success');await hazards()}catch(e){toast(e.message,'error')}}
async function reports(){const host=document.getElementById('admin-chat-data');if(!host)return;try{const rows=arr(await api('/admin/chat/reports'));host.innerHTML=rows.length?'':'<tr><td colspan="6">No chat reports.</td></tr>';for(const r of rows){const tr=document.createElement('tr');tr.innerHTML=`<td>${dt(r?.createdAt)}</td><td>${esc(r?.reporterId?.name||'User')}</td><td class="moderation-content">${esc(r?.messageId?.content||'[message unavailable]')}<br><small>by ${esc(r?.messageId?.userId?.name||'User')}</small></td><td>${esc(r?.reason)}</td><td>${esc(r?.status)}</td><td class="admin-table-actions"><button data-s="REVIEWED" type="button" class="btn-navora btn-ghost">Reviewed</button><button data-s="DISMISSED" type="button" class="btn-navora btn-ghost">Dismiss</button><button data-s="ACTIONED" type="button" class="btn-navora">Remove</button></td>`;tr.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{const s=b.dataset.s;if(s==='ACTIONED'&&!confirm('Remove the reported message from chat?'))return;reviewReport(r?._id,s)}));host.appendChild(tr)}}catch(e){host.innerHTML='<tr><td colspan="6">Chat reports unavailable.</td></tr>';toast(e.message,'error')}}
async function reviewReport(id,status){try{await api(`/admin/chat/reports/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})});toast('Moderation action saved','success');await reports()}catch(e){toast(e.message,'error')}}
async function audit(){const host=document.getElementById('admin-audit-data');if(!host)return;try{const rows=arr(await api('/admin/audit'));host.innerHTML=rows.length?rows.map(x=>`<tr><td>${dt(x?.createdAt)}</td><td>${esc(x?.action)}</td><td>${esc(x?.actorId?.name||'system')}</td><td>${esc(x?.targetType||'—')}</td><td>${esc(x?.result||'—')}</td></tr>`).join(''):'<tr><td colspan="5">No audit entries.</td></tr>'}catch(e){host.innerHTML='<tr><td colspan="5">Audit data unavailable.</td></tr>';toast(e.message,'error')}}
overview();health();users();hazards();reports();audit();
