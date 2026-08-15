/* NAVORA Obsidian Intelligence runtime — structure/presentation only. */
(()=>{
  'use strict';
  const d=document;
  const root=d.documentElement;
  const body=d.body;
  if(!body || body.dataset.obsidianReady==='1') return;
  body.dataset.obsidianReady='1';

  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const page=(location.pathname.split('/').pop()||'index.html').replace(/\.html$/i,'')||'index';
  body.dataset.obsidianPage=page;

  const $=(s,c=d)=>c.querySelector(s);
  const $$=(s,c=d)=>[...c.querySelectorAll(s)];
  const make=(tag,cls,attrs={})=>{
    const el=d.createElement(tag);
    if(cls) el.className=cls;
    Object.entries(attrs).forEach(([k,v])=>{
      if(k==='text') el.textContent=v;
      else if(k==='html') el.innerHTML=v;
      else if(v!==undefined&&v!==null) el.setAttribute(k,String(v));
    });
    return el;
  };

  function chrome(){
    const nav=$('.navora-nav');
    if(!nav) return;
    if(!nav.querySelector('.obs-nav-status') && !['login','register','forgot-password','verify-email','verify-otp','reset-password','shared-journey'].includes(page)){
      const badge=make('span','obs-nav-status',{text:'Adaptive network'});
      const theme=nav.querySelector('[data-theme-toggle]');
      nav.insertBefore(badge,theme||null);
    }
    const brand=$('.brand',nav);
    if(brand && !brand.getAttribute('aria-label')) brand.setAttribute('aria-label','Navora home');
  }

  function semanticCards(){
    $$('.card').forEach((card,i)=>{
      if(card.dataset.obsType) return;
      let type='standard';
      if(card.querySelector('.metric,.admin-stat')) type='stat';
      else if(card.querySelector('canvas,.three-shell')) type='visual';
      else if(card.querySelector('form,input,select,textarea')) type='interactive';
      else if(card.querySelector('.danger,[data-danger]')) type='alert';
      card.dataset.obsType=type;
      card.style.setProperty('--obs-order',String(i));
    });
  }

  function sectionKickers(){
    if(page==='dashboard'){
      $$('.page-shell > section').forEach((section,i)=>{
        if(section.previousElementSibling?.classList?.contains('obs-section-kicker')) return;
        const labels=['Live overview','Learning & activity','System intelligence'];
        const kicker=make('div','obs-section-kicker');
        kicker.innerHTML=`<span>${labels[i]||'Navora workspace'}</span><span>0${i+1}</span>`;
        section.before(kicker);
      });
    }
    if(page.startsWith('admin')){
      const head=$('.page-head');
      if(head) head.dataset.obsAdmin='true';
    }
  }

  function mapMobileSheet(){
    if(page!=='map' || $('.obs-map-sheet-toggle')) return;
    const panel=$('.route-panel');
    if(!panel) return;
    panel.id=panel.id||'route-intelligence-panel';
    const btn=make('button','obs-map-sheet-toggle',{
      type:'button',
      'aria-controls':panel.id,
      'aria-expanded':'false',
      'aria-label':'Open route intelligence panel',
      text:'⌃'
    });
    body.append(btn);
    const sync=()=>{
      const open=body.classList.contains('obs-map-sheet-open');
      btn.setAttribute('aria-expanded',String(open));
      btn.setAttribute('aria-label',open?'Collapse route intelligence panel':'Open route intelligence panel');
      btn.textContent=open?'⌄':'⌃';
    };
    btn.addEventListener('click',()=>{body.classList.toggle('obs-map-sheet-open');sync()});
    panel.addEventListener('focusin',()=>{if(matchMedia('(max-width: 820px)').matches){body.classList.add('obs-map-sheet-open');sync()}});
    d.addEventListener('keydown',e=>{
      if(e.key==='Escape' && body.classList.contains('obs-map-sheet-open')){
        body.classList.remove('obs-map-sheet-open');sync();btn.focus();
      }
    });
    sync();
  }

  function routeStates(){
    if(page!=='map') return;
    const list=$('#route-list');
    if(!list) return;
    const sync=()=>{
      $$('.route-card',list).forEach((card,i)=>{
        card.dataset.obsRoute=String(i+1);
        if(!card.hasAttribute('tabindex')) card.tabIndex=0;
        if(!card.getAttribute('role')) card.setAttribute('role','button');
      });
    };
    sync();
    new MutationObserver(sync).observe(list,{childList:true,subtree:true});
  }

  function journeyCockpit(){
    if(page!=='journey') return;
    const layout=$('.journey-layout');
    if(!layout) return;
    layout.setAttribute('aria-label','Live navigation cockpit');
    const camera=$('.camera-pane');
    const navigation=$('.navigation-pane');
    camera?.setAttribute('aria-label','Camera perception and neuromorphic risk view');
    navigation?.setAttribute('aria-label','Map and journey navigation view');
  }

  function authDetails(){
    const form=$('.auth-card');
    if(!form) return;
    $$('input',form).forEach(input=>{
      input.addEventListener('invalid',()=>input.setAttribute('aria-invalid','true'));
      input.addEventListener('input',()=>{if(input.validity.valid)input.removeAttribute('aria-invalid')});
    });
  }

  function themeSync(){
    const meta=$('meta[name="theme-color"]');
    const sync=()=>{
      const dark=root.dataset.theme==='dark';
      if(meta) meta.content=dark?'#090C0B':'#F6F5EF';
      body.dataset.obsTheme=dark?'dark':'light';
    };
    sync();
    window.addEventListener('navora:theme',sync);
  }

  function motion(){
    if(reduce) return;
    const targets=$$('.page-head,.hero,.auth-shell,.map-layout,.journey-layout,.card,.data-row').filter(n=>!n.closest('.leaflet-pane'));
    targets.forEach((el,i)=>el.style.setProperty('--obs-delay',`${Math.min((i%6)*35,175)}ms`));
    if(!('IntersectionObserver' in window)) return;
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){entry.target.classList.add('obs-in');observer.unobserve(entry.target)}
      });
    },{threshold:.04,rootMargin:'60px 0px -20px'});
    targets.forEach(el=>observer.observe(el));
    window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  }

  function accessibility(){
    const main=$('main');
    if(main && !main.id) main.id='main-content';
    if(main && !$('.obs-skip-link')){
      const skip=make('a','sr-only obs-skip-link',{href:'#main-content',text:'Skip to main content'});
      skip.addEventListener('focus',()=>skip.classList.remove('sr-only'));
      skip.addEventListener('blur',()=>skip.classList.add('sr-only'));
      body.prepend(skip);
    }
    $$('button').forEach(btn=>{
      if(!btn.type && !btn.closest('form')) btn.type='button';
    });
  }

  function init(){
    chrome();semanticCards();sectionKickers();mapMobileSheet();routeStates();journeyCockpit();authDetails();themeSync();motion();accessibility();
  }

  if(d.readyState==='loading') d.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
