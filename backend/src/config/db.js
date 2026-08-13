const mongoose=require('mongoose');const env=require('./env');const logger=require('./logger');
let retryTimer=null,connecting=false;
async function connectDB(){if(mongoose.connection.readyState===1)return mongoose.connection;if(connecting)return mongoose.connection;connecting=true;mongoose.set('strictQuery',true);try{await mongoose.connect(env.mongoUri,{serverSelectionTimeoutMS:5000});logger.info({event:'database_connected'});return mongoose.connection}finally{connecting=false}}
function startDatabaseRecovery({intervalMs=15000}={}){if(retryTimer)return retryTimer;const attempt=async()=>{if(mongoose.connection.readyState===1){clearInterval(retryTimer);retryTimer=null;return}try{await connectDB()}catch(e){logger.warn({event:'database_retry_failed',message:e.message,degraded:true})}};retryTimer=setInterval(attempt,intervalMs);retryTimer.unref?.();return retryTimer}
function stopDatabaseRecovery(){if(retryTimer){clearInterval(retryTimer);retryTimer=null}}
module.exports={connectDB,startDatabaseRecovery,stopDatabaseRecovery};
