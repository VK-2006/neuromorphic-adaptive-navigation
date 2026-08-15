
import{api,toast}from'./api.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const value=id=>$(id)?.value?.trim()||'';
const when=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString()};
const pct=v=>`${Math.round((Number(v)||0)*100)}%`;
function initials(u){return String(u?.name||u?.email||'N').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function setText(id,v){const el=$(id);if(el)el.textContent=v}
function setValue(id,v){const el=$(id);if(el)el.value=v??''}
function renderProfileHero(u){
  setText('profile-display-name',u?.name||'Navora user');setText('profile-display-email',u?.email||'');
  const av=$('profile-avatar');
  if(av)av.innerHTML=u?.avatarUrl?`<img alt="" src="${esc(u.avatarUrl)}">`:esc(initials(u));
  setText('profile-role',u?.role||'USER');setText('profile-verified',u?.emailVerified?'Email verified':'Email not verified');
}
function rangePaint(id,out){const el=$(id),o=$(out);if(el&&o)o.textContent=`${el.value}%`}
async function loadProfile(){
  if(!$('profile-name')&&!$('pref-safety'))return;
  try{
    const u=(await api('/users/me'))||{},p=u.preferences||{};
    renderProfileHero(u);
    setValue('profile-name',u.name||'');setValue('profile-email',u.email||'');setValue('profile-phone',u.phone||'');
    setValue('profile-city',u.city||'');setValue('profile-country',u.country||'');setValue('profile-language',u.preferredLanguage||'en-IN');
    setText('profile-account-role',u.role||'USER');setText('profile-email-state',u.emailVerified?'Verified':'Not verified');
    setText('profile-member-since',when(u.createdAt));setText('profile-last-login',when(u.lastLoginAt));setText('profile-user-id',u.id||'—');

    setValue('pref-safety',Math.round(Number(p.safety??.75)*100));
    setValue('pref-traffic',Math.round(Number(p.traffic??.55)*100));
    setValue('pref-familiarity',Math.round(Number(p.familiarity??.45)*100));
    setValue('pref-theme',p.theme||String(document.documentElement.dataset.themeChoice||'SYSTEM').toUpperCase());
    setValue('pref-units',p.units||'METRIC');setValue('pref-voice-language',p.voiceLanguage||u.preferredLanguage||'en-IN');
    setValue('pref-detection-mode',p.detectionMode||'LOCAL');
    if($('pref-high-accuracy'))$('pref-high-accuracy').checked=p.highAccuracyGps!==false;
    rangePaint('pref-safety','pref-safety-out');rangePaint('pref-traffic','pref-traffic-out');rangePaint('pref-familiarity','pref-familiarity-out');

    if($('profile-stat-journeys')){
      const s=await api('/users/me/summary');
      setText('profile-stat-journeys',s?.journeys??0);setText('profile-stat-completed',s?.completedJourneys??0);
      setText('profile-stat-memory',s?.routeMemories??0);setText('profile-stat-devices',s?.devices??0);
      setText('profile-stat-contacts',s?.trustedContacts??0);setText('profile-stat-unread',s?.unreadNotifications??0);
      setText('profile-last-journey',s?.lastJourney?`${s.lastJourney.status||'—'} · ${when(s.lastJourney.createdAt)}`:'No journeys yet');
    }
  }catch(e){toast(e.message,'error')}
}
$('profile-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');if(btn)btn.disabled=true;
  try{
    const u=await api('/users/me',{method:'PATCH',body:JSON.stringify({
      name:value('profile-name'),phone:value('profile-phone'),city:value('profile-city'),country:value('profile-country'),preferredLanguage:value('profile-language')
    })});
    renderProfileHero(u);toast('Profile updated','success');
  }catch(x){toast(x.message,'error')}finally{if(btn)btn.disabled=false}
});
['pref-safety','pref-traffic','pref-familiarity'].forEach(id=>$(id)?.addEventListener('input',()=>rangePaint(id,`${id}-out`)));
$('preferences-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');if(btn)btn.disabled=true;
  try{
    const preferences={
      safety:Number($('pref-safety')?.value||75)/100,traffic:Number($('pref-traffic')?.value||55)/100,
      familiarity:Number($('pref-familiarity')?.value||45)/100,theme:value('pref-theme')||'SYSTEM',
      units:value('pref-units')||'METRIC',voiceLanguage:value('pref-voice-language')||'en-IN',
      detectionMode:value('pref-detection-mode')||'LOCAL',highAccuracyGps:Boolean($('pref-high-accuracy')?.checked)
    };
    await api('/users/me',{method:'PATCH',body:JSON.stringify({preferences})});
    try{localStorage.setItem('navora:preferences',JSON.stringify(preferences))}catch{}
    const choice=preferences.theme.toLowerCase();window.NavoraTheme?.apply?.(choice);
    toast('Navigation, appearance and perception defaults saved.','success');
  }catch(x){toast(x.message,'error')}finally{if(btn)btn.disabled=false}
});
async function loadContacts(){
  const h=$('contact-list');if(!h)return;
  try{
    const rows=arr(await api('/trusted-contacts'));
    h.innerHTML=rows.length?rows.map(c=>`<div class="data-row"><strong>${esc(c?.name)}</strong><div class="muted">${esc(c?.relationship||'Trusted contact')} · ${esc(c?.email||c?.phone||'No channel')}${c?.sharePermission&&!c?.email?' · sharing disabled until email added':''}</div><div class="toolbar"><button class="btn-navora btn-ghost" type="button" data-toggle-contact="${esc(c?._id)}">${c?.sharePermission?'Disable sharing':'Enable sharing'}</button><button class="btn-navora btn-ghost" type="button" data-delete-contact="${esc(c?._id)}">Remove</button></div></div>`).join(''):'<div class="empty-state">No trusted contacts configured.</div>';
    h.querySelectorAll('[data-toggle-contact]').forEach(b=>b.addEventListener('click',async()=>{
      try{const c=rows.find(x=>String(x?._id)===String(b.dataset.toggleContact));if(!c?.sharePermission&&!c?.email)throw new Error('Add an email address before enabling journey sharing/SOS delivery.');await api('/trusted-contacts/'+encodeURIComponent(b.dataset.toggleContact),{method:'PATCH',body:JSON.stringify({sharePermission:!c?.sharePermission})});await loadContacts()}catch(e){toast(e.message,'error')}
    }));
    h.querySelectorAll('[data-delete-contact]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Remove this trusted contact?'))return;try{await api('/trusted-contacts/'+encodeURIComponent(b.dataset.deleteContact),{method:'DELETE'});await loadContacts();toast('Trusted contact removed','success')}catch(e){toast(e.message,'error')}
    }));
  }catch(e){h.innerHTML='<div class="empty-state">Trusted contacts are temporarily unavailable.</div>';toast(e.message,'error')}
}
$('contact-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const sharePermission=Boolean($('contact-share')?.checked),email=value('contact-email');
    if(sharePermission&&!email)throw new Error('Email is required when journey sharing/SOS alerts are enabled.');
    await api('/trusted-contacts',{method:'POST',body:JSON.stringify({name:value('contact-name'),email,phone:value('contact-phone'),relationship:value('contact-relationship'),sharePermission})});
    e.currentTarget.reset();toast('Trusted contact added','success');await loadContacts();
  }catch(x){toast(x.message,'error')}
});
loadProfile();loadContacts();
