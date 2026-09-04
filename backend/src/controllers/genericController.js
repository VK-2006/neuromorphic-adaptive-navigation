
const RouteMemory=require('../models/RouteMemory');
const Notification=require('../models/Notification');
const TrustedContact=require('../models/TrustedContact');
const User=require('../models/User');
const Journey=require('../models/Journey');
const {ok}=require('../utils/response');

const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj?.[k]!==undefined).map(k=>[k,obj[k]]));
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
  const [journeys,completed,active,routeMemories,trustedContacts,unreadNotifications,lastJourney]=await Promise.all([
    Journey.countDocuments({userId:uid}),
    Journey.countDocuments({userId:uid,status:'COMPLETED'}),
    Journey.countDocuments({userId:uid,status:{$in:['ACTIVE','PAUSED']}}),
    RouteMemory.countDocuments({userId:uid}),
    TrustedContact.countDocuments({userId:uid}),
    Notification.countDocuments({userId:uid,readAt:null}),
    Journey.findOne({userId:uid}).sort({createdAt:-1}).select('status mode createdAt completedAt selectedRouteSnapshot').lean()
  ]);
  ok(res,{journeys,completedJourneys:completed,activeJourneys:active,routeMemories,trustedContacts,unreadNotifications,lastJourney});
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
  const n=await Notification.findOneAndUpdate({_id:req.params.id,userId:req.user._id},{$set:{readAt:new Date()}},{new:true});
  if(!n)return res.status(404).json({success:false,message:'Notification not found'});
  ok(res,n);
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
