jest.mock('../src/services/aiClient',()=>({predictRisk:jest.fn()}));
jest.mock('../src/models/Hazard',()=>({countDocuments:jest.fn()}));
jest.mock('../src/models/Journey',()=>({findOne:jest.fn()}));
jest.mock('../src/services/hazardService',()=>({dedupeAndUpsert:jest.fn()}));
jest.mock('../src/services/riskFeatureService',()=>({
  validLocation:jest.fn(),
  hydrateContext:jest.fn(),
  buildFeatures:jest.fn()
}));

const ai=require('../src/services/aiClient');
const Hazard=require('../src/models/Hazard');
const riskFeatures=require('../src/services/riskFeatureService');
const controller=require('../src/controllers/hazardMetadataController');

function response(){
  return {
    statusCode:200,
    body:null,
    status(code){this.statusCode=code;return this},
    json(payload){this.body=payload;return this}
  };
}

describe('verified nearby hazard geospatial context',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    Hazard.countDocuments.mockResolvedValue(3);
    riskFeatures.validLocation.mockReturnValue(true);
    riskFeatures.hydrateContext.mockResolvedValue({
      context:{weatherRisk:.2,visibility:.9},
      weather:{weatherSource:'openweathermap-cache',weatherAvailable:true}
    });
    riskFeatures.buildFeatures.mockReturnValue({
      objectClass:'car',
      confidence:.8,
      estimatedDistance:10,
      relativeSpeed:0,
      userSpeed:0,
      objectPersistence:.5,
      trafficDensity:.2,
      hazardFrequency:.1,
      visibility:.9,
      weatherRisk:.2,
      roadCondition:.2,
      verifiedReports:3
    });
    ai.predictRisk.mockResolvedValue({
      score:.25,
      level:'LOW',
      validated:false,
      mode:'development/heuristic-fallback',
      modelVersion:'risk-test'
    });
  });

  test('uses $geoWithin/$centerSphere and forwards verified count into SNN features',async()=>{
    const req={
      user:{_id:'user-1'},
      body:{
        location:{lat:17.385,lng:78.4867,speed:0},
        detections:[{objectClass:'car',confidence:.8,estimatedDistance:10}],
        context:{source:'browser-local-coco-ssd'}
      },
      app:{get:()=>null}
    };
    const res=response();

    await controller.analyze(req,res);

    expect(res.statusCode).toBe(200);
    expect(Hazard.countDocuments).toHaveBeenCalledTimes(1);

    const query=Hazard.countDocuments.mock.calls[0][0];
    expect(query.location.$near).toBeUndefined();
    expect(query.location.$geoWithin).toBeDefined();

    const sphere=query.location.$geoWithin.$centerSphere;
    expect(sphere[0]).toEqual([78.4867,17.385]);
    expect(sphere[1]).toBeCloseTo(1200/6378100,12);

    expect(riskFeatures.buildFeatures).toHaveBeenCalledWith(
      expect.objectContaining({objectClass:'car'}),
      expect.objectContaining({weatherRisk:.2}),
      req.body.location,
      3
    );
  });
});
