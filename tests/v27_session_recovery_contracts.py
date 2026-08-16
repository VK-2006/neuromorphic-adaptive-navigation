from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def text(p): return (ROOT/p).read_text(encoding='utf-8',errors='ignore')

shell=text('frontend/assets/js/app-shell.js')
offline=text('frontend/assets/js/offline.js')
sw=text('frontend/service-worker.js')

# Protected startup must distinguish a real auth failure from transport/service
# failures. A 401 goes to Login; all other failures use the recovery surface.
assert "async function userSession()" in shell
assert "return{user:await api('/users/me'),error:null}" in shell
assert "if(session.error&&Number(session.error.status)!==401){recoverFromServiceFailure(session.error);return}" in shell
assert "location.replace(`offline.html?reason=${reason}`)" in shell
assert "location.replace(`login.html?returnTo=${encodeURIComponent(returnTo())}`)" in shell
assert "async function user(){try{return await api('/users/me')}catch{return null}}" not in shell
assert "if(needs&&u)sessionStorage.removeItem('navora:returnTo')" in shell

# Recovery page must preserve a safe same-origin HTML target and distinguish
# backend/service failure copy from normal offline copy.
assert "function retryTarget()" in offline
assert "u.origin!==location.origin" in offline
assert "file==='offline.html'" in offline
assert "reason==='service'" in offline
assert "Live services temporarily unavailable" in offline
assert "retry.href=retryTarget()" in offline

# Updated app-shell/offline runtime must bypass installed stale caches.
assert "const CACHE='navora-session-recovery-v27-0-0'" in sw
assert "V26_CACHE_LINEAGE='navora-preference-consistency-v26-0-0'" in sw
for asset in ['/assets/js/app-shell.js','/assets/js/offline.js']:
    assert asset in sw

print('V27 SESSION RECOVERY CONTRACTS: PASS')
