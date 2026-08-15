// NAVORA_ROBOFLOW_V11_4
const env=require('../config/env');
const logger=require('../config/logger');

const DEFAULT_BASE='https://serverless.roboflow.com';
const NAVORA_DEFAULT_CLASSES=[
  'person','car','bus','truck','motorcycle','bicycle','pothole','road debris',
  'road barrier','traffic cone','fallen tree','animal','construction equipment'
];

function classes(value=env.roboflowClasses){
  if(Array.isArray(value))return [...new Set(value.map(String).map(x=>x.trim()).filter(Boolean))];
  const raw=String(value||'').trim();
  if(!raw)return [];
  if(/[,;\n]/.test(raw)){
    return [...new Set(raw.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean))];
  }
  const normalized=raw.toLowerCase().replace(/\s+/g,' ').trim();
  if(normalized===NAVORA_DEFAULT_CLASSES.join(' '))return [...NAVORA_DEFAULT_CLASSES];
  // A single whitespace-delimited string is ambiguous when class names contain spaces.
  // Preserve it as one parameter instead of silently inventing boundaries.
  return [raw];
}

function configuredUrl(){
  return env.roboflowWorkflowUrl?String(env.roboflowWorkflowUrl).replace(/\/+$/,''):'';
}

function endpointCandidates(){
  if(!env.roboflowWorkspace||!env.roboflowWorkflowId)return configuredUrl()?[configuredUrl()]:[];
  const ws=encodeURIComponent(env.roboflowWorkspace);
  const id=encodeURIComponent(env.roboflowWorkflowId);
  return [...new Set([
    configuredUrl(),
    `${DEFAULT_BASE}/${ws}/workflows/${id}`,
    `${DEFAULT_BASE}/infer/workflows/${ws}/${id}`
  ].filter(Boolean))];
}

function configured(){
  return Boolean(env.roboflowApiKey&&env.roboflowWorkspace&&env.roboflowWorkflowId&&endpointCandidates().length);
}

function status(){
  const cls=classes();
  return {
    provider:'roboflow',
    configured:configured(),
    workspace:env.roboflowWorkspace||null,
    workflowId:env.roboflowWorkflowId||null,
    endpointCount:endpointCandidates().length,
    classes:cls,
    classCount:cls.length,
    classDelimiterWarning:cls.length===1&&/\s/.test(cls[0]||''),
    imageInput:'image',
    classesInput:'classes',
    transport:'serverless-workflow-rest',
    cloudProcessing:true,
    liveCameraDefault:'browser-local-coco-ssd',
    privacyMode:'cloud-opt-in-only',
    detectorValidated:false,
    validationNote:'Roboflow/YOLO-World integration is research-only until held-out detector validation is completed.'
  };
}

function imagePayload(image){
  if(typeof image!=='string'||!image.trim()){
    const e=new Error('Roboflow image must be a non-empty URL, base64 string, or data URL');
    e.status=422;e.expose=true;throw e;
  }
  const value=image.trim();
  if(/^https?:\/\//i.test(value))return {type:'url',value};
  const m=value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);
  const raw=(m?m[1]:value).replace(/\s+/g,'');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)||raw.length<16){
    const e=new Error('Roboflow image is not valid base64 or an http(s) URL');
    e.status=422;e.expose=true;throw e;
  }
  return {type:'base64',value:raw};
}

function collectPredictions(node,out=[],seen=new Set()){
  if(!node||typeof node!=='object'||seen.has(node))return out;
  seen.add(node);
  if(Array.isArray(node)){
    for(const item of node)collectPredictions(item,out,seen);
    return out;
  }
  if(Array.isArray(node.predictions)){
    for(const p of node.predictions){
      if(!p||typeof p!=='object')continue;
      const cls=p.class??p.class_name??p.label??p.category;
      const confidence=Number(p.confidence??p.score??p.class_confidence);
      if(cls!=null||Number.isFinite(confidence)){
        out.push({
          objectClass:String(cls??'unknown'),
          confidence:Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence)):0,
          x:Number.isFinite(Number(p.x))?Number(p.x):null,
          y:Number.isFinite(Number(p.y))?Number(p.y):null,
          width:Number.isFinite(Number(p.width))?Number(p.width):null,
          height:Number.isFinite(Number(p.height))?Number(p.height):null,
          detectionId:p.detection_id??p.detectionId??null
        });
      }
    }
  }
  for(const value of Object.values(node))collectPredictions(value,out,seen);
  return out;
}

async function readJson(response){
  try{return await response.json()}catch{return null}
}

async function callEndpoint(url,img,cls,classesAsArray=true){
  const body={
    api_key:env.roboflowApiKey,
    inputs:{
      image:img,
      classes:classesAsArray?cls:cls.join(', ')
    }
  };
  const response=await fetch(url,{
    method:'POST',
    headers:{
      accept:'application/json',
      'content-type':'application/json',
      authorization:`Bearer ${env.roboflowApiKey}`,
      'user-agent':'Navora-Academic-Research/1.0'
    },
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(Math.max(5000,Number(env.roboflowTimeoutMs)||25000))
  });
  return {response,payload:await readJson(response),classesAsArray};
}

async function infer({image,classes:requested=env.roboflowClasses}={}){
  if(!configured()){
    const e=new Error('Roboflow is not fully configured in the backend environment');
    e.status=503;e.expose=true;throw e;
  }
  const img=imagePayload(image);
  const cls=classes(requested);
  if(!cls.length){
    const e=new Error('At least one Roboflow class is required');
    e.status=422;e.expose=true;throw e;
  }

  const endpoints=endpointCandidates();
  let last=null;
  for(const url of endpoints){
    for(const asArray of [true,false]){
      try{
        const attempt=await callEndpoint(url,img,cls,asArray);
        last={...attempt,url};
        if(attempt.response.ok){
          const detections=collectPredictions(attempt.payload);
          return {
            provider:'roboflow',
            workspace:env.roboflowWorkspace,
            workflowId:env.roboflowWorkflowId,
            endpoint:url,
            classes:cls,
            classesTransport:asArray?'array':'comma-separated-string',
            detections,
            outputs:attempt.payload?.outputs??attempt.payload,
            imageTransport:img.type,
            cloudProcessed:true
          };
        }
        // 400/404/405/422 can indicate endpoint or workflow-input-shape differences.
        // Try the compatible endpoint/payload variants without exposing provider body/secrets.
        if(![400,404,405,422].includes(attempt.response.status))break;
      }catch(cause){
        last={cause,url};
        logger.warn({event:'roboflow_request_attempt_failed',message:cause.message,workflowId:env.roboflowWorkflowId});
        break;
      }
    }
  }

  if(last?.cause){
    const e=new Error('Roboflow workflow request failed');
    e.status=503;e.expose=true;e.cause=last.cause;throw e;
  }
  const statusCode=last?.response?.status||502;
  logger.warn({event:'roboflow_http_error',status:statusCode,workflowId:env.roboflowWorkflowId});
  const e=new Error(`Roboflow workflow returned HTTP ${statusCode}`);
  e.status=502;e.expose=true;throw e;
}

module.exports={
  NAVORA_DEFAULT_CLASSES,
  classes,
  endpointCandidates,
  status,
  configured,
  imagePayload,
  collectPredictions,
  infer
};
