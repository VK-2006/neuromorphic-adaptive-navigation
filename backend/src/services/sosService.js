const Journey=require('../models/Journey');
const TrustedContact=require('../models/TrustedContact');
const Notification=require('../models/Notification');
const {sendEmail}=require('./emailService');
const logger=require('../config/logger');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sosError=(message,status=422)=>Object.assign(new Error(message),{status,expose:true});

async function trigger(userId,{journeyId,location}){
  const journey=await Journey.findOne({_id:journeyId,userId});if(!journey)throw new Error('Journey not found');
  if(journey.emergencyActive)return{journeyId:journey._id,contactsAuthorized:0,contactsSkippedNoEmail:0,emailAttempts:0,delivery:[],emergencyActive:true,alreadyActive:true,lastKnownPosition:journey.lastKnownPosition||null,destination:journey.destination||null,timestamp:new Date()};
  const configured=await TrustedContact.find({userId,sharePermission:true});
  const contacts=configured.filter(c=>String(c.email||'').trim());
  const skippedNoEmail=configured.length-contacts.length;
  if(!contacts.length)throw sosError('Add and enable at least one trusted contact with an email address before activating SOS.');
  journey.emergencyActive=true;if(location)journey.lastKnownPosition=location;journey.decisionEvents.push({type:'SOS_ACTIVATED',at:new Date()});await journey.save();

  const pos=journey.lastKnownPosition;
  const position=pos&&Number.isFinite(Number(pos.lat))&&Number.isFinite(Number(pos.lng))?`${Number(pos.lat).toFixed(6)}, ${Number(pos.lng).toFixed(6)}`:'Unavailable';
  const dest=journey.destination?.label||[journey.destination?.lat,journey.destination?.lng].filter(x=>x!=null).join(', ')||'Unavailable';
  const results=[];
  for(const c of contacts){
    try{
      results.push(await sendEmail({
        to:c.email,subject:'Navora SOS alert',
        html:`<h2>Trusted-contact SOS alert</h2><p>An SOS was activated for journey <strong>${esc(journey._id)}</strong>.</p><p><strong>Timestamp:</strong> ${esc(new Date().toISOString())}</p><p><strong>Current / last known position:</strong> ${esc(position)}</p><p><strong>Destination:</strong> ${esc(dest)}</p><p>This is a user-authorized trusted-contact alert, not a police/ambulance dispatch.</p>`
      }));
    }catch(e){
      logger.warn({event:'sos_contact_delivery_failed',message:e.message});
      results.push({mode:'degraded',sent:false,providerMessage:'Trusted-contact delivery failed.'});
    }
  }
  let notificationPersisted=true;
  try{
    await Notification.create({userId,type:'SOS',title:'SOS activated',message:`Trusted-contact SOS activated for journey ${journey._id}.`,data:{journeyId:journey._id,contactsDeliverable:contacts.length,skippedNoEmail},expiresAt:new Date(Date.now()+30*86400000)});
  }catch(e){notificationPersisted=false;logger.warn({event:'sos_notification_persist_failed',message:e.message})}
  return{journeyId:journey._id,contactsAuthorized:contacts.length,contactsSkippedNoEmail:skippedNoEmail,emailAttempts:results.length,delivery:results,emergencyActive:true,alreadyActive:false,notificationPersisted,lastKnownPosition:pos||null,destination:journey.destination||null,timestamp:new Date()};
}
module.exports={trigger};
