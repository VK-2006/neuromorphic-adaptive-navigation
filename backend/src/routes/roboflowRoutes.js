// NAVORA_ROBOFLOW_V11_7
const r=require('express').Router();
const c=require('../controllers/roboflowController');
const {authenticate}=require('../middleware/auth');
const {roboflowInferenceLimiter}=require('../middleware/rateLimits');

r.get('/status',c.status);
r.post('/probe',c.probe);
r.post('/infer',authenticate,roboflowInferenceLimiter,c.infer);
r.post('/analyze',authenticate,roboflowInferenceLimiter,c.analyze);

module.exports=r;
