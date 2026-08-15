const env=require('../src/config/env');
const ai=require('../src/services/aiClient');

describe('AI client cold-start resilience',()=>{
  const old={
    url:env.aiServiceUrl,
    request:env.aiRequestTimeoutMs,
    cold:env.aiColdStartTimeoutMs,
    retry:env.aiRetryTimeoutMs,
    fetch:global.fetch
  };

  beforeEach(()=>{
    env.aiServiceUrl='https://ai.example.test';
    env.aiRequestTimeoutMs=8000;
    env.aiColdStartTimeoutMs=45000;
    env.aiRetryTimeoutMs=20000;
  });

  afterEach(()=>{global.fetch=old.fetch});

  afterAll(()=>{
    env.aiServiceUrl=old.url;
    env.aiRequestTimeoutMs=old.request;
    env.aiColdStartTimeoutMs=old.cold;
    env.aiRetryTimeoutMs=old.retry;
    global.fetch=old.fetch;
  });

  test('warms model-info and retries risk after first transport failure',async()=>{
    global.fetch=jest.fn()
      .mockRejectedValueOnce(new Error('cold start timeout'))
      .mockResolvedValueOnce({
        ok:true,status:200,
        json:async()=>({riskModel:{mode:'development/heuristic-fallback'}})
      })
      .mockResolvedValueOnce({
        ok:true,status:200,
        json:async()=>({
          score:.51,level:'MEDIUM',confidence:.8,
          modelVersion:'risk-snn-dev-1',
          mode:'development/heuristic-fallback',
          validated:false,
          explanation:{}
        })
      });

    const result=await ai.predictRiskResilient({objectClass:'car'});
    expect(result.score).toBe(.51);
    expect(result.level).toBe('MEDIUM');
    expect(result.degraded).not.toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(String(global.fetch.mock.calls[1][0])).toContain('/model/info');
    expect(String(global.fetch.mock.calls[2][0])).toContain('/api/v1/risk/predict');
  });

  test('returns truthful degraded object if retry still fails',async()=>{
    global.fetch=jest.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('warmup failure'))
      .mockRejectedValueOnce(new Error('retry failure'));

    const result=await ai.predictRiskResilient({objectClass:'car'});
    expect(result.degraded).toBe(true);
    expect(result.validated).toBe(false);
    expect(result.score).toBeUndefined();
    expect(result.error).toContain('retry failure');
  });
});
