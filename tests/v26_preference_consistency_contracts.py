from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def text(p): return (ROOT/p).read_text(encoding='utf-8',errors='ignore')

dashboard=text('frontend/assets/js/dashboard.js')
data_pages=text('frontend/assets/js/data-pages.js')
replay=text('frontend/assets/js/replay.js')
sw=text('frontend/service-worker.js')

# Dashboard must resolve the account/local unit default before rendering recent trips.
assert "let chart=null,unitMode='METRIC'" in dashboard
assert "async function loadUnits()" in dashboard
assert "await loadUnits();" in dashboard
assert "formatDistance(j.distanceCovered)" in dashboard
assert "(num(j.distanceCovered)/1000).toFixed(1)} km covered" not in dashboard
assert "/1609.344" in dashboard

# History, journey detail and Route Memory all share the same unit-aware distance helper.
assert "let unitMode='METRIC'" in data_pages
assert "async function loadUnits()" in data_pages
assert "async function init(){await loadUnits();history();memory();notifications()}" in data_pages
assert "unitMode==='IMPERIAL'?`${(Number(v)/1609.344).toFixed(1)} mi`" in data_pages
assert "${km(j?.totalDistance)}" in data_pages
assert "${km(m?.distance)}" in data_pages

# Replay speed must respect units instead of always displaying km/h.
assert "async function loadUnits()" in replay
assert "await loadUnits();" in replay
assert "function fmtSpeed(metersPerSecond)" in replay
assert "mph" in replay and "km/h" in replay
assert "GPS ${fmtSpeed(p?.speed)}" in replay
assert "Number(p?.speed||0)*3.6" not in replay

# V26 established the read-only preference cache boundary. Later releases may
# rotate the active cache, but must keep V26 explicitly in release lineage.
assert "navora-preference-consistency-v26-0-0" in sw
assert "const CACHE='navora-preference-consistency-v26-0-0'" in sw or "V26_CACHE_LINEAGE='navora-preference-consistency-v26-0-0'" in sw
assert "V25_CACHE_LINEAGE='navora-settings-runtime-v25-0-0'" in sw
for asset in ['/assets/js/dashboard.js','/assets/js/data-pages.js','/assets/js/replay.js']:
    assert asset in sw

print('V26 PREFERENCE CONSISTENCY CONTRACTS: PASS')
