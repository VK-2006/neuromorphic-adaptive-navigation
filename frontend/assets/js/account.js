import{api,toast}from'./api.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const value=id=>$(id)?.value?.trim()||'';
async function loadProfile(){
  if(!$('profile-name')&&!$('pref-safety'))return;
  try{
    const u=(await api('/users/me'))||{},p=u.preferences||{};
    if($('profile-name'))$('profile-name').value=u.name||'';
    if($('profile-email'))$('profile-email').value=u.email||'';
    if($('pref-safety'))$('pref-safety').value=Math.round(Number(p.safety??.75)*100);
    if($('pref-traffic'))$('pref-traffic').value=Math.round(Number(p.traffic??.55)*100);
    if($('pref-familiarity'))$('pref-familiarity').value=Math.round(Number(p.familiarity??.45)*100);
  }catch(e){toast(e.message,'error')}
}
$('profile-form')?.addEventListener('submit',async e=>{
  e.preventDefault();try{await api('/users/me',{method:'PATCH',body:JSON.stringify({name:value('profile-name')})});toast('Profile updated','success')}catch(x){toast(x.message,'error')}
});
$('preferences-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const preferences={safety:Number($('pref-safety')?.value||75)/100,traffic:Number($('pref-traffic')?.value||55)/100,familiarity:Number($('pref-familiarity')?.value||45)/100};
    await api('/users/me',{method:'PATCH',body:JSON.stringify({preferences})});
    try{localStorage.setItem('navora:preferences',JSON.stringify(preferences))}catch{}
    toast('Route preferences saved','success');
  }catch(x){toast(x.message,'error')}
});
async function loadContacts(){
  const h=$('contact-list');if(!h)return;
  try{
    const rows=arr(await api('/trusted-contacts'));
    h.innerHTML=rows.length?rows.map(c=>`<div class="data-row"><strong>${esc(c?.name)}</strong><div class="muted">${esc(c?.relationship||'Trusted contact')} · ${esc(c?.email||c?.phone||'No channel')}</div><div class="toolbar"><button class="btn-navora btn-ghost" type="button" data-toggle-contact="${esc(c?._id)}">${c?.sharePermission?'Disable sharing':'Enable sharing'}</button><button class="btn-navora btn-ghost" type="button" data-delete-contact="${esc(c?._id)}">Remove</button></div></div>`).join(''):'<div class="empty-state">No trusted contacts configured.</div>';
    h.querySelectorAll('[data-toggle-contact]').forEach(b=>b.addEventListener('click',async()=>{
      try{const c=rows.find(x=>String(x?._id)===String(b.dataset.toggleContact));await api('/trusted-contacts/'+encodeURIComponent(b.dataset.toggleContact),{method:'PATCH',body:JSON.stringify({sharePermission:!c?.sharePermission})});await loadContacts()}catch(e){toast(e.message,'error')}
    }));
    h.querySelectorAll('[data-delete-contact]').forEach(b=>b.addEventListener('click',async()=>{
      try{await api('/trusted-contacts/'+encodeURIComponent(b.dataset.deleteContact),{method:'DELETE'});await loadContacts()}catch(e){toast(e.message,'error')}
    }));
  }catch(e){h.innerHTML='<div class="empty-state">Trusted contacts are temporarily unavailable.</div>';toast(e.message,'error')}
}
$('contact-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    await api('/trusted-contacts',{method:'POST',body:JSON.stringify({name:value('contact-name'),email:value('contact-email'),phone:value('contact-phone'),relationship:value('contact-relationship'),sharePermission:Boolean($('contact-share')?.checked)})});
    e.currentTarget.reset();toast('Trusted contact added','success');await loadContacts();
  }catch(x){toast(x.message,'error')}
});
loadProfile();loadContacts();
