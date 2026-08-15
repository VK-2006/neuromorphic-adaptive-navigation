from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(p):
    return (ROOT/p).read_text(encoding='utf-8')

# ----- Exact page-sweep contract -----
sweep=read('scripts/browser_v8_full_sweep.js')
m=re.search(r"const pages=\[(.*?)\];",sweep,re.S)
assert m, 'browser_v8_full_sweep.js: pages list not found'
pages=re.findall(r"'([^']+\.html)'",m.group(1))
expected=[
    'index.html','register.html','verify-email.html','login.html','forgot-password.html',
    'verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html',
    'world-chat.html','devices.html','memory.html','journey-replay.html','history.html',
    'notifications.html','profile.html','settings.html','camera-share.html','shared-journey.html',
    'offline.html','admin.html','admin-users.html','admin-devices.html','admin-hazards.html',
    'admin-chat.html','admin-health.html','admin-audit.html'
]
assert len(pages)==28, f'expected 28 pages, found {len(pages)}'
assert len(set(pages))==28, 'duplicate page exists in browser sweep'
assert pages==expected, f'page sweep differs from expected list: {pages}'
for signal in [
    'initial-load',
    'corrupted localStorage',
    'Replay degrades safely',
    'public page redirected unexpectedly',
    "serviceWorkers:'block'",
]:
    assert signal in sweep, f'browser sweep missing {signal}'

# ----- Runtime hardening contracts -----
shell=read('frontend/assets/js/app-shell.js')
assert "protectedPages.has(page)||adminPages.has(page)" in shell
assert "if(!protectedPages.has(page)&&!adminPages.has(page))return" in shell

chat=read('frontend/assets/js/chat.js')
assert 'safeJson' in chat
assert "JSON.parse(localStorage.getItem('navoraChatUnread')" not in chat
assert 'asArray' in chat

offline=read('frontend/assets/js/offline.js')
assert 'safeJson' in offline

replay=read('frontend/assets/js/replay.js')
assert 'leafletReady' in replay
assert 'Map unavailable' in replay

camera=read('frontend/assets/js/camera-share.js')
assert 'window.io' in camera
assert 'window.RTCPeerConnection' in camera
assert 'window.isSecureContext' in camera

dashboard=read('frontend/assets/js/dashboard.js')
assert 'Array.isArray' in dashboard

account=read('frontend/assets/js/account.js')
assert 'encodeURIComponent(b.dataset.deleteContact)' in account

data=read('frontend/assets/js/data-pages.js')
assert 'temporarily unavailable' in data

devices=read('frontend/assets/js/devices.js')
assert 'GATT' in devices
assert 'DETECTION_ON / DETECTION_OFF' in devices

theme=read('frontend/assets/js/theme.js')
assert "typeof window.matchMedia==='function'" in theme

mapjs=read('frontend/assets/js/map.js')
assert 'safeStoredArray' in mapjs

journey=read('frontend/assets/js/journey.js')
assert "showNoJourneyState(e.message)" in journey
assert "window.RTCPeerConnection" in journey

# Local runner contract belongs to the runner; serviceWorkers belongs to the sweep above.
runner=read('scripts/browser_v8_local_runner.js')
for signal in [
    "server.listen(0",
    "browser_v8_full_sweep.js",
    "127.0.0.1",
    "cache-control':'no-store'",
]:
    assert signal in runner, f'local runner missing {signal}'

print('V8.3_RUNTIME_AUDIT PASS: exact 28-page contract + runtime hardening + isolated local browser harness are valid')
