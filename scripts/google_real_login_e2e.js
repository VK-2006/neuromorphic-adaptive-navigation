const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const base = (process.env.NAVORA_BASE_URL || 'https://navora-backend-clzp.onrender.com').replace(/\/$/, '');
const stateB64 = process.env.GOOGLE_AUTH_STORAGE_STATE_B64;
if (!stateB64) throw new Error('GOOGLE_AUTH_STORAGE_STATE_B64 is required');
const statePath = path.join(os.tmpdir(), `navora-google-${process.pid}.json`);
fs.writeFileSync(statePath, Buffer.from(stateB64, 'base64'), { mode: 0o600 });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${base}/login.html`, { waitUntil: 'networkidle' });
    const config = await page.evaluate(async () => {
      const r = await fetch('/api/v1/auth/config', { credentials: 'include' });
      return r.ok ? r.json() : { ok: false, status: r.status };
    });
    if (!config?.google?.enabled || !config.google.clientId) {
      throw new Error('Google Identity Services is not configured in production');
    }
    const googleButton = page.locator('#google-signin iframe, #google-signin [role="button"]');
    if (await googleButton.count() === 0) {
      throw new Error('Google Sign-In control did not render');
    }
    await page.goto(`${base}/dashboard.html`, { waitUntil: 'networkidle' });
    if (!page.url().includes('/dashboard.html')) {
      throw new Error(`Stored Google session was not accepted; redirected to ${page.url()}`);
    }
    if (errors.length) throw new Error(`Browser page errors: ${errors.join(' | ')}`);
    console.log('GOOGLE_REAL_BROWSER_VALIDATION: PASS');
  } finally {
    await browser.close();
    try { fs.rmSync(statePath, { force: true }); } catch {}
  }
})().catch(err => {
  console.error('GOOGLE_REAL_BROWSER_VALIDATION: FAIL');
  console.error(err.stack || err.message || err);
  process.exitCode = 1;
});
