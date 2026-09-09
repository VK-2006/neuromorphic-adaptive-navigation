import {api,toast} from './api.js';

const page=location.pathname.split('/').pop()||'index.html';
const $=s=>document.querySelector(s);
const byId=id=>document.getElementById(id);

function capabilityGuards(){
  document.querySelectorAll('[data-passkey],[data-passkey-login]').forEach(b=>{
    if(!window.PublicKeyCredential){
      b.disabled=true;b.title='Passkeys are not supported in this browser.';
      b.setAttribute('aria-disabled','true');
    }else if(b.hasAttribute('data-passkey-login')){
      b.title='Enter your account email first, then use your passkey.';
    }
  });
}

function historyGuard(){
  if(page!=='history.html')return;
  const host=byId('history-body');if(!host)return;
  const table=host.closest('table');
  const headers=Array.from(table?.querySelectorAll('thead th')||[]);
  const statusIndex=headers.findIndex(th=>th.textContent.trim().toUpperCase()==='STATUS');
  const apply=()=>host.querySelectorAll('tr').forEach(tr=>{
    const cells=tr.querySelectorAll('td');
    if(statusIndex<0||cells.length<=statusIndex)return;
    const status=cells[statusIndex].textContent.trim().toUpperCase();
    const a=tr.querySelector('a[data-replay]');
    if(a&&!['COMPLETED','ACTIVE','PAUSED'].includes(status)){
      const span=document.createElement('span');span.textContent=a.textContent;span.className='muted';a.replaceWith(span);
    }
  });
  new MutationObserver(apply).observe(host,{childList:true,subtree:true});apply();
}

function notificationsUi(){
  if(page!=='notifications.html')return;
  byId('notification-list')?.addEventListener('click',e=>{
    const row=e.target.closest?.('[data-read]');if(!row)return;
    setTimeout(()=>{
      const small=row.querySelector('small');
      if(small)small.textContent=small.textContent.replace(' · unread',' · read');
      row.style.opacity='.65';
    },250);
  });
}

function settingsSafety(){
  if(page!=='settings.html')return;
  const checkbox=byId('contact-share'),email=byId('contact-email'),form=byId('contact-form');
  const note=document.createElement('p');note.className='muted';note.style.fontSize='.82rem';
  note.textContent='SOS delivery currently uses trusted-contact email. A phone number may be stored as metadata, but enabling journey sharing requires an email address.';
  form?.insertAdjacentElement('beforebegin',note);
  form?.addEventListener('submit',e=>{
    if(checkbox?.checked&&!email?.value?.trim()){
      e.preventDefault();e.stopImmediatePropagation();toast('Add an email before enabling journey sharing/SOS alerts.','error');email.focus();
    }
  },true);
}

function mapPrerequisites(){
  if(page!=='map.html')return;
  const b=byId('begin-selected-journey');
  if(b&&!document.querySelector('.route-card')){b.disabled=true;b.title='Calculate and select a persisted route first.'}
  if(!window.L){
    const host=byId('map');if(host)host.innerHTML='<div class="navora-state-panel"><h3>Map library unavailable</h3><p class="muted">Reconnect and reload before planning a live route.</p></div>';
    const submit=$('#route-form button[type="submit"]');if(submit)submit.disabled=true;
  }
}

function init(){
 capabilityGuards();historyGuard();notificationsUi();settingsSafety();mapPrerequisites();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
