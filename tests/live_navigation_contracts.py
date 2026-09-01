from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(errors='ignore')
def need(p,*items):
    t=read(p); missing=[x for x in items if x not in t]
    assert not missing, f'{p}: missing {missing}'

journey=read('frontend/assets/js/journey.js')
for signal in ['navigator.wakeLock.request','watchPosition(','navigationPreferences.highAccuracyGps','enableHighAccuracy:highAccuracy','/live/readiness','ONLINE','OFFLINE','automaticArrival:true','safetyEligible','AI RESEARCH ONLY','requestFullscreen','pendingTracking','2000','visibilitychange']:
    assert signal in journey, f'journey live field runtime missing {signal}'
assert journey.count('watchPosition(')==1
assert 'enableHighAccuracy:true,maximumAge:0,timeout:15000' not in journey, 'Live Journey must honor the saved highAccuracyGps preference rather than forcing high accuracy'
need('frontend/public/journey.html','live-field-bar','gps-state','wake-state','ai-state','route-provider-state','fullscreen-journey','Field navigation')
map_html=read('frontend/public/map.html')
assert 'id="simulation"' in map_html and 'id="simulation" type="checkbox" checked' not in map_html, 'simulation must default OFF for field routing'
need('backend/src/app.js','Permissions-Policy','/api/v1/live')
need('backend/src/controllers/liveController.js','safetyEligible','routingLive','trafficLive','warnings')
need('backend/src/services/aiClient.js','/model/info','async function info')
need('backend/src/controllers/trackingController.js','arrivalThreshold','destinationDistance','arrived:')
need('backend/src/controllers/hazardController.js','safetyEligible','canAffectLive',"journey.status!=='ACTIVE'")
need('ai-service/app/schemas/risk.py','validated:bool=False')
need('frontend/service-worker.js','navora-v7-functional-product-1','/assets/js/journey.js','networkFirst')
need('frontend/manifest.json','display_override','Live Journey')
print('LIVE_NAVIGATION_CONTRACTS PASS: foreground field GPS with account accuracy preference, wake lock, HTTPS readiness, live-provider readiness, offline latest-fix recovery, arrival completion, PWA field shell')
