
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:80},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true,index:true},
  passwordHash:{type:String,select:false},
  googleSub:{type:String,sparse:true,unique:true},
  avatarUrl:String,
  emailVerified:{type:Boolean,default:false},
  role:{type:String,enum:['USER','ADMIN'],default:'USER'},
  phone:{type:String,trim:true,maxlength:32,default:''},
  city:{type:String,trim:true,maxlength:80,default:''},
  country:{type:String,trim:true,maxlength:80,default:''},
  preferredLanguage:{type:String,enum:['en-IN','en-US','te-IN','hi-IN'],default:'en-IN'},
  preferences:{
    safety:{type:Number,min:0,max:1,default:.7},
    traffic:{type:Number,min:0,max:1,default:.5},
    familiarity:{type:Number,min:0,max:1,default:.4},
    theme:{type:String,enum:['LIGHT','DARK','SYSTEM'],default:'SYSTEM'},
    units:{type:String,enum:['METRIC','IMPERIAL'],default:'METRIC'},
    voiceLanguage:{type:String,enum:['en-IN','en-US','te-IN','hi-IN'],default:'en-IN'},
    detectionMode:{type:String,enum:['LOCAL','CLOUD'],default:'LOCAL'},
    highAccuracyGps:{type:Boolean,default:true}
  },
  disabledAt:Date,
  lastLoginAt:Date
},{timestamps:true});
module.exports=mongoose.model('User',schema);
