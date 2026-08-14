import{api,toast}from'./api.js';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const when=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString()};
const replayable=new Set(['COMPLETED','ACTIVE','PAUSED']);

async function history(){
  const h=document.getElementById('history-body');if(!h)return;
  try{
    const rows=arr(await api('/journeys'));
    h.innerHTML=rows.length?rows.map(j=>{
      const status=String(j?.status||'—').toUpperCase(),date=when(j?.createdAt);
      const journey=replayable.has(status)?`<a href="journey-replay.html" data-replay="${esc(j?._id)}">${date}</a>`:`<span class="muted">${date}</span>`;
      return`<tr><td>${journey}</td><td>${esc(j?.mode||'—')}</td><td>${j?.averageRisk!=null?Math.round(100*(1-Number(j.averageRisk)))+'%':'—'}</td><td>${Number(j?.reroutes)||0}</td><td>${esc(status)}</td></tr>`;
    }).join(''):'<tr><td colspan="5">No journeys yet.</td></tr>';
    h.querySelectorAll('[data-replay]').forEach(a=>a.addEventListener('click',()=>{try{sessionStorage.setItem('lastCompletedJourneyId',a.dataset.replay)}catch{}}));
  }catch(e){h.innerHTML='<tr><td colspan="5">Journey history is temporarily unavailable.</td></tr>';toast(e.message,'error')}
}
async function memory(){
  const h=document.getElementById('memory-list');if(!h)return;
  try{
    const rows=arr(await api('/memory'));
    h.innerHTML=rows.length?rows.map(m=>`<div class="data-row"><div style="display:flex;justify-content:space-between"><strong>Route memory</strong><span>${Math.round((Number(m?.familiarity)||0)*100)}% familiar</span></div><div class="muted">Journeys ${Number(m?.journeyCount)||0} · successful ${Number(m?.successfulJourneyCount)||0} · safety ${Math.round((Number(m?.historicalSafety)||0)*100)}% · reliability ${Math.round((Number(m?.reliability??m?.historicalSafety)||0)*100)}%</div></div>`).join(''):'<div class="empty-state">No CRM memories yet. Complete a journey to create one.</div>';
  }catch(e){h.innerHTML='<div class="empty-state">Route memory is temporarily unavailable.</div>';toast(e.message,'error')}
}
async function notifications(){
  const h=document.getElementById('notification-list');if(!h)return;
  try{
    const rows=arr(await api('/notifications'));
    h.innerHTML=rows.length?rows.map(n=>`<button class="data-row" type="button" style="text-align:left;width:100%;color:inherit" data-read="${esc(n?._id)}"><strong>${esc(n?.title||n?.type||'Notification')}</strong><div>${esc(n?.message||'')}</div><small class="muted">${when(n?.createdAt)}${n?.readAt?' · read':' · unread'}</small></button>`).join(''):'<div class="empty-state">No notifications.</div>';
    h.querySelectorAll('[data-read]').forEach(b=>b.addEventListener('click',async()=>{
      try{
        const n=await api(`/notifications/${encodeURIComponent(b.dataset.read)}/read`,{method:'PATCH'});
        b.style.opacity='.65';const small=b.querySelector('small');
        if(small)small.textContent=`${when(n?.createdAt||Date.now())} · read`;
        b.removeAttribute('data-read');
      }catch(e){toast(e.message,'error')}
    }));
  }catch(e){h.innerHTML='<div class="empty-state">Notifications are temporarily unavailable.</div>';toast(e.message,'error')}
}
history();memory();notifications();
