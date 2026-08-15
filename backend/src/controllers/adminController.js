const mongoose=require('mongoose');
const env=require('../config/env');
const Hazard=require('../models/Hazard');
const ChatReport=require('../models/ChatReport');
const AuditLog=require('../models/AuditLog');
const User=require('../models/User');
const Journey=require('../models/Journey');
const ChatMessage=require('../models/ChatMessage');
const Notification=require('../models/Notification');
const Device=require('../models/Device');
const reputation=require('../services/reputationService');
const hazardService=require('../services/hazardService');
const aiHealth=async()=>{try{const r=await fetch(env.aiServiceUrl+'/health',{signal:AbortSignal.timeout(1500)});return {status:r.ok?'ok':'warning',detail:`HTTP ${r.status}`}}catch{return {status:'warning',detail:'AI unavailable / degraded mode'}}};
exports.health=async(req,res)=>{res.json({success:true,data:{backend:{status:'ok',detail:'Node orchestration running'},database:{status:mongoose.connection.readyState===1?'ok':'warning',detail:`readyState=${mongoose.connection.readyState}`},ai:await aiHealth(),routing:{status:env.routingProvider?'ok':'warning',detail:env.routingProvider},traffic:{status:env.trafficProvider?'ok':'warning',detail:env.trafficProvider||'simulation/unknown only'},brevo:{status:env.brevoApiKey?'ok':'warning',detail:env.brevoApiKey?'configured':'credentials required'},google:{status:env.googleClientId?'ok':'warning',detail:env.googleClientId?'configured':'credentials required'}}})};
exports.overview=async(req,res)=>{const [users,pendingHazards,reports,activeJourneys]=await Promise.all([User.countDocuments(),Hazard.countDocuments({status:'PENDING'}),ChatReport.countDocuments({status:'PENDING'}),Journey.countDocuments({status:{$in:['ACTIVE','PAUSED']}})]);res.json({success:true,data:{users,pendingHazards,pendingChatReports:reports,activeJourneys}})};
exports.hazards=async(req,res)=>res.json({success:true,data:await Hazard.find().sort({createdAt:-1}).limit(200).populate('userId','name email')});
exports.verifyHazard=async(req,res)=>{
  const status=req.body.status==='REJECTED'?'REJECTED':'VERIFIED';const h=await Hazard.findById(req.params.id);if(!h)return res.status(404).json({success:false,message:'Hazard not found'});const previousStatus=h.status;
  h.status=status;h.trustScore=hazardService.trust({confidence:h.confidence,reputation:h.reporterReputation,confirmations:h.nearbyConfirmations,snnRisk:h.snnRiskScore,adminVerified:status==='VERIFIED'});await h.save();
  if(h.userId){let delta={};if(previousStatus!==status){if(previousStatus==='VERIFIED')delta.reportsVerified=-1;if(previousStatus==='REJECTED'){delta.reportsRejected=-1;delta.falseReports=-1}if(status==='VERIFIED')delta.reportsVerified=(delta.reportsVerified||0)+1;if(status==='REJECTED'){delta.reportsRejected=(delta.reportsRejected||0)+1;delta.falseReports=(delta.falseReports||0)+1}if(Object.keys(delta).length)await reputation.update(h.userId,delta)}const note=await Notification.create({userId:h.userId,type:'HAZARD_REVIEW',title:`Hazard ${status.toLowerCase()}`,message:`Your ${h.type} report was ${status.toLowerCase()} by an administrator.`,data:{hazardId:h._id,status},expiresAt:new Date(Date.now()+30*86400000)});req.app.get('io')?.to(`user:${h.userId}`).emit('notification:new',note)}
  await AuditLog.create({actorId:req.user._id,action:'HAZARD_VERIFY',targetType:'Hazard',targetId:req.params.id,result:status});req.app.get('io')?.to('admin').emit('admin:hazard-reviewed',{hazardId:String(h._id),status});res.json({success:true,data:h});
};
exports.chatReports=async(req,res)=>res.json({success:true,data:await ChatReport.find().sort({createdAt:-1}).limit(100).populate('reporterId','name email').populate({path:'messageId',populate:{path:'userId',select:'name email'}})});
exports.reviewChatReport=async(req,res)=>{const status=['REVIEWED','DISMISSED','ACTIONED'].includes(req.body.status)?req.body.status:'REVIEWED';const x=await ChatReport.findByIdAndUpdate(req.params.id,{$set:{status}},{new:true});if(!x)return res.status(404).json({success:false,message:'Report not found'});if(status==='ACTIONED'&&x.messageId){const m=await ChatMessage.findByIdAndUpdate(x.messageId,{$set:{deletedAt:new Date(),content:'[removed by moderation]'}},{new:true});if(m)req.app.get('io')?.to(`chat:${String(m.roomId)}`).emit('chat:deleted',{id:String(m._id)})}await AuditLog.create({actorId:req.user._id,action:'CHAT_MODERATION',targetType:'ChatReport',targetId:req.params.id,result:status});res.json({success:true,data:x})};
exports.updateUser=async(req,res)=>{if(String(req.params.id)===String(req.user._id)&&req.body.disabled===true)return res.status(422).json({success:false,message:'You cannot disable your own admin session'});const patch={};if(['USER','ADMIN'].includes(req.body.role))patch.role=req.body.role;if(req.body.disabled===true)patch.disabledAt=new Date();if(req.body.disabled===false)patch.disabledAt=null;const u=await User.findByIdAndUpdate(req.params.id,{$set:patch},{new:true}).select('-passwordHash');if(!u)return res.status(404).json({success:false,message:'User not found'});await AuditLog.create({actorId:req.user._id,action:'USER_ADMIN_UPDATE',targetType:'User',targetId:req.params.id,result:JSON.stringify({role:patch.role,disabled:!!patch.disabledAt})});res.json({success:true,data:u})};
exports.audit=async(req,res)=>res.json({success:true,data:await AuditLog.find().sort({createdAt:-1}).limit(200).populate('actorId','name email')});

exports.devices=async(req,res)=>res.json({success:true,data:await Device.find().sort({updatedAt:-1}).limit(300).populate('userId','name email')});
