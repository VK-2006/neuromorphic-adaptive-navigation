const r=require('express').Router();
const {authenticate}=require('../middleware/auth');
const ChatRoom=require('../models/ChatRoom');
const ChatMessage=require('../models/ChatMessage');
const ChatReaction=require('../models/ChatReaction');
const ChatReport=require('../models/ChatReport');
const Blocked=require('../models/BlockedUser');
const Journey=require('../models/Journey');
const Route=require('../models/Route');
r.use(authenticate);

const clean=s=>String(s||'').trim().replace(/<[^>]*>/g,'').slice(0,1000);
async function globalRoom(){return ChatRoom.findOneAndUpdate({type:'GLOBAL',name:'Global'},{$setOnInsert:{active:true}},{upsert:true,new:true})}
async function canAccess(req,room){
  if(!room?.active)return false;
  if(['GLOBAL','NEARBY','REGION'].includes(room.type))return true;
  if(room.type==='JOURNEY')return !!await Journey.exists({_id:room.journeyId,userId:req.user._id});
  if(room.type==='ROUTE')return !!await Route.exists({_id:room.routeId,userId:req.user._id});
  return false;
}
async function getRoom(id){return id==='global'?globalRoom():ChatRoom.findById(id)}
async function emitMessageRoom(req,message,event,payload){
  const io=req.app.get('io'); if(!io||!message)return;
  io.to(`chat:${String(message.roomId)}`).emit(event,payload);
}

r.get('/rooms',async(req,res)=>{
  await globalRoom();
  await ChatRoom.findOneAndUpdate({type:'REGION',name:'City / Region'},{$setOnInsert:{active:true,region:'Coarse region only'}},{upsert:true});
  const nearbyCell=String(req.query.nearbyCell||'').slice(0,40);const base=await ChatRoom.find({active:true,$or:[{type:{$in:['GLOBAL','REGION']}},...(nearbyCell?[{type:'NEARBY',region:nearbyCell}]:[])]}).sort({type:1,name:1}).lean();
  const [journeyRooms,routeRooms]=await Promise.all([
    ChatRoom.find({active:true,type:'JOURNEY',journeyId:{$in:await Journey.find({userId:req.user._id}).distinct('_id')}}).lean(),
    ChatRoom.find({active:true,type:'ROUTE',routeId:{$in:await Route.find({userId:req.user._id}).distinct('_id')}}).lean(),
  ]);
  res.json({success:true,data:[...base,...journeyRooms,...routeRooms]});
});

r.post('/rooms',async(req,res)=>{
  const type=String(req.body.type||'').toUpperCase();
  if(!['NEARBY','REGION','ROUTE','JOURNEY'].includes(type))return res.status(422).json({success:false,message:'Unsupported room type'});
  if(type==='JOURNEY'&&!await Journey.exists({_id:req.body.journeyId,userId:req.user._id}))return res.status(403).json({success:false,message:'Journey room forbidden'});
  if(type==='ROUTE'&&!await Route.exists({_id:req.body.routeId,userId:req.user._id}))return res.status(403).json({success:false,message:'Route room forbidden'});
  const name=clean(req.body.name).slice(0,80)||type;
  if(type==='NEARBY'&&!/^[-0-9.]+,[-0-9.]+$/.test(String(req.body.region||'')))return res.status(422).json({success:false,message:'Valid coarse nearby cell required'});const filter=type==='JOURNEY'?{type,journeyId:req.body.journeyId}:type==='ROUTE'?{type,routeId:req.body.routeId}:type==='NEARBY'?{type,region:String(req.body.region)}:{type,name};
  const room=await ChatRoom.findOneAndUpdate(filter,{$set:{name,active:true,region:clean(req.body.region).slice(0,80)||undefined,routeId:req.body.routeId,journeyId:req.body.journeyId}},{upsert:true,new:true,setDefaultsOnInsert:true});
  res.status(201).json({success:true,data:room});
});

