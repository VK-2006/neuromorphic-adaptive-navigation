from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def text(p): return (ROOT/p).read_text(encoding='utf-8',errors='ignore')

mapjs=text('frontend/assets/js/map.js')
journey=text('frontend/assets/js/journey.js')
sw=text('frontend/service-worker.js')

# Route-search overrides are per search. They may update the three route weights,
# but must not erase account defaults such as units, voice, GPS or theme.
assert "function storePreferences(patch={})" in mapjs
assert "storePreferences(preferences);" in mapjs
assert "localStorage.setItem('navora:preferences',JSON.stringify(preferences))" not in mapjs
assert "unitMode='METRIC'" in mapjs
assert "highAccuracyGps=true" in mapjs
assert "enableHighAccuracy:highAccuracyGps" in mapjs
assert "fmtDistance(r.distance)" in mapjs
assert "fmtShortDistance(s.distance||0)" in mapjs

# Live Journey consumes persisted/account navigation defaults before GPS starts.
assert "let navigationPreferences={units:'METRIC',voiceLanguage:'en-IN',highAccuracyGps:true}" in journey
assert "await loadNavigationPreferences();" in journey
assert journey.index("await loadNavigationPreferences();") < journey.index("const id=jid();")
assert "const highAccuracy=navigationPreferences.highAccuracyGps!==false" in journey
assert "enableHighAccuracy:highAccuracy" in journey
assert "enableHighAccuracy:true,maximumAge:0,timeout:15000" not in journey
assert "language.value=navigationPreferences.voiceLanguage" in journey
assert "fmtSpeed(lastPosition.speed)" in journey
assert "fmtDistance(r.distanceCovered||0)" in journey
assert "fmtShortDistance(a.distanceAhead)" in journey

# The current release has no browser camera/detection runtime. Journey settings
# therefore remain limited to navigation preferences and GPS behavior.
assert "detection-mode.js" not in journey
assert "MediaRecorder" not in journey

# V25 established the settings-runtime cache boundary. Later releases may rotate
# the active cache, but must retain V25 explicitly in release lineage.
assert "navora-settings-runtime-v25-0-0" in sw
assert "const CACHE='navora-settings-runtime-v25-0-0'" in sw or "V25_CACHE_LINEAGE='navora-settings-runtime-v25-0-0'" in sw
assert "V23_CACHE_LINEAGE='navora-security-pwa-v23-0-0'" in sw

print('V25 SETTINGS RUNTIME CONTRACTS: PASS')
