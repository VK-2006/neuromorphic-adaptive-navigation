from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]
required_pages=['index.html','login.html','register.html','verify-email.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','history.html','journey-replay.html','notifications.html','profile.html','settings.html','admin.html','admin-users.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html']
required_models=['User','RefreshToken','OtpVerification','PasskeyCredential','TrustedContact','Device','Route','Journey','JourneyLocationPoint','Hazard','HazardConfirmation','RouteMemory','Notification','ChatRoom','ChatMessage','ChatReaction','ChatReport','BlockedUser','UserReputation','AuditLog']
errors=[]
for x in required_pages:
    if not (ROOT/'frontend/public'/x).exists():errors.append('missing page '+x)
for x in required_models:
    if not (ROOT/'backend/src/models'/f'{x}.js').exists():errors.append('missing model '+x)
for x in ['backend/.env.example','ai-service/.env.example','docker-compose.yml','README.md','frontend/manifest.json','frontend/service-worker.js']:
    if not (ROOT/x).exists():errors.append('missing '+x)
# accidental secret patterns (only high-confidence assignments outside env examples)
patterns=[re.compile(r'AIza[0-9A-Za-z_-]{20,}'),re.compile(r'(?i)mongodb\+srv://[^\s]+:[^\s]+@'),re.compile(r'(?i)BREVO_API_KEY\s*=\s*\S+')]
for p in ROOT.rglob('*'):
    if not p.is_file() or p.suffix in {'.zip','.png','.jpg','.jpeg'} or p.name=='.env.example':continue
    try:t=p.read_text(errors='ignore')
    except:continue
    for rx in patterns:
        if rx.search(t):errors.append(f'possible secret in {p.relative_to(ROOT)}')
# no real env files
for p in ROOT.rglob('.env'):
    errors.append('real .env exists: '+str(p.relative_to(ROOT)))
print('CROSSCHECK', 'PASS' if not errors else 'FAIL')
for e in errors:print('-',e)
sys.exit(1 if errors else 0)
