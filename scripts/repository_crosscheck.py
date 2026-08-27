from __future__ import annotations
from pathlib import Path
import argparse
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Navora repository hygiene/security cross-check.')
parser.add_argument('--working-tree',action='store_true',help='Allow local .env files only when they are ignored/untracked by Git.')
args=parser.parse_args()

required_pages=['index.html','login.html','register.html','verify-email.html','forgot-password.html','verify-otp.html','reset-password.html','dashboard.html','map.html','journey.html','world-chat.html','devices.html','memory.html','history.html','journey-replay.html','notifications.html','profile.html','settings.html','admin.html','admin-users.html','admin-hazards.html','admin-chat.html','admin-health.html','admin-audit.html']
required_models=['User','RefreshToken','OtpVerification','PasskeyCredential','TrustedContact','Device','Route','Journey','JourneyLocationPoint','Hazard','HazardConfirmation','RouteMemory','Notification','ChatRoom','ChatMessage','ChatReaction','ChatReport','BlockedUser','UserReputation','AuditLog']
errors=[]
warnings=[]

for x in required_pages:
    if not (ROOT/'frontend/public'/x).exists():errors.append('missing page '+x)
for x in required_models:
    if not (ROOT/'backend/src/models'/f'{x}.js').exists():errors.append('missing model '+x)
for x in ['backend/.env.example','ai-service/.env.example','docker-compose.yml','README.md','frontend/manifest.json','frontend/service-worker.js']:
    if not (ROOT/x).exists():errors.append('missing '+x)

# High-confidence secret patterns outside .env.example templates.
patterns=[
    re.compile(r'AIza[0-9A-Za-z_-]{20,}'),
    re.compile(r'(?i)mongodb\+srv://[^\s:@]+:[^\s@]+@'),
    re.compile(r'(?im)^[ \t]*BREVO_API_KEY[ \t]*=[ \t]*\S+'),
    re.compile(r'(?im)^[ \t]*GOOGLE_CLIENT_SECRET[ \t]*=[ \t]*\S+'),
    re.compile(r'(?im)^[ \t]*JWT_(?:ACCESS|REFRESH)_SECRET[ \t]*=[ \t]*\S+'),
]
# These values are deliberately synthetic inputs to a backend serialization
# test. Allow only these exact literals in this exact test file; scan all other
# content in the file and all other repository files normally.
fixture_allowlist = {
    'backend/tests/production-deployment-contracts.test.js': {
        'mongodb+srv://user:' + 'secretpass@cluster.mongodb.net/navora',
        'SUPER_SECRET_ACCESS_KEY_1234567890_ABCDEF',
        'SUPER_SECRET_REFRESH_KEY_1234567890_ABCDEF',
    },
}
for p in ROOT.rglob('*'):
    if not p.is_file() or p.suffix.lower() in {'.zip','.png','.jpg','.jpeg','.webp','.pt','.pyc','.pyo'} or p.name=='.env.example':continue
    if any(part in {'node_modules','.venv','venv','.git','__pycache__','.pytest_cache'} for part in p.parts):continue
    # Runtime .env files are handled separately below. In working-tree mode their
    # contents must never make a hygiene scan fail (or be surfaced in logs); only
    # ignored/untracked status matters. In clean-distribution mode their presence
    # itself is an error below.
    if p.name=='.env':continue
    try:t=p.read_text(errors='ignore')
    except Exception:continue
    rel=str(p.relative_to(ROOT)).replace('\\','/')
    for fixture in fixture_allowlist.get(rel, set()):
        t=t.replace(fixture, '<synthetic-test-fixture>')
    for rx in patterns:
        if rx.search(t):errors.append(f'possible secret in {p.relative_to(ROOT)}')

# Local .env handling: forbidden in a clean distribution; allowed in a working tree only when Git ignores it.
def git_output(*cmd):
    try:return subprocess.run(['git',*cmd],cwd=ROOT,text=True,capture_output=True,check=False)
    except FileNotFoundError:return None

envs=list(ROOT.rglob('.env'))
if envs:
    if not args.working_tree:
        for p in envs:errors.append('real .env exists: '+str(p.relative_to(ROOT)))
    else:
        for p in envs:
            rel=str(p.relative_to(ROOT)).replace('\\','/')
            tracked=git_output('ls-files','--error-unmatch',rel)
            if tracked and tracked.returncode==0:errors.append('real .env is tracked by Git: '+rel)
            ignored=git_output('check-ignore','-q',rel)
            if ignored and ignored.returncode!=0:errors.append('real .env is not ignored by Git: '+rel)
        warnings.append(f'local runtime env files allowed in working-tree mode: {len(envs)}')

# No migration/backup artifacts should remain in the clean source tree.
backup_names=[]
for p in ROOT.rglob('*'):
    if not p.is_file():continue
    n=p.name.lower()
    if n.endswith('.backup') or '.before-' in n or 'before-zip-update' in n:
        backup_names.append(str(p.relative_to(ROOT)))
if backup_names:
    errors.extend('backup artifact: '+x for x in backup_names)

print('CROSSCHECK', 'PASS' if not errors else 'FAIL')
for w in warnings:print('-', 'WARNING:', w)
for e in errors:print('-',e)
sys.exit(1 if errors else 0)
