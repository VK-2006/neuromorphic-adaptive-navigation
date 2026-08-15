// NAVORA_ROBOFLOW_V11_4
const crypto=require('crypto');
const env=require('../config/env');
const roboflow=require('../services/roboflowService');
const riskService=require('../services/roboflowRiskService');
const {ok}=require('../utils/response');

const PROBE_MESSAGE='navora-roboflow-v11.4';
const PROBE_IMAGE='https://storage.googleapis.com/com-roboflow-marketing/docs/cars-highway.png';
let lastProbeAt=0;

function consent(req,res){
  if(req.body?.consentToCloudProcessing===true)return true;
  res.status(422).json({
    success:false,
    message:'Explicit consentToCloudProcessing=true is required because the image is sent to Roboflow cloud inference.'
  });
  return false;
}

function validProbeSignature(req){
  if(!env.roboflowApiKey)return false;
  const ts=String(req.get('x-navora-probe-timestamp')||'');
  const sig=String(req.get('x-navora-probe-signature')||'').toLowerCase();
  if(!/^\d{10,13}$/.test(ts)||!/^[0-9a-f]{64}$/.test(sig))return false;
  const n=Number(ts);
  const seconds=n>1e12?Math.floor(n/1000):n;
  if(Math.abs(Math.floor(Date.now()/1000)-seconds)>180)return false;
  const expected=crypto.createHmac('sha256',env.roboflowApiKey)
    .update(`${ts}:${PROBE_MESSAGE}`)
    .digest('hex');
  const a=Buffer.from(sig,'hex'),b=Buffer.from(expected,'hex');
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

exports.status=(req,res)=>ok(res,roboflow.status());

exports.infer=async(req,res)=>{
  if(!consent(req,res))return;
  const result=await roboflow.infer({image:req.body?.image,classes:req.body?.classes});
  ok(res,{
    ...result,
    detectorValidated:false,
    safetyEligible:false,
    privacy:{
      cloudProcessed:true,
      provider:'Roboflow',
      rawImageStoredByNavora:false,
      note:'Opt-in endpoint; browser-local COCO-SSD remains the default live detector.'
    }
  });
};

exports.analyze=async(req,res)=>{
  if(!consent(req,res))return;
  const result=await riskService.analyze({
    userId:req.user?._id,
    journeyId:req.body?.journeyId||null,
    deviceId:req.body?.deviceId||null,
    image:req.body?.image,
    classes:req.body?.classes,
    location:req.body?.location||null,
    context:req.body?.context||{},
    persist:req.body?.persist!==false
  });
  if(result.journeyUpdated){
    req.app.get('io')?.to(`journey:${req.body.journeyId}`).emit('snn:risk',{
      score:result.risk?.score,
      riskLevel:result.risk?.level,
      modelVersion:result.risk?.modelVersion,
      mode:result.risk?.mode,
      detector:'roboflow-cloud-yolo-world',
      safetyEligible:result.safetyEligible,
      cloudProcessed:true
    });
  }
  ok(res,{
    ...result,
    privacy:{
      cloudProcessed:true,
      provider:'Roboflow',
      rawImageStoredByNavora:false,
      explicitConsent:true
    }
  });
};

exports.probe=async(req,res)=>{
  if(!consent(req,res))return;
  if(!validProbeSignature(req))return res.status(401).json({success:false,message:'Invalid or expired Roboflow probe signature'});
  if(Date.now()-lastProbeAt<30000)return res.status(429).json({success:false,message:'Roboflow probe cooldown active'});
  lastProbeAt=Date.now();

  const result=await riskService.analyze({
    image:PROBE_IMAGE,
    classes:['car','truck','bus','person'],
    context:{
      estimatedDistance:15,
      relativeSpeed:0,
      userSpeed:0,
      objectPersistence:0.5,
      trafficDensity:0.5,
      hazardFrequency:0,
      visibility:1,
      weatherRisk:0,
      roadCondition:0.2,
      verifiedReports:0
    },
    persist:false
  });

  const snnOk=Number.isFinite(Number(result.risk?.score))&&Boolean(result.risk?.level);
  ok(res,{
    testOnly:true,
    imageSource:'official-roboflow-public-sample',
    providerCallOk:true,
    detectionCount:result.inference?.detections?.length||0,
    topDetection:result.topDetection,
    endpoint:result.inference?.endpoint||null,
    classesTransport:result.inference?.classesTransport||null,
    snnOk,
    risk:result.risk,
    featuresUsed:result.featuresUsed,
    detectorValidated:false,
    riskValidated:result.riskValidated,
    safetyEligible:false,
    persisted:false,
    canAffectLive:false,
    note:'Smoke test only. No hazard or journey data is persisted and no detector validation claim is made.'
  });
};

module.exports.PROBE_MESSAGE=PROBE_MESSAGE;
