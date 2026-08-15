const Otp=require('../models/OtpVerification');const env=require('../config/env');const{randomOtp,sha256,timingSafeEqualHash}=require('../utils/crypto');const{sendEmail}=require('./emailService');
function exposed(message,status=503){const e=new Error(message);e.status=status;e.expose=true;return e}
async function issue(email,purpose){
 email=email.toLowerCase();const recent=await Otp.findOne({email,purpose,usedAt:null}).sort({lastSentAt:-1});if(recent&&Date.now()-recent.lastSentAt.getTime()<env.otpResendCooldownSeconds*1000)throw exposed('Please wait before requesting another OTP',429);
 await Otp.updateMany({email,purpose,usedAt:null},{$set:{usedAt:new Date()}});
 const code=randomOtp();const rec=await Otp.create({email,purpose,otpHash:sha256(code),attempts:0,expiresAt:new Date(Date.now()+env.otpExpiryMinutes*60000),lastSentAt:new Date(),deliveryMode:'pending'});
 const result=await sendEmail({to:email,subject:purpose==='EMAIL_VERIFY'?'Verify your Navora email':'Reset your Navora password',html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2>NAVORA</h2><p>Your one-time code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:18px 0">${code}</div><p>This code expires in ${env.otpExpiryMinutes} minutes.</p></div>`,tag:purpose==='EMAIL_VERIFY'?'navora-email-verify':'navora-password-reset'});
 rec.deliveryMode=result.mode;rec.deliveryMessageId=result.messageId||undefined;rec.deliveryProviderStatus=result.status||undefined;rec.deliveryError=result.sent?undefined:String(result.providerMessage||'Delivery failed').slice(0,240);
 if(result.sent){await rec.save();return{delivery:result.mode,messageId:result.messageId||undefined}}
 if(env.nodeEnv==='production'){rec.usedAt=new Date();await rec.save();throw exposed(result.providerMessage?`Verification email could not be sent: ${result.providerMessage}`:'Verification email could not be sent. Please retry shortly.',result.status===429?429:503)}
 await rec.save();return{delivery:'development-no-email',developmentOtp:code,note:'Development-only OTP returned once; plaintext is not stored or logged.'}
}
async function verify(email,purpose,otp){const rec=await Otp.findOne({email:email.toLowerCase(),purpose,usedAt:null}).sort({createdAt:-1}).select('+otpHash');if(!rec||rec.expiresAt<Date.now())throw exposed('OTP expired or not found',400);if(rec.attempts>=env.otpMaxAttempts)throw exposed('OTP attempt limit reached',429);rec.attempts+=1;if(!timingSafeEqualHash(otp,rec.otpHash)){await rec.save();throw exposed('Invalid OTP',400)}rec.usedAt=new Date();await rec.save();return rec}
module.exports={issue,verify};
