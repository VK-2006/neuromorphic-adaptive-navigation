const rateLimit=require('express-rate-limit');
exports.apiLimiter=rateLimit({windowMs:60_000,limit:180,standardHeaders:'draft-7',legacyHeaders:false});
exports.authLimiter=rateLimit({windowMs:15*60_000,limit:30,standardHeaders:'draft-7',legacyHeaders:false});
exports.otpLimiter=rateLimit({windowMs:15*60_000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});
exports.roboflowInferenceLimiter=rateLimit({windowMs:60_000,limit:40,standardHeaders:'draft-7',legacyHeaders:false});
