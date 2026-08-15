function n(v,d=0){return Number.isFinite(Number(v))?Number(v):d}
function explain(selected,all){
  const reasons=[];const shortest=Math.min(...all.map(r=>n(r.distance,Infinity))),fastest=Math.min(...all.map(r=>n(r.trafficDuration,Infinity)));
  if(n(selected.safetyScore)>=85)reasons.push(`High computed safety score (${Math.round(selected.safetyScore)}%)`);
  if(n(selected.snnHazardRisk)<.25)reasons.push(`Low aggregated SNN hazard risk (${Math.round(n(selected.snnHazardRisk)*100)}%) on the evaluated route corridor`);
  if(n(selected.hazardExposure)<.25)reasons.push(`Lower verified/community hazard exposure (${Math.round(n(selected.hazardExposure)*100)}%)`);
  if(['FREE_FLOW','LIGHT','MODERATE'].includes(selected.trafficSeverity))reasons.push(`${selected.trafficSeverity.toLowerCase().replace('_',' ')} traffic rather than a more congested alternative`);
  if(n(selected.dtwSimilarity)>=.6)reasons.push(`DTW similarity indicates ${Math.round(n(selected.dtwSimilarity)*100)}% similarity to a learned route`);
  if(n(selected.familiarity)>=.6)reasons.push(`High route familiarity (${Math.round(n(selected.familiarity)*100)}%) from Cognitive Route Memory`);
  if(n(selected.previousSuccessfulJourneys)>0)reasons.push(`${Math.round(n(selected.previousSuccessfulJourneys))} previous successful journey(s) contribute to route history`);
  if(n(selected.historicalSafety)>=.75)reasons.push(`Strong EMA historical safety (${Math.round(n(selected.historicalSafety)*100)}%)`);
  if(n(selected.preferenceFit)>=.7)reasons.push(`Good fit to the user's current safety/traffic/familiarity preferences (${Math.round(n(selected.preferenceFit)*100)}%)`);
  if(n(selected.distance)>shortest*1.03&&n(selected.safetyScore)>=80)reasons.push('Slightly longer route accepted for a meaningful safety/reliability advantage');
  if(n(selected.trafficDuration)<=fastest*1.08)reasons.push('Traffic-adjusted ETA remains competitive');
  reasons.push(`ACO ranked this route highest with score ${n(selected.acoScore).toFixed(2)}`);
  return {title:'WHY THIS ROUTE?',reasons,metrics:{safetyScore:n(selected.safetyScore),snnHazardRisk:n(selected.snnHazardRisk),hazardExposure:n(selected.hazardExposure),verifiedHazardCount:n(selected.verifiedHazardCount),dtwSimilarity:n(selected.dtwSimilarity),familiarity:n(selected.familiarity),previousSuccessfulJourneys:n(selected.previousSuccessfulJourneys),historicalSafety:n(selected.historicalSafety),trafficDelay:n(selected.trafficDelay),trafficSeverity:selected.trafficSeverity||'UNKNOWN',preferenceFit:n(selected.preferenceFit),acoScore:n(selected.acoScore),finalUtility:n(selected.finalUtility)}}
}
module.exports={explain};
