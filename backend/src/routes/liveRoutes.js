const r=require('express').Router();
const {authenticate}=require('../middleware/auth');
const c=require('../controllers/liveController');
r.get('/readiness',authenticate,c.readiness);
module.exports=r;
