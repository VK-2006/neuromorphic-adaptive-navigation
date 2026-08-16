from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def between(text: str, start: str, end: str) -> str:
    a = text.index(start)
    b = text.index(end, a)
    return text[a:b]


# NAVORA V17.9 guarded page-repair contracts.
# These intentionally validate behavior-oriented source invariants rather than
# release strings, formatting, or cache-name literals.

pages = sorted((ROOT / "frontend" / "public").glob("*.html"))
assert len(pages) == 28, f"expected 28 frontend pages, found {len(pages)}"

auth = read("frontend/assets/js/auth.js")
assert "function finishAuth(" in auth
assert "sessionStorage.removeItem('navora:returnTo')" in auth
assert "finishAuth();" in between(auth, "async function passkeyLogin()", "document.querySelector('[data-passkey]')")
assert "finishAuth(mode==='signup'?'dashboard.html':target())" in auth

journey = read("frontend/assets/js/journey.js")
pause = between(journey, "async function pauseJourney()", "async function completeJourney")
assert pause.index("await api(`/journeys/${jid()}/pause`") < pause.index("stopGps()"), "pause must stop local tracking only after server pause succeeds"
complete = between(journey, "async function completeJourney", "function startGps")
assert complete.index("confirm('Complete this journey") < complete.index("await api(`/journeys/${jid()}/complete`")
assert complete.index("await api(`/journeys/${jid()}/complete`") < complete.index("stopGps()"), "completion must keep tracking alive until server completion succeeds"
assert "stopAdaptiveReevaluation()" in complete
assert "${esc(message)}" in journey

map_js = read("frontend/assets/js/map.js")
assert "sessionStorage.removeItem('selectedRouteDbId')" in map_js
assert "else sessionStorage.removeItem('selectedRouteDbId')" in map_js

data_pages = read("frontend/assets/js/data-pages.js")
assert "if(!id||b.disabled)return;b.disabled=true" in data_pages
assert "disabled aria-disabled=\"true\"" in data_pages
assert "b.setAttribute('aria-disabled','true')" in data_pages

replay = read("frontend/assets/js/replay.js")
assert "marker?.remove?.();marker=null" in replay
assert "hazardLayer?.clearLayers?.()" in replay
assert "String(j?.status||'').toUpperCase()" in replay

sw = read("frontend/service-worker.js")
assert "networkFirst(r,{offlineFallback=false}={})" in sw
assert "e.request.mode==='navigate'" in sw and "offlineFallback:true" in sw
assert "/\.(?:js|css|json)$/i.test(u.pathname)" in sw
assert "if(offlineFallback)return await c.match('/offline.html')" in sw

print("V17_9_GUARDED_REPAIR_CONTRACTS PASS: 28 pages and repaired auth/journey/map/notifications/replay/PWA semantics are present")
