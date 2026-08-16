from __future__ import annotations
from pathlib import Path
import json,sys

ROOT=Path(__file__).resolve().parents[1]
MODEL_DIR=ROOT/'ai-service'/'trained_models'
sys.path.insert(0,str(ROOT/'ai-service'))
from app.model_validation import detector_integrity_status,model_validation_status

meta_path=MODEL_DIR/'metadata.json'
detector=MODEL_DIR/'detector.pt'
snn=MODEL_DIR/'risk_snn.pt'

def load(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        print(f'MODEL_READINESS FAIL: invalid {path.name}:',e)
        sys.exit(1)

meta=load(meta_path) if meta_path.exists() else {}
detector_present=detector.exists() and detector.stat().st_size>0
snn_present=snn.exists() and snn.stat().st_size>0

# Detector readiness is functional/integrity-only. Its independent cross-dataset
# scientific validation is intentionally outside the current NAVORA project scope.
if detector_present:
    detector_status=detector_integrity_status(detector,meta_path)
    if not detector_status['passed']:
        print('MODEL_READINESS FAIL: detector.pt is present but failed normal artifact integrity checks.')
        for problem in detector_status['reasons']:
            print('-',problem)
        sys.exit(1)
    print('MODEL_READINESS detector: functional artifact present and integrity checks passed.')
    print(f"- detector SHA-256: {detector_status.get('weightSha256')}")
    print(f"- metadata hash binding present: {detector_status.get('hashBound')}")
else:
    print('MODEL_READINESS detector: detector.pt not present in this checkout; development fallback remains available.')

# SNN scientific validation remains independent and unchanged in scope.
if bool(meta.get('riskValidated',False)):
    risk_status=model_validation_status('risk',snn,meta_path)
    if not risk_status['passed']:
        print('MODEL_READINESS FAIL: riskValidated=true is not backed by the SNN validation evidence guard.')
        for problem in risk_status['reasons']:
            print('-',problem)
        sys.exit(1)
    print('MODEL_READINESS SNN: validated risk model is evidence-bound and ready.')
else:
    print('MODEL_READINESS SNN: research/development state is truthful; validated SNN risk inference is NOT claimed.')
    print(f'- SNN weights present: {snn_present}')
    print(f"- SNN independently evaluated flag: {bool(meta.get('riskValidated',False))}")

print('MODEL_READINESS PASS: detector functional readiness and SNN scientific validation are separate concerns.')
print('- Detector scientific validation is not required for current project completion.')
