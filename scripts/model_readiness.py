from __future__ import annotations
from pathlib import Path
import hashlib,json,sys

ROOT=Path(__file__).resolve().parents[1]
MODEL_DIR=ROOT/'ai-service'/'trained_models'
meta_path=MODEL_DIR/'metadata.json'
detector=MODEL_DIR/'detector.pt'
snn=MODEL_DIR/'risk_snn.pt'

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''):
            h.update(c)
    return h.hexdigest()

def load(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        print(f'MODEL_READINESS FAIL: invalid {path.name}:',e)
        sys.exit(1)

meta=load(meta_path) if meta_path.exists() else {}
validated=bool(meta.get('validated',False))
detector_ready=detector.exists() and detector.stat().st_size>0
snn_ready=snn.exists() and snn.stat().st_size>0

if validated and not (detector_ready and snn_ready):
    print('MODEL_READINESS FAIL: metadata says validated=true but one or more trained weight files are missing.')
    sys.exit(1)

if validated:
    if not (meta.get('detectorValidated') is True and meta.get('riskValidated') is True):
        print('MODEL_READINESS FAIL: validated=true requires both independent validation flags.')
        sys.exit(1)
    evidence_path=MODEL_DIR/'validation-evidence.json'
    if not evidence_path.exists():
        print('MODEL_READINESS FAIL: validated models require validation-evidence.json.')
        sys.exit(1)
    evidence=load(evidence_path)
    if evidence.get('passed') is not True:
        print('MODEL_READINESS FAIL: validation evidence did not pass.')
        sys.exit(1)
    if evidence.get('weights',{}).get('detectorSha256')!=sha(detector):
        print('MODEL_READINESS FAIL: detector weight hash does not match validation evidence.')
        sys.exit(1)
    if evidence.get('weights',{}).get('riskSnnSha256')!=sha(snn):
        print('MODEL_READINESS FAIL: SNN weight hash does not match validation evidence.')
        sys.exit(1)
    print('MODEL_READINESS PASS: both validated models are present and bound to passing validation evidence.')
else:
    print('MODEL_READINESS PASS: research/development fallback is truthful; validated safety AI is NOT claimed.')
    print(f'- detector weights present: {detector_ready}')
    print(f'- SNN weights present: {snn_ready}')
    print('- To enable validated live AI, pass V12 real-data gating and both held-out evaluations.')
