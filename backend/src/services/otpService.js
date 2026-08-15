const Otp = require('../models/OtpVerification');
const env = require('../config/env');
const { randomOtp, sha256, timingSafeEqualHash } = require('../utils/crypto');
const { sendEmail } = require('./emailService');

async function issue(email, purpose) {
  email = email.toLowerCase();

  const recent = await Otp.findOne({
    email,
    purpose,
    usedAt: null
  }).sort({ lastSentAt: -1 });

  if (
    recent &&
    Date.now() - recent.lastSentAt.getTime() <
      env.otpResendCooldownSeconds * 1000
  ) {
    throw new Error('Please wait before requesting another OTP');
  }

  await Otp.updateMany(
    { email, purpose, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  const otp = randomOtp();

  await Otp.create({
    email,
    purpose,
    otpHash: sha256(otp),
    attempts: 0,
    expiresAt: new Date(Date.now() + env.otpExpiryMinutes * 60000),
    lastSentAt: new Date()
  });

  const result = await sendEmail({
    to: email,
    subject:
      purpose === 'EMAIL_VERIFY'
        ? 'Verify your Navora email'
        : 'Reset your Navora password',
    html: `
      <p>Your Navora verification code is <strong>${otp}</strong>.</p>
      <p>It expires in ${env.otpExpiryMinutes} minutes.</p>
    `
  });

  return result.sent
    ? { delivery: result.mode }
    : {
        delivery: 'development-no-email',
        developmentOtp: env.nodeEnv === 'production' ? undefined : otp,
        note:
          env.nodeEnv === 'production'
            ? 'Email credentials required'
            : 'Development-only OTP returned once; it is not stored or logged in plaintext.'
      };
}

async function verify(email, purpose, otp) {
  const rec = await Otp.findOne({
    email: email.toLowerCase(),
    purpose,
    usedAt: null
  })
    .sort({ createdAt: -1 })
    .select('+otpHash');

  if (!rec || rec.expiresAt < Date.now()) {
    throw new Error('OTP expired or not found');
  }

  if (rec.attempts >= env.otpMaxAttempts) {
    throw new Error('OTP attempt limit reached');
  }

  rec.attempts += 1;

  if (!timingSafeEqualHash(otp, rec.otpHash)) {
    await rec.save();
    throw new Error('Invalid OTP');
  }

  rec.usedAt = new Date();
  await rec.save();

  return rec;
}

module.exports = { issue, verify };
