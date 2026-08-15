from __future__ import annotations
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'ai-service'/'trained_models'
OUT=ROOT/'model-artifacts'
FILES=[
    'detector.pt','risk_snn.pt','metadata.json',
    'data-gate-report.json','detector-evaluation.json','snn-evaluation.json',
    'validation-evidence.json'
]

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''):
            h.update(c)
    return h.hexdigest()

def main():
    rc=subprocess.run([sys.executable,str(ROOT/'scripts/model_readiness.py')]).returncode
    if rc!=0:
        return rc
    meta=MODEL/'metadata.json'
    if not meta.exists() or json.loads(meta.read_text(encoding='utf-8')).get('validated') is not True:
        print('MODEL BUNDLE BLOCKED: models are not independently validated yet.')
        return 2
    missing=[name for name in FILES if not (MODEL/name).exists()]
    if missing:
        print('MODEL BUNDLE BLOCKED: missing',missing)
        return 2
    OUT.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    dest=OUT/f'navora-model-bundle-{stamp}.zip'
    sums=[]
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name in FILES:
            p=MODEL/name
            z.write(p,arcname=name)
            sums.append(f'{sha(p)}  {name}')
        z.writestr('SHA256SUMS.txt','\n'.join(sums)+'\n')
    print('MODEL_BUNDLE_PASS')
    print('bundle:',dest)
    print('bundleSha256:',sha(dest))
    print('IMPORTANT: do not commit this model ZIP to Git.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
