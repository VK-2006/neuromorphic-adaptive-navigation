const { chromium } = require('playwright');

const turn = {
  urls: process.env.WEBRTC_TURN_URL,
  username: process.env.WEBRTC_TURN_USERNAME,
  credential: process.env.WEBRTC_TURN_CREDENTIAL,
};
if (!turn.urls || !turn.username || !turn.credential) throw new Error('TURN credentials are required');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    const result = await page.evaluate(async (iceServer) => {
      const pc = new RTCPeerConnection({ iceServers: [iceServer], iceTransportPolicy: 'relay' });
      const relayCandidates = [];
      pc.onicecandidate = event => {
        const candidate = event.candidate?.candidate || '';
        if (candidate.includes(' typ relay')) relayCandidates.push(candidate);
      };
      pc.createDataChannel('navora-turn');
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 12000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timer);
            resolve();
          }
        };
      });
      const result = { ok: relayCandidates.length > 0, relayCandidates: relayCandidates.length };
      pc.close();
      return result;
    }, turn);
    if (!result.ok) throw new Error(`No TURN relay candidate gathered (${result.relayCandidates})`);
    console.log(`TURN_RELAY_VALIDATION: PASS (${result.relayCandidates} relay candidate(s))`);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('TURN_RELAY_VALIDATION: FAIL');
  console.error(err.stack || err.message || err);
  process.exitCode = 1;
});
