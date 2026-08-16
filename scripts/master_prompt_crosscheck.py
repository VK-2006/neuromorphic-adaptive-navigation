from pathlib import Path
import argparse, json, re, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Navora master-prompt source/compliance cross-check.')
parser.add_argument('--working-tree',action='store_true',help='Allow local runtime .env files only when Git ignores them and they are untracked.')
args=parser.parse_args()
fail=[]

def need(name, cond, detail=''):
    if not cond: fail.append(f'{name}: {detail or "missing"}')

def text(rel): return (ROOT/rel).read_text(encoding='utf-8',errors='ignore')
def exists(rel): return (ROOT/rel).exists()

required_pages=['index.html','login.html','register.html','verify-email.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','history.html','journey-replay.html','notifications.html','profile.html','settings.html','admin.html','admin-users.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html','admin-devices.html','camera-share.html','shared-journey.html','offline.html']
for p in required_pages: need(f'page:{p}', exists(f'frontend/public/{p}'))
required_models=['User','RefreshToken','OtpVerification','PasskeyCredential','TrustedContact','Device','Route','Journey','JourneyLocationPoint','Hazard','HazardConfirmation','RouteMemory','Notification','ChatRoom','ChatMessage','ChatReaction','ChatReport','BlockedUser','UserReputation','AuditLog']
for m in required_models: need(f'model:{m}', exists(f'backend/src/models/{m}.js'))
for p in ['frontend/manifest.json','frontend/service-worker.js','frontend/public/offline.html','frontend/assets/icons/navora-192.png','frontend/assets/icons/navora-512.png']:
    need(p,exists(p))
for p in ['README.md','frontend/README.md','backend/README.md','ai-service/README.md','docs/architecture.md','docs/database.md','docs/api.md','docs/datasets.md','docs/snn.md','docs/crm.md','docs/aco.md','docs/security.md','docs/testing.md','docs/render-deployment.md','docs/demo.md','docs/troubleshooting.md','docs/user-guide.md']:
    need(f'doc:{p}',exists(p))

route=text('backend/src/services/routingProvider.js')
for key in ['osrm','graphhopper','valhalla','development/mock']:
    need(f'route-provider:{key}',key in route.lower())
need('road-route alternatives', 'alternatives=true' in route and 'alternative_route' in route)
traffic=text('backend/src/services/trafficService.js')
for key in ['FREE_FLOW','LIGHT','MODERATE','HEAVY','SEVERE','UNKNOWN','trafficMode:\'simulation\'']:
    need(f'traffic:{key}',key in traffic)
mapjs=text('frontend/assets/js/map.js')
for key in ['/geocoding/search','/geocoding/reverse','L.marker','draggable:true','hazards/nearby','recommendedRouteId']:
    need(f'map:{key}',key in mapjs)
journey=text('frontend/assets/js/journey.js')
need('single GPS watcher variable',journey.count('watchPosition(')==1,f'watchPosition calls={journey.count("watchPosition(")}')
need('camera explicit detection off','data-enabled="false"' in text('frontend/public/journey.html') and "dataset.enabled==='false'" in journey)
need('no MediaRecorder', 'MediaRecorder' not in journey)
for key in ['pause','resume','complete','voice-language','voice-volume','voice-select','reroute','share','sos']:
    need(f'journey-ui:{key}',key.lower() in (journey+text('frontend/public/journey.html')).lower())

track=text('backend/src/controllers/trackingController.js')
for key in ['accuracy','heading','speed','offRouteSince','distanceCovered','distanceRemaining']:
    need(f'tracking:{key}',key in track)
geo=text('backend/src/services/geofenceService.js')
need('geofence direction', 'heading' in geo and 'distanceAhead' in geo)

aco=text('backend/src/services/aco.js')
for key in ['pheromone','evaporation','ants','iterations','preference']:
    need(f'ACO:{key}',key in aco.lower())
crm=text('backend/src/services/routeMemoryService.js')
for key in ['dtw','ema','successfulJourney','historicalSafety','familiarity']:
    need(f'CRM:{key}',key.lower() in crm.lower())
xai=text('backend/src/services/explainabilityService.js')
for key in ['snn','dtw','ema','aco','hazard','traffic']:
    need(f'XAI:{key}',key in xai.lower())