r.get('/messages/:roomId',async(req,res)=>{
  const room=await getRoom(req.params.roomId); if(!await canAccess(req,room))return res.status(403).json({success:false,message:'Room forbidden'});
  const limit=Math.min(100,Math.max(10,Number(req.query.limit)||50));
  const before=req.query.before?{createdAt:{$lt:new Date(req.query.before)}}:{};
  const blocks=await Blocked.find({userId:req.user._id}).select('blockedUserId').lean();
  const blocked=blocks.map(x=>x.blockedUserId);
  const docs=await ChatMessage.find({roomId:room._id,deletedAt:null,userId:{$nin:blocked},...before}).sort({createdAt:-1}).limit(limit)
    .populate('userId','name avatarUrl').populate({path:'replyTo',select:'content userId',populate:{path:'userId',select:'name'}}).lean();
  const ids=docs.map(x=>x._id),rx=ids.length?await ChatReaction.find({messageId:{$in:ids}}).lean():[];
  const reactionMap=new Map();rx.forEach(x=>{const k=String(x.messageId);if(!reactionMap.has(k))reactionMap.set(k,[]);reactionMap.get(k).push({emoji:x.emoji,userId:String(x.userId)})});
  const messages=docs.reverse().map(m=>({...m,id:String(m._id),user:{id:String(m.userId?._id),name:m.userId?.name,avatarUrl:m.userId?.avatarUrl},reactions:reactionMap.get(String(m._id))||[]}));
  res.json({success:true,data:{room,messages,hasMore:docs.length===limit,nextBefore:docs.length?docs[0].createdAt:null}});
});

r.patch('/messages/:id',async(req,res)=>{
  const m=await ChatMessage.findOne({_id:req.params.id,userId:req.user._id,deletedAt:null});if(!m)return res.status(404).json({success:false,message:'Message not found'});
  m.content=clean(req.body.content);if(!m.content)return res.status(422).json({success:false,message:'Message cannot be empty'});m.editedAt=new Date();await m.save();
  await emitMessageRoom(req,m,'chat:edited',{id:String(m._id),content:m.content,editedAt:m.editedAt});res.json({success:true,data:m});
});
r.delete('/messages/:id',async(req,res)=>{const m=await ChatMessage.findOneAndUpdate({_id:req.params.id,userId:req.user._id},{$set:{deletedAt:new Date(),content:'[deleted]'}},{new:true});if(!m)return res.status(404).json({success:false,message:'Message not found'});await emitMessageRoom(req,m,'chat:deleted',{id:String(m._id)});res.json({success:true,data:m})});
r.post('/messages/:id/reactions',async(req,res)=>{const emoji=String(req.body.emoji||'').slice(0,12);if(!emoji)return res.status(422).json({success:false,message:'Emoji required'});const msg=await ChatMessage.findById(req.params.id);if(!msg)return res.status(404).json({success:false,message:'Message not found'});const room=await ChatRoom.findById(msg.roomId);if(!await canAccess(req,room))return res.status(403).json({success:false,message:'Message room forbidden'});const q={messageId:req.params.id,userId:req.user._id,emoji};const existing=await ChatReaction.findOne(q);let removed=false;if(existing){await existing.deleteOne();removed=true}else await ChatReaction.create(q);const reactions=await ChatReaction.find({messageId:req.params.id}).lean();await emitMessageRoom(req,msg,'chat:reaction',{messageId:req.params.id,reactions:reactions.map(x=>({emoji:x.emoji,userId:String(x.userId)}))});res.status(removed?200:201).json({success:true,data:{removed,emoji,reactions}})});
r.post('/messages/:id/report',async(req,res)=>{const msg=await ChatMessage.findById(req.params.id);if(!msg)return res.status(404).json({success:false,message:'Message not found'});const room=await ChatRoom.findById(msg.roomId);if(!await canAccess(req,room))return res.status(403).json({success:false,message:'Message room forbidden'});const existing=await ChatReport.findOne({messageId:req.params.id,reporterId:req.user._id,status:'PENDING'});if(existing)return res.json({success:true,data:existing});res.status(201).json({success:true,data:await ChatReport.create({messageId:req.params.id,reporterId:req.user._id,reason:clean(req.body.reason||'Safety concern').slice(0,500)})})});
r.get('/blocks',async(req,res)=>res.json({success:true,data:await Blocked.find({userId:req.user._id}).populate('blockedUserId','name avatarUrl')}));
r.post('/blocks/:userId',async(req,res)=>{if(String(req.params.userId)===String(req.user._id))return res.status(422).json({success:false,message:'Cannot block yourself'});res.status(201).json({success:true,data:await Blocked.findOneAndUpdate({userId:req.user._id,blockedUserId:req.params.userId},{$setOnInsert:{}},{upsert:true,new:true})})});
r.delete('/blocks/:userId',async(req,res)=>{await Blocked.deleteOne({userId:req.user._id,blockedUserId:req.params.userId});res.json({success:true,data:{blocked:false}})});
module.exports=r;
