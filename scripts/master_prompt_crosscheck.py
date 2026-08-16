from pathlib import Path
import argparse, json, re, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Navora master-prompt source/compliance cross-check.')
parser.add_argument('--working-tree',action='store_true')
args=parser.parse_args(); fail=[]
def need(name,cond,detail=''):
    if not cond: fail.append(f'{name}: {detail or "missing"}')
def text(rel): return (ROOT/rel).read_text(encoding='utf-8',errors='ignore')
def exists(rel): return (ROOT/rel).exists()
required_pages=['index.html','login.html','register.html','verify-email.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','history.html','journey-replay.html','notifications.html','profile.html','settings.html','admin.html','admin-users.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html','admin-devices.html','camera-share.html','shared-journey.html','offline.html']
for p in required_pages: need(f'page:{p}',exists(f'frontend/public/{p}'))
required_models=['User','RefreshToken','OtpVerification','PasskeyCredential','TrustedContact','Device','Route','Journey','JourneyLocationPoint','Hazard','HazardConfirmation','RouteMemory','Notification','ChatRoom','ChatMessage','ChatReaction','ChatReport','BlockedUser','UserReputation','AuditLog']
for m in required_models: need(f'model:{m}',exists(f'backend/src/models/{m}.js'))
for p in ['frontend/manifest.json','frontend/service-worker.js','frontend/public/offline.html','frontend/assets/icons/navora-192.png','frontend/assets/icons/navora-512.png']:
    need(p,exists(p))
route=text('backend/src/services/routingProvider.js')
for key in ['osrm','graphhopper','valhalla','development/mock']: need(f'route-provider:{key}',key in route.lower())
need('road-route alternatives','alternatives=true' in route and 'alternative_route' in route)
traffic=text('backend/src/services/trafficService.js')
for key in ['FREE_FLOW','LIGHT','MODERATE','HEAVY','SEVERE','UNKNOWN']: need(f'traffic:{key}',key in traffic)
journey=text('frontend/assets/js/journey.js'); need('single GPS watcher variable',journey.count('watchPosition(')==1)
need('camera explicit detection off','data-enabled="false"' in text('frontend/public/journey.html') and "dataset.enabled==='false'" in journey)
need('no MediaRecorder','MediaRecorder' not in journey)
aco=text('backend/src/services/aco.js')
for key in ['pheromone','evaporation','ants','iterations','preference']: need(f'ACO:{key}',key in aco.lower())
crm=text('backend/src/services/routeMemoryService.js')
for key in ['dtw','ema','successfulJourney','historicalSafety','familiarity']: need(f'CRM:{key}',key.lower() in crm.lower())
ai=text('ai-service/app/main.py')+text('ai-service/app/api/routes.py')
for endpoint in ['/health','/model/info','/api/v1/detect','/api/v1/risk/predict','/api/v1/risk/batch']: need(f'AI:{endpoint}',endpoint in ai)
need('detector taxonomy',exists('ai-service/app/detector_taxonomy.py'))
detect=text('ai-service/app/services/detection_service.py')
for cls in ['person','bicycle','motorcycle','car','bus','truck']: need(f'detector-class:{cls}',repr(cls) in detect or f"'{cls}'" in detect)
need('detector runtime readiness',"model_validation_status('detector'" in detect and 'self.runtime_ready' in detect)
need('detector trained inference preserved','self._torchscript' in detect and 'float(score)<.3' in detect)
need('detector fallback preserved','_fallback_detect' in detect)
need('detector scientific validation not required','detectorScientificValidationRequired' in text('ai-service/trained_models/metadata.example.json') and 'false' in text('ai-service/trained_models/metadata.example.json').lower())
need('BDD100K detector docs','BDD100K' in text('README.md') and 'BDD100K' in text('datasets/README.md'))
need('camera-to-risk flow','objectClass' in text('backend/src/controllers/hazardMetadataController.js') and 'confidence' in text('backend/src/controllers/hazardMetadataController.js') and 'predictRisk' in text('backend/src/controllers/hazardMetadataController.js'))
snn=text('ai-service/app/models/snn.py'); need('snnTorch LIF','snn.Leaky' in snn or 'Leaky' in snn)
risk=text('ai-service/app/services/risk_service.py')
need('SNN validation retained',"model_validation_status('risk'" in risk and "self.validated=bool(validation.get('passed'))" in risk)
need('SNN research lock retained',exists('ai-service/app/research_lock.py') and 'RESEARCH_ONLY_RISK_MODELS' in text('ai-service/app/research_lock.py'))
need('SNN phase4 evidence doc retained',exists('docs/snn-phase4-2025-external-validation.md'))
server=text('backend/src/server.js'); package=json.loads(text('backend/package.json'))
need('Render exact PORT','const PORT = process.env.PORT || 5000;' in server); need('npm start',package.get('scripts',{}).get('start')=='node src/server.js')
need('docker compose',exists('docker-compose.yml')); need('backend Dockerfile',exists('backend/Dockerfile')); need('AI Dockerfile',exists('ai-service/Dockerfile'))
for tool in ['scripts/final_verify.py','scripts/prepush_audit.py','scripts/model_readiness.py','scripts/evaluate_detector.py','scripts/evaluate_snn.py','.github/workflows/ci.yml']: need(f'final-tooling:{tool}',exists(tool))
meta=text('ai-service/trained_models/metadata.example.json')
need('risk validation metadata retained','riskValidated' in meta)
need('detector readiness metadata','detectorRuntimeReady' in meta and 'detectorSha256' in meta)
validation_helper=text('ai-service/app/model_validation.py')
need('model status helper',"def model_validation_status" in validation_helper and 'sha256_file' in validation_helper)
need('detector scientific gate removed from runtime',"if kind == 'detector':\n        return _detector_runtime_readiness" in validation_helper)
# Secrets remain blank in templates.
envexample=text('backend/.env.example')
for var in ['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','BREVO_API_KEY','GOOGLE_CLIENT_SECRET','TRAFFIC_API_KEY','ROUTING_API_KEY']:
    m=re.search(rf'^{var}=(.*)$',envexample,re.M); need(f'blank secret:{var}',bool(m) and not m.group(1).strip())
# Removed detector scientific-validation scope must not reappear as a completion requirement.
scan_ext={'.md','.txt','.py','.js','.json','.yml','.yaml','.bat','.ps1','.html'}
forbidden=['Cityscapes','Detector Scientific Validation','independent detector validation','external detector validation','cross-dataset detector validation']
allowed_future='independent cross-dataset detector scientific validation is outside the current project scope'
for path in ROOT.rglob('*'):
    if not path.is_file() or path.suffix.lower() not in scan_ext or '.git' in path.parts: continue
    content=path.read_text(encoding='utf-8',errors='ignore')
    if 'Cityscapes' in content: fail.append(f'removed-detector-scope:{path.relative_to(ROOT)}: Cityscapes reference remains')
    lower=content.lower()
    for phrase in forbidden[1:]:
        if phrase.lower() in lower and allowed_future not in lower:
            fail.append(f'removed-detector-scope:{path.relative_to(ROOT)}: {phrase} remains outside approved future-work wording')
if fail:
    print('MASTER PROMPT CROSS-CHECK: FAIL')
    for x in fail: print(' -',x)
    sys.exit(1)
print('MASTER PROMPT CROSS-CHECK: PASS')
print(f'Pages={len(required_pages)}, Models={len(required_models)}; detector functional scope retained, detector scientific-validation completion gate removed, SNN scientific validation retained.')
