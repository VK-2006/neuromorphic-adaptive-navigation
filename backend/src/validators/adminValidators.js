const {body,param}=require('express-validator');
exports.id=[param('id').isMongoId()];
exports.userUpdate=[param('id').isMongoId(),body('role').optional().isIn(['USER','ADMIN']),body('disabled').optional().isBoolean()];
exports.hazardReview=[param('id').isMongoId(),body('status').isIn(['VERIFIED','REJECTED'])];
exports.chatReview=[param('id').isMongoId(),body('status').isIn(['REVIEWED','DISMISSED','ACTIONED'])];
