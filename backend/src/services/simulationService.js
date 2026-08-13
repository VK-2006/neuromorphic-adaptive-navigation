const Journey=require('../models/Journey');
const ai=require('./aiClient');
const hazards=require('./hazardService');

const SCENARIO={
  3:{objectClass:'car',confidence:.88,estimatedDistance:18,relativeSpeed:4,roadCondition:.15,trafficDensity:.45},
  6:{objectClass:'pothole',confidence:.91,estimatedDistance:10,relativeSpeed:0,roadCondition:.82,trafficDensity:.5},
  9:{objectClass:'road blockage',confidence:.97,estimatedDistance:5,relativeSpeed:0,roadCondition:.92,trafficDensity:.85},
};
function status(){return {mode:'SIMULATION MODE',gps:'simulated',traffic:'simulated',detection:'scripted classroom detections',hazard:'deduplicated simulated hazard records',snn:'real AI-service call; explicit development fallback if trained weights unavailable',rerouting:'critical/high scenario can trigger adaptive reroute comparison',journeyCompletion:'route end completes journey and updates CRM/EMA'}}
async function step({userId,journeyId,location,index}){
  const journey=await Journey.findOne({_id:journeyId,userId});if(!journey)throw Object.assign(new Error('Journey not found'),{status:404});if(journey.mode!=='SIMULATION')throw Object.assign(new Error('Simulation step allowed only for SIMULATION journeys'),{status:409});
  const scenario=SCENARIO[Number(index)];if(!scenario)return {event:null};
  const features={objectClass:scenario.objectClass,confidence:scenario.confidence,estimatedDistance:scenario.estimatedDistance,relativeSpeed:scenario.relativeSpeed,userSpeed:Number(location?.speed)||8,objectPersistence:.85,trafficDensity:scenario.trafficDensity,hazardFrequency:.35,visibility:.8,weatherRisk:.1,roadCondition:scenario.roadCondition,verifiedReports:0};
  const risk=await ai.predictRisk(features);const detection={objectClass:scenario.objectClass,confidence:scenario.confidence,boundingBox:[.28,.35,.42,.35],timestamp:Date.now(),approximateDistance:scenario.estimatedDistance,location,journeyId,simulation:true};let hazard=null;
  if(location&&(risk.score??0)>=.35)hazard=await hazards.dedupeAndUpsert({userId,journeyId:journey._id,type:scenario.objectClass,location,confidence:scenario.confidence,snnRiskScore:risk.score||0,snnRiskLevel:risk.level||'LOW',metadata:{source:'simulation',scriptedScenario:true,aiMode:risk.mode}});
  const score=Math.max(0,Math.min(1,Number(risk.score)||0));journey.averageRisk=((journey.averageRisk||0)*(journey.riskSamples||0)+score)/((journey.riskSamples||0)+1);journey.maximumRisk=Math.max(journey.maximumRisk||0,score);journey.riskSamples=(journey.riskSamples||0)+1;if(hazard?.$locals?.wasCreated)journey.hazardCount=(journey.hazardCount||0)+1;journey.decisionEvents.push({type:'SIMULATION_DETECTION',at:new Date(),hazardId:hazard?._id,hazardType:scenario.objectClass,riskScore:score,riskLevel:risk.level,aiMode:risk.mode,scripted:true});await journey.save();
  return {event:{detection,risk,hazardId:hazard?._id||null,simulation:true}};
}
module.exports={status,step};
