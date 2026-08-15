jest.mock('../src/services/weatherService',()=>({
  currentAt:jest.fn()
}));

const weather=require('../src/services/weatherService');
const riskFeatures=require('../src/services/riskFeatureService');

describe('risk feature normalization and weather hydration',()=>{
  beforeEach(()=>weather.currentAt.mockReset());

  test('normalizes Roboflow custom classes into the SNN taxonomy',()=>{
    expect(riskFeatures.canonicalizeObjectClass('road debris')).toBe('road blockage');
    expect(riskFeatures.canonicalizeObjectClass('road barrier')).toBe('barrier');
    expect(riskFeatures.canonicalizeObjectClass('fallen tree')).toBe('road blockage');
    expect(riskFeatures.canonicalizeObjectClass('construction equipment')).toBe('construction');
  });

  test('hydrates missing weather risk from backend OpenWeather context',async()=>{
    weather.currentAt.mockResolvedValue({
      weatherRisk:.61,
      condition:'Rain',
      cacheHit:false
    });
    const result=await riskFeatures.hydrateContext(
      {visibility:.8},
      {lat:17.385,lng:78.4867}
    );
    expect(result.context.weatherRisk).toBeCloseTo(.61);
    expect(result.weather.weatherSource).toBe('openweathermap-live');
    expect(weather.currentAt).toHaveBeenCalledTimes(1);
  });

  test('respects explicit caller weather risk without provider call',async()=>{
    const result=await riskFeatures.hydrateContext(
      {weatherRisk:.25},
      {lat:17.385,lng:78.4867}
    );
    expect(result.context.weatherRisk).toBe(.25);
    expect(result.weather.weatherSource).toBe('request-context');
    expect(weather.currentAt).not.toHaveBeenCalled();
  });

  test('uses canonical road-hazard prior for SNN features',()=>{
    const features=riskFeatures.buildFeatures(
      {objectClass:'road debris',confidence:.9,estimatedDistance:4},
      {weatherRisk:.4,visibility:.7},
      {speed:8},
      2
    );
    expect(features.objectClass).toBe('road blockage');
    expect(features.roadCondition).toBeCloseTo(.88);
    expect(features.weatherRisk).toBeCloseTo(.4);
    expect(features.verifiedReports).toBe(2);
  });
});
