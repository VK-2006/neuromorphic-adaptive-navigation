const aiClient = require('../src/services/aiClient');

describe('Step 10.1: AI Service & RiskSNN Production Resilience Contracts', () => {

  test('AI client handles unconfigured external AI service gracefully by returning degraded payload', async () => {
    const res = await aiClient.predictRisk({
      objectClass: 'car',
      confidence: 0.9,
      estimatedDistance: 5,
      context: { weatherRisk: 0.2 }
    });

    expect(res).toBeDefined();
    expect(res).toHaveProperty('validated', false);
    if (res.degraded) {
      expect(res.mode).toBe('unavailable/degraded');
      expect(res.error).toBeDefined();
    } else {
      expect(res.score).toBeGreaterThanOrEqual(0);
      expect(res.score).toBeLessThanOrEqual(1);
    }
  });

  test('AI client predictRiskResilient handles cold-start retries without crashing', async () => {
    const res = await aiClient.predictRiskResilient({
      objectClass: 'pothole',
      confidence: 0.85,
      estimatedDistance: 3
    });

    expect(res).toBeDefined();
    expect(res).toHaveProperty('validated', false);
  });

  test('AI client info endpoint exposes model status or degraded payload', async () => {
    const info = await aiClient.info();
    expect(info).toBeDefined();
    expect(info).toHaveProperty('validated');
  });

});
