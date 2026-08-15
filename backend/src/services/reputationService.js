const UserReputation=require('../models/UserReputation');
const COUNT_FIELDS=['reportsSubmitted','reportsVerified','reportsRejected','nearbyConfirmations','falseReports'];
function score(r){const submitted=Math.max(1,r.reportsSubmitted||0);const verified=(r.reportsVerified||0)+(r.nearbyConfirmations||0)*.3;const penalties=(r.reportsRejected||0)*.7+(r.falseReports||0)*1.5;return Math.max(0,Math.min(1,.5+(verified-penalties)/(submitted+5)))}
async function update(userId,delta){const r=await UserReputation.findOneAndUpdate({userId},{$inc:delta},{$setOnInsert:{userId},upsert:true,new:true});for(const k of COUNT_FIELDS)r[k]=Math.max(0,Number(r[k])||0);r.reputationScore=score(r);await r.save();return r}
module.exports={score,update};