ai=text('ai-service/app/main.py')+text('ai-service/app/api/routes.py')
for endpoint in ['/health','/model/info','/api/v1/detect','/api/v1/risk/predict','/api/v1/risk/batch']:
    need(f'AI:{endpoint}',endpoint in ai)
snn=text('ai-service/app/models/snn.py')
need('snnTorch LIF','snn.Leaky' in snn or 'Leaky' in snn)
risk=text('ai-service/app/services/risk_service.py')
for key in ['temporal','validated','fallback','membrane','spike']:
    need(f'risk-service:{key}',key in risk.lower())

socket=text('backend/src/sockets/index.js')
for room in ['user:','journey:','device:','route:','chat:','admin']:
    need(f'socket-room:{room}',room in socket)
need('no global GPS broadcast', "io.emit('gps" not in socket and 'io.emit("gps' not in socket)
for ev in ['journey:location','device:updated','snn:risk','route:updated','notification:new']:
    corpus=socket+''.join(x.read_text(encoding='utf-8',errors='ignore') for x in (ROOT/'backend/src/controllers').glob('*.js'))
    need(f'socket-event:{ev}',ev in corpus)

auth=text('backend/src/controllers/authController.js')+text('backend/src/services/tokenService.js')+text('backend/src/services/otpService.js')+text('backend/src/services/webauthnService.js')
for key in ['bcrypt','refresh','google','passkey','revoke','otp']:
    need(f'auth:{key}',key in auth.lower())
need('OTP not plaintext DB','otpHash' in text('backend/src/models/OtpVerification.js') and 'select:false' in text('backend/src/models/OtpVerification.js').replace(' ',''))
need('Google frontend GIS','accounts.google.com/gsi/client' in text('frontend/public/login.html') and '/auth/google' in text('frontend/assets/js/auth.js'))

three=text('frontend/assets/js/three-scenes.js')+text('frontend/assets/js/three-research.js')
for key in ['requestAnimationFrame','dispose','prefers-reduced-motion','renderer']:
    need(f'Three:{key}',key in three)
need('Three landing','three-hero' in text('frontend/public/index.html'))
need('Three research','three-research' in text('frontend/public/memory.html') or 'research' in text('frontend/public/memory.html').lower())

css=text('frontend/assets/css/main.css')+text('frontend/assets/css/navora-v7.css'); theme=text('frontend/assets/js/theme.js')
need('light/dark themes','data-theme="dark"' in css and 'light' in theme.lower() and 'system' in theme.lower())
need('reduced motion','prefers-reduced-motion' in css)

server=text('backend/src/server.js'); package=json.loads(text('backend/package.json'))
need('Render exact PORT','const PORT = process.env.PORT || 5000;' in server)
need('npm start',package.get('scripts',{}).get('start')=='node src/server.js')
need('Express 5',str(package.get('dependencies',{}).get('express','')).startswith('^5'))
need('docker compose',exists('docker-compose.yml'))
need('backend Dockerfile',exists('backend/Dockerfile'))
need('AI Dockerfile',exists('ai-service/Dockerfile'))

# Exact hazard-dedup and frontend-stack compliance added during final hardening.
hsim=text('backend/src/services/hazardSimilarity.js')
for key in ['detectionSimilarity','boxSimilarity','DETECTION_SIMILARITY_THRESHOLD']:
    need(f'hazard-dedup:{key}',key in hsim)
hazard_controller=text('backend/src/controllers/hazardController.js')
need('hazard detection evidence','boundingBox' in hazard_controller and 'approximateDistance' in hazard_controller)

stack_pages=''.join(text(f'frontend/public/{p}') for p in required_pages)
for key in ['bootstrap@5.3.3','gsap@3.12.5','aos@2.3.4','lottie-web@5.12.2']:
    need(f'frontend-stack:{key}',key in stack_pages)
v7=text('frontend/assets/js/app-shell.js')+text('frontend/assets/css/navora-v7.css')
for key in ['protectedPages','buildAppNav','navora:returnTo','--nav-sidebar','.map-layout','.journey-layout','.chat-layout']:
    need(f'frontend-v7:{key}',key in v7)
