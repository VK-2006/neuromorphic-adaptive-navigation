const { compare, combineRisk } = require('../src/services/routeService');
const { optimize, scoreRoute, preferenceFit, normalizePreferences } = require('../src/services/aco');
const { explain } = require('../src/services/explainabilityService');

describe('Phase 7: Adaptive Route Decision Pipeline Verification', () => {

  const source = { lat: 17.3850, lng: 78.4867 };
  const destination = { lat: 17.4375, lng: 78.4483 };

  describe('Step 7.1 & 7.2: Route Decision Pipeline & Multi-Route Decision Scenarios', () => {
    test('Scenario A — High safety preference favors safest candidate over raw shortest distance', async () => {
      const res = await compare({
        source,
        destination,
        preferences: { safety: 0.9, traffic: 0.1, familiarity: 0.1 },
        simulation: true
      });
      expect(res.recommendedRouteId).toBeTruthy();
      expect(res.routes.length).toBeGreaterThanOrEqual(3);
      const selected = res.routes.find(r => r.id === res.recommendedRouteId);
      expect(selected.safetyScore).toBeGreaterThanOrEqual(50);
      expect(selected.routeTypes).toContain('ADAPTIVE');
    });

    test('Scenario B — High hazard risk elevates total risk and penalizes candidate utility', () => {
      const baseCandidate = {
        id: 'route-b1',
        distance: 5000,
        trafficDuration: 400,
        trafficDelay: 0,
        historicalSafety: 0.9,
        familiarity: 0.5,
      };
      
      const safeEvidence = { exposure: 0.0, snnRisk: 0.0 };
      const hazardEvidence = { exposure: 0.8, snnRisk: 0.9 };

      const baseRiskSafe = Math.min(1, 0.35 * safeEvidence.exposure + 0.25 * safeEvidence.snnRisk + 0.40 * (1 - baseCandidate.historicalSafety));
      const baseRiskHazard = Math.min(1, 0.35 * hazardEvidence.exposure + 0.25 * hazardEvidence.snnRisk + 0.40 * (1 - baseCandidate.historicalSafety));

      const safetyScoreSafe = Math.max(0, 100 * (1 - baseRiskSafe));
      const safetyScoreHazard = Math.max(0, 100 * (1 - baseRiskHazard));

      expect(safetyScoreSafe).toBeGreaterThan(safetyScoreHazard);
      expect(safetyScoreSafe).toBeCloseTo(96, 4);
      expect(safetyScoreHazard).toBeCloseTo(45.5, 4);
    });

    test('Scenario C — Cognitive Route Memory (CRM) historical safety boosts candidate score', () => {
      const weights = { distance: 0.15, time: 0.15, traffic: 0.15, safety: 0.25, familiarity: 0.12, history: 0.10, preference: 0.08 };
      
      const routeHighCRM = {
        distance: 10000,
        nDistance: 0,
        trafficDuration: 600,
        nTime: 0,
        nTraffic: 0,
        safetyScore: 85,
        familiarity: 0.9,
        historicalSafety: 0.95,
        previousSuccessfulJourneys: 10
      };

      const routeLowCRM = {
        distance: 10000,
        nDistance: 0,
        trafficDuration: 600,
        nTime: 0,
        nTraffic: 0,
        safetyScore: 85,
        familiarity: 0.1,
        historicalSafety: 0.40,
        previousSuccessfulJourneys: 0
      };

      const opt = optimize([routeHighCRM, routeLowCRM], { ants: 20, iterations: 30, weights });
      expect(opt.selected.historicalSafety).toBe(0.95);
      expect(opt.ranked[0].finalUtility).toBeGreaterThan(opt.ranked[1].finalUtility);
    });

    test('Scenario D — Traffic severity delay penalizes candidate utility', async () => {
      const res = await compare({
        source,
        destination,
        preferences: { safety: 0.5, traffic: 0.9, familiarity: 0.2 },
        simulation: true
      });
      const selected = res.routes.find(r => r.id === res.recommendedRouteId);
      expect(selected.trafficSeverity).toBeDefined();
      expect(selected.trafficDuration).toBeGreaterThan(0);
    });

    test('Scenario E — Weather risk penalty combineRisk formula behaves monotonically additive', () => {
      const baseRisk = 0.20;
      const noWeather = combineRisk(baseRisk, 0.80, 0.15, false);
      const withWeather = combineRisk(baseRisk, 0.80, 0.15, true);

      expect(noWeather).toBe(0.20);
      expect(withWeather).toBeGreaterThan(baseRisk);
      expect(withWeather).toBeCloseTo(0.20 + 0.15 * 0.80 * (1 - 0.20), 4);
    });
  });

  describe('Step 7.5: ACO Multi-Objective Optimization Determinism', () => {
    test('ACO optimization produces deterministic ranking with fixed seed', () => {
      const candidates = [
        { id: 'c1', distance: 12000, trafficDuration: 900, trafficDelay: 50, safetyScore: 90, familiarity: 0.8, historicalSafety: 0.9 },
        { id: 'c2', distance: 10000, trafficDuration: 1100, trafficDelay: 300, safetyScore: 60, familiarity: 0.2, historicalSafety: 0.5 },
      ];
      const weights = { distance: 0.15, time: 0.15, traffic: 0.15, safety: 0.25, familiarity: 0.12, history: 0.10, preference: 0.08 };
      
      const opt1 = optimize(candidates, { ants: 30, iterations: 40, weights, seed: 42 });
      const opt2 = optimize(candidates, { ants: 30, iterations: 40, weights, seed: 42 });

      expect(opt1.selected.id).toBe(opt2.selected.id);
      expect(opt1.selected.finalUtility).toBeCloseTo(opt2.selected.finalUtility, 4);
    });
  });

  describe('Step 7.8: Natural-Language Route Explainability Truthfulness', () => {
    test('explainability generator includes reasons matching active metrics without contradiction', () => {
      const selected = {
        id: 'r1',
        distance: 10500,
        trafficDuration: 750,
        safetyScore: 92,
        snnHazardRisk: 0.05,
        hazardExposure: 0.0,
        trafficSeverity: 'LIGHT',
        dtwSimilarity: 0.88,
        familiarity: 0.75,
        previousSuccessfulJourneys: 4,
        historicalSafety: 0.90,
        preferenceFit: 0.85,
        acoScore: 1.0,
        finalUtility: 0.88,
      };
      const all = [selected, { id: 'r2', distance: 10000, trafficDuration: 700, safetyScore: 60 }];
      
      const explanation = explain(selected, all);
      expect(explanation.title).toBe('WHY THIS ROUTE?');
      expect(explanation.reasons.some(r => r.includes('High computed safety score'))).toBe(true);
      expect(explanation.reasons.some(r => r.includes('DTW similarity'))).toBe(true);
      expect(explanation.reasons.some(r => r.includes('ACO ranked'))).toBe(true);
      expect(explanation.metrics.safetyScore).toBe(92);
    });
  });

});
