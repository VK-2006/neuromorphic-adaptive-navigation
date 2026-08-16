const env=require('../config/env');
const ai=require('../services/aiClient');
const {ok}=require('../utils/response');

exports.readiness=async(req,res)=>{
  const info=await ai.info();
  const routingLive=!['mock','development'].includes(env.routingProvider);
  const trafficLive=env.trafficProvider==='tomtom'&&!!env.trafficApiKey;
  const aiReachable=!info?.degraded;
  const detectorFunctional=info?.detector?.functional!==false;
  const detectorIntegrityReady=info?.detector?.integrityReady===true;
  const detectorValidated=false; // legacy compatibility only; detector science is out of current scope.
  const riskValidated=info?.riskModel?.validated===true;
  const aiSafetyEligible=aiReachable&&riskValidated;
  const warnings=[];
  if(!routingLive)warnings.push('Live routing provider is not configured.');
  if(!trafficLive)warnings.push('Live traffic is not configured; ETA will use routing-provider duration.');
  if(!aiReachable)warnings.push('AI service is unavailable. Camera-derived risk processing will be degraded.');
  else if(!riskValidated)warnings.push('SNN weights are not marked validated; live automatic safety decisions remain restricted by the SNN gate.');
  if(!detectorIntegrityReady)warnings.push('AI detector.pt is not active; detector fallback/browser perception may still provide functional detection metadata.');
  if(env.simulationMode)warnings.push('Server simulation capability is enabled; keep the route simulation toggle OFF for field journeys.');
  ok(res,{
    fieldMode:true,
    routing:{provider:env.routingProvider,live:routingLive},
    traffic:{provider:env.trafficProvider||null,live:trafficLive},
    ai:{
      reachable:aiReachable,
      detectorValidated,
      detectorFunctional,
      detectorIntegrityReady,
      detectorScientificValidationRequired:false,
      riskValidated,
      safetyEligible:aiSafetyEligible,
      mode:info?.detector?.mode||info?.riskModel?.mode||'unavailable'
    },
    simulationCapability:env.simulationMode,
    requireValidatedAiForLive:env.liveRequireValidatedAi,
    warnings
  });
};

exports.webrtcConfig=async(req,res)=>{
  const iceServers=[
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'}
  ];
  const turnConfigured=!!(env.webrtcTurnUrl&&env.webrtcTurnUsername&&env.webrtcTurnCredential);
  if(turnConfigured)iceServers.push({urls:env.webrtcTurnUrl,username:env.webrtcTurnUsername,credential:env.webrtcTurnCredential});
  ok(res,{iceServers,turnConfigured,note:turnConfigured?'TURN relay configured for restrictive NAT/firewalls.':'STUN fallback active. Configure WEBRTC_TURN_URL/USERNAME/CREDENTIAL for reliable cross-network relay.'});
};
