
/* NAVORA Product Experience Repair v10.0 */
(()=>{
  'use strict';
  const d=document, body=d.body;
  if(!body || body.dataset.productRepairV10==='1') return;
  body.dataset.productRepairV10='1';
  const $=(s,c=d)=>c.querySelector(s);
  const $$=(s,c=d)=>[...c.querySelectorAll(s)];
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();

  function routeNetworkBackdrop(){
    const host=$('#three-hero'); if(!host || host.querySelector('.route-network-backdrop')) return;
    const wrap=d.createElement('div');
    wrap.className='route-network-backdrop';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`<svg viewBox="0 0 980 520" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="rnGrid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path class="rn-grid" d="M 36 0 L 0 0 0 36" fill="none" stroke="currentColor" stroke-width=".55"/>
        </pattern>
      </defs>
      <rect width="980" height="520" fill="url(#rnGrid)" opacity=".28"/>
      <path class="rn-route-alt" d="M20 105 C170 160 245 70 380 125 S600 80 760 150 S890 115 970 145"/>
      <path class="rn-route-alt" d="M30 420 C160 350 255 435 395 365 S610 430 760 350 S890 315 960 250"/>
      <path class="rn-route" d="M45 330 C160 250 235 335 345 235 S545 175 650 238 S820 170 930 115"/>
      <circle class="rn-node" cx="45" cy="330" r="6"/><circle class="rn-node" cx="345" cy="235" r="5"/>
      <circle class="rn-node" cx="650" cy="238" r="5"/><circle class="rn-node" cx="930" cy="115" r="7"/>
      <circle class="rn-hazard" cx="245" cy="287" r="15"/><circle class="rn-hazard" cx="548" cy="194" r="13"/>
      <circle class="rn-hazard" cx="770" cy="207" r="14"/><circle class="rn-pulse" cx="0" cy="0" r="6"/>
    </svg>`;
    host.prepend(wrap);
    const badge=d.createElement('div');badge.className='route-network-status';
    badge.textContent=host.querySelector('canvas')?'LIVE 3D + ROUTE GRAPH':'ROUTE GRAPH FALLBACK';
    host.appendChild(badge);
    setTimeout(()=>{if(host.querySelector('canvas'))badge.textContent='LIVE 3D + ROUTE GRAPH'},1000);
  }

  function journeyDock(){
    if(page!=='journey.html') return;
    const pane=$('.camera-pane'); if(!pane) return;
    if(!pane.querySelector('.journey-camera-dock')){
      const dock=d.createElement('div');dock.className='journey-camera-dock';
      [...pane.querySelectorAll(':scope > .camera-controls'),pane.querySelector(':scope > #perception-mode-note')]
        .filter(Boolean).forEach(el=>dock.appendChild(el));
      pane.appendChild(dock);
    }

    const syncNoJourney=()=>{
      const state=$('.navigation-pane .navora-state-panel');
      const noJourney=Boolean(state && /No active journey/i.test(state.textContent||''));
      body.classList.toggle('journey-no-active',noJourney);
      let empty=pane.querySelector('.journey-camera-empty');
      if(noJourney && !empty){
        empty=d.createElement('div');empty.className='journey-camera-empty';
        empty.innerHTML=`<div><span class="chip">Journey setup</span><h2>Plan a route before starting perception</h2>
          <p class="muted">Camera, local detection, GPS tracking and adaptive rerouting are enabled only after a saved journey exists.</p>
          <div class="px-steps"><span>1 · Plan and compare routes</span><span>2 · Select and save a route</span><span>3 · Open Live Journey</span></div>
          <a class="btn-navora" href="map.html" style="margin-top:18px">Plan a route</a></div>`;
        pane.appendChild(empty);
      }
      if(!noJourney) empty?.remove();
      setTimeout(()=>window.dispatchEvent(new Event('resize')),60);
    };
    syncNoJourney();
    const mo=new MutationObserver(syncNoJourney);
    const nav=$('.navigation-pane'); if(nav)mo.observe(nav,{childList:true,subtree:true});
    addEventListener('pagehide',()=>mo.disconnect(),{once:true});
  }

  function dashboardZeroState(){
    if(page!=='dashboard.html')return;
    const empty=$('#trend-empty');
    if(empty) empty.textContent='Complete a journey to build your real historical safety trend. No synthetic chart data is shown.';
  }

  function historyDialogClose(){
    if(page!=='history.html')return;
    const dialog=$('#journey-detail-dialog');
    $('#journey-detail-close')?.addEventListener('click',()=>dialog?.close?.());
    dialog?.addEventListener('click',e=>{
      if(e.target===dialog){
        const r=dialog.getBoundingClientRect();
        if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close?.();
      }
    });
  }

  function init(){routeNetworkBackdrop();journeyDock();dashboardZeroState();historyDialogClose()}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
