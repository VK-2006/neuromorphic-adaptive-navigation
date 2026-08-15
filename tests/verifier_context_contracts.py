from __future__ import annotations
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]
GIT=shutil.which('git')
if not GIT:
    raise SystemExit('VERIFIER_CONTEXT_CONTRACTS FAIL: git is required for pre-push working-tree validation')


def run(root:Path,*args:str):
    return subprocess.run(args,cwd=root,text=True,capture_output=True,check=False)

with tempfile.TemporaryDirectory(prefix='navora-verifier-') as td:
    clone=Path(td)/'repo'
    def clean_distribution_ignore(directory,names):
        ignored=set()
        for name in names:
            if name in {'.git','node_modules','.venv','venv','__pycache__','.pytest_cache'}:
                ignored.add(name)
            elif name=='.env' or (name.startswith('.env.') and name!='.env.example'):
                ignored.add(name)
            elif name.endswith('.pyc') or name.endswith('.pyo'):
                ignored.add(name)
        return ignored

    # Build the strict-check fixture the same way a distributable/source ZIP is built:
    # local runtime env files/caches are excluded, while .env.example remains present.
    shutil.copytree(ROOT,clone,ignore=clean_distribution_ignore)

    # A clean distribution has no runtime .env files and must pass strict checks.
    clean_master=run(clone,sys.executable,'scripts/master_prompt_crosscheck.py')
    clean_repo=run(clone,sys.executable,'scripts/repository_crosscheck.py')
    if clean_master.returncode or clean_repo.returncode:
        print(clean_master.stdout,clean_master.stderr,clean_repo.stdout,clean_repo.stderr,sep='\n')
        raise SystemExit('VERIFIER_CONTEXT_CONTRACTS FAIL: clean distribution checks did not pass')

    # A developer Git working tree may have ignored/untracked local runtime env files.
    run(clone,GIT,'init','-q')
    (clone/'backend/.env').write_text('JWT_ACCESS_SECRET=local-runtime-secret\nBREVO_API_KEY=local-runtime-key\n',encoding='utf-8')
    (clone/'ai-service/.env').write_text('AI_HOST=127.0.0.1\n',encoding='utf-8')

    wt_master=run(clone,sys.executable,'scripts/master_prompt_crosscheck.py','--working-tree')
    wt_repo=run(clone,sys.executable,'scripts/repository_crosscheck.py','--working-tree')
    if wt_master.returncode or wt_repo.returncode:
        print(wt_master.stdout,wt_master.stderr,wt_repo.stdout,wt_repo.stderr,sep='\n')
        raise SystemExit('VERIFIER_CONTEXT_CONTRACTS FAIL: ignored/untracked working-tree env files were rejected')

    # The exact same tree must still fail clean-distribution mode so release hygiene is not weakened.
    strict_master=run(clone,sys.executable,'scripts/master_prompt_crosscheck.py')
    strict_repo=run(clone,sys.executable,'scripts/repository_crosscheck.py')
    if strict_master.returncode==0 or strict_repo.returncode==0:
        raise SystemExit('VERIFIER_CONTEXT_CONTRACTS FAIL: clean-distribution mode accepted real .env files')

print('VERIFIER_CONTEXT_CONTRACTS PASS: clean releases reject real .env files; Git working trees accept only ignored/untracked runtime env files without scanning their secret contents')
