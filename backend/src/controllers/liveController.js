const env=require('../config/env');
const ai=require('../services/aiClient');
const {ok}=require('../utils/response');

exports.readiness=async(req,res)=>{
  const info=await ai.info();
  const routingLive=!['mock','development'].includes(env.routingProvider);
  const trafficLive=env.trafficProvider==='tomtom'&&!!env.trafficApiKey;
  const aiReachable=!info?.degraded;
  const detectorValidated=info?.detector?.validated===true;
  const riskValidated=info?.riskModel?.validated===true;
  const aiSafetyEligible=aiReachable&&detectorValidated&&riskValidated;
  const warnings=[];
  if(!routingLive)warnings.push('Live routing provider is not configured.');
  if(!trafficLive)warnings.push('Live traffic is not configured; ETA will use routing-provider duration.');
  if(!aiReachable)warnings.push('AI service is unavailable. Camera perception will be disabled for safety decisions.');
  else if(!aiSafetyEligible)warnings.push('AI weights are not marked validated; camera detections are research-only and will not trigger automatic live safety decisions.');
  if(env.simulationMode)warnings.push('Server simulation capability is enabled; keep the route simulation toggle OFF for field journeys.');
  ok(res,{
    fieldMode:true,
    routing:{provider:env.routingProvider,live:routingLive},
    traffic:{provider:env.trafficProvider||null,live:trafficLive},
    ai:{reachable:aiReachable,detectorValidated,riskValidated,safetyEligible:aiSafetyEligible,mode:info?.detector?.mode||info?.riskModel?.mode||'unavailable'},
    simulationCapability:env.simulationMode,
    requireValidatedAiForLive:env.liveRequireValidatedAi,
    warnings
  });
};
