from __future__ import annotations
from pathlib import Path
import json
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]
warnings=[]

def run(*args):
    return subprocess.run(args,cwd=ROOT,text=True,capture_output=True,check=False)

if not (ROOT/'.git').exists():
    print('PREPUSH AUDIT: SKIP — .git directory is not present in this clean distribution.')
    print('Run this script after merging the final source into your Git working repository.')
    sys.exit(0)

tracked=run('git','ls-files','-z')
if tracked.returncode!=0:
    print('PREPUSH AUDIT: FAIL')
    print('-',tracked.stderr.strip() or 'git ls-files failed')
    sys.exit(1)
paths=[p for p in tracked.stdout.split('\0') if p]
pathset=set(paths)

forbidden=[]
for p in paths:
    lp=p.lower()
    name=Path(p).name.lower()
    if name=='.env' or '/node_modules/' in f'/{lp}/' or '/.venv/' in f'/{lp}/':forbidden.append(p)
    if name.endswith('.backup') or '.before-' in name or 'before-zip-update' in name:forbidden.append(p)
    if lp.startswith('qa-screens/') and Path(lp).suffix in {'.png','.jpg','.jpeg'}:forbidden.append(p)
    if lp.startswith('ai-service/trained_models/') and Path(lp).suffix=='.pt':forbidden.append(p)
    if p.startswith('UPDATE_') and p.endswith('.md'):forbidden.append(p)
    if p.startswith('TEST_RESULTS_') and p!='TEST_RESULTS.md':forbidden.append(p)
if forbidden:
    errors.append('forbidden/obsolete tracked files: '+', '.join(sorted(set(forbidden))))

for required in ['backend/package-lock.json','backend/.env.example','ai-service/.env.example','.gitignore','README.md']:
    if required not in pathset:errors.append('required tracked file missing: '+required)

# package.json/package-lock.json must agree on direct dependency specifications for npm ci.
package_path=ROOT/'backend/package.json'; lock_path=ROOT/'backend/package-lock.json'
if package_path.exists() and lock_path.exists():
    try:
        pkg=json.loads(package_path.read_text(encoding='utf-8'))
        lock=json.loads(lock_path.read_text(encoding='utf-8'))
        root_lock=(lock.get('packages') or {}).get('',{})
        for section in ('dependencies','devDependencies'):
            a=pkg.get(section,{}) or {}; b=root_lock.get(section,{}) or {}
            for key,val in a.items():
                if b.get(key)!=val:errors.append(f'package-lock mismatch: {section}.{key}: package.json={val!r} lock={b.get(key)!r}')
            for key in b:
                if key not in a:errors.append(f'package-lock has stale direct {section}: {key}')
    except Exception as e:errors.append('cannot validate package-lock.json: '+str(e))

# Scan only tracked text files so local secrets in ignored .env files are irrelevant.
secret_patterns=[
    ('Google API key',re.compile(r'AIza[0-9A-Za-z_-]{20,}')),
    ('MongoDB credential URI',re.compile(r'(?i)mongodb\+srv://[^\s:@]+:[^\s@]+@')),
    ('Brevo key assignment',re.compile(r'(?im)^[ \t]*BREVO_API_KEY[ \t]*=[ \t]*[^ \t\r\n#]+')),
    ('Google secret assignment',re.compile(r'(?im)^[ \t]*GOOGLE_CLIENT_SECRET[ \t]*=[ \t]*[^ \t\r\n#]+')),
    ('JWT secret assignment',re.compile(r'(?im)^[ \t]*JWT_(?:ACCESS|REFRESH)_SECRET[ \t]*=[ \t]*[^ \t\r\n#]+')),
]
for rel in paths:
    p=ROOT/rel
    if not p.is_file() or p.name=='.env.example' or p.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.zip','.pt','.ico'}:continue
    try:text=p.read_text(encoding='utf-8',errors='ignore')
    except Exception:continue
    for label,rx in secret_patterns:
        if rx.search(text):errors.append(f'{label} found in tracked file: {rel}')

# Real local env files are okay only if ignored and untracked.
for rel in ['backend/.env','ai-service/.env']:
    p=ROOT/rel
    if p.exists():
        if rel in pathset:errors.append('runtime env is tracked: '+rel)
        chk=run('git','check-ignore','-q',rel)
        if chk.returncode!=0:errors.append('runtime env is not ignored: '+rel)
        else:warnings.append('ignored local runtime env preserved: '+rel)

print('PREPUSH AUDIT:', 'PASS' if not errors else 'FAIL')
for w in warnings:print('-', 'WARNING:',w)
for e in errors:print('-',e)
sys.exit(1 if errors else 0)
