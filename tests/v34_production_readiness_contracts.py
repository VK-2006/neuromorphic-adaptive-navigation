from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
fail=[]

def need(name,cond):
    if not cond: fail.append(name)

def text(rel):
    return (ROOT/rel).read_text(encoding='utf-8',errors='ignore')

service=text('backend/src/services/productionReadinessService.js')
app=text('backend/src/app.js')
env=text('backend/.env.production.example')
smoke=text('scripts/production_smoke.py')
doc=text('docs/render-deployment.md')
ci=text('.github/workflows/ci.yml')

for token in [
    'evaluateProductionReadiness','criticalReady','fullIntegrationReady',
    'mongodbEnv','jwtAccess','jwtRefresh','jwtDistinct','frontendHttps',
    'socketHttps','aiHttps','liveMode','validatedAiPolicy','publicReadiness'
]:
    need(f'readiness:{token}',token in service)

need('readiness endpoint exists',"app.get('/ready'" in app)
need('readiness endpoint can return 503','res.status(readiness.ready?200:503)' in app)
need('health exposes ready boolean','ready:readiness.ready' in app)
need('readiness never exposes secret values','publicReadiness(readiness)' in app and 'JWT_ACCESS_SECRET' not in app and 'JWT_REFRESH_SECRET' not in app)

for token in [
    'AI_REQUEST_TIMEOUT_MS=8000','AI_COLD_START_TIMEOUT_MS=45000',
    'ROUTING_API_URL=https://router.project-osrm.org','GEOCODING_API_KEY=',
    'TRAFFIC_PROVIDER=tomtom','OPENWEATHER_API_KEY=','ROBOFLOW_API_KEY=',
    'WEBRTC_TURN_URL=','LIVE_REQUIRE_VALIDATED_AI=true'
]:
    need(f'production-env:{token}',token in env)
need('production template no real secrets','mongodb+srv://' not in env and 'sk-' not in env)
need('google secret documented as unused','not require a client secret' in env)

need('smoke checks backend readiness','backend+"/ready"' in smoke)
need('smoke checks exact backend release','Exact backend Render commit' in smoke)
need('smoke checks exact AI release','Exact AI Render commit' in smoke)
need('smoke checks V33 inference gate','V33 validated-only inference policy' in smoke)

need('Render health check uses /ready','Health Check Path: `/ready`' in doc)
need('Render docs explain liveness','`GET /health` is a liveness endpoint' in doc)
need('Render docs explain readiness','`GET /ready` is the deployment gate' in doc)

need('CI runs V34 contract','python tests/v34_production_readiness_contracts.py' in ci)
need('CI syntax-checks readiness service','node --check backend/src/services/productionReadinessService.js' in ci)
need('CI compiles production smoke','python -m py_compile scripts/production_smoke.py' in ci)

if fail:
    print('V34 PRODUCTION READINESS CONTRACTS: FAIL')
    for item in fail: print(' -',item)
    raise SystemExit(1)

print('V34 PRODUCTION READINESS CONTRACTS: PASS')
print('Readiness/liveness split, non-secret diagnostics, complete production template, exact backend+AI release smoke, and CI coverage are present.')
