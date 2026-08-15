// NAVORA_AI_CLIENT_V11_4_2
const env=require('../config/env');
const logger=require('../config/logger');

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

async function postOnce(path,body,timeout){
  const r=await fetch(env.aiServiceUrl+path,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(timeout)
  });
  if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
  return r.json();
}

async function getOnce(path,timeout){
  const r=await fetch(env.aiServiceUrl+path,{
    headers:{accept:'application/json'},
    signal:AbortSignal.timeout(timeout)
  });
  if(!r.ok)throw new Error(`AI HTTP ${r.status}`);
  return r.json();
}

function degraded(error){
  return {
    degraded:true,
    mode:'unavailable/degraded',
    validated:false,
    error:String(error?.message||error||'AI unavailable')
  };
}

async function post(path,body,timeout=5000){
  try{
    return await postOnce(path,body,timeout);
  }catch(e){
    logger.warn({event:'ai_degraded',path,message:e.message});
    return degraded(e);
  }
}

async function get(path,timeout=3500){
  try{
    return await getOnce(path,timeout);
  }catch(e){
    logger.warn({event:'ai_info_degraded',path,message:e.message});
    return degraded(e);
  }
}

async function predictRisk(features){
  return post('/api/v1/risk/predict',{features},Number(env.aiRequestTimeoutMs)||8000);
}

async function predictRiskResilient(features){
  const first=await predictRisk(features);
  if(!first?.degraded)return first;

  logger.warn({
    event:'ai_risk_retry_after_degraded',
    firstError:first?.error||'unknown'
  });

  // Render/free-tier AI services may need a cold-start wake-up period.
  // Warm the model-info endpoint with a long timeout, then retry risk once.
  try{
    await getOnce('/model/info',Number(env.aiColdStartTimeoutMs)||45000);
  }catch(e){
    logger.warn({event:'ai_warmup_failed',message:e.message});
  }

  await sleep(350);

  try{
    return await postOnce(
      '/api/v1/risk/predict',
      {features},
      Number(env.aiRetryTimeoutMs)||20000
    );
  }catch(e){
    logger.warn({event:'ai_risk_retry_failed',message:e.message});
    return degraded(e);
  }
}

async function detect(image){
  return post('/api/v1/detect',{image},Number(env.aiRequestTimeoutMs)||8000);
}
async function info(){
  return get('/model/info',Number(env.aiRequestTimeoutMs)||8000);
}

module.exports={
  detect,
  predictRisk,
  predictRiskResilient,
  info,
  post,
  get
};
