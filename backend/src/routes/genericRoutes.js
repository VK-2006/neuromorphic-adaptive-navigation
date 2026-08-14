const express=require('express');
const c=require('../controllers/genericController');
const {authenticate}=require('../middleware/auth');
const v=require('../validators/domainValidators');
const validate=require('../middleware/validate');
const contactSafety=require('../middleware/contactSafety');
function router(){const r=express.Router();r.use(authenticate);return r}
exports.users=(()=>{const r=router();r.get('/me',c.profile);r.patch('/me',v.profilePatch,validate,c.updateProfile);r.get('/dashboard',c.dashboard);return r})();
exports.devices=(()=>{const r=router();r.get('/',c.devices);r.post('/',v.deviceCreate,validate,c.addDevice);r.patch('/:id',v.devicePatch,validate,c.updateDevice);r.delete('/:id',v.mongoIdParam,validate,c.deleteDevice);return r})();
exports.memory=(()=>{const r=router();r.get('/',c.memory);return r})();
exports.notifications=(()=>{const r=router();r.get('/',c.notifications);r.patch('/:id/read',v.mongoIdParam,validate,c.readNotification);return r})();
exports.contacts=(()=>{const r=router();r.get('/',c.contacts);r.post('/',v.contactCreate,validate,contactSafety,c.addContact);r.patch('/:id',v.contactPatch,validate,contactSafety,c.updateContact);r.delete('/:id',v.mongoIdParam,validate,c.deleteContact);return r})();
