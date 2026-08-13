const jwt=require('jsonwebtoken');
const env=require('../config/env');
const ChatRoom=require('../models/ChatRoom');
const ChatMessage=require('../models/ChatMessage');
const Blocked=require('../models/BlockedUser');
const User=require('../models/User');
const Journey=require('../models/Journey');
const Device=require('../models/Device');
const Route=require('../models/Route');
async function canJoinChat(user,room){if(!room||!room.active)return false;if(['GLOBAL','REGION','NEARBY'].includes(room.type))return true;if(room.type==='JOURNEY')return !!await Journey.exists({_id:room.journeyId,userId:user._id});if(room.type==='ROUTE')return !!await Route.exists({_id:room.routeId,userId:user._id});return false}
async function getRoom(roomId){if(roomId==='global')return ChatRoom.findOneAndUpdate({type:'GLOBAL',name:'Global'},{$setOnInsert:{active:true}},{upsert:true,new:true});return ChatRoom.findById(roomId)}
async function blockedUserRooms(senderId){const docs=await Blocked.find({$or:[{userId:senderId},{blockedUserId:senderId}]}).lean();const ids=new Set();for(const b of docs){const other=String(b.userId)===String(senderId)?b.blockedUserId:b.userId;ids.add(`user:${String(other)}`)}return [...ids]}
function init(io){
  const presence=new Map();
  io.use(async(socket,next)=>{try{const cookie=Object.fromEntries((socket.handshake.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));const raw=socket.handshake.auth?.token||cookie.navora_access;if(!raw)return next(new Error('Authentication required'));const p=jwt.verify(raw,env.jwtAccessSecret,{issuer:'navora'});const u=await User.findById(p.sub);if(!u||u.disabledAt)return next(new Error('User unavailable'));socket.user=u;next()}catch(e){next(new Error('Socket authentication failed'))}});
  io.on('connection',socket=>{
    const uid=String(socket.user._id);socket.join(`user:${uid}`);socket.join('authenticated');if(socket.user.role==='ADMIN')socket.join('admin');const wasOffline=!presence.has(uid);presence.set(uid,(presence.get(uid)||0)+1);socket.emit('presence:snapshot',{userIds:[...presence.keys()]});io.to('authenticated').emit('presence:count',{onlineUsers:presence.size});if(wasOffline)io.to('authenticated').emit('presence:user',{userId:uid,online:true});let lastMessageAt=0;
    socket.on('journey:join',async({journeyId},ack)=>{try{const allowed=journeyId&&await Journey.exists({_id:journeyId,userId:socket.user._id});if(allowed)socket.join(`journey:${journeyId}`);ack?.({ok:!!allowed})}catch{ack?.({ok:false})}});
    socket.on('device:join',async({deviceId},ack)=>{try{const allowed=deviceId&&await Device.exists({_id:deviceId,userId:socket.user._id});if(allowed)socket.join(`device:${deviceId}`);ack?.({ok:!!allowed})}catch{ack?.({ok:false})}});
    socket.on('route:join',async({routeId},ack)=>{try{const allowed=routeId&&await Route.exists({_id:routeId,userId:socket.user._id});if(allowed)socket.join(`route:${routeId}`);ack?.({ok:!!allowed})}catch{ack?.({ok:false})}});
    socket.on('webrtc:join',async({journeyId},ack)=>{try{const allowed=journeyId&&await Journey.exists({_id:journeyId,userId:socket.user._id});if(allowed){socket.join(`webrtc:${journeyId}`);socket.data.webrtcJourney=String(journeyId)}ack?.({ok:!!allowed})}catch{ack?.({ok:false})}});
    socket.on('webrtc:receiver-ready',({journeyId})=>{if(socket.rooms.has(`webrtc:${journeyId}`))socket.to(`webrtc:${journeyId}`).emit('webrtc:receiver-ready',{journeyId,receiverId:socket.id})});
    socket.on('webrtc:signal',({journeyId,targetId,signal})=>{const room=`webrtc:${journeyId}`;if(!socket.rooms.has(room))return;const payload={journeyId,fromId:socket.id,signal};if(targetId){const target=io.sockets.sockets.get(String(targetId));if(!target?.rooms?.has(room))return;target.emit('webrtc:signal',payload)}else socket.to(room).emit('webrtc:signal',payload)});
    socket.on('chat:join',async({roomId='global'},ack)=>{try{const room=await getRoom(roomId);const allowed=await canJoinChat(socket.user,room);if(allowed){if(socket.data.chatAlias)socket.leave(`chat:${socket.data.chatAlias}`);if(socket.data.chatDbId)socket.leave(`chat:${socket.data.chatDbId}`);socket.join(`chat:${roomId}`);socket.join(`chat:${String(room._id)}`);socket.data.chatAlias=roomId;socket.data.chatDbId=String(room._id)}ack?.({ok:!!allowed,roomId:allowed?roomId:null,dbRoomId:allowed?String(room._id):null})}catch{ack?.({ok:false})}});
    socket.on('chat:typing',({roomId,typing})=>{if(socket.rooms.has(`chat:${roomId}`))socket.to(`chat:${roomId}`).emit('chat:typing',{userId:uid,name:socket.user.name,typing:!!typing})});
    socket.on('chat:send',async({roomId='global',content,replyTo})=>{try{
      if(Date.now()-lastMessageAt<650)throw new Error('Slow down');lastMessageAt=Date.now();content=String(content||'').trim().replace(/<[^>]*>/g,'');if(!content||content.length>1000)throw new Error('Invalid message');
      const room=await getRoom(roomId);if(!await canJoinChat(socket.user,room))throw new Error('Room unavailable');
      let reply=null;if(replyTo){reply=await ChatMessage.findOne({_id:replyTo,roomId:room._id,deletedAt:null}).populate('userId','name');if(!reply)throw new Error('Reply target unavailable')}
      const msg=await ChatMessage.create({roomId:room._id,userId:socket.user._id,content,replyTo:reply?._id});
      const payload={id:String(msg._id),roomId,dbRoomId:String(room._id),content,replyTo:reply?{id:String(reply._id),content:reply.content,user:{id:String(reply.userId?._id),name:reply.userId?.name}}:null,createdAt:msg.createdAt,user:{id:uid,name:socket.user.name,avatarUrl:socket.user.avatarUrl},reactions:[]};
      const excluded=await blockedUserRooms(uid);io.to(`chat:${roomId}`).except(excluded).emit('chat:message',payload);if(['GLOBAL','NEARBY','REGION'].includes(room.type))io.to('authenticated').except([`user:${uid}`,...excluded]).emit('chat:unread',{roomId,roomName:room.name,senderId:uid});
    }catch(e){socket.emit('chat:error',{message:e.message})}});
    socket.on('disconnect',()=>{const n=(presence.get(uid)||1)-1;if(n<=0){presence.delete(uid);io.to('authenticated').emit('presence:user',{userId:uid,online:false})}else presence.set(uid,n);io.to('authenticated').emit('presence:count',{onlineUsers:presence.size})});
  });
  return io;
}
module.exports={init,canJoinChat};
