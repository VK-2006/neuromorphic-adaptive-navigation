from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p): return (ROOT/p).read_text(errors='ignore')
def need(p,*items):
    t=read(p); missing=[x for x in items if x not in t]
    assert not missing, f'{p}: missing {missing}'

# Provider/database degradation must not crash the entire orchestration layer.
need('backend/src/server.js','database_unavailable','startDatabaseRecovery','server.listen(PORT')
need('backend/src/config/db.js','database_retry_failed')
need('backend/src/services/aiClient.js','degraded','AbortSignal.timeout')
need('backend/src/services/trafficService.js','trafficMode:\'degraded\'','UNKNOWN')
need('backend/src/services/routingProvider.js','Routing provider HTTP','throw new Error')
need('backend/src/services/emailService.js','credentials-required','degraded','brevo_provider_unavailable')
need('frontend/assets/js/journey.js','Geolocation not supported','GPS ERROR','socket?.disconnect','startGps','stopGps')
need('backend/src/middleware/auth.js','Invalid or expired access token','401')
need('backend/src/middleware/validate.js','422')
print('FAILURE_CONTRACTS PASS: DB/AI/routing/traffic/email/GPS/socket/auth/payload failure paths are represented')
