const env=require('../config/env');
const {ok}=require('../utils/response');

exports.readiness=async(req,res)=>{
  const routingLive=!['mock','development'].includes(env.routingProvider);
  const trafficLive=env.trafficProvider==='tomtom'&&!!env.trafficApiKey;
  const aiReachable=Boolean(env.aiServiceUrl);
  const safetyEligible=aiReachable && !['mock','disabled'].includes(String(env.aiServiceUrl).toLowerCase());
  const warnings=[];
  if(!routingLive)warnings.push('Live routing provider is not configured.');
  if(!trafficLive)warnings.push('Live traffic is not configured; ETA will use routing-provider duration.');
  if(env.simulationMode)warnings.push('Server simulation capability is enabled; keep the route simulation toggle OFF for field journeys.');
  if(!aiReachable)warnings.push('AI safety model is not configured; live journeys remain in research-only mode.');
  ok(res,{ai:{reachable:aiReachable,safetyEligible,validated:safetyEligible},fieldMode:true,routing:{provider:env.routingProvider,live:routingLive},traffic:{provider:env.trafficProvider||null,live:trafficLive},simulationCapability:env.simulationMode,warnings});
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
