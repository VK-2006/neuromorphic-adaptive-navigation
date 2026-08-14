from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p):return (ROOT/p).read_text(encoding='utf-8')
def need(p,*xs):
    t=read(p);missing=[x for x in xs if x not in t]
    assert not missing,f'{p}: missing {missing}'

need('frontend/public/register.html','id="google-signin"','data-google-mode="signup"','accounts.google.com/gsi/client','id="confirm-password"')
need('frontend/assets/js/auth.js',"text:mode==='signup'?'signup_with':'continue_with'","Passwords do not match.","resend-reset")
for p in ['frontend/public/verify-email.html','frontend/public/verify-otp.html']:
    need(p,'autocomplete="one-time-code"','pattern="[0-9]{6}"')
need('frontend/public/verify-otp.html','id="resend-reset"','id="email"')
need('frontend/public/reset-password.html','id="confirm-password"')
need('frontend/assets/js/map.js',"navora:preferences",'setStartEnabled(false)','Map unavailable')
need('frontend/public/journey.html','local-detection-bridge.js','Frames stay in browser','metadata only sent')
bridge=read('frontend/assets/js/local-detection-bridge.js')
assert "DETECT_PATH='/api/v1/hazards/detect'" in bridge and "ANALYZE_PATH='/api/v1/hazards/analyze'" in bridge
assert 'requestBody.image' not in bridge and 'frameTransmitted:false' in bridge
need('backend/src/routes/hazardRoutes.js',"r.post('/analyze'")
need('backend/src/controllers/hazardMetadataController.js','frameTransmitted:false','detectorValidated=false','verifiedNearby')
need('frontend/assets/js/chat.js','typingTimers','removeMessage(m.id)','m.editedAt')
need('frontend/assets/js/replay.js','buildTimeline','interpolatePoint','currentTime()')
need('frontend/assets/js/data-pages.js','replayable','removeAttribute(\'data-read\')')
need('backend/src/middleware/contactSafety.js','Email is required')
runtime=read('scripts/runtime_e2e.js')
assert "email:'e2e-contact@example.com'" in runtime and "sharePermission:true" in runtime, 'runtime SOS fixture must use a deliverable trusted contact'
need('backend/src/controllers/adminSafetyController.js','last active administrator','cannot demote your own')
need('frontend/assets/js/admin.js','Demote this administrator','Disable this user account')
need('frontend/assets/js/devices.js','startNotifications','SENSOR_STREAM','Stream sensor')
need('frontend/assets/js/shared-journey.js','delay=Math.min(60000','Link expired or revoked')
need('backend/src/controllers/liveController.js','webrtcConfig','turnConfigured')
rtc=read('frontend/assets/js/v9-functional.js')
assert "fetch('/api/v1/live/webrtc-config'" in rtc, 'optional ICE config must use direct fetch'
assert "api('/live/webrtc-config')" not in rtc, 'optional ICE config must not dispatch global auth-required on 401'
need('backend/src/config/env.js','WEBRTC_TURN_URL','WEBRTC_TURN_USERNAME','WEBRTC_TURN_CREDENTIAL')
need('frontend/assets/js/research-telemetry.js','NavoraResearchTelemetry')
need('scripts/browser_v9_local_runner.js','browser_v9_functional_e2e.js','server.listen(0','Local V9 harness API fallback')
need('frontend/assets/js/three-research.js','telemetry()','navora:research-telemetry')
sw=read('frontend/service-worker.js')
assert "const CACHE='navora-v9-functional-e2e-1'" in sw and all('/'+p in sw for p in [
'index.html','register.html','verify-email.html','login.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html','camera-share.html','shared-journey.html','offline.html','admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html'])
print('V9_CONTRACTS PASS: Google signup, auth recovery, preferences, metadata-only local perception, chat/replay/settings/admin/device/share/PWA hardening are present')
