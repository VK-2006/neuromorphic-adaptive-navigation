import{api,toast}from'./api.js';
const token=new URLSearchParams(location.search).get('token');
let timer=null,delay=15000,stopped=false,toastShown=false;
const $=id=>document.getElementById(id);
function schedule(ms=delay){clearTimeout(timer);if(!stopped)timer=setTimeout(load,ms)}
function stop(message){stopped=true;clearTimeout(timer);if($('shared-status'))$('shared-status').textContent=message}
function render(j){
  $('shared-status').textContent=j.status||'Unknown';
  $('shared-destination').textContent=j.destination?.label||'Authorized destination';
  const total=(j.distanceCovered||0)+(j.distanceRemaining||0);$('shared-progress').textContent=total?Math.round(100*(j.distanceCovered||0)/total)+'%':'—';
  const d=new Date(j.updatedAt);$('shared-updated').textContent=Number.isNaN(d.getTime())?'—':d.toLocaleString();
  $('shared-emergency').textContent=j.emergencyActive?'ACTIVE':'No';
  const p=j.lastKnownPosition;
  $('shared-location').textContent=p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))?`Last authorized position: ${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}`:'No position shared yet';
}
async function load(){
  if(!token){stop('Invalid share link');return}
  try{
    const j=await api('/journeys/shared/'+encodeURIComponent(token));render(j);delay=15000;toastShown=false;schedule();
  }catch(e){
    if([401,403,404,410].includes(Number(e.status))){stop('Link expired or revoked');if(!toastShown){toastShown=true;toast('This journey share link is no longer available.','warning')}return}
    if(!toastShown){toastShown=true;toast('Shared journey temporarily unavailable; retrying with backoff.','warning')}
    delay=Math.min(60000,Math.max(15000,delay*2));schedule(delay);
  }
}
addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer)});
load();
