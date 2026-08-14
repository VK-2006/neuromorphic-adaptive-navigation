const User=require('../models/User');
const AuditLog=require('../models/AuditLog');

exports.updateUser=async(req,res)=>{
  const target=await User.findById(req.params.id);
  if(!target)return res.status(404).json({success:false,message:'User not found'});
  const self=String(target._id)===String(req.user._id);
  const wantsDemote=req.body.role==='USER'&&target.role==='ADMIN';
  const wantsDisable=req.body.disabled===true&&target.disabledAt==null;

  if(self&&(wantsDemote||wantsDisable)){
    return res.status(422).json({success:false,message:wantsDemote?'You cannot demote your own active admin session':'You cannot disable your own admin session'});
  }

  if(target.role==='ADMIN'&&(wantsDemote||wantsDisable)){
    const activeAdmins=await User.countDocuments({role:'ADMIN',disabledAt:null});
    if(activeAdmins<=1)return res.status(422).json({success:false,message:'The last active administrator cannot be demoted or disabled'});
  }

  const patch={};
  if(['USER','ADMIN'].includes(req.body.role))patch.role=req.body.role;
  if(req.body.disabled===true)patch.disabledAt=new Date();
  if(req.body.disabled===false)patch.disabledAt=null;

  Object.assign(target,patch);await target.save();
  await AuditLog.create({
    actorId:req.user._id,action:'USER_ADMIN_UPDATE',targetType:'User',targetId:target._id,
    result:JSON.stringify({role:patch.role??target.role,disabled:target.disabledAt!=null})
  });
  res.json({success:true,data:{_id:target._id,name:target.name,email:target.email,role:target.role,emailVerified:target.emailVerified,disabledAt:target.disabledAt}});
};
