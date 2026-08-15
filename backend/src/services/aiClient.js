const env=require('../config/env');
const logger=require('../config/logger');
async function post(path,body,timeout=5000){
  try{
    const r=await fetch(env.aiServiceUrl+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
    if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
    return await r.json();
  }catch(e){
    logger.warn({event:'ai_degraded',message:e.message});
    return {degraded:true,mode:'development/heuristic-fallback',error:e.message};
  }
}
async function get(path,timeout=3500){
  try{
    const r=await fetch(env.aiServiceUrl+path,{headers:{accept:'application/json'},signal:AbortSignal.timeout(timeout)});
    if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
    return await r.json();
  }catch(e){
    logger.warn({event:'ai_info_degraded',message:e.message});
    return {degraded:true,error:e.message};
  }
}
async function detect(image){return post('/api/v1/detect',{image})}
async function predictRisk(features){return post('/api/v1/risk/predict',{features})}
async function info(){return get('/model/info')}
module.exports={detect,predictRisk,info};
