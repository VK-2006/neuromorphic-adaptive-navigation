import {api,toast} from './api.js';
const safeJson=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const asArray=v=>Array.isArray(v)?v:[];
const state={socket:null,user:null,rooms:[],roomId:null,dbRoomId:null,before:null,reply:null,typingTimer:null,typingUsers:new Map(),typingTimers:new Map(),messages:new Map(),onlineUsers:new Set(),unread:safeJson('navoraChatUnread',{})};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const $=s=>document.querySelector(s);
const safeAvatar=u=>{try{const x=new URL(String(u||''),location.origin);return['http:','https:'].includes(x.protocol)?x.href:''}catch{return''}};
function saveUnread(){try{localStorage.setItem('navoraChatUnread',JSON.stringify(state.unread))}catch{}}
function renderAuthRequired(err){const host=$('#message-list');if(host)host.innerHTML=`<div class="empty-state"><strong>World Chat requires a verified sign-in.</strong><p class="muted">${esc(err?.message||'Sign in to continue.')}</p><a class="btn-navora" href="login.html">Go to login</a></div>`;const form=$('#chat-form');if(form)form.querySelectorAll('input,button').forEach(x=>x.disabled=true);toast('Sign in with a verified account to use World Chat.','warning')}
function normalize(m){m=m&&typeof m==='object'?m:{};return{...m,id:String(m.id||m._id||crypto.randomUUID?.()||Date.now()),user:m.user||{id:String(m.userId?._id||m.userId||''),name:m.userId?.name||'User',avatarUrl:m.userId?.avatarUrl}}}
function roomAlias(room){return room.type==='GLOBAL'?'global':String(room._id)}
function renderRooms(){const host=$('#room-list');if(!host)return;host.innerHTML='';for(const room of asArray(state.rooms)){const alias=roomAlias(room),b=document.createElement('button');b.type='button';b.className='room-btn'+(alias===state.roomId?' active':'');b.innerHTML=`<span><strong>${esc(room.name)}</strong><br><small class="muted">${esc(room.type)}</small></span>${state.unread[alias]?`<span class="unread-badge">${Math.min(99,state.unread[alias])}</span>`:''}`;b.onclick=()=>openRoom(alias);host.appendChild(b)}}
function groupedReactions(list=[]){const m=new Map();for(const x of list)m.set(x.emoji,(m.get(x.emoji)||0)+1);return[...m.entries()]}
function messageHtml(m){const mine=String(m.user?.id)===String(state.user?.id),online=state.onlineUsers.has(String(m.user?.id)),avatar=safeAvatar(m.user?.avatarUrl);const avatarHtml=avatar?`<div class="avatar avatar-image"><img src="${esc(avatar)}" alt=""></div>`:`<div class="avatar">${esc((m.user?.name||'U')[0])}</div>`;const reply=m.replyTo?.content?`<div class="reply-preview">↪ ${esc(m.replyTo.user?.name||m.replyTo.userId?.name||'User')}: ${esc(m.replyTo.content).slice(0,140)}</div>`:'';const reactions=groupedReactions(m.reactions).map(([e,n])=>`<button class="reaction-chip" data-action="react" data-emoji="${esc(e)}">${esc(e)} ${n}</button>`).join('');return`${avatarHtml}<div><div class="message-meta"><strong>${esc(m.user?.name||'User')}</strong><span class="presence-dot ${online?'online':'offline'}" title="${online?'Online':'Offline'}" aria-label="${online?'Online':'Offline'}"></span><small class="muted">${new Date(m.createdAt||Date.now()).toLocaleString()}</small>${m.editedAt?'<small class="muted">edited</small>':''}</div><div class="bubble">${reply}${esc(m.content||'')}</div><div class="message-actions">${reactions}<button data-action="react" data-emoji="👍">👍</button><button data-action="react" data-emoji="❤️">❤️</button><button data-action="reply">Reply</button>${mine?'<button data-action="edit">Edit</button><button data-action="delete">Delete</button>':'<button data-action="report">Report</button><button data-action="block">Block</button>'}</div></div>`}
function upsertMessage(raw,{prepend=false}={}){const m=normalize(raw);state.messages.set(m.id,m);let node=document.querySelector(`[data-message-id="${CSS.escape(m.id)}"]`);if(!node){node=document.createElement('div');node.dataset.messageId=m.id;node.className='message'+(String(m.user?.id)===String(state.user?.id)?' mine':'');const host=$('#message-list');if(!host)return null;prepend?host.prepend(node):host.append(node)}node.innerHTML=messageHtml(m);node.onclick=e=>handleAction(e,m);return node}
function removeMessage(id){state.messages.delete(String(id));document.querySelector(`[data-message-id="${CSS.escape(String(id))}"]`)?.remove()}
async function handleAction(e,m){
  const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
  try{
    if(action==='reply'){state.reply=m;$('#reply-text').textContent=`Replying to ${m.user?.name}: ${m.content.slice(0,90)}`;$('#reply-banner').classList.add('show');$('#chat-input').focus()}
    else if(action==='react'){const out=await api(`/chat/messages/${m.id}/reactions`,{method:'POST',body:JSON.stringify({emoji:b.dataset.emoji})});m.reactions=out.reactions||[];upsertMessage(m)}
    else if(action==='edit'){
      const content=prompt('Edit message',m.content);
      if(content&&content.trim()&&content.trim()!==m.content){
        const out=await api(`/chat/messages/${m.id}`,{method:'PATCH',body:JSON.stringify({content:content.trim()})});
        m.content=out?.content??content.trim();m.editedAt=out?.editedAt||new Date().toISOString();upsertMessage(m);
      }
    }else if(action==='delete'){
      if(confirm('Delete this message?')){await api(`/chat/messages/${m.id}`,{method:'DELETE'});removeMessage(m.id)}
    }else if(action==='report'){
      const reason=prompt('Reason for report','Spam or unsafe content');
      if(reason){await api(`/chat/messages/${m.id}/report`,{method:'POST',body:JSON.stringify({reason})});toast('Report submitted','success')}
    }else if(action==='block'){
      if(m.user?.id&&confirm(`Block ${m.user.name}?`)){await api(`/chat/blocks/${m.user.id}`,{method:'POST'});removeMessage(m.id);await loadBlocks();toast('User blocked','success')}
    }
  }catch(err){toast(err.message,'error')}
}
async function loadRooms(){const nearbyCell=localStorage.getItem('navoraNearbyCell')||'';state.rooms=asArray(await api(`/chat/rooms${nearbyCell?`?nearbyCell=${encodeURIComponent(nearbyCell)}`:''}`));renderRooms();if(!state.roomId&&state.rooms.length)await openRoom(roomAlias(state.rooms.find(r=>r.type==='GLOBAL')||state.rooms[0]))}
async function loadMessages({older=false}={}){if(!state.roomId)return;const qs=new URLSearchParams({limit:'50'});if(older&&state.before)qs.set('before',state.before);const out=(await api(`/chat/messages/${encodeURIComponent(state.roomId)}?${qs}`))||{},room=out.room||{},messages=asArray(out.messages);state.dbRoomId=String(room._id||state.roomId);if($('#room-title'))$('#room-title').textContent=room.name||'Chat';if($('#room-kind'))$('#room-kind').textContent=room.type||'';const host=$('#message-list');if(!host)return;if(!older){host.innerHTML='';state.messages.clear()}for(const raw of messages)upsertMessage(raw,{prepend:older});state.before=messages[0]?.createdAt||null;if($('#load-older'))$('#load-older').disabled=!out.hasMore;if(!older)host.scrollTop=host.scrollHeight}
async function joinRealtime(alias){if(!state.socket?.connected)return;state.socket.emit('chat:join',{roomId:alias},ack=>{if(!ack?.ok)toast('Realtime room join unavailable; REST chat remains active.','warning');else state.dbRoomId=ack.dbRoomId})}
async function openRoom(alias){state.roomId=alias;state.unread[alias]=0;saveUnread();renderRooms();try{await loadMessages();await joinRealtime(alias)}catch(e){toast(e.message,'error')}}
function renderTyping(){const names=[...state.typingUsers.values()].map(x=>x.name);const host=$('#typing-line');if(host)host.textContent=names.length?`${names.slice(0,3).join(', ')} ${names.length===1?'is':'are'} typing…`:''}
function updateTyping(x){
  const id=String(x?.userId||'');if(!id||id===String(state.user?.id))return;
  const old=state.typingTimers.get(id);if(old)clearTimeout(old);
  if(x.typing){
    state.typingUsers.set(id,x);
    const t=setTimeout(()=>{state.typingUsers.delete(id);state.typingTimers.delete(id);renderTyping()},2500);
    state.typingTimers.set(id,t);
  }else{state.typingUsers.delete(id);state.typingTimers.delete(id)}
  renderTyping();
}
function setupSocket(){
  if(!window.io)return;state.socket=window.io({withCredentials:true});
  state.socket.on('connect',()=>{if(state.roomId)joinRealtime(state.roomId)});
  state.socket.on('connect_error',e=>toast(`Realtime chat unavailable: ${e.message}. Secure REST sending stays available.`,'warning'));
  state.socket.on('presence:snapshot',x=>{state.onlineUsers=new Set(asArray(x?.userIds).map(String));document.querySelectorAll('[data-message-id]').forEach(n=>{const m=state.messages.get(n.dataset.messageId);if(m)upsertMessage(m)})});
  state.socket.on('presence:user',x=>{x.online?state.onlineUsers.add(String(x.userId)):state.onlineUsers.delete(String(x.userId));for(const m of state.messages.values())if(String(m.user?.id)===String(x.userId))upsertMessage(m)});
  state.socket.on('presence:count',x=>{if($('#online-count'))$('#online-count').textContent=x.onlineUsers||0});
  state.socket.on('chat:unread',x=>{if(x.roomId===state.roomId||x.senderId===state.user?.id)return;state.unread[x.roomId]=(state.unread[x.roomId]||0)+1;saveUnread();renderRooms()});
  state.socket.on('chat:message',raw=>{const target=raw.roomId||state.roomId;if(target!==state.roomId){state.unread[target]=(state.unread[target]||0)+1;saveUnread();renderRooms();return}upsertMessage(raw);const h=$('#message-list');if(h)h.scrollTop=h.scrollHeight});
  state.socket.on('chat:edited',x=>{const m=state.messages.get(String(x.id));if(m){m.content=x.content;m.editedAt=x.editedAt;upsertMessage(m)}});
  state.socket.on('chat:deleted',x=>removeMessage(x.id));
  state.socket.on('chat:reaction',x=>{const m=state.messages.get(String(x.messageId));if(m){m.reactions=x.reactions||[];upsertMessage(m)}});
  state.socket.on('chat:typing',updateTyping);
  state.socket.on('chat:error',e=>toast(e.message,'error'));
}
async function loadBlocks(){const host=$('#blocked-list');if(!host)return;const rows=asArray(await api('/chat/blocks'));host.innerHTML=rows.length?'':'<div class="muted">No blocked users.</div>';for(const r of rows){const u=r.blockedUserId||{},d=document.createElement('div');d.className='data-row';d.innerHTML=`<strong>${esc(u.name||'User')}</strong> <button class="icon-btn" type="button">Unblock</button>`;d.querySelector('button').onclick=async()=>{try{await api(`/chat/blocks/${u._id}`,{method:'DELETE'});await loadBlocks();toast('User unblocked','success')}catch(e){toast(e.message,'error')}};host.appendChild(d)}}
async function openNearby(){if(!navigator.geolocation)return toast('Geolocation unavailable','error');navigator.geolocation.getCurrentPosition(async pos=>{const cell=`${(Math.round(pos.coords.latitude*10)/10).toFixed(1)},${(Math.round(pos.coords.longitude*10)/10).toFixed(1)}`;localStorage.setItem('navoraNearbyCell',cell);try{const room=await api('/chat/rooms',{method:'POST',body:JSON.stringify({type:'NEARBY',name:`Nearby ${cell}`,region:cell})});if(!state.rooms.some(r=>r._id===room._id))state.rooms.push(room);renderRooms();await openRoom(String(room._id));toast('Joined coarse nearby room; exact GPS was not posted to chat.','success')}catch(e){toast(e.message,'error')}},e=>toast(`Nearby room: ${e.message}`,'error'),{enableHighAccuracy:false,maximumAge:300000,timeout:8000})}
async function openContextRoom(type){const isJourney=type==='JOURNEY',id=sessionStorage.getItem(isJourney?'journeyId':'selectedRouteDbId');if(!id)return toast(`No ${isJourney?'active journey':'selected saved route'} is available.`,'warning');try{const body=isJourney?{type,name:'Current Journey',journeyId:id}:{type,name:'Selected Route',routeId:id};const room=await api('/chat/rooms',{method:'POST',body:JSON.stringify(body)});if(!state.rooms.some(r=>r._id===room._id))state.rooms.push(room);renderRooms();await openRoom(String(room._id))}catch(e){toast(e.message,'error')}}
async function init(){
  if(!$('#chat-form'))return;
  try{state.user=await api('/users/me');setupSocket();await Promise.all([loadRooms(),loadBlocks()])}catch(e){renderAuthRequired(e);return}
  $('#chat-form').onsubmit=async e=>{e.preventDefault();const i=$('#chat-input'),content=i.value.trim(),btn=$('#chat-form button[type="submit"]');if(!content||!state.roomId)return;btn.disabled=true;try{const msg=await api(`/chat/messages/${encodeURIComponent(state.roomId)}`,{method:'POST',body:JSON.stringify({content,replyTo:state.reply?.id})});upsertMessage(msg);i.value='';state.reply=null;$('#reply-banner').classList.remove('show');if(state.socket?.connected)state.socket.emit('chat:typing',{roomId:state.roomId,typing:false});$('#message-list').scrollTop=$('#message-list').scrollHeight}catch(err){toast(err.message,'error')}finally{btn.disabled=false}};
  $('#chat-input').oninput=()=>{if(!state.roomId)return;if(state.socket?.connected)state.socket.emit('chat:typing',{roomId:state.roomId,typing:true});clearTimeout(state.typingTimer);state.typingTimer=setTimeout(()=>state.socket?.connected&&state.socket.emit('chat:typing',{roomId:state.roomId,typing:false}),1200)};
  $('#cancel-reply').onclick=()=>{state.reply=null;$('#reply-banner').classList.remove('show')};$('#load-older').onclick=()=>loadMessages({older:true});$('#nearby-room').onclick=openNearby;$('#journey-room').onclick=()=>openContextRoom('JOURNEY');$('#route-room').onclick=()=>openContextRoom('ROUTE');
  $('#region-room-form').onsubmit=async e=>{e.preventDefault();const name=$('#region-name').value.trim();if(!name)return;try{const room=await api('/chat/rooms',{method:'POST',body:JSON.stringify({type:'REGION',name,region:name})});if(!state.rooms.some(r=>r._id===room._id))state.rooms.push(room);renderRooms();await openRoom(String(room._id));$('#region-name').value=''}catch(err){toast(err.message,'error')}};
}
addEventListener('pagehide',()=>{for(const t of state.typingTimers.values())clearTimeout(t);state.socket?.disconnect()});
init();
