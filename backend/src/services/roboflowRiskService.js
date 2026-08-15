// NAVORA_ROBOFLOW_SNN_V11_4_2
const env=require('../config/env');
const roboflow=require('./roboflowService');
const ai=require('./aiClient');
const hazards=require('./hazardService');
const Journey=require('../models/Journey');

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const roadHazard=/pothole|road debris|road barrier|traffic cone|fallen tree|construction equipment|road damage/i;

function topDetection(detections=[]){
  return [...(Array.isArray(detections)?detections:[])].sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0]||null;
}

function buildFeatures(detections=[],context={},location={}){
  const top=topDetection(detections);
  const objectClass=String(top?.objectClass||'unknown');
  const providedRoad=Number(context.roadCondition);
  const roadCondition=Number.isFinite(providedRoad)
    ? clamp(providedRoad)
    : (roadHazard.test(objectClass)?0.8:0.2);

  return {
    objectClass,
    confidence:clamp(top?.confidence),
    estimatedDistance:Math.max(0,finite(context.estimatedDistance,10)),
    relativeSpeed:finite(context.relativeSpeed,0),
    userSpeed:Math.max(0,finite(location?.speed??context.userSpeed,0)),
    objectPersistence:clamp(context.objectPersistence??(top?1:0)),
    trafficDensity:clamp(context.trafficDensity),
    hazardFrequency:clamp(context.hazardFrequency),
    visibility:clamp(context.visibility??1),
    weatherRisk:clamp(context.weatherRisk),
    roadCondition,
    verifiedReports:Math.max(0,finite(context.verifiedReports,0))
  };
}

async function analyze({
  userId=null,journeyId=null,deviceId=null,image,classes,location=null,context={},persist=true
}={}){
  let journey=null;
  if(journeyId){
    if(!userId){
      const e=new Error('Authenticated user is required for journey analysis');
      e.status=401;e.expose=true;throw e;
    }
    journey=await Journey.findOne({_id:journeyId,userId});
    if(!journey){
      const e=new Error('Journey unavailable for this user');
      e.status=403;e.expose=true;throw e;
    }
  }

  const inference=await roboflow.infer({image,classes});
  const top=topDetection(inference.detections);
  const features=buildFeatures(inference.detections,context,location||{});

  // This path is intentionally more resilient than the low-latency browser-local path:
  // if the separate AI Render service is asleep, warm it and retry once.
  const risk=await ai.predictRiskResilient(features);

  const detectorValidated=false;
  const riskValidated=risk?.validated===true;
  const safetyEligible=detectorValidated&&riskValidated;
  const canAffectLive=!journey||journey.mode!=='LIVE'||!env.liveRequireValidatedAi||safetyEligible;
  const score=Number(risk?.score);
  let hazard=null;

  if(
    persist&&top&&location&&
    Number.isFinite(Number(location.lat))&&Number.isFinite(Number(location.lng))&&
    Number.isFinite(score)&&score>=0.45&&canAffectLive
  ){
    hazard=await hazards.dedupeAndUpsert({
      userId,journeyId:journey?._id||null,deviceId,
      type:top.objectClass,
      location:{lat:Number(location.lat),lng:Number(location.lng)},
      confidence:top.confidence,
      snnRiskScore:clamp(score),
      snnRiskLevel:risk.level||'LOW',
      metadata:{
        source:'camera',
        detectorProvider:'roboflow',
        detectorMode:'roboflow-cloud-yolo-world',
        validated:false,
        cloudProcessed:true,
        detection:{
          x:top.x,y:top.y,width:top.width,height:top.height,
          confidence:top.confidence,detectionId:top.detectionId
        }
      }
    });
  }

  if(journey&&Number.isFinite(score)&&canAffectLive){
    const s=clamp(score);
    journey.averageRisk=((journey.averageRisk||0)*(journey.riskSamples||0)+s)/((journey.riskSamples||0)+1);
    journey.maximumRisk=Math.max(journey.maximumRisk||0,s);
    journey.riskSamples=(journey.riskSamples||0)+1;
    if(hazard?.$locals?.wasCreated)journey.hazardCount=(journey.hazardCount||0)+1;
    journey.decisionEvents.push({
      type:'ROBOFLOW_SNN_RISK',
      at:new Date(),
      hazardId:hazard?._id||null,
      hazardType:top?.objectClass||'unknown',
      riskScore:s,
      riskLevel:risk.level,
      modelVersion:risk.modelVersion,
      aiMode:risk.mode,
      detector:'roboflow-cloud-yolo-world',
      detectorValidated:false,
      cloudProcessed:true
    });
    await journey.save();
  }

  return {
    inference,
    topDetection:top,
    featuresUsed:features,
    risk,
    aiDegraded:risk?.degraded===true,
    aiError:risk?.error||null,
    hazardId:hazard?._id||null,
    detectorValidated,
    riskValidated,
    safetyEligible,
    canAffectLive,
    researchOnly:!safetyEligible,
    persistenceRequested:Boolean(persist),
    persisted:Boolean(hazard),
    journeyUpdated:Boolean(journey&&Number.isFinite(score)&&canAffectLive)
  };
}

module.exports={topDetection,buildFeatures,analyze};
