(function(){
  'use strict';
  const root=document.documentElement,key='navora-theme',order=['system','light','dark'],label={system:'◐ System',light:'☀ Light',dark:'◒ Dark'};
  if(!document.querySelector('link[data-navora-media-v18]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/css/media-frames-v18.css';link.dataset.navoraMediaV18='true';document.head.appendChild(link);
  }
  if(!document.querySelector('link[data-navora-fixed-sidebar-v21]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/css/fixed-sidebar-v21.css';link.dataset.navoraFixedSidebarV21='true';document.head.appendChild(link);
  }
  const normalize=value=>order.includes(value)?value:'system';
  const media=()=>typeof window.matchMedia==='function'?window.matchMedia('(prefers-color-scheme: dark)'):null;
  function render(value){document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.textContent=label[value];button.setAttribute('aria-label',`Theme is ${value}. Activate to change theme.`);button.setAttribute('title',`Theme: ${value}`)})}
  function apply(value){
    value=normalize(value);const mq=media(),system=mq?.matches?'dark':'light',actual=value==='system'?system:value;
    root.dataset.theme=actual;root.dataset.themeChoice=value;try{localStorage.setItem(key,value)}catch{}render(value);
    window.dispatchEvent(new CustomEvent('navora:theme',{detail:{choice:value,actual}}));
  }
  let saved='system';try{saved=localStorage.getItem(key)||'system'}catch{}
  window.NavoraTheme={apply,get:()=>{try{return normalize(localStorage.getItem(key)||saved)}catch{return saved}}};
  apply(saved);
  document.addEventListener('DOMContentLoaded',()=>render(window.NavoraTheme.get()),{once:true});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-theme-toggle]');if(!button)return;const current=window.NavoraTheme.get();apply(order[(order.indexOf(current)+1)%order.length])});
  media()?.addEventListener?.('change',()=>{if(window.NavoraTheme.get()==='system')apply('system')});

  // Keep the current route/navigation shell without loading legacy V9 enhancement layers.
})();
