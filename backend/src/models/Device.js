
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  name:{type:String,required:true},
  deviceType:{type:String,enum:['BROWSER_CAMERA','BLUETOOTH_SENSOR','WEBRTC_CAMERA','WIFI_CAMERA','OTHER'],default:'OTHER'},
  externalId:String,battery:Number,lastSeenAt:Date,capabilities:[String],enabled:{type:Boolean,default:true},
  connectionStatus:{type:String,enum:['UNKNOWN','CONNECTED','DISCONNECTED','ERROR'],default:'UNKNOWN'},
  serviceUuid:{type:String,maxlength:200,default:''},
  controlCharacteristicUuid:{type:String,maxlength:200,default:''},
  sensorCharacteristicUuid:{type:String,maxlength:200,default:''},
  lastCommand:{type:String,maxlength:80,default:''},
  lastCommandAt:Date,
  lastSensorValue:{type:String,maxlength:500,default:''},
  lastSensorAt:Date
},{timestamps:true});
schema.index({userId:1,externalId:1},{unique:true,sparse:true});
module.exports=mongoose.model('Device',schema);
