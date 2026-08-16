from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def text(p): return (ROOT/p).read_text(encoding='utf-8',errors='ignore')

mapjs=text('frontend/assets/js/map.js')
journey=text('frontend/assets/js/journey.js')
detection=text('frontend/assets/js/detection-mode.js')
sw=text('frontend/service-worker.js')

# Route-search overrides are per search. They may update the three route weights,
# but must not erase account defaults such as units, voice, GPS, theme or detection.
assert "function storePreferences(patch={})" in mapjs
assert "storePreferences(preferences);" in mapjs
assert "localStorage.setItem('navora:preferences',JSON.stringify(preferences))" not in mapjs
assert "unitMode='METRIC'" in mapjs
assert "highAccuracyGps=true" in mapjs
assert "enableHighAccuracy:highAccuracyGps" in mapjs
assert "fmtDistance(r.distance)" in mapjs
assert "fmtShortDistance(s.distance||0)" in mapjs

# Live Journey consumes persisted/account navigation defaults before GPS starts.
assert "let navigationPreferences={units:'METRIC',voiceLanguage:'en-IN',highAccuracyGps:true,detectionMode:'LOCAL'}" in journey
assert "await loadNavigationPreferences();" in journey
assert journey.index("await loadNavigationPreferences();") < journey.index("const id=jid();")
assert "const highAccuracy=navigationPreferences.highAccuracyGps!==false" in journey
assert "enableHighAccuracy:highAccuracy" in journey
assert "enableHighAccuracy:true,maximumAge:0,timeout:15000" not in journey
assert "language.value=navigationPreferences.voiceLanguage" in journey
assert "fmtSpeed(lastPosition.speed)" in journey
assert "fmtDistance(r.distanceCovered||0)" in journey
assert "fmtShortDistance(a.distanceAhead)" in journey

# CLOUD may be an account default, but it is only a UI preference. Consent and
# camera inference remain explicit actions on every Journey session.
assert "resolvePreferredMode" in detection
assert "String(p?.detectionMode||'LOCAL').toUpperCase()==='CLOUD'?'cloud':'local'" in detection
assert "consent.checked=false" in detection
assert "forceDetectionOff();" in detection
assert "Cloud default selected · explicit consent is still required" in detection
assert "consent.checked=true" not in detection
assert "consentToCloudProcessing:true" in detection  # sent only inside cloudAnalyze after consented() guard
assert "if(!consented())" in detection

# Changed runtime JS gets a fresh PWA shell cache while retaining release lineage.
assert "const CACHE='navora-settings-runtime-v25-0-0'" in sw
assert "V23_CACHE_LINEAGE='navora-security-pwa-v23-0-0'" in sw

print('V25 SETTINGS RUNTIME CONTRACTS: PASS')
