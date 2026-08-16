jest.mock('../src/services/aiClient',()=>({detect:jest.fn(),predictRisk:jest.fn()}));
jest.mock('../src/services/hazardService',()=>({dedupeAndUpsert:jest.fn(),trust:jest.fn()}));
jest.mock('../src/models/Hazard',()=>({findById:jest.fn(),find:jest.fn()}));
jest.mock('../src/models/HazardConfirmation',()=>({findOne:jest.fn(),findOneAndUpdate:jest.fn(),countDocuments:jest.fn()}));
jest.mock('../src/models/Journey',()=>({findOne:jest.fn(),exists:jest.fn()}));
jest.mock('../src/services/reputationService',()=>({update:jest.fn()}));

const env=require('../src/config/env');
const ai=require('../src/services/aiClient');
const hazards=require('../src/services/hazardService');
const Journey=require('../src/models/Journey');
const controller=require('../src/controllers/hazardController');

function response(){
  return {
    statusCode:200,
    body:null,
    status(code){this.statusCode=code;return this},
    json(payload){this.body=payload;return this}
  };
}

function journey({mode='LIVE',status='ACTIVE'}={}){
  return {
    _id:'journey-1',mode,status,
    averageRisk:0,maximumRisk:0,riskSamples:0,hazardCount:0,
    decisionEvents:[],save:jest.fn().mockResolvedValue(undefined)
  };
}

function request(){
  return {
    user:{_id:'user-1'},
    body:{
      journeyId:'507f1f77bcf86cd799439011',
      image:'data:image/jpeg;base64,abc',
      location:{lat:17.385,lng:78.4867,speed:5},
      deviceId:null
    },
    app:{get:()=>({to:()=>({emit:jest.fn()})})}
  };
}

describe('image detector live safety gate',()=>{
  const previous=env.liveRequireValidatedAi;

  beforeEach(()=>{
    jest.clearAllMocks();
    env.liveRequireValidatedAi=true;
    ai.detect.mockResolvedValue({
      validated:false,mode:'torchscript-trained-weights-unvalidated',modelVersion:'detector-test',
      detections:[{objectClass:'pothole',confidence:.9,approximateDistance:4,boundingBox:[.1,.2,.3,.2]}]
    });
    ai.predictRisk.mockResolvedValue({
      validated:false,score:.8,level:'CRITICAL',mode:'snn-trained-weights-unvalidated',modelVersion:'risk-test'
    });
  });

  afterAll(()=>{env.liveRequireValidatedAi=previous});

  test('unvalidated LIVE perception is returned as research data but cannot mutate journey state',async()=>{
    const j=journey();
    Journey.findOne.mockResolvedValue(j);
    const res=response();

    await controller.detect(request(),res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.safetyEligible).toBe(false);
    expect(res.body.data.canAffectLive).toBe(false);
    expect(hazards.dedupeAndUpsert).not.toHaveBeenCalled();
    expect(j.save).not.toHaveBeenCalled();
    expect(j.riskSamples).toBe(0);
    expect(j.maximumRisk).toBe(0);
  });

  test('validated LIVE perception may persist and update active journey telemetry',async()=>{
    const j=journey();
    Journey.findOne.mockResolvedValue(j);
    ai.detect.mockResolvedValue({
      validated:true,mode:'torchscript-trained-weights',modelVersion:'detector-test',
      detections:[{objectClass:'pothole',confidence:.9,approximateDistance:4,boundingBox:[.1,.2,.3,.2]}]
    });
    ai.predictRisk.mockResolvedValue({
      validated:true,score:.8,level:'CRITICAL',mode:'snn-trained-weights',modelVersion:'risk-test'
    });
    hazards.dedupeAndUpsert.mockResolvedValue({
      _id:'hazard-1',type:'pothole',$locals:{wasCreated:true}
    });
    const res=response();

    await controller.detect(request(),res);

    expect(res.body.data.safetyEligible).toBe(true);
    expect(res.body.data.canAffectLive).toBe(true);
    expect(hazards.dedupeAndUpsert).toHaveBeenCalledTimes(1);
    expect(j.save).toHaveBeenCalledTimes(1);
    expect(j.riskSamples).toBe(1);
    expect(j.maximumRisk).toBe(.8);
    expect(j.hazardCount).toBe(1);
  });

  test.each(['PLANNED','PAUSED','COMPLETED','CANCELLED'])(
    'journey-linked image detection rejects %s journey before inference',
    async(status)=>{
      const j=journey({status});
      Journey.findOne.mockResolvedValue(j);
      const res=response();

      await controller.detect(request(),res);

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toMatch(/active journey/i);
      expect(ai.detect).not.toHaveBeenCalled();
      expect(ai.predictRisk).not.toHaveBeenCalled();
      expect(hazards.dedupeAndUpsert).not.toHaveBeenCalled();
      expect(j.save).not.toHaveBeenCalled();
    }
  );
});
