const TrustedContact=require('../models/TrustedContact');

module.exports=async function contactSafety(req,res,next){
  try{
    if(req.method==='POST'){
      if(req.body.sharePermission===true&&!String(req.body.email||'').trim()){
        return res.status(422).json({success:false,message:'Email is required when journey sharing/SOS alerts are enabled'});
      }
      return next();
    }
    if(req.method==='PATCH'){
      const current=await TrustedContact.findOne({_id:req.params.id,userId:req.user._id}).lean();
      if(!current)return res.status(404).json({success:false,message:'Contact not found'});
      const nextShare=req.body.sharePermission===undefined?current.sharePermission:req.body.sharePermission===true;
      const nextEmail=req.body.email===undefined?current.email:String(req.body.email||'').trim();
      if(nextShare&&!nextEmail)return res.status(422).json({success:false,message:'Email is required while journey sharing/SOS alerts are enabled'});
    }
    next();
  }catch(e){next(e)}
};
