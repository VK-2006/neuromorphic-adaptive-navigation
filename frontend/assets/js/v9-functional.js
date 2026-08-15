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
  if(page==='devices.html'&&!navigator.bluetooth){
    const b=$('[data-bluetooth-pair]');if(b){b.disabled=true;b.title='Web Bluetooth is unavailable in this browser.'}
  }
}

function historyGuard(){
  if(page!=='history.html')return;
  const host=byId('history-body');if(!host)return;
  const apply=()=>host.querySelectorAll('tr').forEach(tr=>{
    const cells=tr.querySelectorAll('td');if(cells.length<5)return;
    const status=cells[4].textContent.trim().toUpperCase();
    const a=cells[0].querySelector('a[data-replay]');
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

async function installIceConfig(){
  if(!window.RTCPeerConnection||window.__navoraRtcWrapped)return;
  const Native=window.RTCPeerConnection;
  let extra=[{urls:'stun:stun1.l.google.com:19302'}];
  window.__navoraRtcWrapped=true;
  const Wrapped=function(config={},constraints){
    const existing=Array.isArray(config.iceServers)?config.iceServers:[];
    const merged=[...existing,...extra].filter((x,i,a)=>a.findIndex(y=>JSON.stringify(y)===JSON.stringify(x))===i);
    return new Native({...config,iceServers:merged},constraints);
  };
  Wrapped.prototype=Native.prototype;Object.setPrototypeOf(Wrapped,Native);window.RTCPeerConnection=Wrapped;
  try{
    // ICE configuration is an optional enhancement. Read it without api(), because
    // a missing/expired session here must not emit navora:auth-required and hijack
    // the main Journey page while its primary authenticated data is still loading.
    const response=await fetch('/api/v1/live/webrtc-config',{credentials:'include',headers:{accept:'application/json'}});
    if(!response.ok)return;
    const body=await response.json().catch(()=>null),cfg=body?.data??body;
    if(Array.isArray(cfg?.iceServers)&&cfg.iceServers.length)extra=cfg.iceServers;
  }catch{}
}

function init(){
  capabilityGuards();historyGuard();notificationsUi();settingsSafety();mapPrerequisites();
  if(['journey.html','camera-share.html'].includes(page))installIceConfig();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
