import {api,toast} from './api.js';
const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
const authPages=new Set(['login.html','register.html','verify-email.html','forgot-password.html','verify-otp.html','reset-password.html']);
const protectedPages=new Set(['dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html','camera-share.html']);
const adminPages=new Set(['admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html']);
const userLinks=[['dashboard.html','Dashboard','⌂'],['map.html','Navigate','⌖'],['journey.html','Live Journey','▶'],['world-chat.html','World Chat','◉'],['devices.html','Devices','⌁'],['memory.html','Route Memory','◇'],['history.html','History','◷'],['notifications.html','Notifications','•'],['settings.html','Settings','⚙']];
const adminLinks=[['admin.html','Overview','▦'],['admin-users.html','Users','◌'],['admin-hazards.html','Hazards','△'],['admin-devices.html','Devices','⌁'],['admin-chat.html','Chat reports','◉'],['admin-health.html','System health','＋'],['admin-audit.html','Audit log','≡']];
document.body.classList.add('navora-booting');

let deferredInstallPrompt=null;
function showInstallAction(){
  if(!deferredInstallPrompt||document.querySelector('[data-pwa-install]'))return;
  const nav=document.querySelector('.navora-nav');
  if(!nav)return;
  const target=nav.querySelector('.nav-account')||nav.querySelector('.nav-links')||nav;
  const b=document.createElement('button');
  b.type='button';b.className='icon-btn';b.dataset.pwaInstall='';b.textContent='Install';
  b.setAttribute('aria-label','Install Navora');
  b.addEventListener('click',async()=>{
    if(!deferredInstallPrompt)return;
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted')toast('Navora installation accepted.','success');
    deferredInstallPrompt=null;b.remove();
  });
  target.appendChild(b);
}
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferredInstallPrompt=event;showInstallAction();
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  document.querySelector('[data-pwa-install]')?.remove();
  toast('Navora installed successfully.','success');
});

function initials(u){return String(u?.name||u?.email||'N').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'N'}
function brand(){const a=document.createElement('a');a.className='brand';a.href='index.html';a.innerHTML='<span class="brand-mark" aria-hidden="true"></span><span>NAVORA</span>';return a}
function themeButton(){const b=document.createElement('button');b.type='button';b.className='icon-btn';b.dataset.themeToggle='';b.setAttribute('aria-label','Change theme');b.textContent='◐ Theme';return b}
function navLink([href,label,icon]){const a=document.createElement('a');a.href=href;a.innerHTML=`<span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;if(href===page){a.classList.add('active');a.setAttribute('aria-current','page')}return a}
function buildAuthNav(){const nav=document.querySelector('.navora-nav');if(!nav)return;nav.innerHTML='';nav.appendChild(brand());const links=document.createElement('div');links.className='nav-links';if(page!=='login.html'){const a=document.createElement('a');a.href='login.html';a.textContent='Sign in';links.appendChild(a)}if(page!=='register.html'){const a=document.createElement('a');a.href='register.html';a.textContent='Create account';links.appendChild(a)}nav.append(links,themeButton())}
function buildPublicNav(user){const nav=document.querySelector('.navora-nav');if(!nav)return;nav.innerHTML='';nav.appendChild(brand());const links=document.createElement('div');links.className='nav-links';if(user){const a=document.createElement('a');a.href='dashboard.html';a.textContent='Open Navora';links.appendChild(a)}else{for(const [h,t] of [['login.html','Sign in'],['register.html','Create account']]){const a=document.createElement('a');a.href=h;a.textContent=t;links.appendChild(a)}}nav.append(links,themeButton())}
function buildAppNav(user,isAdmin=false){const nav=document.querySelector('.navora-nav');if(!nav)return;nav.innerHTML='';nav.appendChild(brand());const links=document.createElement('div');links.className='nav-links';const s=document.createElement('div');s.className='nav-section';s.textContent=isAdmin?'Administration':'Navigation workspace';links.appendChild(s);for(const x of(isAdmin?adminLinks:userLinks))links.appendChild(navLink(x));if(!isAdmin&&user?.role==='ADMIN'){const s2=document.createElement('div');s2.className='nav-section';s2.textContent='Administration';links.appendChild(s2);links.appendChild(navLink(['admin.html','Admin console','▦']))}nav.appendChild(links);const account=document.createElement('div');account.className='nav-account';const summary=document.createElement('div');summary.className='nav-user-summary';summary.innerHTML=`<span class="nav-avatar">${initials(user)}</span><span class="nav-user-copy"><strong>${String(user?.name||'Navora user')}</strong><small>${String(user?.email||'')}</small></span>`;const row=document.createElement('div');row.className='toolbar';const home=document.createElement('a');home.href=isAdmin?'dashboard.html':'profile.html';home.className='btn-navora btn-ghost';home.textContent=isAdmin?'User app':'Profile';const logout=document.createElement('button');logout.type='button';logout.className='btn-navora btn-ghost';logout.textContent='Logout';logout.onclick=async()=>{try{await api('/auth/logout',{method:'POST'},false)}catch{}sessionStorage.clear();location.replace('login.html')};row.append(home,logout);account.append(summary,row,themeButton());nav.appendChild(account)}
function mobile(){if(!protectedPages.has(page)&&!adminPages.has(page))return;const b=document.createElement('button');b.type='button';b.className='nav-mobile-toggle';b.setAttribute('aria-label','Open navigation');b.textContent='☰';b.onclick=()=>{const open=document.body.classList.toggle('nav-open');b.textContent=open?'✕':'☰'};document.body.appendChild(b)}
async function user(){try{return await api('/users/me')}catch{return null}}
async function start(){const u=await user(),needs=protectedPages.has(page)||adminPages.has(page);if(needs&&!u){sessionStorage.setItem('navora:returnTo',page+location.search+location.hash);location.replace(`login.html?returnTo=${encodeURIComponent(page+location.search+location.hash)}`);return}if(adminPages.has(page)&&u?.role!=='ADMIN'){toast('Administrator access is required.','warning');location.replace('dashboard.html');return}if((page==='login.html'||page==='register.html')&&u){location.replace('dashboard.html');return}if(authPages.has(page)){document.body.classList.add('navora-auth');buildAuthNav()}else if(adminPages.has(page)){document.body.classList.add('navora-admin');buildAppNav(u,true)}else if(protectedPages.has(page)){document.body.classList.add('navora-app');buildAppNav(u)}else{document.body.classList.add('navora-public');buildPublicNav(u)}document.body.classList.remove('navora-booting');mobile()}
window.addEventListener('navora:auth-required',()=>{if(authPages.has(page))return;sessionStorage.setItem('navora:returnTo',page+location.search+location.hash);location.replace(`login.html?returnTo=${encodeURIComponent(page+location.search+location.hash)}`)});
start().then(()=>{if(deferredInstallPrompt)showInstallAction()}).catch(e=>{document.body.classList.remove('navora-booting');toast(e.message,'error')});
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const r=await navigator.serviceWorker.register('/service-worker.js',{updateViaCache:'none'});await r.update().catch(()=>{})}catch{}});
window.Navora={...(window.Navora||{}),toast};
