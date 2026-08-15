const {combineRisk}=require('../src/services/routeService');

describe('route weather risk combination',()=>{
  test('clear weather never lowers an already high base risk',()=>{
    const combined=combineRisk(.80,.05,.15,true);
    expect(combined).toBeGreaterThanOrEqual(.80);
    expect(combined).toBeLessThanOrEqual(1);
  });

  test('dangerous weather adds bounded risk',()=>{
    const combined=combineRisk(.20,.80,.15,true);
    expect(combined).toBeGreaterThan(.20);
    expect(combined).toBeLessThanOrEqual(1);
  });

  test('unavailable weather leaves base risk unchanged',()=>{
    expect(combineRisk(.63,.9,.15,false)).toBeCloseTo(.63);
  });
});
