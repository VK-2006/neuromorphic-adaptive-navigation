import{toast}from'./api.js';
let socket=null,stream=null,pc=null,receiverId=null;
const $=id=>document.getElementById(id);
const id=()=>$('webrtc-journey-id')?.value?.trim()||'';
function state(value){const element=$('share-camera-state');if(element)element.textContent=value}
async function makePeer(target){
  if(!window.RTCPeerConnection)throw new Error('WebRTC is not supported in this browser.');
  if(!stream)throw new Error('Camera stream is not active.');
  if(!socket)throw new Error('Realtime connection is not active.');
  pc?.close();pc=new window.RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  stream.getTracks().forEach(track=>pc.addTrack(track,stream));
  pc.onicecandidate=event=>{if(event.candidate)socket?.emit('webrtc:signal',{journeyId:id(),targetId:target,signal:{type:'candidate',candidate:event.candidate}})};
  pc.onconnectionstatechange=()=>state(`Peer ${pc?.connectionState||'unknown'}`);
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);
  socket.emit('webrtc:signal',{journeyId:id(),targetId:target,signal:{type:'offer',sdp:pc.localDescription}});
}
async function start(){
  if(stream)return;
  const journeyId=id();if(!journeyId)return toast('Journey ID required','error');
  if(!window.isSecureContext)return toast('Camera sharing requires HTTPS.','error');
  if(!navigator.mediaDevices?.getUserMedia)return toast('Camera API is unavailable in this browser.','error');
  if(!window.io)return toast('Realtime Socket.IO client is unavailable.','error');
  if(!window.RTCPeerConnection)return toast('WebRTC is not supported in this browser.','error');
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const video=$('share-video');if(video){video.srcObject=stream;await video.play?.().catch(()=>{})}
    socket=window.io({withCredentials:true});
    socket.on('connect',()=>socket.emit('webrtc:join',{journeyId},ack=>{if(!ack?.ok){stop();return toast('Journey WebRTC authorization failed','error')}state('Camera ready; waiting for receiver...')}));
    socket.on('connect_error',error=>{state('Realtime unavailable');toast(`Realtime connection: ${error.message}`,'warning')});
    socket.on('webrtc:receiver-ready',async event=>{if(event?.journeyId!==journeyId)return;receiverId=event.receiverId;try{await makePeer(receiverId)}catch(error){toast(error.message,'error')}});
    socket.on('webrtc:signal',async packet=>{const signal=packet?.signal;if(!pc||packet?.fromId!==receiverId||!signal)return;try{if(signal.type==='answer')await pc.setRemoteDescription(signal.sdp);else if(signal.type==='candidate'&&signal.candidate)await pc.addIceCandidate(signal.candidate)}catch(error){console.debug(error)}});
  }catch(error){toast(`Camera: ${error.message}`,'error');stop()}
}
function stop(){try{pc?.close()}catch{}pc=null;try{stream?.getTracks().forEach(track=>track.stop())}catch{}stream=null;try{socket?.disconnect()}catch{}socket=null;receiverId=null;const video=$('share-video');if(video)video.srcObject=null;state('Stopped')}
const journeyInput=$('webrtc-journey-id');if(journeyInput)journeyInput.value=new URLSearchParams(location.search).get('journeyId')||sessionStorage.getItem('journeyId')||'';
$('share-camera-start')?.addEventListener('click',start);$('share-camera-stop')?.addEventListener('click',stop);addEventListener('pagehide',stop);
