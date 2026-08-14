const ai=require('../services/aiClient');
const env=require('../config/env');
const Hazard=require('../models/Hazard');
const Journey=require('../models/Journey');
const {ok}=require('../utils/response');

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

async function verifiedNearby(location){
  const lat=finite(location?.lat,NaN),lng=finite(location?.lng,NaN);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return 0;
  try{
    return await Hazard.countDocuments({
      status:'VERIFIED',expiresAt:{$gt:new Date()},
      location:{$near:{$geometry:{type:'Point',coordinates:[lng,lat]},$maxDistance:1200}}
    });
  }catch{return 0}
}

exports.analyze=async(req,res)=>{
  let journey=null;
  if(req.body.journeyId){
    journey=await Journey.findOne({_id:req.body.journeyId,userId:req.user._id});
    if(!journey)return res.status(403).json({success:false,message:'Journey unavailable for this user'});
  }
  const detections=(Array.isArray(req.body.detections)?req.body.detections:[])
    .map(d=>({
      objectClass:String(d?.objectClass||'unknown').slice(0,80),
      confidence:clamp(d?.confidence),
      boundingBox:Array.isArray(d?.boundingBox)?d.boundingBox.slice(0,4).map(x=>clamp(x)):undefined,
      approximateDistance:Math.max(0,finite(d?.estimatedDistance,10)),
      relativeSpeed:finite(d?.relativeSpeed,0),
      objectPersistence:clamp(d?.objectPersistence)
    }))
    .sort((a,b)=>b.confidence-a.confidence);
  const top=detections[0],ctx=req.body.context||{},verifiedReports=await verifiedNearby(req.body.location);
  const features={
    objectClass:top?.objectClass||'unknown',
    confidence:top?.confidence||0,
    estimatedDistance:top?.approximateDistance||10,
    relativeSpeed:top?.relativeSpeed||0,
    userSpeed:Math.max(0,finite(req.body.location?.speed??ctx.userSpeed,0)),
    objectPersistence:top?.objectPersistence||0,
    trafficDensity:clamp(ctx.trafficDensity),
    hazardFrequency:clamp(ctx.hazardFrequency),
    visibility:clamp(ctx.visibility??1),
    weatherRisk:clamp(ctx.weatherRisk),
    roadCondition:clamp(ctx.roadCondition),
    verifiedReports
  };
  const risk=await ai.predictRisk(features);
  const detectorValidated=false; // COCO-SSD browser detector is useful research metadata, not a validated Navora safety detector.
  const riskValidated=risk?.validated===true;
  const safetyEligible=detectorValidated&&riskValidated;
  const canAffectLive=journey?.mode!=='LIVE'||!env.liveRequireValidatedAi||safetyEligible;

  if(journey&&Number.isFinite(Number(risk?.score))&&canAffectLive){
    const score=clamp(risk.score);
    journey.averageRisk=((journey.averageRisk||0)*(journey.riskSamples||0)+score)/((journey.riskSamples||0)+1);
    journey.maximumRisk=Math.max(journey.maximumRisk||0,score);
    journey.riskSamples=(journey.riskSamples||0)+1;
    journey.decisionEvents.push({
      type:'LOCAL_METADATA_RISK',at:new Date(),hazardType:top?.objectClass||'unknown',
      riskScore:score,riskLevel:risk.level,modelVersion:risk.modelVersion,
      aiMode:risk.mode,frameTransmitted:false,detector:'browser-local-coco-ssd'
    });
    await journey.save();
    req.app.get('io')?.to(`journey:${journey._id}`).emit('snn:risk',{
      score,riskLevel:risk.level,modelVersion:risk.modelVersion,mode:risk.mode,
      safetyEligible,frameTransmitted:false
    });
  }

  ok(res,{
    detections,
    risk,
    hazardId:null,
    aiMode:risk?.mode||'unknown',
    detectorValidated,
    riskValidated,
    safetyEligible,
    featuresUsed:features,
    privacy:{frameTransmitted:false,detectorLocation:'browser',detector:'coco-ssd',networkPayload:'metadata-only'}
  });
};
