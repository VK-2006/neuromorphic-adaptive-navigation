from pathlib import Path
import re
# NAVORA_V9_SEMANTIC_CONTRACTS: validate behavior without whitespace or release-name coupling.
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
forbidden_local_payloads=('requestBody.image','requestBody.frame','requestBody.video','requestBody.blob')
assert not any(x in bridge for x in forbidden_local_payloads), 'browser-local bridge must not forward raw frame fields'
assert re.search(r'\bframeTransmitted\s*:\s*false\b',bridge), 'browser-local bridge must mark frames as not transmitted'
need('backend/src/routes/hazardRoutes.js',"r.post('/analyze'")
controller=read('backend/src/controllers/hazardMetadataController.js')
assert re.search(r'\b(?:const|let|var)\s+detectorValidated\s*=\s*false\b',controller), 'browser-local detector must be explicitly unvalidated'
assert re.search(r'\bframeTransmitted\s*:\s*false\b',controller), 'controller must preserve no-frame-transmission privacy metadata'
assert re.search(r"\bdetectorLocation\s*:\s*['\"]browser['\"]",controller), 'controller must identify browser-local detection'
assert re.search(r"\bnetworkPayload\s*:\s*['\"]metadata-only['\"]",controller), 'controller must declare metadata-only network payloads'
assert 'verifiedNearby' in controller, 'controller must hydrate nearby verified reports'
assert 'req.body.image' not in controller and 'req.body.frame' not in controller, 'metadata controller must not consume raw image/frame fields'
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
cache=re.search(r"\bconst\s+CACHE\s*=\s*(['\"])([^'\"]+)\1\s*;",sw)
assert cache and cache.group(2).strip(), 'service worker must define a non-empty cache version'
shell_pages=[
'index.html','register.html','verify-email.html','login.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','journey-replay.html','history.html','notifications.html','profile.html','settings.html','camera-share.html','shared-journey.html','offline.html','admin.html','admin-users.html','admin-devices.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html']
missing_shell_pages=[p for p in shell_pages if '/'+p not in sw]
assert len(shell_pages)==28, f'PWA shell contract expected 28 pages, found {len(shell_pages)}'
assert not missing_shell_pages, f'service worker shell missing {missing_shell_pages}'
print('V9_CONTRACTS PASS: Google signup, auth recovery, preferences, metadata-only local perception, chat/replay/settings/admin/device/share/PWA hardening are present')
