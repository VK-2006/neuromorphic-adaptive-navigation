// NAVORA_ROBOFLOW_V11_4
const r=require('express').Router();
const c=require('../controllers/roboflowController');
const {authenticate}=require('../middleware/auth');

r.get('/status',c.status);
r.post('/probe',c.probe);
r.post('/infer',authenticate,c.infer);
r.post('/analyze',authenticate,c.analyze);

module.exports=r;
