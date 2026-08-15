
const Device=require('../models/Device');
const RouteMemory=require('../models/RouteMemory');
const Notification=require('../models/Notification');
const TrustedContact=require('../models/TrustedContact');
const User=require('../models/User');
const Journey=require('../models/Journey');
const {ok}=require('../utils/response');

const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj?.[k]!==undefined).map(k=>[k,obj[k]]));
const DEVICE_FIELDS=[
  'name','deviceType','externalId','battery','capabilities','enabled','connectionStatus',
  'serviceUuid','controlCharacteristicUuid','sensorCharacteristicUuid','lastCommand','lastCommandAt','lastSensorValue','lastSensorAt'
];
const CONTACT_FIELDS=['name','phone','email','relationship','sharePermission'];
const PROFILE_FIELDS=['name','phone','city','country','preferredLanguage'];
const PREF_FIELDS=['safety','traffic','familiarity','theme','units','voiceLanguage','detectionMode','highAccuracyGps'];

exports.profile=async(req,res)=>ok(res,{
  id:req.user._id,name:req.user.name,email:req.user.email,role:req.user.role,
  phone:req.user.phone||'',city:req.user.city||'',country:req.user.country||'',
  preferredLanguage:req.user.preferredLanguage||'en-IN',preferences:req.user.preferences,
  avatarUrl:req.user.avatarUrl,emailVerified:req.user.emailVerified,
  createdAt:req.user.createdAt,updatedAt:req.user.updatedAt,lastLoginAt:req.user.lastLoginAt
});

exports.profileSummary=async(req,res)=>{
  const uid=req.user._id;
  const [journeys,completed,active,routeMemories,devices,trustedContacts,unreadNotifications,lastJourney]=await Promise.all([
    Journey.countDocuments({userId:uid}),
    Journey.countDocuments({userId:uid,status:'COMPLETED'}),
    Journey.countDocuments({userId:uid,status:{$in:['ACTIVE','PAUSED']}}),
    RouteMemory.countDocuments({userId:uid}),
    Device.countDocuments({userId:uid}),
    TrustedContact.countDocuments({userId:uid}),
    Notification.countDocuments({userId:uid,readAt:null}),
    Journey.findOne({userId:uid}).sort({createdAt:-1}).select('status mode createdAt completedAt selectedRouteSnapshot').lean()
  ]);
  ok(res,{journeys,completedJourneys:completed,activeJourneys:active,routeMemories,devices,trustedContacts,unreadNotifications,lastJourney});
};

exports.updateProfile=async(req,res)=>{
  const profile=pick(req.body,PROFILE_FIELDS);
  for(const [k,v] of Object.entries(profile))req.user[k]=v;
  if(req.body.preferences&&typeof req.body.preferences==='object'){
    for(const k of PREF_FIELDS)if(req.body.preferences[k]!==undefined)req.user.preferences[k]=req.body.preferences[k];
  }
  await req.user.save();
  ok(res,{
    id:req.user._id,name:req.user.name,email:req.user.email,role:req.user.role,
    phone:req.user.phone||'',city:req.user.city||'',country:req.user.country||'',
    preferredLanguage:req.user.preferredLanguage||'en-IN',preferences:req.user.preferences,
    avatarUrl:req.user.avatarUrl,emailVerified:req.user.emailVerified,
    createdAt:req.user.createdAt,updatedAt:req.user.updatedAt,lastLoginAt:req.user.lastLoginAt
  });
};

exports.dashboard=async(req,res)=>{
  const uid=req.user._id;
  const [memories,journeys,notifications]=await Promise.all([
    RouteMemory.find({userId:uid}).sort({lastTravelledAt:-1}).lean(),
    Journey.find({userId:uid}).sort({createdAt:-1}).limit(50).lean(),
    Notification.countDocuments({userId:uid,readAt:null})
  ]);
  const completed=journeys.filter(j=>j.status==='COMPLETED');
  const safety=completed.map(j=>Math.max(0,100*(1-(j.averageRisk||0))));
  const verifiedAvoided=completed.reduce((s,j)=>s+(j.decisionEvents||[]).filter(e=>e.type==='REROUTE_ACCEPTED').length,0);
  ok(res,{metrics:{
    safetyTrend:safety.length?Math.round(safety.reduce((a,b)=>a+b,0)/safety.length):null,
    routeMemories:memories.length,successfulJourneys:completed.filter(j=>j.success!==false).length,
    verifiedHazardsAvoided:verifiedAvoided,unreadNotifications:notifications
  },trend:completed.slice(0,12).reverse().map((j,i)=>({
    label:`J-${i+1}`,safety:Math.round(100*(1-(j.averageRisk||0))),risk:j.averageRisk||0,date:j.completedAt||j.updatedAt
  })),recentJourneys:journeys.slice(0,5),recentMemories:memories.slice(0,5)});
};

