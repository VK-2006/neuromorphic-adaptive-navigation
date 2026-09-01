from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def text(relative):
    return (ROOT / relative).read_text(encoding="utf-8", errors="ignore")


shell = text("frontend/assets/js/app-shell.js")
service_worker = text("frontend/service-worker.js")
browser_e2e = text("scripts/browser_v27_session_recovery_e2e.js")
ai_main = text("ai-service/app/main.py")
production_smoke = text("scripts/production_smoke.py")
ci = text(".github/workflows/ci.yml")

# Startup auth/service redirects can occur during an inbound cross-document
# transition. The application must settle that transition before navigating;
# the browser test must continue to reject every genuine page error.
for token in [
    "function replacePage(target,{skipActiveTransition=false}={})",
    "const transition=document.activeViewTransition",
    "replacePage(`offline.html?reason=${reason}`,{skipActiveTransition:true})",
    "replacePage(`login.html?returnTo=${encodeURIComponent(returnTo())}`,{skipActiveTransition:true})",
]:
    assert token in shell, f"session transition repair missing: {token}"

settlement_barrier = re.search(
    r"const transition=document\.activeViewTransition"
    r"[\s\S]*?Promise\.allSettled\(\[\s*"
    r"transition\.ready,\s*"
    r"transition\.updateCallbackDone,\s*"
    r"transition\.finished,\s*"
    r"\]\)"
    r"\.then\(\(\)=>location\.replace\(target\)\)",
    shell,
)
assert settlement_barrier, "session transition settlement barrier missing"
assert "skipTransition" not in shell, "session recovery must not skip transitions"
assert "unhandledrejection" not in shell, "session recovery must not suppress page errors globally"

assert "assert(!pageErrors.length" in browser_e2e
assert "Transition was skipped" not in browser_e2e

# Force installed PWAs to fetch the repaired app shell while retaining the
# prior recovery release marker for historical contract compatibility.
assert "const CACHE='navora-completion-v37-0-0'" in service_worker
assert "V27_CACHE_LINEAGE='navora-session-recovery-v27-0-0'" in service_worker
assert '"/assets/js/app-shell.js"' in service_worker

# A repository release must touch the independently deployed AI service so
# Render cannot leave it on an older SHA while backend/main advances.
assert "'releasePolicy':'exact-sha-v37'" in ai_main
assert 'if passed:\n            # Callers provide `detail` as the failure diagnosis.' in production_smoke
assert 'ok(name, detail if detail' not in production_smoke

assert "python tests/v37_completion_gate_contracts.py" in ci
assert "node scripts/browser_v27_session_recovery_e2e.js" in ci

print("V37 COMPLETION GATE CONTRACTS: PASS")
print("Protected-session redirects settle active MPA transitions without hiding real page errors; PWA cache and CI coverage are current.")
