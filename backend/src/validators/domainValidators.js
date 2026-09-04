
const {body,param}=require('express-validator');
const coord=(prefix,{optional=false}={})=>{
  let lat=body(`${prefix}.lat`),lng=body(`${prefix}.lng`);
  if(optional){lat=lat.optional();lng=lng.optional()}
  return [lat.isFloat({min:-90,max:90}),lng.isFloat({min:-180,max:180})];
};
exports.mongoIdParam=[param('id').isMongoId()];
exports.journeyCreate=[body('routeId').optional({nullable:true}).isMongoId(),body('mode').optional().isIn(['LIVE','SIMULATION']),...coord('source',{optional:true}),...coord('destination',{optional:true})];
exports.journeySwitch=[param('id').isMongoId(),body('routeId').isMongoId(),body('reason').optional().isString().isLength({max:240})];
exports.journeyComplete=[param('id').isMongoId(),body('success').optional().isBoolean(),body('userFeedback').optional().isFloat({min:0,max:1})];
exports.journeyShare=[param('id').isMongoId(),body('hours').optional().isFloat({min:.25,max:24})];
exports.journeyIdParam=[param('id').isMongoId()];
exports.tracking=[body('journeyId').isMongoId(),body('lat').isFloat({min:-90,max:90}),body('lng').isFloat({min:-180,max:180}),body('accuracy').optional().isFloat({min:0,max:10000}),body('heading').optional({nullable:true}).isFloat({min:0,max:360}),body('speed').optional({nullable:true}).isFloat({min:0,max:200}),body('altitude').optional({nullable:true}).isFloat({min:-1000,max:20000}),body('timestamp').optional().custom(v=>Number.isFinite(Number(v))||!Number.isNaN(Date.parse(v))).withMessage('Invalid timestamp')];
exports.reroute=[body('journeyId').isMongoId(),...coord('currentLocation',{optional:true}),body('preferences.safety').optional().isFloat({min:0,max:1}),body('preferences.traffic').optional().isFloat({min:0,max:1}),body('preferences.familiarity').optional().isFloat({min:0,max:1})];
exports.detect=[body('journeyId').optional({nullable:true}).isMongoId(),body('image').isString().isLength({min:20,max:2_800_000}),...coord('location',{optional:true}),body('location.speed').optional({nullable:true}).isFloat({min:0,max:200})];
exports.hazardReport=[body('journeyId').optional({nullable:true}).isMongoId(),body('type').trim().isLength({min:2,max:80}),...coord('location'),body('confidence').optional().isFloat({min:0,max:1}),body('riskScore').optional().isFloat({min:0,max:1}),body('riskLevel').optional().isIn(['LOW','MEDIUM','HIGH','CRITICAL'])];
exports.hazardConfirm=[param('id').isMongoId(),body('confirmed').optional().isBoolean(),...coord('location')];
exports.sos=[body('journeyId').isMongoId(),...coord('location',{optional:true}),body('location.accuracy').optional({nullable:true}).isFloat({min:0,max:10000}),body('location.heading').optional({nullable:true}).isFloat({min:0,max:360}),body('location.speed').optional({nullable:true}).isFloat({min:0,max:200}),body('location.timestamp').optional().custom(v=>Number.isFinite(Number(v))||!Number.isNaN(Date.parse(v))).withMessage('Invalid location timestamp')];

exports.contactCreate=[body('name').trim().isLength({min:1,max:100}),body('phone').optional().isString().isLength({max:32}),body('email').optional({checkFalsy:true}).isEmail().normalizeEmail(),body('relationship').optional().isString().isLength({max:80}),body('sharePermission').optional().isBoolean()];
exports.contactPatch=[param('id').isMongoId(),body('name').optional().trim().isLength({min:1,max:100}),body('phone').optional().isString().isLength({max:32}),body('email').optional({checkFalsy:true}).isEmail().normalizeEmail(),body('relationship').optional().isString().isLength({max:80}),body('sharePermission').optional().isBoolean()];
exports.profilePatch=[
  body('name').optional().trim().isLength({min:2,max:80}),
  body('phone').optional().isString().isLength({max:32}),
  body('city').optional().isString().isLength({max:80}),
  body('country').optional().isString().isLength({max:80}),
  body('preferredLanguage').optional().isIn(['en-IN','en-US','te-IN','hi-IN']),
  body('preferences.safety').optional().isFloat({min:0,max:1}),
  body('preferences.traffic').optional().isFloat({min:0,max:1}),
  body('preferences.familiarity').optional().isFloat({min:0,max:1}),
  body('preferences.theme').optional().isIn(['LIGHT','DARK','SYSTEM']),
  body('preferences.units').optional().isIn(['METRIC','IMPERIAL']),
  body('preferences.voiceLanguage').optional().isIn(['en-IN','en-US','te-IN','hi-IN']),
  body('preferences.detectionMode').optional().isIn(['LOCAL','CLOUD']),
  body('preferences.highAccuracyGps').optional().isBoolean()
];

exports.simulationStep=[body('journeyId').isMongoId(),body('index').isInt({min:0,max:100000}),...coord('location'),body('location.speed').optional({nullable:true}).isFloat({min:0,max:200})];
