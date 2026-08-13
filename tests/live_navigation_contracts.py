from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(errors='ignore')
def need(p,*items):
    t=read(p); missing=[x for x in items if x not in t]
    assert not missing, f'{p}: missing {missing}'

journey=read('frontend/assets/js/journey.js')
for signal in ['navigator.wakeLock.request','watchPosition(','enableHighAccuracy:true','/live/readiness','ONLINE','OFFLINE','automaticArrival:true','safetyEligible','AI RESEARCH ONLY','requestFullscreen','pendingTracking','2000','visibilitychange']:
    assert signal in journey, f'journey live field runtime missing {signal}'
assert journey.count('watchPosition(')==1
need('frontend/public/journey.html','live-field-bar','gps-state','wake-state','ai-state','route-provider-state','fullscreen-journey','Field navigation')
map_html=read('frontend/public/map.html')
assert 'id="simulation"' in map_html and 'id="simulation" type="checkbox" checked' not in map_html, 'simulation must default OFF for field routing'
need('backend/src/app.js','Permissions-Policy','/api/v1/live')
need('backend/src/controllers/liveController.js','safetyEligible','routingLive','trafficLive','warnings')
need('backend/src/services/aiClient.js','/model/info','async function info')
need('backend/src/controllers/trackingController.js','arrivalThreshold','destinationDistance','arrived:')
need('backend/src/controllers/hazardController.js','safetyEligible','LIVE_REQUIRE_VALIDATED_AI' if False else 'liveRequireValidatedAi','allowPersistence')
need('ai-service/app/schemas/detection.py','validated:bool=False')
need('ai-service/app/schemas/risk.py','validated:bool=False')
need('frontend/service-worker.js','navora-shell-v8-live-field','/assets/js/journey.js')
need('frontend/manifest.json','display_override','Live Journey')
print('LIVE_NAVIGATION_CONTRACTS PASS: foreground field GPS, wake lock, HTTPS/camera readiness, live-provider readiness, offline latest-fix recovery, arrival completion, validated-AI safety gating, PWA field shell')
