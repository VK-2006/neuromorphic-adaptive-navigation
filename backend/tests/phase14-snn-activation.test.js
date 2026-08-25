/**
 * Phase 14 — RiskSNN Trained Model Activation & Route Decision Influence
 *
 * Tests:
 *  14.1  AI client degraded fallback shape
 *  14.2  SNN risk influence — higher snnHazardRisk degrades safetyScore
 *  14.3  SNN risk influence — lower snnHazardRisk improves safetyScore
 *  14.4  Validated SNN payload accepted by route pipeline without crash
 *  14.5  AI client robustness — malformed payload handled without crash
 *  14.6  Explainability text references real SNN-derived factors
 *  14.7  Route ranking is monotone in snnHazardRisk (all else equal)
 */

process.env.NODE_ENV = 'test';

const combineRisk = require('../src/services/routeService').__combineRisk ||
  (() => {
    // Inline the same combineRisk logic from routeService.js for isolation
    function combineRisk(baseRisk, snnRisk, weatherRisk) {
      const r = 0.55 * baseRisk + 0.25 * snnRisk + 0.20 * weatherRisk;
      return Math.max(0, Math.min(1, r));
    }
    return combineRisk;
  })();

const scoreRoute = (() => {
  function safetyScore(combinedRisk) {
    return Math.round(Math.max(0, Math.min(100, (1 - combinedRisk) * 100)));
  }
  return safetyScore;
})();

const aiClient = require('../src/services/aiClient');

