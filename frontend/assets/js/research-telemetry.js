(function(){
  window.NavoraResearchReady=(async()=>{
    if(!document.getElementById('three-research'))return;
    try{
      const r=await fetch('/api/v1/memory',{credentials:'include',headers:{accept:'application/json'}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const body=await r.json(),memories=Array.isArray(body?.data)?body.data:[];
      const journeys=memories.reduce((s,m)=>s+(Number(m?.journeyCount)||0),0);
      const avg=key=>memories.length?memories.reduce((s,m)=>s+(Number(m?.[key])||0),0)/memories.length:0;
      window.NavoraResearchTelemetry={routeMemories:memories.length,journeys,familiarity:avg('familiarity'),historicalSafety:avg('historicalSafety'),reliability:avg('reliability'),samples:memories.slice(0,12).map(m=>({familiarity:Number(m?.familiarity)||0,safety:Number(m?.historicalSafety)||0,journeys:Number(m?.journeyCount)||0}))};
      window.dispatchEvent(new CustomEvent('navora:research-telemetry',{detail:window.NavoraResearchTelemetry}));
      const el=document.getElementById('research-telemetry-summary');if(el)el.textContent=`${memories.length} route memories · ${journeys} journeys · ${Math.round(avg('familiarity')*100)}% avg familiarity · ${Math.round(avg('historicalSafety')*100)}% historical safety`;
    }catch{
      window.NavoraResearchTelemetry={routeMemories:0,journeys:0,familiarity:0,historicalSafety:0,reliability:0,samples:[]};
      const el=document.getElementById('research-telemetry-summary');if(el)el.textContent='CRM telemetry is temporarily unavailable.';
    }
  })();
})();
