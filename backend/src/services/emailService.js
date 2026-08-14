const env=require('../config/env');const logger=require('../config/logger');
const SEND='https://api.brevo.com/v3/smtp/email',SENDERS='https://api.brevo.com/v3/senders';let cache={at:0,value:null};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function body(r){const t=await r.text();try{return t?JSON.parse(t):{}}catch{return{message:t.slice(0,180)}}}
function safe(status,b){const raw=String(b?.message||b?.error||'').slice(0,180);if(status===401||status===403)return'Brevo authentication/permission rejected the request.';if(status===400)return raw||'Brevo rejected the sender or message.';if(status===429)return'Brevo rate limited the request.';if(status>=500)return'Brevo is temporarily unavailable.';return raw||`Brevo HTTP ${status}`}
async function sendEmail({to,subject,html,tag='navora-auth'}){
 if(!env.brevoApiKey||!env.brevoSenderEmail)return{mode:'credentials-required',sent:false,providerMessage:'Brevo credentials are not configured.'};
 let last;
 for(let n=1;n<=2;n++){try{const r=await fetch(SEND,{method:'POST',headers:{'api-key':env.brevoApiKey,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{email:env.brevoSenderEmail,name:env.brevoSenderName},to:[{email:to}],subject,htmlContent:html,tags:[tag]}),signal:AbortSignal.timeout(10000)});const b=await body(r);if(r.ok){const messageId=b?.messageId||b?.messageIds?.[0]||null;logger.info({event:'brevo_email_accepted',toDomain:String(to).split('@')[1],messageId:messageId||undefined});return{mode:'live',sent:true,messageId}}const msg=safe(r.status,b);last={mode:'degraded',sent:false,status:r.status,providerMessage:msg};logger.warn({event:'brevo_provider_error',status:r.status,providerMessage:msg});if(!((r.status===429||r.status>=500)&&n<2))break;await sleep(500*n)}catch(e){last={mode:'degraded',sent:false,providerMessage:'Brevo request failed or timed out.'};logger.warn({event:'brevo_provider_unavailable',message:e.message});if(n<2)await sleep(500*n)}}
 return last||{mode:'degraded',sent:false,providerMessage:'Brevo delivery failed.'}
}
async function providerStatus({force=false}={}){
 const configured=!!(env.brevoApiKey&&env.brevoSenderEmail);if(!configured)return{configured:false,providerReachable:false,senderRegistered:false,senderActive:false};
 if(!force&&cache.value&&Date.now()-cache.at<60000)return cache.value;
 try{const r=await fetch(SENDERS,{headers:{'api-key':env.brevoApiKey,accept:'application/json'},signal:AbortSignal.timeout(8000)});const b=await body(r);if(!r.ok){const value={configured:true,providerReachable:false,senderRegistered:false,senderActive:false,status:r.status,note:safe(r.status,b)};cache={at:Date.now(),value};return value}
 const rows=Array.isArray(b?.senders)?b.senders:Array.isArray(b)?b:[];const sender=rows.find(x=>String(x?.email||'').toLowerCase()===String(env.brevoSenderEmail).toLowerCase());const value={configured:true,providerReachable:true,senderRegistered:!!sender,senderActive:!!sender&&sender.active!==false,note:sender?'Configured Brevo sender was found.':'Configured sender email is not registered in Brevo.'};cache={at:Date.now(),value};return value
 }catch(e){logger.warn({event:'brevo_status_unavailable',message:e.message});const value={configured:true,providerReachable:false,senderRegistered:false,senderActive:false,note:'Brevo sender-status request failed or timed out.'};cache={at:Date.now(),value};return value}
}
module.exports={sendEmail,providerStatus};
