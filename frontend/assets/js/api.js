const API_BASE='/api/v1';let refreshPromise=null;
async function parse(r){let body=null;try{body=await r.json()}catch{}return {r,body}}
async function refresh(){if(!refreshPromise)refreshPromise=fetch(`${API_BASE}/auth/refresh`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}}).then(r=>{if(!r.ok)throw new Error('Session expired');return r}).finally(()=>refreshPromise=null);return refreshPromise}
export async function api(path,options={},retry=true){const init={credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options};let {r,body}=await parse(await fetch(API_BASE+path,init));if(r.status===401&&retry&&!path.startsWith('/auth/')){try{await refresh();({r,body}=await parse(await fetch(API_BASE+path,init)))}catch{}}if(!r.ok)throw new Error(body?.message||`HTTP ${r.status}`);return body?.data??body}
export function toast(message,type='info'){
  let stack=document.querySelector('.toast-stack');if(!stack){stack=document.createElement('div');stack.className='toast-stack';stack.setAttribute('aria-live','polite');stack.setAttribute('aria-atomic','false');document.body.appendChild(stack)}
  const t=document.createElement('div');t.className='toastx';t.dataset.type=type;t.setAttribute('role',type==='error'?'alert':'status');
  const icon=document.createElement('span');icon.className='toast-icon';icon.setAttribute('aria-hidden','true');icon.textContent=type==='success'?'✓':type==='error'?'!':type==='warning'?'△':'i';
  const text=document.createElement('span');text.textContent=message;
  const close=document.createElement('button');close.type='button';close.className='toast-close';close.setAttribute('aria-label','Dismiss notification');close.textContent='×';close.onclick=()=>t.remove();
  const progress=document.createElement('span');progress.className='toast-progress';progress.setAttribute('aria-hidden','true');
  t.append(icon,text,close,progress);stack.appendChild(t);setTimeout(()=>t.remove(),4500)
}
export const money=n=>new Intl.NumberFormat().format(n);
