(function(){
  'use strict';
  if(window.__navoraLocalDetectionBridge)return;
  window.__navoraLocalDetectionBridge=true;

  const nativeFetch=window.fetch.bind(window);
  let modelPromise=null,frameHistory=[],classState=new Map();
  const DETECT_PATH='/api/v1/hazards/detect',ANALYZE_PATH='/api/v1/hazards/analyze';

  function script(src,test){
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('Detector dependency failed to load')),{once:true});return}
      const s=document.createElement('script');s.src=src;s.crossOrigin='anonymous';s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.head.appendChild(s);
    });
  }

  async function loadModel(){
    if(modelPromise)return modelPromise;
    modelPromise=(async()=>{
      await script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',()=>Boolean(window.tf));
      await script('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',()=>Boolean(window.cocoSsd));
      if(!window.cocoSsd)throw new Error('COCO-SSD is unavailable');
      return window.cocoSsd.load({base:'lite_mobilenet_v2'});
    })().catch(e=>{modelPromise=null;throw e});
    return modelPromise;
  }

  const classMap={
    person:'person',bicycle:'bicycle',car:'car',motorcycle:'motorcycle',bus:'bus',truck:'truck',
    dog:'animal',cat:'animal',horse:'animal',cow:'animal',sheep:'animal',bird:'animal',
    'stop sign':'barrier','traffic light':'traffic control'
  };

  function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,Number(v)||0))}
  function normalizedBox(pred,v){
    const [x,y,w,h]=pred.bbox||[0,0,0,0],vw=Math.max(1,v.videoWidth),vh=Math.max(1,v.videoHeight);
    return [clamp(x/vw),clamp(y/vh),clamp(w/vw),clamp(h/vh)];
  }
  function estimateDistance(box){
    const h=Math.max(.02,box[3]);return Math.max(.8,Math.min(35,1.8/h));
  }
  function visibilityFromVideo(v){
    try{
      const c=document.createElement('canvas');c.width=32;c.height=18;
      const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0,c.width,c.height);
      const d=x.getImageData(0,0,c.width,c.height).data;let sum=0;
      for(let i=0;i<d.length;i+=4)sum+=(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2]);
      const mean=sum/(d.length/4)/255;
      return clamp(mean<.15?mean/.15*.35:mean>.9?.8:Math.min(1,.35+(mean-.15)/.75*.65));
    }catch{return 1}
  }
  function trafficDensity(detections){
    const traffic=new Set(['car','truck','bus','motorcycle','bicycle']);
    const seen=detections.filter(d=>traffic.has(d.objectClass)).length;
    const severity=(document.getElementById('journey-traffic')?.textContent||'').toUpperCase();
    const base={FREE:0.15,LIGHT:0.3,MODERATE:0.55,HEAVY:0.8,SEVERE:1}[severity]??0;
    return clamp(Math.max(base,seen/6));
  }
  function enrich(pred,v,now){
    const objectClass=classMap[pred.class]||pred.class||'unknown',box=normalizedBox(pred,v),area=box[2]*box[3];
    const prev=classState.get(objectClass),dt=prev?Math.max(.15,(now-prev.at)/1000):1;
    const relativeSpeed=prev?Math.max(-20,Math.min(20,(area-prev.area)/dt*80)):0;
    const count=prev&&now-prev.at<2200?prev.count+1:1;
    classState.set(objectClass,{area,at:now,count});
    return {
      objectClass,confidence:clamp(pred.score),boundingBox:box,
      estimatedDistance:estimateDistance(box),relativeSpeed,
      objectPersistence:clamp(count/5),
      localClass:pred.class
    };
  }

  function context(detections,v,requestBody){
    const now=Date.now();frameHistory.push({at:now,count:detections.length});frameHistory=frameHistory.filter(x=>now-x.at<=10000);
    return {
      source:'browser-local-coco-ssd',
      frameTransmitted:false,
      visibility:visibilityFromVideo(v),
      trafficDensity:trafficDensity(detections),
      hazardFrequency:clamp(frameHistory.reduce((s,x)=>s+x.count,0)/30),
      userSpeed:Math.max(0,Number(requestBody?.location?.speed)||0),
      trafficSeverity:(document.getElementById('journey-traffic')?.textContent||'UNKNOWN').toUpperCase()
    };
  }

  async function intercept(url,init={}){
    const requestBody=typeof init.body==='string'?JSON.parse(init.body||'{}'):{};
    const video=document.getElementById('camera-video');
    if(!video?.videoWidth||!video?.videoHeight)throw new Error('Camera video is not ready for local detection.');
    const model=await loadModel();
    const raw=await model.detect(video,12,.35),now=Date.now();
    const detections=raw.map(p=>enrich(p,video,now)).filter(d=>d.confidence>=.35);
    const body={
      journeyId:requestBody.journeyId||null,
      deviceId:requestBody.deviceId||null,
      location:requestBody.location||null,
      detections,
      context:context(detections,video,requestBody)
    };
    const headers=new Headers(init.headers||{});headers.set('content-type','application/json');
    return nativeFetch(ANALYZE_PATH,{
      method:'POST',credentials:init.credentials||'include',headers,body:JSON.stringify(body),signal:init.signal
    });
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?new URL(input,location.origin):new URL(input.url,location.origin);
    if(url.origin===location.origin&&url.pathname===DETECT_PATH){
      try{return await intercept(url,init||{})}
      catch(e){
        return new Response(JSON.stringify({success:false,message:`Browser-local detector unavailable: ${e.message}`}),{
          status:503,headers:{'content-type':'application/json'}
        });
      }
    }
    return nativeFetch(input,init);
  };

  window.NavoraLocalDetection={privacy:'frame-local-only',networkEndpoint:ANALYZE_PATH};
})();
