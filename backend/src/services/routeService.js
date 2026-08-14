const env = require('../config/env');
const routing = require('./routingProvider');
const traffic = require('./trafficService');
const memory = require('./routeMemoryService');
const hazards = require('./hazardService');
const weather = require('./weatherService');
const { optimize } = require('./aco');
const { explain } = require('./explainabilityService');
const logger = require('../config/logger');

function routeTypes(routes, selectedId) {
  if (!routes.length) return routes;
  const by = (fn, dir = 1) => routes.reduce((a, b) => dir * fn(a) <= dir * fn(b) ? a : b);
  const shortest = by((r) => r.distance);
  const fastest = by((r) => r.trafficDuration);
  const safest = by((r) => -(r.safetyScore || 0));
  const familiar = by((r) => -(r.familiarity || 0));
  return routes.map((r) => ({
    ...r,
    routeTypes: [
      r.id === shortest.id && 'SHORTEST',
      r.id === fastest.id && 'FASTEST',
      r.id === safest.id && 'SAFEST',
      r.id === familiar.id && 'FAMILIAR',
      r.id === selectedId && 'ADAPTIVE',
    ].filter(Boolean),
  }));
}

async function compare({ userId, source, destination, preferences = {}, simulation = false, journeyId = null }) {
  let routes;
  try {
    routes = await routing.getCandidateRoutes(source, destination, { simulation });
  } catch (error) {
    if (!simulation) throw error;
    routes = await routing.getCandidateRoutes(source, destination, { simulation: true });
  }

  routes = await Promise.all(routes.map((route) => traffic.annotate(route, { simulation })));
  routes = await memory.annotate(userId, routes);

  routes = await Promise.all(routes.map(async (route) => {
    const [evidence, weatherEvidence] = await Promise.all([
      hazards.getExposure(route, { journeyId }),
      weather.annotate(route),
    ]);

    const historicalSafety = Number.isFinite(Number(route.historicalSafety))
      ? Number(route.historicalSafety)
      : 0.5;

    const baseRisk = Math.min(
      1,
      0.35 * evidence.exposure +
      0.25 * evidence.snnRisk +
      0.40 * (1 - historicalSafety)
    );

    const weatherWeight = Math.max(0, Math.min(0.35, Number(env.weatherRouteRiskWeight) || 0.15));
    const risk = weatherEvidence.weatherAvailable
      ? Math.min(1, (1 - weatherWeight) * baseRisk + weatherWeight * weatherEvidence.weatherRisk)
      : baseRisk;

    return {
      ...route,
      ...evidence,
      ...weatherEvidence,
      hazardExposure: evidence.exposure,
      snnHazardRisk: evidence.snnRisk,
      risk,
      safetyScore: Math.max(0, 100 * (1 - risk)),
    };
  }));

  const result = optimize(routes, {
    ants: env.acoAnts,
    iterations: env.acoIterations,
    evaporation: env.acoEvaporation,
    weights: env.routeWeights,
    preferences,
  });

  let ranked = result.ranked.map((route) => ({ ...route, explanation: null }));
  ranked = routeTypes(ranked, result.selected.id);
  const selected = ranked.find((route) => route.id === result.selected.id);
  selected.explanation = explain(selected, ranked);

  logger.info({
    event: 'route_intelligence',
    userId: String(userId),
    selectedRouteId: selected.id,
    provider: selected.provider,
    acoScore: selected.acoScore,
    finalUtility: selected.finalUtility,
    safetyScore: selected.safetyScore,
    snnHazardRisk: selected.snnHazardRisk,
    weatherRisk: selected.weatherRisk,
    weatherAvailable: selected.weatherAvailable,
    dtwSimilarity: selected.dtwSimilarity,
    historicalSafety: selected.historicalSafety,
    trafficSeverity: selected.trafficSeverity,
    simulation: Boolean(simulation),
  });

  return {
    routes: ranked,
    recommendedRouteId: selected.id,
    mode: selected.mode,
    optimization: {
      ...result.metadata,
      weather: {
        provider: env.weatherProvider,
        configured: weather.status().configured,
        routeRiskWeight: env.weatherRouteRiskWeight,
        riskMethod: 'deterministic-observation-heuristic-v1',
      },
    },
  };
}

module.exports = { compare };
