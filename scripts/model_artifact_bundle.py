from __future__ import annotations
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'ai-service'/'trained_models'
OUT=ROOT/'model-artifacts'
REQUIRED_FILES=[
    'detector.pt','risk_snn.pt','metadata.json',
    'data-gate-report.json','snn-evaluation.json','validation-evidence.json'
]
OPTIONAL_FILES=['detector-evaluation.json']

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
    if not meta.exists() or json.loads(meta.read_text(encoding='utf-8')).get('riskValidated') is not True:
        print('MODEL BUNDLE BLOCKED: SNN risk model is not scientifically validated yet.')
        return 2
    missing=[name for name in REQUIRED_FILES if not (MODEL/name).exists()]
    if missing:
        print('MODEL BUNDLE BLOCKED: missing',missing)
        return 2
    OUT.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    dest=OUT/f'navora-model-bundle-{stamp}.zip'
    sums=[]
    files=REQUIRED_FILES+[name for name in OPTIONAL_FILES if (MODEL/name).exists()]
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name in files:
            p=MODEL/name
            z.write(p,arcname=name)
            sums.append(f'{sha(p)}  {name}')
        z.writestr('SHA256SUMS.txt','\n'.join(sums)+'\n')
        z.writestr(
            'DETECTOR_SCOPE.txt',
            'Detector functionality is retained as a functional perception component.\n'
            'Independent cross-dataset detector scientific validation is outside current NAVORA scope.\n'
            'SNN scientific-validation evidence remains separately governed.\n'
        )
    print('MODEL_BUNDLE_PASS')
    print('bundle:',dest)
    print('bundleSha256:',sha(dest))
    print('detector-evaluation.json included only when present as optional development diagnostics')
    print('IMPORTANT: do not commit this model ZIP to Git.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
