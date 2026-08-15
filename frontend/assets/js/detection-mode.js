(function(){
  'use strict';
  if(window.__navoraDetectionModeBridge)return;
  window.__navoraDetectionModeBridge=true;

  const delegatedFetch=window.fetch.bind(window);
  const DETECT_PATH='/api/v1/hazards/detect';
  const CLOUD_PATH='/api/v1/roboflow/analyze';
  const STATUS_PATH='/api/v1/roboflow/status';
  const CLOUD_MIN_INTERVAL_MS=2500;

  let cloudConfigured=false;
  let lastCloudAt=0;
  let lastCloudEnvelope=null;

  function mode(){
    return document.getElementById('detection-mode')?.value==='cloud'?'cloud':'local';
  }
  function consented(){
    return document.getElementById('cloud-detection-consent')?.checked===true;
  }
  function setStatus(text,state='info'){
    const el=document.getElementById('detection-mode-status');
    if(!el)return;
    el.textContent=text;
    el.dataset.state=state;
  }
  function setDescription(){
    const el=document.getElementById('perception-mode-description');
    if(!el)return;
    if(mode()==='cloud'){
      el.textContent='Enhanced Cloud mode sends selected compressed camera snapshots to Roboflow only after explicit consent. Roboflow detections are scored by Navora risk AI. This remains research-only until detector and SNN validation pass.';
    }else{
      el.textContent='Private Local is the default: COCO-SSD runs in this browser. Frames stay in browser and metadata only sent to Navora risk scoring.';
    }
  }
  function forceDetectionOff(){
    const button=document.getElementById('detection-toggle');
    if(!button)return;
    button.dataset.enabled='false';
    button.textContent='Detection OFF';
  }
  function envelope(data,status=200){
    return new Response(JSON.stringify(data),{
      status,
      headers:{'content-type':'application/json','x-navora-detection-mode':mode()}
    });
  }
  function requestJson(init){
    if(typeof init?.body!=='string')return {};
    try{return JSON.parse(init.body||'{}')}catch{return {}}
  }
  function trafficDensity(){
    const text=(document.getElementById('journey-traffic')?.textContent||'').trim().toUpperCase();
    return {FREE:.15,LIGHT:.3,MODERATE:.55,HEAVY:.8,SEVERE:1}[text]??0;
  }
  function cloudContext(body){
    return {
      source:'journey-cloud-roboflow',
      cloudProcessed:true,
      userSpeed:Math.max(0,Number(body?.location?.speed)||0),
      trafficDensity:trafficDensity()
    };
  }

  async function cloudAnalyze(init){
    if(!cloudConfigured){
      return envelope({success:false,message:'Roboflow cloud detection is not configured on this deployment.'},503);
    }
    if(!consented()){
      return envelope({success:false,message:'Explicit cloud-processing consent is required before a camera snapshot can be sent to Roboflow.'},422);
    }

    const body=requestJson(init);
    if(typeof body.image!=='string'||!body.image.startsWith('data:image/')){
      return envelope({success:false,message:'Cloud detection requires a compressed camera image snapshot.'},422);
    }

    const now=Date.now();
    if(lastCloudEnvelope&&now-lastCloudAt<CLOUD_MIN_INTERVAL_MS){
      return envelope(lastCloudEnvelope,200);
    }

    const headers=new Headers(init?.headers||{});
    headers.set('content-type','application/json');
    const cloudBody={
      image:body.image,
      journeyId:body.journeyId||null,
      deviceId:body.deviceId||null,
      location:body.location||null,
      context:cloudContext(body),
      persist:true,
      consentToCloudProcessing:true
    };

    const response=await delegatedFetch(CLOUD_PATH,{
      method:'POST',
      credentials:init?.credentials||'include',
      headers,
      body:JSON.stringify(cloudBody),
      signal:init?.signal
    });

    let payload=null;
    try{payload=await response.json()}catch{}
    if(!response.ok){
      return envelope(payload||{success:false,message:`Roboflow cloud request failed (${response.status})`},response.status);
    }

    const data=payload?.data??payload??{};
    const normalized={
      detections:Array.isArray(data?.inference?.detections)?data.inference.detections:[],
      risk:data.risk||null,
      hazardId:data.hazardId||null,
      detectorValidated:data.detectorValidated===true,
      riskValidated:data.riskValidated===true,
      safetyEligible:data.safetyEligible===true,
      canAffectLive:data.canAffectLive===true,
      researchOnly:data.researchOnly!==false,
      cloudProcessed:true,
      detectionMode:'roboflow-cloud-yolo-world',
      privacy:data.privacy||{cloudProcessed:true,provider:'Roboflow',explicitConsent:true}
    };

    lastCloudAt=now;
    lastCloudEnvelope={success:true,data:normalized};
    setStatus('Roboflow cloud inference active · max 1 request / 2.5 s','active');
    return envelope(lastCloudEnvelope,200);
  }

  window.fetch=async function(input,init){
    let url;
    try{
      url=typeof input==='string'?new URL(input,location.origin):new URL(input.url,location.origin);
    }catch{
      return delegatedFetch(input,init);
    }
    if(url.origin===location.origin&&url.pathname===DETECT_PATH&&mode()==='cloud'){
      return cloudAnalyze(init||{});
    }
    return delegatedFetch(input,init);
  };

  async function loadCloudStatus(){
    const select=document.getElementById('detection-mode');
    const cloudOption=select?.querySelector('option[value="cloud"]');
    try{
      const r=await delegatedFetch(STATUS_PATH,{credentials:'include',headers:{accept:'application/json'}});
      const payload=await r.json().catch(()=>null);
      const data=payload?.data??payload??{};
      cloudConfigured=r.ok&&data.configured===true;
      if(cloudOption)cloudOption.disabled=!cloudConfigured;
      if(cloudConfigured){
        setStatus('Roboflow available · cloud mode is opt-in','ready');
      }else{
        if(select)select.value='local';
        setStatus('Roboflow unavailable · Private Local mode only','warning');
      }
    }catch{
      cloudConfigured=false;
      if(cloudOption)cloudOption.disabled=true;
      if(select)select.value='local';
      setStatus('Roboflow status unavailable · Private Local mode only','warning');
    }
    setDescription();
  }

  function bind(){
    const select=document.getElementById('detection-mode');
    const consent=document.getElementById('cloud-detection-consent');
    const toggle=document.getElementById('detection-toggle');

    if(select){
      select.value='local';
      select.addEventListener('change',()=>{
        lastCloudEnvelope=null;
        lastCloudAt=0;
        if(select.value==='cloud'&&!cloudConfigured){
          select.value='local';
          setStatus('Roboflow is not configured; staying in Private Local mode.','warning');
        }else if(select.value==='cloud'){
          forceDetectionOff();
          setStatus(consented()?'Cloud consent active · detection can be enabled':'Cloud mode selected · consent required before detection','warning');
        }else{
          if(consent)consent.checked=false;
          forceDetectionOff();
          setStatus(cloudConfigured?'Private Local mode · Roboflow remains available':'Private Local mode','ready');
        }
        setDescription();
      });
    }

    consent?.addEventListener('change',()=>{
      lastCloudEnvelope=null;
      lastCloudAt=0;
      if(mode()!=='cloud'){
        consent.checked=false;
        setStatus('Select Enhanced Cloud mode before granting cloud-processing consent.','info');
        return;
      }
      forceDetectionOff();
      setStatus(consent.checked?'Cloud consent active · detection can be enabled':'Cloud consent removed · detection disabled',consent.checked?'ready':'warning');
      setDescription();
    });

    toggle?.addEventListener('click',(event)=>{
      if(mode()==='cloud'&&(!cloudConfigured||!consented())){
        event.preventDefault();
        event.stopImmediatePropagation();
        forceDetectionOff();
        setStatus(!cloudConfigured?'Roboflow is unavailable.':'Cloud-processing consent is required before enabling detection.','warning');
      }
    },true);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{bind();loadCloudStatus()},{once:true});
  }else{
    bind();
    loadCloudStatus();
  }

  window.NavoraDetectionMode={
    defaultMode:'local',
    cloudPath:CLOUD_PATH,
    cloudMinIntervalMs:CLOUD_MIN_INTERVAL_MS,
    cloudConfigured:()=>cloudConfigured
  };
})();
