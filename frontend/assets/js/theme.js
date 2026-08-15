(function(){
  'use strict';
  const root=document.documentElement;
  const key='navora-theme';
  const order=['system','light','dark'];
  const label={system:'◐ System',light:'☀ Light',dark:'◒ Dark'};
  const normalize=value=>order.includes(value)?value:'system';
  function render(value){
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
      button.textContent=label[value];
      button.setAttribute('aria-label',`Theme is ${value}. Activate to change theme.`);
      button.setAttribute('title',`Theme: ${value}`);
    });
  }
  function apply(value){
    value=normalize(value);
    const system=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    const actual=value==='system'?system:value;
    root.dataset.theme=actual;
    root.dataset.themeChoice=value;
    try{localStorage.setItem(key,value)}catch{}
    render(value);
    window.dispatchEvent(new CustomEvent('navora:theme',{detail:{choice:value,actual}}));
  }
  let saved='system';try{saved=localStorage.getItem(key)||'system'}catch{}
  window.NavoraTheme={apply,get:()=>{try{return normalize(localStorage.getItem(key)||saved)}catch{return saved}}};
  apply(saved);
  document.addEventListener('DOMContentLoaded',()=>render(window.NavoraTheme.get()),{once:true});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-theme-toggle]');if(!button)return;
    const current=window.NavoraTheme.get();apply(order[(order.indexOf(current)+1)%order.length]);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(window.NavoraTheme.get()==='system')apply('system')});
})();
