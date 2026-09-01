from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def read(p):
   return (ROOT / p).read_text(encoding='utf-8', errors='ignore')

def need(p, *xs):
   text = read(p)
   missing = [x for x in xs if x not in text]
   assert not missing, f'{p}: missing {missing}'

need('frontend/public/register.html', 'id="google-signin"', 'data-google-mode="signup"', 'accounts.google.com/gsi/client', 'id="confirm-password"')
need('frontend/assets/js/auth.js', "text:mode==='signup'?'signup_with':'continue_with'", 'Passwords do not match.', 'resend-reset')
for p in ['frontend/public/verify-email.html', 'frontend/public/verify-otp.html']:
   need(p, 'autocomplete="one-time-code"', 'pattern="[0-9]{6}"')
need('frontend/public/verify-otp.html', 'id="resend-reset"', 'id="email"')
need('frontend/public/reset-password.html', 'id="confirm-password"')
need('frontend/assets/js/map.js', "navora:preferences", 'setStartEnabled(false)', 'Map unavailable')
need('frontend/public/journey.html', 'Start / Resume', 'Pause', 'Complete', 'Voice', 'Create secure share link', 'SOS', 'reroute-comparison')
journey = read('frontend/assets/js/journey.js')
for signal in ['/journeys/', '/routes/reroute', 'speechSynthesis', 'share', 'watchPosition(']:
   assert signal in journey, f'journey.js missing {signal}'
assert 'MediaRecorder' not in journey, 'journey.js should not rely on MediaRecorder camera capture'
assert 'camera-share.html' not in read('frontend/service-worker.js')
assert 'camera-share.html' not in read('frontend/assets/js/app-shell.js')
assert 'v9-functional.js' not in read('frontend/public/journey.html')
assert 'v9-functional.js' not in read('frontend/assets/js/theme.js')
need('frontend/assets/js/devices.js', 'navigator.bluetooth', 'optionalServices', 'Stream sensor')
need('frontend/assets/js/chat.js', 'typingTimers', 'removeMessage(m.id)', 'm.editedAt')
need('frontend/assets/js/replay.js', 'buildTimeline', 'interpolatePoint', 'currentTime()')
need('backend/src/middleware/contactSafety.js', 'Email is required')
need('frontend/assets/js/shared-journey.js', 'Link expired or revoked')
need('frontend/service-worker.js', '/journey.html', '/devices.html', '/shared-journey.html')
print('V9_CONTRACTS PASS: active NAVORA journey, share flow, Bluetooth controller sync, and PWA shell match the current camera-free runtime.')
