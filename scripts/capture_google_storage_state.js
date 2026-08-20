const { chromium } = require('playwright');

const base = (process.env.NAVORA_BASE_URL || 'https://navora-backend-clzp.onrender.com').replace(/\/$/, '');
const output = process.env.GOOGLE_STORAGE_STATE_OUT || 'navora-google-storage-state.json';

(async () => {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${base}/login.html`, { waitUntil: 'domcontentloaded' });
    console.log('Complete the REAL Google Sign-In in the opened browser window.');
    console.log('After the authenticated dashboard is visible, return here and press Enter.');
    await new Promise(resolve => process.stdin.once('data', resolve));
    await context.storageState({ path: output });
    console.log(`Storage state saved to ${output}`);
    console.log('Treat this file like a credential. Do not commit or upload it anywhere except as the protected GitHub secret GOOGLE_AUTH_STORAGE_STATE_B64.');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('GOOGLE_STORAGE_CAPTURE: FAIL');
  console.error(err.stack || err.message || err);
  process.exitCode = 1;
});
