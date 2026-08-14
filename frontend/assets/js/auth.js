import {api,toast} from './api.js';

const $=id=>document.getElementById(id);
const val=id=>$(id)?.value?.trim()||'';

function target(){
  const raw=new URLSearchParams(location.search).get('returnTo')||sessionStorage.getItem('navora:returnTo');
  if(!raw)return'dashboard.html';
  try{
    const u=new URL(raw,location.origin),f=u.pathname.split('/').pop();
    return u.origin===location.origin&&f?.endsWith('.html')?f+u.search+u.hash:'dashboard.html';
  }catch{return'dashboard.html'}
}

function status(form,msg,type='info'){
  const el=form?.querySelector('[data-form-status]')||document.querySelector('[data-form-status]');
  if(!el)return toast(msg,type);
  el.textContent=msg;el.dataset.type=type;el.classList.remove('hidden');
}

function busy(form,on,label='Please wait…'){
  const b=form?.querySelector('button[type="submit"]');if(!b)return;
  if(on){b.dataset.old=b.textContent;b.textContent=label;b.disabled=true;form.setAttribute('aria-busy','true')}
  else{b.textContent=b.dataset.old||b.textContent;b.disabled=false;form.removeAttribute('aria-busy')}
}

async function run(form,label,fn){
  busy(form,true,label);
  try{await fn()}catch(e){status(form,e.message,'error');toast(e.message,'error')}
  finally{busy(form,false)}
}

function cooldown(b,n=60){
  let x=n,old=b.textContent;b.disabled=true;b.textContent=`Resend in ${x}s`;
  const t=setInterval(()=>{x--;if(x<=0){clearInterval(t);b.disabled=false;b.textContent=old}else b.textContent=`Resend in ${x}s`},1000);
}

function assertPasswords(primary='password',confirm='confirm-password'){
  const p=val(primary),c=val(confirm);
  if(c&&p!==c)throw new Error('Passwords do not match.');
  if(p.length<8)throw new Error('Password must be at least 8 characters.');
  return p;
}

$('register-form')?.addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;
  run(f,'Creating account…',async()=>{
    const email=val('email'),password=assertPasswords();
    await api('/auth/register',{method:'POST',body:JSON.stringify({name:val('name'),email,password})});
    sessionStorage.setItem('pendingEmail',email);
    status(f,'Account created. Opening email verification…','success');
    setTimeout(()=>location.assign('verify-email.html'),400);
  });
});

$('verify-form')?.addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;
  run(f,'Verifying…',async()=>{
    const email=val('email')||sessionStorage.getItem('pendingEmail');
    if(!email)throw new Error('Verification email is missing. Register again.');
    await api('/auth/verify-email',{method:'POST',body:JSON.stringify({email,otp:val('otp')})});
    sessionStorage.removeItem('pendingEmail');
    status(f,'Email verified. Redirecting to sign in…','success');
    setTimeout(()=>location.assign('login.html'),400);
  });
});

$('login-form')?.addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;
  run(f,'Signing in…',async()=>{
    await api('/auth/login',{method:'POST',body:JSON.stringify({email:val('email'),password:val('password')})});
    const x=target();sessionStorage.removeItem('navora:returnTo');location.assign(x);
  });
});

$('forgot-form')?.addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;
  run(f,'Sending code…',async()=>{
    const email=val('email');
    await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})});
    sessionStorage.setItem('resetEmail',email);
    status(f,'Reset code requested. Check your email.','success');
    setTimeout(()=>location.assign('verify-otp.html'),400);
  });
});

$('verify-reset-form')?.addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;
  run(f,'Checking code…',async()=>{
    const email=val('email')||sessionStorage.getItem('resetEmail');
    if(!email)throw new Error('Reset email is missing. Enter your email or start again.');
    sessionStorage.setItem('resetEmail',email);
    const d=await api('/auth/verify-reset-otp',{method:'POST',body:JSON.stringify({email,otp:val('otp')})});
    sessionStorage.setItem('resetToken',d.resetToken);
    location.assign('reset-password.html');
  });
});

$('reset-form')?.addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;
  run(f,'Updating password…',async()=>{
    const resetToken=sessionStorage.getItem('resetToken');
    if(!resetToken)throw new Error('Reset session expired. Start again.');
    const password=assertPasswords();
    await api('/auth/reset-password',{method:'POST',body:JSON.stringify({resetToken,password})});
    sessionStorage.removeItem('resetToken');sessionStorage.removeItem('resetEmail');
    status(f,'Password updated. Opening sign in…','success');
    setTimeout(()=>location.assign('login.html'),350);
  });
});

async function passkey(){
  try{
    if(!window.PublicKeyCredential)throw new Error('Passkeys are not supported in this browser.');
    if(!window.NavoraWebAuthn)throw new Error('Passkey helper failed to load.');
    const options=await api('/auth/passkeys/register/options',{method:'POST'});
    const c=await navigator.credentials.create({publicKey:window.NavoraWebAuthn.decodeCreationOptions?.(options)||options});
    if(!c)throw new Error('Passkey creation was cancelled.');
    await api('/auth/passkeys/register/verify',{method:'POST',body:JSON.stringify(window.NavoraWebAuthn.credentialToJSON(c))});
    toast('Passkey registered','success');
  }catch(e){toast(`Passkey: ${e.message}`,'error')}
}

