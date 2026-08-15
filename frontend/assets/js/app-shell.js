import {api,toast} from './api.js';

const path=location.pathname.split('/').pop()||'index.html';
const authPages=new Set(['login.html','register.html','verify-email.html','forgot-password.html','verify-otp.html','reset-password.html']);
const userLinks=[
  ['index.html','Home'],['dashboard.html','Dashboard'],['map.html','Navigate'],['journey.html','Live Journey'],
  ['world-chat.html','World Chat'],['devices.html','Devices'],['memory.html','Route Memory'],['journey-replay.html','Journey Replay'],
  ['history.html','Journey History'],['notifications.html','Notifications'],['profile.html','Profile'],['settings.html','Settings']
];

function actionHost(nav){return nav?.querySelector('.nav-actions')||nav}

function active(){
  document.querySelectorAll('.nav-links a').forEach(a=>{
    const isActive=a.getAttribute('href')===path;
    a.classList.toggle('active',isActive);
    if(isActive)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
}

function initials(user){return String(user?.name||user?.email||'N').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'N'}

function userMenu(user){
  const wrap=document.createElement('div');wrap.className='nav-user';
  const button=document.createElement('button');button.type='button';button.className='icon-btn nav-user-button';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Open account menu');
  button.innerHTML=`<span class="nav-user-avatar" aria-hidden="true">${initials(user)}</span><span>Account</span>`;
  const menu=document.createElement('div');menu.className='nav-user-menu';menu.setAttribute('role','menu');
  const profile=document.createElement('a');profile.href='profile.html';profile.textContent='Profile';profile.setAttribute('role','menuitem');
  const settings=document.createElement('a');settings.href='settings.html';settings.textContent='Settings';settings.setAttribute('role','menuitem');
  const logout=document.createElement('button');logout.type='button';logout.textContent='Logout';logout.setAttribute('role','menuitem');
  logout.addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST'},false)}catch{}location.href='login.html'});
  menu.append(profile,settings,logout);wrap.append(button,menu);
  button.addEventListener('click',()=>{const open=wrap.classList.toggle('open');button.setAttribute('aria-expanded',String(open))});
  return wrap;
}

async function enhanceNav(){
  const nav=document.querySelector('.navora-nav'),links=nav?.querySelector('.nav-links');
  if(!nav||!links||path.startsWith('admin-')||path==='admin.html')return;
  let user=null;try{user=await api('/users/me')}catch{}
  if(user){
    links.innerHTML='';
    for(const [href,label] of userLinks){const a=document.createElement('a');a.href=href;a.textContent=label;links.appendChild(a)}
    if(user.role==='ADMIN'){const a=document.createElement('a');a.href='admin.html';a.textContent='Admin';links.appendChild(a)}
    {const host=actionHost(nav);host.insertBefore(userMenu(user),host.querySelector('[data-theme-toggle]')||null);}
  }else if(!authPages.has(path)){
    const a=document.createElement('a');a.href='login.html';a.textContent='Login';links.appendChild(a);
  }
  active();
  if(!nav.querySelector('.mobile-nav-toggle')){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='icon-btn mobile-nav-toggle';toggle.setAttribute('aria-label','Open navigation');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';
    toggle.onclick=()=>{const open=links.classList.toggle('mobile-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');toggle.textContent=open?'✕':'☰'};
    {const host=actionHost(nav);host.insertBefore(toggle,host.querySelector('[data-theme-toggle]')||null);}
  }
}

active();enhanceNav();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}))}
document.addEventListener('click',e=>{if(e.target.closest('[data-demo-toast]'))toast(e.target.closest('[data-demo-toast]').dataset.demoToast)});
window.Navora={...(window.Navora||{}),toast};

let deferredInstallPrompt=null;
function ensureInstallButton(){
  const nav=document.querySelector('.navora-nav');
  if(!nav||document.querySelector('[data-pwa-install]'))return;
  const button=document.createElement('button');
  button.type='button';button.className='icon-btn';button.dataset.pwaInstall='';button.textContent='Install';button.setAttribute('aria-label','Install Navora app');
  button.addEventListener('click',async()=>{
    if(!deferredInstallPrompt){toast('Install is available from your browser menu when supported.','info');return}
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted')toast('App installation accepted.','success');
    deferredInstallPrompt=null;button.remove();
  });
  {const host=actionHost(nav);host.insertBefore(button,host.querySelector('[data-theme-toggle]')||null);}
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;ensureInstallButton()});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;document.querySelector('[data-pwa-install]')?.remove();toast('Navora installed successfully.','success')});