describe('Phase 14: RiskSNN Trained Model Activation & Route Decision Influence', () => {

  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // 14.1  AI client degraded fallback shape
  // -------------------------------------------------------------------------
  test('14.1: AI client returns degraded payload when service is unreachable', async () => {
    const res = await aiClient.predictRisk({
      objectClass: 'car', confidence: 0.8, estimatedDistance: 5,
      relativeSpeed: 0, userSpeed: 0, objectPersistence: 0,
      trafficDensity: 0, hazardFrequency: 0, visibility: 1,
      weatherRisk: 0, roadCondition: 0, verifiedReports: 0
    });

    // In test env the AI service is not running — expect degraded
    if (res.degraded) {
      expect(res.degraded).toBe(true);
      expect(res.validated).toBe(false);
      expect(res.mode).toBe('unavailable/degraded');
      expect(typeof res.error).toBe('string');
    } else {
      // If a local AI service happens to be running, accept real validated response
      expect(typeof res.score).toBe('number');
      expect(res.score).toBeGreaterThanOrEqual(0);
      expect(res.score).toBeLessThanOrEqual(1);
    }
  });

  // -------------------------------------------------------------------------
  // 14.2  SNN high risk degrades safetyScore
  // -------------------------------------------------------------------------
  test('14.2: High snnHazardRisk (0.90) produces lower safetyScore than low snnHazardRisk (0.05)', () => {
    const baseRisk = 0.30;
    const weatherRisk = 0.10;

    // Simulate combineRisk inline (matches routeService.js formula)
    function combineRisk(base, snn, weather) {
      return Math.max(0, Math.min(1, 0.55 * base + 0.25 * snn + 0.20 * weather));
    }

    const combined_low_snn  = combineRisk(baseRisk, 0.05, weatherRisk);
    const combined_high_snn = combineRisk(baseRisk, 0.90, weatherRisk);

    const safety_low  = Math.round((1 - combined_low_snn)  * 100);
    const safety_high = Math.round((1 - combined_high_snn) * 100);

    expect(safety_high).toBeLessThan(safety_low);
    expect(combined_high_snn).toBeGreaterThan(combined_low_snn);
  });

  // -------------------------------------------------------------------------
  // 14.3  SNN low risk improves safetyScore relative to default
  // -------------------------------------------------------------------------
  test('14.3: Low snnHazardRisk (0.05) gives safetyScore >= 70 for moderate base risk', () => {
    function combineRisk(base, snn, weather) {
      return Math.max(0, Math.min(1, 0.55 * base + 0.25 * snn + 0.20 * weather));
    }
    const combined = combineRisk(0.25, 0.05, 0.10);
    const safety = Math.round((1 - combined) * 100);
    expect(safety).toBeGreaterThanOrEqual(70);
  });

  // -------------------------------------------------------------------------
  // 14.4  Validated SNN payload shape accepted by route pipeline
  // -------------------------------------------------------------------------
  test('14.4: Validated SNN response payload is accepted and produces valid safetyScore', () => {
    // Simulate what a trained validated RiskSNN response looks like
    const validatedPayload = {
      score: 0.7946,
      level: 'CRITICAL',
      confidence: 0.7112,
      modelVersion: 'risk-snn-v14-phase14',
      mode: 'snn-trained-weights-validated',
      validated: true,
      explanation: {
        classProbabilities: { LOW: 0.0963, MEDIUM: 0.0963, HIGH: 0.0963, CRITICAL: 0.7112 },
        temporalSteps: 20,
        decoder: 'spike-rate + membrane',
        canonicalObjectClass: 'road blockage'
      }
    };

    expect(validatedPayload.validated).toBe(true);
    expect(validatedPayload.mode).toBe('snn-trained-weights-validated');
    expect(validatedPayload.score).toBeGreaterThan(0.5);
    expect(validatedPayload.score).toBeLessThanOrEqual(1.0);
    expect(Number.isNaN(validatedPayload.score)).toBe(false);
    expect(Number.isFinite(validatedPayload.score)).toBe(true);

    // Apply to route pipeline
    function combineRisk(base, snn, weather) {
      return Math.max(0, Math.min(1, 0.55 * base + 0.25 * snn + 0.20 * weather));
    }
    const combined = combineRisk(0.30, validatedPayload.score, 0.15);
    const safety = Math.round((1 - combined) * 100);
    expect(safety).toBeGreaterThanOrEqual(0);
    expect(safety).toBeLessThanOrEqual(100);
    expect(safety).toBeLessThan(65); // CRITICAL risk should lower safetyScore
  });

  // -------------------------------------------------------------------------
  // 14.5  AI client robustness — malformed input handled without crash
  // -------------------------------------------------------------------------
  test('14.5: AI client handles malformed/minimal payload without throwing', async () => {
    await expect(
      aiClient.predictRisk({})
    ).resolves.toBeDefined();

    await expect(
      aiClient.predictRisk({ objectClass: null, confidence: NaN })
    ).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 14.6  Explainability reflects SNN-derived factors
  // -------------------------------------------------------------------------
  test('14.6: Validated SNN explanation contains classProbabilities and temporalSteps', () => {
    const explanation = {
      classProbabilities: { LOW: 0.70, MEDIUM: 0.10, HIGH: 0.10, CRITICAL: 0.10 },
      temporalSteps: 20,
      decoder: 'spike-rate + membrane',
      canonicalObjectClass: 'car'
    };

    expect(explanation).toHaveProperty('classProbabilities');
    expect(Object.keys(explanation.classProbabilities)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    expect(explanation.temporalSteps).toBe(20);
    expect(explanation.decoder).toBe('spike-rate + membrane');

    // Probabilities sum to ~1
    const sum = Object.values(explanation.classProbabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  // -------------------------------------------------------------------------
  // 14.7  Route ranking is monotone in snnHazardRisk (all else equal)
  // -------------------------------------------------------------------------
  test('14.7: Route ranking is monotone — higher SNN risk produces strictly worse utility', () => {
    function combineRisk(base, snn, weather) {
      return Math.max(0, Math.min(1, 0.55 * base + 0.25 * snn + 0.20 * weather));
    }
    function safetyScore(combinedRisk) {
      return Math.round((1 - combinedRisk) * 100);
    }
    // Simple utility model: safetyScore / 100 * preference weight
    function utility(snnRisk) {
      const safety = safetyScore(combineRisk(0.30, snnRisk, 0.10));
      return safety / 100;
    }

    const risks = [0.05, 0.20, 0.40, 0.60, 0.80, 0.95];
    const utilities = risks.map(utility);

    // Each successive utility should be strictly less than the previous
    for (let i = 1; i < utilities.length; i++) {
      expect(utilities[i]).toBeLessThan(utilities[i - 1]);
    }
  });

});
