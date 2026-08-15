const r=require('express').Router();
const svc=require('../services/geocodingService');

r.get('/status',(req,res)=>res.json({success:true,data:svc.status()}));
r.get('/search',async(req,res,next)=>{try{const data=await svc.search(req.query.q,{limit:Math.min(10,Number(req.query.limit)||6),lat:req.query.lat,lng:req.query.lng});res.json({success:true,data})}catch(e){next(e)}});
r.get('/reverse',async(req,res,next)=>{try{res.json({success:true,data:await svc.reverse(Number(req.query.lat),Number(req.query.lng))})}catch(e){next(e)}});
module.exports=r;
