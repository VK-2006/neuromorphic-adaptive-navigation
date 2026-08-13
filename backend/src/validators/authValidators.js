const { body } = require('express-validator');

exports.register = [
  body('name').trim().isLength({ min: 2, max: 80 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 })
];

exports.login = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 128 })
];

exports.otp = [
  body('email').isEmail().normalizeEmail(),
  body('otp').matches(/^\d{6}$/)
];

exports.email = [
  body('email').isEmail().normalizeEmail()
];

exports.reset = [
  body('resetToken').isString().isLength({ min: 20, max: 512 }),
  body('password').isLength({ min: 8, max: 128 })
];

exports.google = [
  body('idToken').isString().isLength({ min: 40, max: 10000 })
];
