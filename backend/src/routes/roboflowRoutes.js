// NAVORA_ROBOFLOW_V11_3
const r=require('express').Router();const c=require('../controllers/roboflowController');const {authenticate}=require('../middleware/auth');r.get('/status',c.status);r.post('/infer',authenticate,c.infer);module.exports=r;
