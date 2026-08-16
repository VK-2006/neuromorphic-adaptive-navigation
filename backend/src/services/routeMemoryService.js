
const RouteMemory=require('../models/RouteMemory');
const logger=require('../config/logger');
const {dtwSimilarity}=require('./dtw');
const {ema}=require('./ema');
const env=require('../config/env');
const crypto=require('crypto');

function signature(coords){
  return crypto.createHash('sha256').update(
    coords.filter((_,i)=>i%Math.max(1,Math.floor(coords.length/20))===0)
      .map(p=>`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  ).digest('hex');
}
async function annotate(userId,routes){
  if(!userId)return routes.map(r=>({...r,familiarity:0,historicalSafety:.5,crmMatches:0,previousSuccessfulJourneys:0}));
  let memories=[];try{memories=await RouteMemory.find({userId}).sort({lastTravelledAt:-1}).limit(50).lean()}catch{}
  return routes.map(r=>{
    let best=0,bestMem=null;
    for(const m of memories){const s=dtwSimilarity(r.coordinates,m.routeCoordinates);if(s>best){best=s;bestMem=m}}
    const learned=bestMem?.familiarity||0;
    return {...r,dtwSimilarity:best,familiarity:Math.min(1,.65*best+.35*learned),
      historicalSafety:bestMem?.historicalSafety??.5,crmMatches:memories.length,
      previousSuccessfulJourneys:bestMem?.successfulJourneyCount||0,routeSignature:signature(r.coordinates)};
  });
}
async function updateFromJourney(journey,route,feedback=.5){
  if(!journey?.userId||!route)return null;
  const sig=route.routeSignature||signature(route.coordinates);
  let m=await RouteMemory.findOne({userId:journey.userId,routeSignature:sig});
  if(!m)m=new RouteMemory({userId:journey.userId,routeSignature:sig,routeCoordinates:route.coordinates,journeyCount:0,successfulJourneyCount:0});
  m.routeCoordinates=route.coordinates||m.routeCoordinates;
  m.routeLabel=route.label||journey.selectedRouteSnapshot?.label||m.routeLabel;
  m.provider=route.provider||journey.selectedRouteSnapshot?.provider||m.provider;
  m.source=journey.source||m.source;m.destination=journey.destination||m.destination;
  m.distance=Number(route.distance)||Number(journey.totalDistance)||m.distance;
  m.lastJourneyId=journey._id;
  m.journeyCount+=1;m.successfulJourneyCount+=journey.success?1:0;
  const elapsedMs=journey.completedAt&&journey.startedAt?Math.max(0,new Date(journey.completedAt)-new Date(journey.startedAt)):null;
  const travelSeconds=elapsedMs==null?null:Math.max(0,(elapsedMs-Math.max(0,Number(journey.totalPausedMs)||0))/1000);
  if(Number.isFinite(travelSeconds))m.travelTime=ema(m.travelTime,travelSeconds,env.emaAlpha);
  m.averageRisk=ema(m.averageRisk,journey.averageRisk||0,env.emaAlpha);
  m.maximumRisk=ema(m.maximumRisk,journey.maximumRisk||0,env.emaAlpha);
  m.rerouteFrequency=ema(m.rerouteFrequency,(journey.reroutes||0)>0?1:0,env.emaAlpha);
  m.historicalSafety=ema(m.historicalSafety,Math.max(0,1-(journey.averageRisk||0)),env.emaAlpha);
  m.hazardFrequency=ema(m.hazardFrequency,journey.hazardCount||0,env.emaAlpha);
  m.reliability=ema(m.reliability,journey.success?1:0,env.emaAlpha);
  m.familiarity=Math.min(1,Math.log1p(m.journeyCount)/3);
  m.userFeedback=ema(m.userFeedback,feedback,env.emaAlpha);
  m.lastTravelledAt=new Date();
  await m.save();
  logger.info({event:'crm_ema_update',userId:String(journey.userId),routeSignature:sig.slice(0,12),
    journeyCount:m.journeyCount,successfulJourneyCount:m.successfulJourneyCount});
  return m;
}
module.exports={annotate,updateFromJourney,signature};
