const express = require('express');
const r = express.Router();

const c = require('../controllers/authController');
const v = require('../validators/authValidators');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimits');

r.get('/config', c.config);

r.post('/register', authLimiter, v.register, validate, c.register);
r.post('/verify-email', otpLimiter, v.otp, validate, c.verifyEmail);
r.post('/resend-verification', otpLimiter, v.email, validate, c.resendVerification);

r.post('/login', authLimiter, v.login, validate, c.login);
r.post('/refresh', authLimiter, c.refresh);
r.post('/logout', c.logout);

r.post('/forgot-password', otpLimiter, v.email, validate, c.forgot);
r.post('/verify-reset-otp', otpLimiter, v.otp, validate, c.verifyResetOtp);
r.post('/reset-password', authLimiter, v.reset, validate, c.resetPassword);

r.post('/google', authLimiter, v.google, validate, c.google);

r.post('/passkeys/register/options', authenticate, c.passkeyRegOptions);
r.post('/passkeys/register/verify', authenticate, c.passkeyRegVerify);
r.post('/passkeys/auth/options', authLimiter, v.email, validate, c.passkeyAuthOptions);
r.post('/passkeys/auth/verify', authLimiter, c.passkeyAuthVerify);

module.exports = r;
