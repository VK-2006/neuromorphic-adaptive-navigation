from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(errors='ignore')
def require(p,*needles):
    text=read(p)
    missing=[n for n in needles if n not in text]
    assert not missing, f'{p}: missing {missing}'

# Map/search/provider/XAI contracts.
require('frontend/public/map.html','source-suggestions','destination-suggestions','route-list','why-route','safety-pref','traffic-pref','familiarity-pref')
require('frontend/assets/js/map.js','/geocoding/search','/geocoding/reverse','navora:recent-routes','congestedSegments','routeTypes','/hazards/nearby','Confirm nearby','/confirm')
require('backend/src/services/routingProvider.js','osrm','graphhopper','valhalla','development')
require('backend/src/services/trafficService.js','FREE_FLOW','LIGHT','MODERATE','HEAVY','SEVERE','UNKNOWN','simulation','tomtom')

# Journey lifecycle/privacy/realtime/reroute/voice/share.
require('frontend/public/journey.html','Start / Resume','Pause','Complete','Voice','Create secure share link','SOS','reroute-comparison')
journey=read('frontend/assets/js/journey.js')
assert journey.count('watchPosition(')==1, 'only one geolocation watchPosition call is allowed'
for signal in ['/journeys/','/routes/reroute','speechSynthesis','share']:
    assert signal in journey, f'journey.js missing {signal}'
assert 'MediaRecorder' not in journey, 'journey.js should not rely on camera recording for the current field stack'

# Chat feature/security contracts.
chat=read('frontend/assets/js/chat.js')+read('backend/src/routes/chatRoutes.js')+read('backend/src/sockets/index.js')
for signal in ['chat:typing','reaction','reply','edit','delete','report','block','NEARBY','REGION','hasMore','chat:unread']:
    assert signal.lower() in chat.lower(), f'chat missing {signal}'
chat_html=read('frontend/public/world-chat.html').lower();assert 'exact gps is never posted automatically' in chat_html and 'coarse' in chat_html, 'chat UI must disclose coarse nearby privacy and no exact GPS sharing'

# PWA, themes, Three.js lifecycle.
require('frontend/manifest.json','navora-192.png','navora-512.png')
require('frontend/service-worker.js','offline.html','caches.open','/api/')
require('frontend/assets/js/app-shell.js','beforeinstallprompt','serviceWorker.register')
require('frontend/assets/js/three-scenes.js','requestAnimationFrame','dispose','prefers-reduced-motion')
require('frontend/assets/js/three-research.js','requestAnimationFrame','dispose','forceContextLoss','prefers-reduced-motion')
for page in ['frontend/public/index.html','frontend/public/memory.html']:
    require(page,'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js')
css=read('frontend/assets/css/main.css')
for signal in [':root','data-theme="dark"','prefers-reduced-motion',':focus-visible']:
    assert signal in css, f'theme/accessibility CSS missing {signal}'
theme=read('frontend/assets/js/theme.js');assert all(x in theme for x in ["'system'","'light'","'dark'"]), 'theme.js must support system/light/dark'

# Auth privacy/security contracts.
auth=read('frontend/assets/js/auth.js')
assert 'devVerifyOtp' not in auth and 'devResetOtp' not in auth, 'plaintext dev OTP must not be persisted in browser storage'
require('backend/src/services/googleAuthService.js','verifyIdToken','audience')
require('backend/src/services/tokenService.js','httpOnly','sameSite','family')

# Backend framework/private socket-room checks and AI connection.
import json
express_spec=json.loads(read('backend/package.json'))['dependencies']['express']
assert express_spec.lstrip('^~>= ').split('.')[0]=='5', 'Express 5 is required for async promise error propagation'

require('backend/src/sockets/index.js','journey:join','route:join','chat:join','webrtc:join')
require('backend/src/services/aiClient.js','/api/v1/risk/predict','degraded')


# Simulation/digital-twin and camera-free navigation contracts.
asset_js = read('frontend/assets/js/devices.js') if (ROOT / 'frontend/assets/js/devices.js').exists() else ''
assert 'navigator.bluetooth' not in asset_js, 'device-controller hooks should be removed from the current runtime'
assert 'devices.html' not in read('frontend/service-worker.js'), 'device pages should not remain in the offline shell'
require('backend/src/services/simulationService.js','SCENARIO','predictRisk','dedupeAndUpsert')
require('backend/src/routes/simulationRoutes.js',"post('/step'",'authenticate','simulationStep')
require('frontend/assets/js/journey.js','/simulation/step','automaticSimulation:true','completeJourney','SIMULATION')
require('backend/src/models/Journey.js','originalRouteId','originalRouteSnapshot','decisionEvents')
require('backend/src/controllers/journeyController.js','originalRoute','routeHistory','ACO_REEVALUATION' if False else 'REROUTE_ACCEPTED')
require('backend/src/controllers/routeController.js','ACO_REEVALUATION','TRAFFIC_CHANGE','recommendedRouteId')
require('frontend/assets/js/replay.js','originalRoute','routeHistory','ACO decisions','traffic changes')
require('frontend/public/memory.html','Input Features','Spike Encoding','LIF Neurons','Risk Output')
require('backend/src/config/db.js','startDatabaseRecovery','database_retry_failed')


# Security/correctness edge contracts added during final hardening.
require('backend/src/sockets/index.js',"target?.rooms?.has(room)")
require('backend/src/models/Journey.js','distanceOffset')
require('backend/src/controllers/trackingController.js','routeDistanceCovered','offset+proj.distanceAlong')
require('frontend/assets/js/journey.js','routeDistanceCovered??r.distanceCovered')
require('backend/src/controllers/hazardController.js',"Journey.findOne({_id:req.body.journeyId,userId:req.user._id})",'canAffectLive','Hazards can only be reported during an active journey','You cannot confirm your own hazard report','Nearby confirmation requires a current location within 500 m of the hazard')
require('backend/src/validators/domainValidators.js',"body('location.accuracy')","body('location.heading')","body('location.speed')")
require('backend/src/services/webauthnService.js','CHALLENGE_TTL_MS','putChallenge','takeChallenge')
require('backend/src/services/otpService.js','return rec')
require('backend/src/services/routeService.js','route_intelligence','snnHazardRisk','dtwSimilarity')

print('FRONTEND_CONTRACTS PASS: map/providers, camera-free journey/privacy/reroute, chat, simulation/replay, PWA, themes/Three.js, auth/socket/AI/database-degraded contracts')

# Admin navigation and Render/source compliance.
require('frontend/public/admin-health.html','NAVORA ADMIN','admin-users.html','admin-hazards.html','admin-chat.html','admin-audit.html')
require('backend/src/server.js','const PORT = process.env.PORT || 5000;','server.listen(PORT')
require('backend/src/routes/adminRoutes.js','adminValidators','authorize(\'ADMIN\')')
print('ADMIN/RENDER CONTRACTS PASS')
