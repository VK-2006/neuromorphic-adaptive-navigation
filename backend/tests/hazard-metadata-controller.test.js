jest.mock('../src/services/aiClient',()=>({predictRisk:jest.fn()}));
jest.mock('../src/models/Hazard',()=>({countDocuments:jest.fn()}));
jest.mock('../src/models/Journey',()=>({findOne:jest.fn()}));
jest.mock('../src/services/hazardService',()=>({dedupeAndUpsert:jest.fn()}));
jest.mock('../src/services/riskFeatureService',()=>({
  validLocation:jest.fn(),
  hydrateContext:jest.fn(),
  buildFeatures:jest.fn()
}));

const env=require('../src/config/env');
const ai=require('../src/services/aiClient');
const Hazard=require('../src/models/Hazard');
const Journey=require('../src/models/Journey');
const hazards=require('../src/services/hazardService');
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

function journey(mode='SIMULATION'){
  return {
    _id:'journey-1',
    mode,
    averageRisk:0,
    riskSamples:0,
    maximumRisk:0,
    hazardCount:0,
    decisionEvents:[],
    save:jest.fn().mockResolvedValue(undefined)
  };
}

describe('browser-local hazard metadata persistence guard',()=>{
  const oldRequireValidated=env.liveRequireValidatedAi;

  beforeEach(()=>{
    jest.clearAllMocks();
    env.liveRequireValidatedAi=true;
    Hazard.countDocuments.mockResolvedValue(0);
    riskFeatures.validLocation.mockReturnValue(true);
    riskFeatures.hydrateContext.mockResolvedValue({
      context:{weatherRisk:.3,visibility:.9},
      weather:{weatherSource:'openweathermap-cache',weatherAvailable:true}
    });
    riskFeatures.buildFeatures.mockReturnValue({
      objectClass:'road blockage',confidence:.9,estimatedDistance:4,
      relativeSpeed:0,userSpeed:4,objectPersistence:.8,
      trafficDensity:.4,hazardFrequency:.2,visibility:.9,
      weatherRisk:.3,roadCondition:.88,verifiedReports:0
    });
    ai.predictRisk.mockResolvedValue({
      score:.72,level:'HIGH',validated:false,
      mode:'development/heuristic-fallback',modelVersion:'risk-test'
    });
  });

  afterAll(()=>{env.liveRequireValidatedAi=oldRequireValidated});

  test('simulation journey can persist a research-only pending local hazard',async()=>{
    const j=journey('SIMULATION');
    Journey.findOne.mockResolvedValue(j);
    hazards.dedupeAndUpsert.mockResolvedValue({
      _id:'hazard-1',
      $locals:{wasCreated:true}
    });

    const req={
      user:{_id:'user-1'},
      body:{
        journeyId:'507f1f77bcf86cd799439011',
        location:{lat:17.385,lng:78.4867,speed:4},
        detections:[{
          objectClass:'road debris',confidence:.9,
          estimatedDistance:4,objectPersistence:.8,
          boundingBox:[.1,.2,.3,.2]
        }],
        context:{source:'browser-local-coco-ssd'}
      },
      app:{get:()=>({to:()=>({emit:jest.fn()})})}
    };
    const res=response();
    await controller.analyze(req,res);

    expect(hazards.dedupeAndUpsert).toHaveBeenCalledTimes(1);
    expect(j.hazardCount).toBe(1);
    expect(res.body.data.hazardId).toBe('hazard-1');
    expect(res.body.data.safetyEligible).toBe(false);
    expect(res.body.data.researchPersistenceAllowed).toBe(true);
  });

  test('live journey does not persist unvalidated browser detector output',async()=>{
    const j=journey('LIVE');
    Journey.findOne.mockResolvedValue(j);

    const req={
      user:{_id:'user-1'},
      body:{
        journeyId:'507f1f77bcf86cd799439011',
        location:{lat:17.385,lng:78.4867,speed:4},
        detections:[{objectClass:'car',confidence:.9,estimatedDistance:4}],
        context:{source:'browser-local-coco-ssd'}
      },
      app:{get:()=>({to:()=>({emit:jest.fn()})})}
    };
    const res=response();
    await controller.analyze(req,res);

    expect(hazards.dedupeAndUpsert).not.toHaveBeenCalled();
    expect(j.save).not.toHaveBeenCalled();
    expect(res.body.data.safetyEligible).toBe(false);
    expect(res.body.data.canAffectLive).toBe(false);
  });
});