exports.devices=async(req,res)=>ok(res,await Device.find({userId:req.user._id}).sort({updatedAt:-1}));
exports.addDevice=async(req,res)=>{
  const body=pick(req.body,DEVICE_FIELDS);
  const data={...body,userId:req.user._id,lastSeenAt:new Date()};
  if(body.lastCommand&&!body.lastCommandAt)data.lastCommandAt=new Date();
  if(body.lastSensorValue&&!body.lastSensorAt)data.lastSensorAt=new Date();
  let d;
  if(body.externalId){
    d=await Device.findOneAndUpdate({userId:req.user._id,externalId:body.externalId},{$set:data},{upsert:true,new:true,setDefaultsOnInsert:true});
  }else d=await Device.create(data);
  req.app.get('io')?.to(`user:${req.user._id}`).emit('device:updated',d);
  ok(res,d,'Device saved',201);
};
exports.updateDevice=async(req,res)=>{
  const patch=pick(req.body,DEVICE_FIELDS);
  patch.lastSeenAt=new Date();
  if(patch.lastCommand&&!patch.lastCommandAt)patch.lastCommandAt=new Date();
  if(patch.lastSensorValue&&!patch.lastSensorAt)patch.lastSensorAt=new Date();
  const d=await Device.findOneAndUpdate({_id:req.params.id,userId:req.user._id},{$set:patch},{new:true});
  if(!d)return res.status(404).json({success:false,message:'Device not found'});
  req.app.get('io')?.to(`user:${req.user._id}`).emit('device:updated',d);
  req.app.get('io')?.to(`device:${d._id}`).emit('device:updated',d);
  ok(res,d);
};
exports.deleteDevice=async(req,res)=>{
  const d=await Device.findOneAndDelete({_id:req.params.id,userId:req.user._id});
  if(d)req.app.get('io')?.to(`user:${req.user._id}`).emit('device:deleted',{deviceId:String(d._id)});
  ok(res,{deleted:!!d});
};

exports.memory=async(req,res)=>ok(res,await RouteMemory.find({userId:req.user._id}).sort({lastTravelledAt:-1}));
exports.memorySummary=async(req,res)=>{
  const rows=await RouteMemory.find({userId:req.user._id}).sort({lastTravelledAt:-1}).lean();
  const count=rows.length;
  const avg=key=>count?rows.reduce((s,x)=>s+(Number(x?.[key])||0),0)/count:0;
  const completedJourneys=await Journey.countDocuments({userId:req.user._id,status:'COMPLETED'});
  ok(res,{count,completedJourneys,averageFamiliarity:avg('familiarity'),averageHistoricalSafety:avg('historicalSafety'),
    averageReliability:avg('reliability'),lastTravelledAt:rows[0]?.lastTravelledAt||null});
};

exports.notifications=async(req,res)=>ok(res,await Notification.find({userId:req.user._id}).sort({createdAt:-1}).limit(100));
exports.readNotification=async(req,res)=>{
  const n=await Notification.findOneAndUpdate({_id:req.params.id,userId:req.user._id},{$set:{readAt:new Date()}},{new:true});ok(res,n);
};
exports.contacts=async(req,res)=>ok(res,await TrustedContact.find({userId:req.user._id}));
exports.addContact=async(req,res)=>ok(res,await TrustedContact.create({...pick(req.body,CONTACT_FIELDS),userId:req.user._id}),'Contact added',201);
exports.updateContact=async(req,res)=>{
  const c=await TrustedContact.findOneAndUpdate({_id:req.params.id,userId:req.user._id},{$set:pick(req.body,CONTACT_FIELDS)},{new:true});
  if(!c)return res.status(404).json({success:false,message:'Contact not found'});ok(res,c);
};
exports.deleteContact=async(req,res)=>{
  const c=await TrustedContact.findOneAndDelete({_id:req.params.id,userId:req.user._id});ok(res,{deleted:!!c});
};
exports.users=async(req,res)=>ok(res,await User.find().select('-passwordHash').limit(200));
