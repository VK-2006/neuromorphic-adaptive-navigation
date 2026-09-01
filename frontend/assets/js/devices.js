
import{api,toast}from'./api.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const val=id=>$(id)?.value?.trim()||'';
const when=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString()};
const bt={device:null,server:null,control:null,sensor:null,savedId:null,streaming:false,streamHandler:null,lastPersistAt:0};

function setText(id,text){const el=$(id);if(el)el.textContent=text}
function log(message,type='INFO'){
  const h=$('bt-controller-log');if(!h)return;
  const row=document.createElement('div');row.textContent=`${new Date().toLocaleTimeString()} · ${type} · ${message}`;
  h.prepend(row);while(h.children.length>30)h.lastElementChild?.remove();
}
function browserStatus(){
  setText('bt-secure-status',window.isSecureContext?'HTTPS / secure context':'HTTPS required');
  setText('bt-support-status',navigator.bluetooth?'Web Bluetooth supported':'Web Bluetooth unavailable');
  setText('bt-connection-status','Not connected');
}
function controls(){
  document.querySelectorAll('[data-bt-command]').forEach(b=>b.disabled=!bt.control);
  const read=document.querySelector('[data-bt-read]');if(read)read.disabled=!bt.sensor?.properties?.read;
  const stream=document.querySelector('[data-bt-stream]');
  if(stream)stream.disabled=!bt.sensor||!(bt.sensor.properties?.notify||bt.sensor.properties?.indicate);
}
function ensureStreamButton(){
  if(document.querySelector('[data-bt-stream]'))return;
  const read=document.querySelector('[data-bt-read]');if(!read)return;
  const b=document.createElement('button');b.className='btn-navora btn-ghost';b.type='button';
  b.dataset.btStream='';b.disabled=true;b.textContent='Stream sensor';
  read.insertAdjacentElement('afterend',b);b.addEventListener('click',toggleStream);
}
async function patchSaved(body){
  if(!bt.savedId)return;
  try{await api(`/devices/${encodeURIComponent(bt.savedId)}`,{method:'PATCH',body:JSON.stringify(body)})}catch{}
}
async function stopStream(){
  if(!bt.sensor||!bt.streaming)return;
  try{bt.sensor.removeEventListener('characteristicvaluechanged',bt.streamHandler);await bt.sensor.stopNotifications?.()}catch{}
  bt.streaming=false;const b=document.querySelector('[data-bt-stream]');if(b)b.textContent='Stream sensor';
  log('Sensor notification stream stopped');
}
async function resetBt(reason='Disconnected'){
  await stopStream();
  const id=bt.savedId;
  bt.device=null;bt.server=null;bt.control=null;bt.sensor=null;bt.savedId=null;
  controls();setText('bt-sensor-output','No custom GATT controller connected.');
  setText('bt-connection-status',reason);
  if(id){try{await api(`/devices/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({connectionStatus:'DISCONNECTED'})})}catch{}}
}
function decodeValue(data){
  const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
  let text='';try{text=new TextDecoder().decode(bytes).replace(/\0+$/,'').trim()}catch{}
  const printable=text&&/[\x20-\x7E]/.test(text);
  return printable?text:`0x ${[...bytes].map(x=>x.toString(16).padStart(2,'0')).join(' ')}`;
}
async function renderSensorValue(data,prefix='Sensor metadata',persist=false){
  const value=decodeValue(data);setText('bt-sensor-output',`${prefix}: ${value}`);log(`${prefix}: ${value}`,'DATA');
  if(persist&&Date.now()-bt.lastPersistAt>1800){
    bt.lastPersistAt=Date.now();await patchSaved({lastSensorValue:value,lastSensorAt:new Date().toISOString(),connectionStatus:'CONNECTED'});
  }
  return value;
}
async function pair(){
  if(!window.isSecureContext)return toast('Bluetooth requires HTTPS or localhost.','error');
  if(!navigator.bluetooth)return toast('Web Bluetooth is not supported in this browser.','error');
  try{
    const serviceUuid=val('bt-service'),controlUuid=val('bt-control'),sensorUuid=val('bt-sensor');
    if((controlUuid||sensorUuid)&&!serviceUuid)throw new Error('Enter the service UUID when using control or sensor characteristics.');
    setText('bt-connection-status','Waiting for device selection…');log('Opening browser Bluetooth chooser');
    const optionalServices=['battery_service',...(serviceUuid?[serviceUuid]:[])];
    const device=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices});
    if(!device?.gatt)throw new Error('Selected Bluetooth device does not expose GATT.');
    setText('bt-connection-status','Connecting…');
    const server=await device.gatt.connect();
    bt.device=device;bt.server=server;
    let battery=null;
    try{
      const svc=await server.getPrimaryService('battery_service');
      const ch=await svc.getCharacteristic('battery_level');
      battery=(await ch.readValue()).getUint8(0);
    }catch{}
    const capabilities=['PAIRING','IDENTITY'];if(battery!=null)capabilities.push('BATTERY');
    if(serviceUuid){
      const svc=await server.getPrimaryService(serviceUuid);
      if(controlUuid){
        bt.control=await svc.getCharacteristic(controlUuid);
        if(!bt.control?.properties?.write&&!bt.control?.properties?.writeWithoutResponse)throw new Error('Configured control characteristic is not writable.');
        capabilities.push('START_STOP');
      }
      if(sensorUuid){
        bt.sensor=await svc.getCharacteristic(sensorUuid);
        if(!bt.sensor?.properties?.read&&!bt.sensor?.properties?.notify&&!bt.sensor?.properties?.indicate)throw new Error('Configured sensor characteristic is neither readable nor notifiable.');
        capabilities.push('SENSOR_METADATA');
        if(bt.sensor.properties?.notify||bt.sensor.properties?.indicate)capabilities.push('SENSOR_STREAM');
      }
    }
    const saved=await api('/devices',{method:'POST',body:JSON.stringify({
      name:device.name||'Bluetooth sensor',deviceType:'BLUETOOTH_SENSOR',externalId:device.id,battery,capabilities,enabled:true,
      connectionStatus:'CONNECTED',serviceUuid:serviceUuid||'',controlCharacteristicUuid:controlUuid||'',sensorCharacteristicUuid:sensorUuid||''
    })});
    bt.savedId=saved?._id||null;controls();
    setText('bt-connection-status',`Connected · ${device.name||'Bluetooth device'}`);
    log(`Connected ${device.name||'Bluetooth device'}${battery==null?'':` · battery ${battery}%`}`,'OK');
    if(!serviceUuid)log('Identity/battery mode only. Add your hardware GATT UUIDs to enable commands or sensor reads.','INFO');
    device.addEventListener?.('gattserverdisconnected',()=>{toast(`${device.name||'Device'} disconnected`,'warning');resetBt('Disconnected')});
    toast(`Paired ${device.name||'Bluetooth device'}`,'success');await load();
  }catch(e){
    setText('bt-connection-status','Connection failed');log(e.message,'ERROR');await resetBt('Not connected');
    toast(`Bluetooth: ${e.message}`,'error');
  }
}
async function sendCommand(command){
  if(!bt.control)return toast('Pair a device with a writable control characteristic first.','error');
  try{
    const bytes=new TextEncoder().encode(command);
    if(bt.control.properties?.write)await bt.control.writeValueWithResponse(bytes);
    else await bt.control.writeValueWithoutResponse(bytes);
    await patchSaved({lastCommand:command,lastCommandAt:new Date().toISOString(),connectionStatus:'CONNECTED'});
    log(`Command sent: ${command}`,'CMD');toast(`Bluetooth command sent: ${command}`,'success');
  }catch(e){log(e.message,'ERROR');toast(`Bluetooth command failed: ${e.message}`,'error')}
}
async function readSensor(){
  if(!bt.sensor?.properties?.read)return toast('Configured sensor characteristic is not readable.','error');
  try{await renderSensorValue(await bt.sensor.readValue(),'Sensor metadata',true)}
  catch(e){log(e.message,'ERROR');toast(`Sensor read failed: ${e.message}`,'error')}
}
async function toggleStream(){
  if(!bt.sensor||!(bt.sensor.properties?.notify||bt.sensor.properties?.indicate))return toast('This sensor characteristic does not support notifications.','error');
  if(bt.streaming){await stopStream();toast('Sensor stream stopped');return}
  try{
    bt.streamHandler=e=>renderSensorValue(e.target.value,'Live sensor',true);
    bt.sensor.addEventListener('characteristicvaluechanged',bt.streamHandler);
    await bt.sensor.startNotifications();bt.streaming=true;
    const b=document.querySelector('[data-bt-stream]');if(b)b.textContent='Stop stream';
    log('Live GATT sensor notifications started','OK');toast('Live sensor stream started','success');
  }catch(e){log(e.message,'ERROR');toast(`Sensor stream failed: ${e.message}`,'error')}
}
async function load(){
  const h=$('device-list');if(!h)return;
  try{
    const rows=arr(await api('/devices'));
    h.classList.add('device-saved-grid');
    h.innerHTML=rows.length?rows.map(x=>`<article class="data-row">
      <div style="display:flex;justify-content:space-between;gap:10px"><strong>${esc(x?.name||'Device')}</strong><span class="chip">${esc(x?.connectionStatus||'UNKNOWN')}</span></div>
      <div class="muted">${esc(x?.deviceType||'OTHER')} · ${x?.battery==null?'Battery —':`Battery ${esc(x.battery)}%`}</div>
      <div class="muted">${arr(x?.capabilities).map(esc).join(' · ')||'No recorded capabilities'}</div>
      <small class="muted">Last seen ${when(x?.lastSeenAt||x?.updatedAt)}${x?.lastCommand?` · Last command ${esc(x.lastCommand)}`:''}</small>
      ${x?.lastSensorValue?`<div class="px-mini" style="margin-top:8px"><small>Last sensor value</small>${esc(x.lastSensorValue)}</div>`:''}
      <div class="toolbar" style="margin-top:10px">
        <button class="btn-navora btn-ghost" type="button" data-device-toggle="${esc(x?._id)}" data-enabled="${x?.enabled!==false}">${x?.enabled===false?'Enable':'Disable'}</button>
        <button class="btn-navora btn-ghost" type="button" data-device-remove="${esc(x?._id)}">Remove</button>
      </div>
    </article>`).join(''):'<div class="empty-state">No saved devices yet. Pair a controller or open a camera workflow to register one.</div>';
    h.querySelectorAll('[data-device-toggle]').forEach(b=>b.addEventListener('click',async()=>{
      try{await api(`/devices/${encodeURIComponent(b.dataset.deviceToggle)}`,{method:'PATCH',body:JSON.stringify({enabled:b.dataset.enabled!=='true'})});await load()}catch(e){toast(e.message,'error')}
    }));
    h.querySelectorAll('[data-device-remove]').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Remove this saved device?'))return;
      try{await api(`/devices/${encodeURIComponent(b.dataset.deviceRemove)}`,{method:'DELETE'});await load();toast('Device removed','success')}catch(e){toast(e.message,'error')}
    }));
  }catch(e){h.innerHTML='<div class="empty-state">Saved devices are temporarily unavailable.</div>';toast(e.message,'error')}
}

browserStatus();ensureStreamButton();controls();
document.querySelector('[data-bluetooth-pair]')?.addEventListener('click',pair);
document.querySelectorAll('[data-bt-command]').forEach(b=>b.addEventListener('click',()=>sendCommand(b.dataset.btCommand)));
document.querySelector('[data-bt-read]')?.addEventListener('click',readSensor);
addEventListener('pagehide',()=>{stopStream();try{bt.device?.gatt?.disconnect()}catch{}},{once:true});
load();
