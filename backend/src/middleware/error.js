const logger=require('../config/logger');
function notFound(req,res){res.status(404).json({success:false,message:'Route not found'})}
function errorHandler(err,req,res,next){
  logger.error({event:'request_error',message:err.message,path:req.path,stack:process.env.NODE_ENV==='development'?err.stack:undefined});
  if(err?.name==='CastError')return res.status(400).json({success:false,message:'Invalid identifier or value'});
  if(err?.name==='ValidationError')return res.status(422).json({success:false,message:'Validation failed'});
  if(err?.code===11000)return res.status(409).json({success:false,message:'Resource already exists'});
  res.status(err.status||500).json({success:false,message:err.expose?err.message:'Request failed'});
}
module.exports={notFound,errorHandler};
