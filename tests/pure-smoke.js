const assert=require('node:assert/strict');
const {dtwSimilarity}=require('../backend/src/services/dtw');
const {ema}=require('../backend/src/services/ema');
const {projectToRoute,haversine,bearing,angularDiff}=require('../backend/src/utils/geo');
const {relevantHazards}=require('../backend/src/services/geofenceService');
const {optimize,preferenceFit}=require('../backend/src/services/aco');
const {explain}=require('../backend/src/services/explainabilityService');

const route=[{lat:17.385,lng:78.4867},{lat:17.385,lng:78.4967},{lat:17.395,lng:78.4967}];
const projected=projectToRoute({lat:17.3851,lng:78.4917},route);
assert(projected.distanceFromRoute<20,'segment projection should use the segment, not only vertices');
assert(projected.distanceAlong>300 && projected.distanceAlong<900,'distance along route should be meaningful');
assert(projected.total>1500,'route total should be road-polyline cumulative length');
assert(haversine(route[0],route[1])>1000);
assert(angularDiff(bearing(route[0],route[1]),90)<10,'eastbound route bearing should be near 90°');

const hazards=[
 {_id:'ahead',location:{coordinates:[78.4940,17.385]},trustScore:.9},
 {_id:'behind',location:{coordinates:[78.4880,17.385]},trustScore:.8},
 {_id:'off',location:{coordinates:[78.4940,17.40]},trustScore:.8}
];
const rel=relevantHazards({lat:17.385,lng:78.4917},route,hazards,{corridorMeters:120,maxAheadMeters:1500,heading:90});
assert(rel.some(x=>x.hazard._id==='ahead'),'ahead corridor hazard should be relevant');
assert(!rel.some(x=>x.hazard._id==='behind'),'behind hazard should not alert');
assert(!rel.some(x=>x.hazard._id==='off'),'off-route hazard should not alert');

const a=[{lat:17.38,lng:78.48},{lat:17.39,lng:78.49},{lat:17.40,lng:78.50}];
const b=[{lat:17.3801,lng:78.4801},{lat:17.3901,lng:78.4901},{lat:17.4001,lng:78.5001}];
const c=[{lat:18.1,lng:79.1},{lat:18.2,lng:79.2}];
assert(dtwSimilarity(a,b)>.95,'near-identical routes should be highly similar');
assert(dtwSimilarity(a,c)<.2,'distant routes should be dissimilar');
assert.equal(ema(10,20,.3),13);

const weights={distance:.15,time:.15,traffic:.15,safety:.25,familiarity:.12,history:.10,preference:.08};
const routes=[
 {id:'safe',distance:11000,trafficDuration:1200,trafficDelay:180,safetyScore:96,familiarity:.35,historicalSafety:.9,previousSuccessfulJourneys:2,hazardExposure:.05,trafficSeverity:'MODERATE'},
 {id:'fast',distance:9000,trafficDuration:900,trafficDelay:60,safetyScore:70,familiarity:.45,historicalSafety:.72,previousSuccessfulJourneys:1,hazardExposure:.25,trafficSeverity:'LIGHT'},
 {id:'familiar',distance:10000,trafficDuration:1050,trafficDelay:120,safetyScore:82,familiarity:.95,historicalSafety:.88,previousSuccessfulJourneys:7,hazardExposure:.12,trafficSeverity:'MODERATE'}
];
assert(preferenceFit({...routes[0],nTraffic:.5},{safety:1,traffic:0,familiarity:0})>preferenceFit({...routes[1],nTraffic:.2},{safety:1,traffic:0,familiarity:0}));
const result=optimize(routes,{weights,preferences:{safety:.9,traffic:.4,familiarity:.5},seed:42,ants:25,iterations:30});
assert(result.selected && result.ranked.length===3);
assert(result.ranked.every(r=>Number.isFinite(r.acoScore)&&Number.isFinite(r.finalUtility)));
const why=explain(result.selected,result.ranked);
assert.equal(why.title,'WHY THIS ROUTE?');
assert(why.reasons.some(x=>x.includes('ACO')),'explanation must expose actual ACO reason');
console.log('PURE_SMOKE PASS: DTW, EMA, segment map-match, heading-aware geofence, ACO preference fit, explainability');
