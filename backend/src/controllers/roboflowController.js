// NAVORA_ROBOFLOW_V11_3
const roboflow=require('../services/roboflowService');const {ok}=require('../utils/response');
exports.status=(req,res)=>ok(res,roboflow.status());
exports.infer=async(req,res)=>{if(req.body?.consentToCloudProcessing!==true)return res.status(422).json({success:false,message:'Explicit consentToCloudProcessing=true is required because the image is sent to Roboflow cloud inference.'});const result=await roboflow.infer({image:req.body?.image,classes:req.body?.classes});ok(res,{...result,privacy:{cloudProcessed:true,provider:'Roboflow',rawImageStoredByNavora:false,note:'Opt-in endpoint; browser-local COCO-SSD remains the default live detector.'}})};
