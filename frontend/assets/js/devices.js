import{api,toast}from'./api.js';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const bt={device:null,server:null,control:null,sensor:null,savedId:null,streaming:false,streamHandler:null};
const val=id=>document.getElementById(id)?.value?.trim()||'';
function ensureStreamButton(){
  if(document.querySelector('[data-bt-stream]'))return;
  const read=document.querySelector('[data-bt-read]');if(!read)return;
  const b=document.createElement('button');b.className='btn-navora btn-ghost';b.type='button';b.dataset.btStream='';b.disabled=true;b.textContent='Stream sensor';read.insertAdjacentElement('afterend',b);b.addEventListener('click',toggleStream);
}
function controls(enabled){
  document.querySelectorAll('[data-bt-command]').forEach(b=>b.disabled=!enabled);
  const read=document.querySelector('[data-bt-read]');if(read)read.disabled=!bt.sensor;
  const stream=document.querySelector('[data-bt-stream]');if(stream)stream.disabled=!bt.sensor||!(bt.sensor.properties?.notify||bt.sensor.properties?.indicate);
}
async function stopStream(){
  if(!bt.sensor||!bt.streaming)return;
  try{bt.sensor.removeEventListener('characteristicvaluechanged',bt.streamHandler);await bt.sensor.stopNotifications?.()}catch{}
  bt.streaming=false;const b=document.querySelector('[data-bt-stream]');if(b)b.textContent='Stream sensor';
}
function resetBt(){stopStream();bt.device=null;bt.server=null;bt.control=null;bt.sensor=null;bt.savedId=null;controls(false);const out=document.getElementById('bt-sensor-output');if(out)out.textContent='No custom GATT controller connected.'}
function renderSensorValue(data,prefix='Sensor metadata'){
  const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);let text='';try{text=new TextDecoder().decode(bytes).replace(/\0+$/,'')}catch{}
  const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join(' '),out=document.getElementById('bt-sensor-output');
  if(out)out.textContent=`${prefix}: ${text&&/[\x20-\x7E]/.test(text)?text:`0x ${hex}`}`;
}
async function pair(){
  if(!navigator.bluetooth)return toast('Web Bluetooth is not supported in this browser.','error');
  try{
    const serviceUuid=val('bt-service'),controlUuid=val('bt-control'),sensorUuid=val('bt-sensor');
    if((controlUuid||sensorUuid)&&!serviceUuid)throw new Error('Custom service UUID is required when using control/sensor characteristics.');
    const optionalServices=['battery_service',...(serviceUuid?[serviceUuid]:[])];
    const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices});
    if(!device?.gatt)throw new Error('Selected Bluetooth device does not expose GATT.');
    const server=await device.gatt.connect();bt.device=device;bt.server=server;
    let battery=null;try{const svc=await server.getPrimaryService('battery_service'),ch=await svc.getCharacteristic('battery_level'),v=await ch.readValue();battery=v.getUint8(0)}catch{}
    const capabilities=['PAIRING','IDENTITY'];if(battery!=null)capabilities.push('BATTERY');
    if(serviceUuid){
      const svc=await server.getPrimaryService(serviceUuid);
      if(controlUuid){bt.control=await svc.getCharacteristic(controlUuid);if(!bt.control?.properties?.write&&!bt.control?.properties?.writeWithoutResponse)throw new Error('Configured control characteristic is not writable.');capabilities.push('START_STOP','DETECTION_CONTROL')}
      if(sensorUuid){
        bt.sensor=await svc.getCharacteristic(sensorUuid);
        if(!bt.sensor?.properties?.read&&!bt.sensor?.properties?.notify&&!bt.sensor?.properties?.indicate)throw new Error('Configured sensor characteristic is neither readable nor notifiable.');
        capabilities.push('SENSOR_METADATA');if(bt.sensor.properties?.notify||bt.sensor.properties?.indicate)capabilities.push('SENSOR_STREAM');
      }
    }
    const saved=(await api('/devices',{method:'POST',body:JSON.stringify({name:device.name||'Bluetooth sensor',deviceType:'BLUETOOTH_SENSOR',externalId:device.id,battery,capabilities,enabled:true})}))||{};
    bt.savedId=saved._id||null;controls(Boolean(bt.control));
    toast(`Paired ${device.name||'Bluetooth device'}${battery==null?'':` · Battery ${battery}%`}`,'success');
    device.addEventListener?.('gattserverdisconnected',()=>{toast(`${device.name||'Device'} disconnected`,'warning');resetBt()});
    await load();
  }catch(e){resetBt();toast(`Bluetooth: ${e.message}`,'error')}
}
async function sendCommand(command){
  if(!bt.control)return toast('Pair a device with a writable control characteristic first.','error');
  try{const bytes=new TextEncoder().encode(command);if(bt.control.properties?.write)await bt.control.writeValueWithResponse(bytes);else await bt.control.writeValueWithoutResponse(bytes);toast(`Bluetooth command sent: ${command}`,'success')}catch(e){toast(`Bluetooth command failed: ${e.message}`,'error')}
}
async function readSensor(){
  if(!bt.sensor?.properties?.read)return toast('Configured sensor characteristic is not readable.','error');
  try{renderSensorValue(await bt.sensor.readValue());if(bt.savedId)await api(`/devices/${encodeURIComponent(bt.savedId)}`,{method:'PATCH',body:JSON.stringify({enabled:true})})}catch(e){toast(`Sensor read failed: ${e.message}`,'error')}
}
async function toggleStream(){
  if(!bt.sensor||!(bt.sensor.properties?.notify||bt.sensor.properties?.indicate))return toast('This characteristic does not support notifications.','error');
  if(bt.streaming){await stopStream();toast('Sensor stream stopped');return}
  try{
    bt.streamHandler=e=>renderSensorValue(e.target.value,'Live sensor');
    bt.sensor.addEventListener('characteristicvaluechanged',bt.streamHandler);await bt.sensor.startNotifications();bt.streaming=true;
    const b=document.querySelector('[data-bt-stream]');if(b)b.textContent='Stop stream';toast('Live GATT sensor notifications started','success');
  }catch(e){toast(`Sensor stream failed: ${e.message}`,'error')}
}
async function load(){
  const h=document.getElementById('device-list');if(!h)return;
  try{
    const rows=arr(await api('/devices'));
    h.innerHTML=rows.length?rows.map(x=>`<div class="data-row"><div style="display:flex;justify-content:space-between"><strong>${esc(x?.name)}</strong><span>${x?.battery==null?'':esc(x.battery)+'%'}</span></div><div class="muted">${esc(x?.deviceType)} · ${arr(x?.capabilities).map(esc).join(' · ')}</div><div class="toolbar"><button class="btn-navora btn-ghost" type="button" data-device-remove="${esc(x?._id)}">Remove</button></div></div>`).join(''):'<div class="empty-state">No saved devices.</div>';
    h.querySelectorAll('[data-device-remove]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Remove this saved device?'))return;try{await api('/devices/'+encodeURIComponent(b.dataset.deviceRemove),{method:'DELETE'});await load();toast('Device removed','success')}catch(e){toast(e.message,'error')}}));
  }catch(e){h.innerHTML='<div class="empty-state">Saved devices are temporarily unavailable.</div>';toast(e.message,'error')}
}
ensureStreamButton();
document.querySelector('[data-bluetooth-pair]')?.addEventListener('click',pair);
document.querySelectorAll('[data-bt-command]').forEach(b=>b.addEventListener('click',()=>sendCommand(b.dataset.btCommand)));
document.querySelector('[data-bt-read]')?.addEventListener('click',readSensor);
addEventListener('pagehide',()=>{stopStream();try{bt.device?.gatt?.disconnect()}catch{}});
load();
// Commands intentionally remain explicit for the Bluetooth control contract: DETECTION_ON / DETECTION_OFF.
