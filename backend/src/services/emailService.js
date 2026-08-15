const env = require('../config/env');
const logger = require('../config/logger');

// Constructed in pieces so copied source never gets converted into a markdown-style link.
const BREVO_SEND_URL = [
  'https:',
  '',
  'api.brevo.com',
  'v3',
  'smtp',
  'email'
].join('/');

async function sendEmail({ to, subject, html }) {
  if (!env.brevoApiKey || !env.brevoSenderEmail) {
    logger.warn({
      event: 'brevo_credentials_required',
      toDomain: String(to).split('@')[1]
    });

    return { mode: 'credentials-required', sent: false };
  }

  try {
    const r = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': env.brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({
        sender: {
          email: env.brevoSenderEmail,
          name: env.brevoSenderName
        },
        to: [{ email: to }],
        subject,
        htmlContent: html
      }),
      signal: AbortSignal.timeout(7000)
    });

    if (!r.ok) {
      logger.warn({ event: 'brevo_provider_error', status: r.status });
      return { mode: 'degraded', sent: false, error: `HTTP ${r.status}` };
    }

    return { mode: 'live', sent: true };
  } catch (e) {
    logger.warn({
      event: 'brevo_provider_unavailable',
      message: e.message
    });

    return { mode: 'degraded', sent: false, error: e.message };
  }
}

module.exports = { sendEmail };
