const {body}=require('express-validator');
const coord=(prefix,{optional=false}={})=>{
  let lat=body(`${prefix}.lat`),lng=body(`${prefix}.lng`);
  if(optional){lat=lat.optional({nullable:true});lng=lng.optional({nullable:true})}
  return [lat.isFloat({min:-90,max:90}),lng.isFloat({min:-180,max:180})];
};
exports.analyze=[
  body('journeyId').optional({nullable:true}).isMongoId(),
  body('deviceId').optional({nullable:true}).isMongoId(),
  body('detections').isArray({max:50}),
  body('detections.*.objectClass').optional().isString().isLength({max:80}),
  body('detections.*.confidence').optional().isFloat({min:0,max:1}),
  body('detections.*.estimatedDistance').optional().isFloat({min:0,max:500}),
  body('detections.*.relativeSpeed').optional().isFloat({min:-100,max:100}),
  body('detections.*.objectPersistence').optional().isFloat({min:0,max:1}),
  body('detections.*.boundingBox').optional().isArray({min:4,max:4}),
  ...coord('location',{optional:true}),
  body('location.speed').optional({nullable:true}).isFloat({min:0,max:200}),
  body('context.visibility').optional().isFloat({min:0,max:1}),
  body('context.trafficDensity').optional().isFloat({min:0,max:1}),
  body('context.hazardFrequency').optional().isFloat({min:0,max:1}),
  body('context.weatherRisk').optional().isFloat({min:0,max:1}),
  body('context.roadCondition').optional().isFloat({min:0,max:1}),
  body('context.frameTransmitted').optional().isBoolean(),
  body('context.source').optional().isString().isLength({max:100})
];