need('retired showcase runtime not loaded','/assets/js/worldclass-ui.js' not in stack_pages and '/assets/css/worldclass.css' not in stack_pages)
need('Lottie asset',exists('frontend/assets/animations/navora-pulse.json'))

# QA and repository tooling must work from arbitrary clone paths, not sandbox-specific paths.
qa=text('qa-screens/render_qa.py')+text('qa-screens/render_journey_map.py')
need('portable QA paths','/mnt/data' not in qa and 'BeautifulSoup' not in qa and 'bs4' not in qa)
for tool in ['scripts/final_verify.py','scripts/prepush_audit.py','scripts/apply_final_release.ps1','scripts/runtime_e2e.js','scripts/model_readiness.py','scripts/evaluate_detector.py','scripts/evaluate_snn.py','.github/workflows/ci.yml']:
    need(f'final-tooling:{tool}',exists(tool))

# Validation metadata must distinguish detector and SNN status, while live runtime must
# derive validation from the V28 evidence guard rather than trusting either flag directly.
meta=text('ai-service/trained_models/metadata.example.json')
need('separate detector/risk validation flags','detectorValidated' in meta and 'riskValidated' in meta)
validation_helper=text('ai-service/app/model_validation.py')
risk_runtime=text('ai-service/app/services/risk_service.py')
detector_runtime=text('ai-service/app/services/detection_service.py')
need('V28 validation helper',"def model_validation_status" in validation_helper and "schemaVersion" in validation_helper and "SHA-256" in validation_helper)
need('risk evidence-bound validation runtime',"model_validation_status('risk'" in risk_runtime and "self.validated=bool(validation.get('passed'))" in risk_runtime)
need('detector evidence-bound validation runtime',"model_validation_status('detector'" in detector_runtime and "self.validated=bool(validation.get('passed'))" in detector_runtime)

# Secrets: examples may name variables, but no non-empty values for secret/key fields.
envexample=text('backend/.env.example')
for var in ['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','BREVO_API_KEY','GOOGLE_CLIENT_SECRET','TRAFFIC_API_KEY','ROUTING_API_KEY']:
    m=re.search(rf'^{var}=(.*)$',envexample,re.M); need(f'blank secret:{var}',bool(m) and not m.group(1).strip())
# Clean distributions must not contain real .env files. In a developer working tree,
# local runtime .env files are acceptable only when Git ignores them and does not track them.
def git_result(*cmd):
    try:
        return subprocess.run(['git',*cmd],cwd=ROOT,text=True,capture_output=True,check=False)
    except FileNotFoundError:
        return None

env_paths=[rel for rel in ['backend/.env','ai-service/.env'] if exists(rel)]
if args.working_tree:
    for rel in env_paths:
        tracked=git_result('ls-files','--error-unmatch',rel)
        ignored=git_result('check-ignore','-q',rel)
        need(f'untracked runtime env:{rel}', not tracked or tracked.returncode!=0, 'tracked by Git')
        need(f'ignored runtime env:{rel}', bool(ignored) and ignored.returncode==0, 'not ignored by Git')
else:
    need('no real .env',not env_paths, ', '.join(env_paths) if env_paths else '')

# Dataset fields requested by master prompt.
raw=text('datasets/demo-data/snn-risk-raw.csv').splitlines()[0].split(',')
for f in ['objectClass','confidence','estimatedDistance','relativeSpeed','userSpeed','objectPersistence','trafficDensity','hazardFrequency','visibility','weatherRisk','roadCondition','verifiedReports','riskScore','riskLabel']:
    need(f'dataset-field:{f}',f in raw)
crm_fixture=text('datasets/demo-data/crm-journeys.json')
for f in ['routeCoordinates','distance','travelTime','traffic','hazards','averageRisk','maximumRisk','reroutes','journeySuccess','familiarity','historicalSafety','userFeedback','timestamp']:
    need(f'crm-fixture:{f}',f in crm_fixture)

if fail:
    print('MASTER PROMPT CROSS-CHECK: FAIL')
    for x in fail: print(' -',x)
    sys.exit(1)
print('MASTER PROMPT CROSS-CHECK: PASS')
print(f'Pages={len(required_pages)} required, Models={len(required_models)} required; routing/AI/algorithms/privacy/auth/PWA/Three/frontend-stack/hazard-dedup/QA/CI contracts present.')
