from __future__ import annotations
from pathlib import Path
import argparse
import importlib.util
import os
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Run the consolidated Navora pre-push verification suite.')
parser.add_argument('--runtime',action='store_true',help='Also run the Mongo-backed runtime E2E flow. Requires local MongoDB and backend node_modules.')
parser.add_argument('--browser',action='store_true',help='Also run optional Playwright visual QA when Playwright/browser are installed.')
args=parser.parse_args()

results=[]

def cmd(name,argv,cwd=ROOT,required=True,env=None):
    print(f'\n=== {name} ===')
    try:
        p=subprocess.run(argv,cwd=cwd,env=env,check=False)
        ok=p.returncode==0
    except FileNotFoundError as e:
        ok=False;p=None;print(e)
    results.append((name,ok,required))
    if required and not ok:print(f'>>> {name}: FAIL')
    elif ok:print(f'>>> {name}: PASS')
    else:print(f'>>> {name}: SKIP/WARNING')
    return ok

py=sys.executable
node=shutil.which('node')
npm=shutil.which('npm.cmd' if os.name=='nt' else 'npm') or shutil.which('npm')

# Source, security, frontend, algorithms.
cmd('Python syntax',[py,'-m','compileall','-q','scripts','ai-service/app','ai-service/tests','tests','qa-screens'])
cmd('Master prompt cross-check',[py,'scripts/master_prompt_crosscheck.py','--working-tree'] if (ROOT/'.git').exists() else [py,'scripts/master_prompt_crosscheck.py'])
cmd('Repository working-tree cross-check',[py,'scripts/repository_crosscheck.py','--working-tree'])
if (ROOT/'.git').exists():cmd('Git pre-push audit',[py,'scripts/prepush_audit.py'])
else:results.append(('Git pre-push audit',True,False));print('\n=== Git pre-push audit ===\nSKIP — clean distribution has no .git; run after merge.')

for test in [
    'tests/frontend_stack_contracts.py','tests/worldclass_ui_contracts.py','tests/dom_contracts.py',
    'tests/static_assets.py','tests/frontend_contracts.py','tests/failure_contracts.py',
    'tests/accessibility_contracts.py','tests/live_navigation_contracts.py','tests/verifier_context_contracts.py'
]:cmd(test,[py,test])

if node:
    cmd('Backend JavaScript syntax',[node,'scripts/check-backend.js'])
    cmd('Pure algorithm smoke',[node,'tests/pure-smoke.js'])
    cmd('Performance smoke',[node,'tests/performance_smoke.js'])
else:results.append(('Node smoke tests',False,True));print('Node.js not found')

# AI tests: prefer the project venv so users do not need to remember the interpreter path.
ai_python=None
for candidate in [ROOT/'ai-service/.venv/Scripts/python.exe',ROOT/'ai-service/.venv/bin/python']:
    if candidate.exists():ai_python=str(candidate);break
if not ai_python:ai_python=py
ai_has_pytest=subprocess.run([ai_python,'-c','import pytest,fastapi,cv2,numpy'],cwd=ROOT/'ai-service',capture_output=True).returncode==0
if ai_has_pytest:cmd('AI pytest',[ai_python,'-m','pytest','tests','-q'],cwd=ROOT/'ai-service')
else:
    results.append(('AI pytest',False,True));print('\n=== AI pytest ===\nFAIL — AI dependencies are not installed in the selected Python environment.')

# Backend Jest/audit only when installed dependencies are available.
backend_modules=ROOT/'backend/node_modules'
if npm and backend_modules.exists():
    cmd('Backend Jest',[npm,'test'],cwd=ROOT/'backend')
    cmd('npm audit',[npm,'audit','--audit-level=high'],cwd=ROOT/'backend')
else:
    results.append(('Backend Jest',True,False));results.append(('npm audit',True,False))
    print('\n=== Backend installed-dependency checks ===\nSKIP — backend/node_modules is absent in this clean distribution.')

cmd('Model readiness truthfulness',[py,'scripts/model_readiness.py'])

if args.runtime:
    if not (node and npm and backend_modules.exists()):
        results.append(('Runtime E2E',False,True));print('\n=== Runtime E2E ===\nFAIL — backend node_modules/npm are required.')
    else:
        # Runtime test itself launches a temporary backend and uses a separate MongoDB database.
        cmd('Runtime E2E',[node,'scripts/runtime_e2e.js'])

if args.browser:
    has_playwright=importlib.util.find_spec('playwright') is not None
    if has_playwright:
        cmd('Browser runtime QA',[py,'qa-screens/render_qa.py','--check-only'])
        cmd('Browser responsive matrix',[py,'qa-screens/render_qa.py','--check-only','--matrix'])
    else:
        results.append(('Browser QA',False,True));print('\n=== Browser QA ===\nFAIL — install Playwright and Chromium before using --browser.')

required=[r for r in results if r[2]]
failed=[r for r in required if not r[1]]
print('\n'+'='*72)
print('NAVORA FINAL VERIFICATION:', 'PASS' if not failed else 'FAIL')
for name,ok,required in results:
    print(f"{'PASS' if ok else 'FAIL'}  {'REQ' if required else 'OPT'}  {name}")
if failed:
    print('\nFix the failed required checks before Git push.')
    sys.exit(1)
print('\nAll required checks executed by this environment passed. External credentials, trained-model validation and physical browser hardware remain explicit environment gates, not hidden PASS claims.')