async function passkeyLogin(){
  try{
    if(!window.PublicKeyCredential)throw new Error('Passkeys are not supported in this browser.');
    if(!window.NavoraWebAuthn)throw new Error('Passkey helper failed to load.');
    const email=val('email');if(!email)throw new Error('Enter your account email before using a passkey.');
    const d=await api('/auth/passkeys/auth/options',{method:'POST',body:JSON.stringify({email})});
    const c=await navigator.credentials.get({publicKey:window.NavoraWebAuthn.decodeRequestOptions(d.options)});
    if(!c)throw new Error('Passkey sign-in was cancelled.');
    await api('/auth/passkeys/auth/verify',{method:'POST',body:JSON.stringify({userId:d.userId,response:window.NavoraWebAuthn.credentialToJSON(c)})});
    location.assign(target());
  }catch(e){toast(`Passkey: ${e.message}`,'error')}
}
document.querySelector('[data-passkey]')?.addEventListener('click',passkey);
document.querySelector('[data-passkey-login]')?.addEventListener('click',passkeyLogin);

async function initGoogle(){
  const host=$('google-signin'),s=$('google-status');
  if(!host)return;
  const mode=host.dataset.googleMode==='signup'?'signup':'login';
  try{
    const cfg=await api('/auth/config');
    if(!cfg.google?.enabled||!cfg.google.clientId){
      host.innerHTML=`<button class="btn-navora btn-ghost" disabled>${mode==='signup'?'Sign up':'Continue'} with Google</button>`;
      if(s)s.textContent='Google authentication is not configured.';
      return;
    }
    let attempts=0;
    const render=()=>{
      const gis=window.google?.accounts?.id;
      if(!gis){
        if(attempts++<40)return setTimeout(render,150);
        host.innerHTML=`<button class="btn-navora btn-ghost" disabled>${mode==='signup'?'Sign up':'Continue'} with Google</button>`;
        if(s)s.textContent='Google Identity Services could not load. Use email/password or passkey.';
        return;
      }
      try{
        gis.initialize({
          client_id:cfg.google.clientId,
          use_fedcm_for_button:true,
          callback:async response=>{
            try{
              if(!response?.credential)throw new Error('Google did not return an ID token.');
              await api('/auth/google',{method:'POST',body:JSON.stringify({idToken:response.credential})});
              sessionStorage.removeItem('pendingEmail');
              location.assign(target());
            }catch(e){toast(`Google ${mode}: ${e.message}`,'error')}
          }
        });
        host.innerHTML='';
        gis.renderButton(host,{
          theme:document.documentElement.dataset.theme==='dark'?'filled_black':'outline',
          size:'large',shape:'rectangular',
          text:mode==='signup'?'signup_with':'continue_with',
          width:320
        });
        if(s)s.textContent=mode==='signup'
          ?'Google creates or links your verified Navora account; no email OTP is required for Google-verified email.'
          :'Google tokens are verified by the Navora backend.';
      }catch(e){
        host.innerHTML=`<button class="btn-navora btn-ghost" disabled>${mode==='signup'?'Sign up':'Continue'} with Google</button>`;
        if(s)s.textContent='Google authentication could not initialize. Use email/password or passkey.';
        console.warn('Navora Google GIS initialization failed:',e);
      }
    };
    render();
  }catch(e){
    host.innerHTML=`<button class="btn-navora btn-ghost" disabled>${mode==='signup'?'Sign up':'Continue'} with Google</button>`;
    if(s)s.textContent=`Google authentication unavailable: ${e.message}`;
  }
}

$('resend-verification')?.addEventListener('click',async()=>{
  const b=$('resend-verification');
  try{
    const email=val('email')||sessionStorage.getItem('pendingEmail');
    if(!email)throw new Error('Enter the registered email.');
    b.disabled=true;
    await api('/auth/resend-verification',{method:'POST',body:JSON.stringify({email})});
    toast('Verification email accepted. Check Inbox and Spam/Junk.','success');cooldown(b);
  }catch(e){b.disabled=false;toast(e.message,'error')}
});

$('resend-reset')?.addEventListener('click',async()=>{
  const b=$('resend-reset');
  try{
    const email=val('email')||sessionStorage.getItem('resetEmail');
    if(!email)throw new Error('Enter the account email.');
    b.disabled=true;sessionStorage.setItem('resetEmail',email);
    await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})});
    toast('A new reset OTP was requested. Check Inbox and Spam/Junk.','success');cooldown(b);
  }catch(e){b.disabled=false;toast(e.message,'error')}
});

if($('verify-form'))$('email').value=sessionStorage.getItem('pendingEmail')||'';
if($('verify-reset-form')&&$('email'))$('email').value=sessionStorage.getItem('resetEmail')||'';
if($('reset-form')&&!sessionStorage.getItem('resetToken')){
  status($('reset-form'),'Reset session is missing or expired. Start password recovery again.','warning');
}

(async()=>{
  const el=$('email-delivery-status');if(!el)return;
  try{
    const x=await api('/auth/email/status');
    el.textContent=x.configured&&x.providerReachable&&x.senderRegistered&&x.senderActive
      ?'Email service ready. If delayed, check Spam/Junk or use Resend code.'
      :(x.note||'Email delivery unavailable.');
  }catch{el.textContent='Email provider status unavailable.'}
})();

initGoogle();
