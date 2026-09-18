jest.mock('../src/models/Journey');
jest.mock('../src/models/TrustedContact');
jest.mock('../src/models/Notification');
jest.mock('../src/services/emailService');

const Journey=require('../src/models/Journey');
const TrustedContact=require('../src/models/TrustedContact');
const Notification=require('../src/models/Notification');
const {sendEmail}=require('../src/services/emailService');
const sos=require('../src/services/sosService');

const userId='507f1f77bcf86cd799439011';
const journeyId='507f1f77bcf86cd799439022';

function journey(overrides={}){
  return {_id:journeyId,userId,emergencyActive:false,lastKnownPosition:null,destination:{label:'Home'},decisionEvents:[],save:jest.fn().mockResolvedValue(undefined),...overrides};
}

describe('SOS service',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    TrustedContact.find.mockResolvedValue([{email:'trusted@example.com',sharePermission:true}]);
    Notification.create.mockResolvedValue({});
    sendEmail.mockResolvedValue({mode:'credentials-required',sent:false,providerMessage:'Brevo credentials are not configured.'});
  });

  test('activates and persists SOS for an authenticated journey owner',async()=>{
    const doc=journey();
    Journey.findOne.mockResolvedValue(doc);
    const result=await sos.trigger(userId,{journeyId,location:{lat:17.3,lng:78.4,accuracy:8}});
    expect(doc.emergencyActive).toBe(true);
    expect(doc.lastKnownPosition.lat).toBe(17.3);
    expect(doc.decisionEvents[0].type).toBe('SOS_ACTIVATED');
    expect(doc.save).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalled();
    expect(result).toMatchObject({emergencyActive:true,alreadyActive:false,notificationPersisted:true});
  });

  test('rejects SOS when the journey has no deliverable trusted contact',async()=>{
    Journey.findOne.mockResolvedValue(journey());
    TrustedContact.find.mockResolvedValue([]);
    await expect(sos.trigger(userId,{journeyId})).rejects.toMatchObject({status:422});
    expect(Journey.findOne).toHaveBeenCalledWith({_id:journeyId,userId});
  });

  test('rejects a journey that does not belong to the authenticated user',async()=>{
    Journey.findOne.mockResolvedValue(null);
    await expect(sos.trigger(userId,{journeyId})).rejects.toThrow('Journey not found');
    expect(TrustedContact.find).not.toHaveBeenCalled();
  });

  test('is idempotent for an already active SOS',async()=>{
    const doc=journey({emergencyActive:true,lastKnownPosition:{lat:1,lng:2}});
    Journey.findOne.mockResolvedValue(doc);
    const result=await sos.trigger(userId,{journeyId});
    expect(result).toMatchObject({alreadyActive:true,emergencyActive:true});
    expect(doc.save).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test('returns activation even when notification persistence fails',async()=>{
    const doc=journey();
    Journey.findOne.mockResolvedValue(doc);
    Notification.create.mockRejectedValue(new Error('notification store unavailable'));
    const result=await sos.trigger(userId,{journeyId});
    expect(result).toMatchObject({emergencyActive:true,notificationPersisted:false});
    expect(doc.save).toHaveBeenCalled();
  });
});
