from __future__ import annotations
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'ai-service'/'trained_models'
OUT=ROOT/'model-artifacts'


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

    detector=MODEL/'detector.pt'
    metadata=MODEL/'metadata.json'
    if not detector.exists() or detector.stat().st_size<=0:
        print('MODEL BUNDLE BLOCKED: functional detector.pt is missing or empty.')
        return 2
    if not metadata.exists():
        print('MODEL BUNDLE BLOCKED: metadata.json is missing.')
        return 2

    try:
        meta=json.loads(metadata.read_text(encoding='utf-8'))
    except Exception as exc:
        print('MODEL BUNDLE BLOCKED: invalid metadata.json:',exc)
        return 2

    expected=meta.get('detectorSha256')
    actual=sha(detector)
    if expected and expected!=actual:
        print('MODEL BUNDLE BLOCKED: detector.pt SHA-256 does not match metadata.')
        return 2

    files=['detector.pt','metadata.json']

    # SNN scientific-validation artifacts remain optional to the detector bundle itself.
    # When a risk model is claimed scientifically validated, bind its retained evidence.
    risk=MODEL/'risk_snn.pt'
    if risk.exists():
        if meta.get('riskValidated') is True:
            required=['risk_snn.pt','data-gate-report.json','snn-evaluation.json','validation-evidence.json']
            missing=[name for name in required if not (MODEL/name).exists()]
            if missing:
                print('MODEL BUNDLE BLOCKED: validated SNN is missing retained evidence:',missing)
                return 2
            files.extend(required)
        else:
            print('MODEL BUNDLE NOTE: risk_snn.pt exists but is not scientifically validated; it is excluded from this runtime bundle.')

    # Internal detector diagnostics are never required for project completion, but include
    # them when present so local development evidence can travel with the artifact bundle.
    if (MODEL/'detector-evaluation.json').exists():
        files.append('detector-evaluation.json')

    OUT.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    dest=OUT/f'navora-model-bundle-{stamp}.zip'
    sums=[]
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name in dict.fromkeys(files):
            p=MODEL/name
            z.write(p,arcname=name)
            sums.append(f'{sha(p)}  {name}')
        z.writestr('SHA256SUMS.txt','\n'.join(sums)+'\n')
        z.writestr('DETECTOR_SCOPE.txt',
            'Functional BDD100K/RDD2022 perception component. Independent cross-dataset detector scientific validation is outside the current project scope and may be future work.\n')
    print('MODEL_BUNDLE_PASS')
    print('bundle:',dest)
    print('bundleSha256:',sha(dest))
    print('IMPORTANT: do not commit this model ZIP to Git.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
