const API_BASE='/api/v1';let refreshPromise=null;
export class ApiError extends Error{constructor(message,status=0,body=null){super(message);this.name='ApiError';this.status=status;this.body=body}}
async function parse(r){let body=null;try{body=await r.json()}catch{}return{r,body}}
async function refresh(){if(!refreshPromise)refreshPromise=fetch(`${API_BASE}/auth/refresh`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}}).then(async r=>{if(!r.ok){let body=null;try{body=await r.json()}catch{};if(r.status===403&&body?.code==='ACCOUNT_BLOCKED'){window.dispatchEvent(new CustomEvent('navora:auth-required',{detail:{path:'/auth/refresh',message:'Admin Blocked — Your account has been blocked by an administrator.',blocked:true}}));throw new ApiError('Admin Blocked — Your account has been blocked by an administrator.',r.status,body)}throw new ApiError(body?.message||'Session expired',r.status,body)}return r}).finally(()=>refreshPromise=null);return refreshPromise}
function requestInit(options={}){
  const headers=new Headers(options.headers||{});
  const body=options.body;
  const isFormData=typeof FormData!=='undefined'&&body instanceof FormData;
  if(body!=null&&!isFormData&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  return{...options,credentials:options.credentials??'include',headers};
}
export async function api(path,options={},retry=true){const init=requestInit(options);let pair;try{pair=await parse(await fetch(API_BASE+path,init))}catch(e){throw new ApiError(navigator.onLine?'Network request failed':'You are offline',0,{cause:e.message})}let{r,body}=pair;if(r.status===401&&retry&&!path.startsWith('/auth/')){try{await refresh();({r,body}=await parse(await fetch(API_BASE+path,init)))}catch{}}if(!r.ok){const e=new ApiError(body?.message||`Request failed (${r.status})`,r.status,body);if((r.status===401||r.status===403)&&body?.code==='ACCOUNT_BLOCKED')window.dispatchEvent(new CustomEvent('navora:auth-required',{detail:{path,message:body.message,blocked:true}}));else if(r.status===401&&!path.startsWith('/auth/'))window.dispatchEvent(new CustomEvent('navora:auth-required',{detail:{path,message:'Your session has expired. Please sign in again.'}}));throw e}return body?.data??body}
export function toast(message,type='info'){let stack=document.querySelector('.toast-stack');if(!stack){stack=document.createElement('div');stack.className='toast-stack';stack.setAttribute('aria-live','polite');document.body.appendChild(stack)}const t=document.createElement('div');t.className='toastx';t.dataset.type=type;t.setAttribute('role',type==='error'?'alert':'status');const icon=document.createElement('span');icon.className='toast-icon';icon.textContent=type==='success'?'✓':type==='error'?'!':type==='warning'?'△':'i';const text=document.createElement('span');text.textContent=String(message||'');const close=document.createElement('button');close.type='button';close.className='toast-close';close.setAttribute('aria-label','Dismiss notification');close.textContent='×';close.onclick=()=>t.remove();const progress=document.createElement('span');progress.className='toast-progress';t.append(icon,text,close,progress);stack.appendChild(t);setTimeout(()=>t.remove(),4500)}
export const money=n=>new Intl.NumberFormat().format(n);
let mapTileConfigPromise=null;
export async function getMapTileConfig(){
  if(!mapTileConfigPromise){
    mapTileConfigPromise=api('/routes/map-tile-config').catch(err=>{
      console.warn('Failed to load map tile config:',err);
      return null;
    });
  }
  return mapTileConfigPromise;
}
export async function createTileLayer(overrides={}){
  const cfg=await getMapTileConfig();
  if(!cfg||!cfg.url||!cfg.url.includes('http')||cfg.url.includes('{key}')){
    throw new ApiError('Map tile configuration unavailable or missing API key',0);
  }
  return L.tileLayer(cfg.url,{
    attribution:cfg.attribution||'© 1992 - 2026 TomTom',
    subdomains:cfg.subdomains||['a','b','c','d'],
    maxZoom:cfg.maxZoom||22,
    ...overrides
  });
}
