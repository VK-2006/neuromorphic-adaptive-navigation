// NAVORA_ROBOFLOW_V11_3
const env=require('../config/env');
const logger=require('../config/logger');

const DEFAULT_BASE='https://serverless.roboflow.com';

function classes(value=env.roboflowClasses){
  if(Array.isArray(value))return value.map(String).map(x=>x.trim()).filter(Boolean);
  return String(value||'').split(/[,\n]+|\s{2,}/).map(x=>x.trim()).filter(Boolean);
}
function workflowUrl(){
  if(env.roboflowWorkflowUrl)return String(env.roboflowWorkflowUrl).replace(/\/+$/,'');
  if(!env.roboflowWorkspace||!env.roboflowWorkflowId)return '';
  return `${DEFAULT_BASE}/${encodeURIComponent(env.roboflowWorkspace)}/workflows/${encodeURIComponent(env.roboflowWorkflowId)}`;
}
function configured(){return Boolean(env.roboflowApiKey&&env.roboflowWorkspace&&env.roboflowWorkflowId&&workflowUrl())}
function status(){return {provider:'roboflow',configured:configured(),workspace:env.roboflowWorkspace||null,workflowId:env.roboflowWorkflowId||null,workflowUrlConfigured:Boolean(workflowUrl()),classes:classes(),imageInput:'image',classesInput:'classes',transport:'serverless-workflow-rest',cloudProcessing:true,liveCameraDefault:'browser-local-coco-ssd',privacyMode:'cloud-opt-in-only'}}
function imagePayload(image){
  if(typeof image!=='string'||!image.trim()){const e=new Error('Roboflow image must be a non-empty URL, base64 string, or data URL');e.status=422;e.expose=true;throw e}
  const value=image.trim();
  if(/^https?:\/\//i.test(value))return {type:'url',value};
  const m=value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);const raw=(m?m[1]:value).replace(/\s+/g,'');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)||raw.length<16){const e=new Error('Roboflow image is not valid base64 or an http(s) URL');e.status=422;e.expose=true;throw e}
  return {type:'base64',value:raw};
}
function collectPredictions(node,out=[],seen=new Set()){
  if(!node||typeof node!=='object'||seen.has(node))return out;seen.add(node);
  if(Array.isArray(node)){for(const item of node)collectPredictions(item,out,seen);return out}
  if(Array.isArray(node.predictions))for(const p of node.predictions){if(!p||typeof p!=='object')continue;const cls=p.class??p.class_name??p.label??p.category;const confidence=Number(p.confidence??p.score??p.class_confidence);if(cls!=null||Number.isFinite(confidence))out.push({objectClass:String(cls??'unknown'),confidence:Number.isFinite(confidence)?Math.max(0,Math.min(1,confidence)):0,x:Number.isFinite(Number(p.x))?Number(p.x):null,y:Number.isFinite(Number(p.y))?Number(p.y):null,width:Number.isFinite(Number(p.width))?Number(p.width):null,height:Number.isFinite(Number(p.height))?Number(p.height):null,detectionId:p.detection_id??p.detectionId??null})}
  for(const value of Object.values(node))collectPredictions(value,out,seen);return out;
}
async function infer({image,classes:requested=env.roboflowClasses}={}){
  if(!configured()){const e=new Error('Roboflow is not fully configured in the backend environment');e.status=503;e.expose=true;throw e}
  const img=imagePayload(image),cls=classes(requested);if(!cls.length){const e=new Error('At least one Roboflow class is required');e.status=422;e.expose=true;throw e}
  let response;try{response=await fetch(workflowUrl(),{method:'POST',headers:{accept:'application/json','content-type':'application/json',authorization:`Bearer ${env.roboflowApiKey}`,'user-agent':'Navora-Academic-Research/1.0'},body:JSON.stringify({inputs:{image:img,classes:cls.join(' ')}}),signal:AbortSignal.timeout(Math.max(3000,Number(env.roboflowTimeoutMs)||15000))})}catch(cause){logger.warn({event:'roboflow_request_failed',message:cause.message});const e=new Error('Roboflow workflow request failed');e.status=503;e.cause=cause;throw e}
  let payload=null;try{payload=await response.json()}catch{}
  if(!response.ok){logger.warn({event:'roboflow_http_error',status:response.status,workflowId:env.roboflowWorkflowId});const e=new Error(`Roboflow workflow returned HTTP ${response.status}`);e.status=502;e.expose=true;throw e}
  return {provider:'roboflow',workspace:env.roboflowWorkspace,workflowId:env.roboflowWorkflowId,classes:cls,detections:collectPredictions(payload),outputs:payload?.outputs??payload,imageTransport:img.type,cloudProcessed:true};
}
module.exports={status,configured,workflowUrl,imagePayload,collectPredictions,infer};
