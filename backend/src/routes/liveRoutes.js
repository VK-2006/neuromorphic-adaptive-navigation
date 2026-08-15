const r=require('express').Router();
const {authenticate}=require('../middleware/auth');
const c=require('../controllers/liveController');
r.get('/readiness',authenticate,c.readiness);
r.get('/webrtc-config',authenticate,c.webrtcConfig);
module.exports=r;
