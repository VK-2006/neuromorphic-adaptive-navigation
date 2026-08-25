const { dtwDistance, dtwSimilarity } = require('../src/services/dtw');
const { ema } = require('../src/services/ema');
const { signature, annotate, updateFromJourney } = require('../src/services/routeMemoryService');

describe('Phase 6: Cognitive Route Memory (CRM), DTW & EMA Verification', () => {

  describe('Step 6.1: Deterministic Route Signatures', () => {
    test('same trajectory generates identical SHA-256 signature', () => {
      const coords = [
        { lat: 17.3850, lng: 78.4867 },
        { lat: 17.4000, lng: 78.4700 },
        { lat: 17.4375, lng: 78.4483 }
      ];
      const sig1 = signature(coords);
      const sig2 = signature(coords);
      expect(sig1).toBe(sig2);
      expect(typeof sig1).toBe('string');
      expect(sig1).toHaveLength(64);
    });

    test('different trajectory generates distinct signature', () => {
      const coordsA = [{ lat: 17.3850, lng: 78.4867 }, { lat: 17.4375, lng: 78.4483 }];
      const coordsB = [{ lat: 28.6139, lng: 77.2090 }, { lat: 28.7041, lng: 77.1025 }];
      expect(signature(coordsA)).not.toBe(signature(coordsB));
    });
  });

  describe('Step 6.2: DTW Mathematical Trajectory Proof', () => {
    const routeA = [
      { lat: 17.3850, lng: 78.4867 },
      { lat: 17.3950, lng: 78.4750 },
      { lat: 17.4050, lng: 78.4650 },
      { lat: 17.4150, lng: 78.4550 },
      { lat: 17.4375, lng: 78.4483 }
    ];

    test('Case A — Identical trajectories have distance 0 and similarity ~1.0', () => {
      const dist = dtwDistance(routeA, routeA);
      const sim = dtwSimilarity(routeA, routeA);
      expect(dist).toBe(0);
      expect(sim).toBeCloseTo(1.0, 4);
    });

    test('Case B — Shifted trajectory (~100m offset) has finite distance and high similarity (>0.90)', () => {
      const routeB = routeA.map(p => ({ lat: p.lat + 0.001, lng: p.lng + 0.001 }));
      const dist = dtwDistance(routeA, routeB);
      const sim = dtwSimilarity(routeA, routeB);
      expect(dist).toBeGreaterThan(0);
      expect(Number.isFinite(dist)).toBe(true);
      expect(sim).toBeGreaterThan(0.90);
      expect(sim).toBeLessThan(1.0);
    });

    test('Case C — Parallel trajectory produces finite non-NaN distance and stable ranking', () => {
      const routeParallel = routeA.map(p => ({ lat: p.lat + 0.005, lng: p.lng }));
      const dist = dtwDistance(routeA, routeParallel);
      const sim = dtwSimilarity(routeA, routeParallel);
      expect(Number.isFinite(dist)).toBe(true);
      expect(Number.isFinite(sim)).toBe(true);
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1.0);
    });

    test('Case D — Intersecting trajectories do not produce false 1.0 similarity', () => {
      const routeCross = [
        { lat: 17.3850, lng: 78.4000 },
        { lat: 17.3950, lng: 78.4750 }, // intersection point
        { lat: 17.4050, lng: 78.5500 }
      ];
      const sim = dtwSimilarity(routeA, routeCross);
      expect(sim).toBeLessThan(0.85);
      expect(sim).toBeGreaterThan(0);
    });

    test('Case E — Reversed trajectory maintains directional distinction', () => {
      const routeReversed = [...routeA].reverse();
      const sim = dtwSimilarity(routeA, routeReversed);
      expect(sim).toBeLessThan(0.99);
    });

    test('Case F — Different length trajectories execute without error', () => {
      const routeSub = routeA.slice(0, 3);
      const dist = dtwDistance(routeA, routeSub);
      const sim = dtwSimilarity(routeA, routeSub);
      expect(Number.isFinite(dist)).toBe(true);
      expect(Number.isFinite(sim)).toBe(true);
    });

    test('Case G — Empty or single-point input returns graceful defaults without throwing', () => {
      expect(dtwDistance([], routeA)).toBe(Infinity);
      expect(dtwSimilarity([], routeA)).toBe(0);
      expect(dtwDistance(routeA, [])).toBe(Infinity);
      expect(dtwSimilarity(routeA, [])).toBe(0);
    });

    test('Case H — Malformed coordinates do not crash DTW', () => {
      const invalidRoute = [{ lat: NaN, lng: undefined }];
      expect(dtwSimilarity(invalidRoute, routeA)).toBeDefined();
    });
  });

  describe('Step 6.3: EMA Convergence & History Update Verification', () => {
    test('Test 1 — First observation initializes value', () => {
      const res = ema(null, 80, 0.3);
      expect(res).toBe(80);
    });

    test('Test 2 — Single step calculation (0.3 * 80 + 0.7 * 100 = 94)', () => {
      const res = ema(100, 80, 0.3);
      expect(res).toBeCloseTo(94.0, 4);
    });

    test('Test 3 — Repeated observations converge monotonically toward observed value', () => {
      let current = 100;
      const alpha = 0.3;
      for (let i = 0; i < 10; i++) {
        current = ema(current, 80, alpha);
      }
      expect(current).toBeLessThan(81.0);
      expect(current).toBeGreaterThanOrEqual(80.0);
    });

    test('Test 4 — Alternating observations remain strictly bounded within [80, 100]', () => {
      let current = 90;
      const alpha = 0.3;
      for (let i = 0; i < 20; i++) {
        const obs = i % 2 === 0 ? 100 : 80;
        current = ema(current, obs, alpha);
        expect(current).toBeGreaterThanOrEqual(80.0);
        expect(current).toBeLessThanOrEqual(100.0);
      }
    });

    test('Test 5 — High volume updates (1,000 runs) execute safely without numerical drift or NaN', () => {
      let current = 50;
      for (let i = 0; i < 1000; i++) {
        current = ema(current, 75, 0.3);
      }
      expect(current).toBeCloseTo(75, 4);
      expect(Number.isFinite(current)).toBe(true);
    });
  });

  describe('Step 6.4: CRM Service Annotation Logic', () => {
    test('annotate returns fallback values when userId is unauthenticated', async () => {
      const routes = [{ coordinates: [{ lat: 10, lng: 10 }], label: 'Route 1' }];
      const annotated = await annotate(null, routes);
      expect(annotated[0].familiarity).toBe(0);
      expect(annotated[0].historicalSafety).toBe(0.5);
      expect(annotated[0].crmMatches).toBe(0);
    });
  });

});
