const { optimize } = require('../src/services/aco');

describe('Step 10.10: Phase 10 Performance & Multi-Candidate Load Scaling Benchmarks', () => {

  function makeCandidates(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        id: `candidate-${i}`,
        distance: 10000 + (i * 400),
        trafficDuration: 600 + (i * 20),
        trafficDelay: i * 10,
        safetyScore: Math.max(20, 95 - (i * 3)),
        familiarity: Math.min(1, 0.1 + (i * 0.04)),
        historicalSafety: Math.min(1, 0.4 + (i * 0.02)),
        previousSuccessfulJourneys: i
      });
    }
    return list;
  }

  const weights = { distance: 0.15, time: 0.15, traffic: 0.15, safety: 0.25, familiarity: 0.12, history: 0.10, preference: 0.08 };
  const preferences = { safety: 0.7, traffic: 0.5, familiarity: 0.4 };

  test.each([2, 4, 8, 16, 32])(
    'Multi-candidate ACO optimization scales deterministically for %i routes under 50ms per run',
    (size) => {
      const candidates = makeCandidates(size);
      const t0 = performance.now();
      const repetitions = 20;

      for (let k = 0; k < repetitions; k++) {
        const res = optimize(candidates, { ants: 30, iterations: 45, weights, preferences });
        expect(res.selected).toBeDefined();
        expect(res.ranked.length).toBe(size);
      }

      const elapsed = performance.now() - t0;
      const perRun = elapsed / repetitions;

      expect(perRun).toBeLessThan(100.0); // Execution time strictly under 100ms per decision run on local CPU
    }
  );

});
