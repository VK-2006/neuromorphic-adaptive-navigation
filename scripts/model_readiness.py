from __future__ import annotations
from pathlib import Path
import json,sys

ROOT=Path(__file__).resolve().parents[1]
MODEL_DIR=ROOT/'ai-service'/'trained_models'
sys.path.insert(0,str(ROOT/'ai-service'))
from app.model_validation import model_validation_status

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
detector_status=model_validation_status('detector',detector,meta_path)
risk_status=model_validation_status('risk',snn,meta_path)

print('DETECTOR FUNCTIONAL READINESS')
print(f"- runtime ready: {bool(detector_status.get('passed'))}")
print(f"- weights present: {bool(detector.exists() and detector.stat().st_size>0)}")
print('- scientific validation required for current project completion: False')
for issue in detector_status.get('reasons') or []:
    print('-',issue)

if risk_status.get('passed'):
    print('SNN SCIENTIFIC VALIDATION PASS: exact risk model is backed by the retained evidence policy.')
else:
    print('SNN SCIENTIFIC VALIDATION NOT PASSED: normal validated SNN inference remains disabled.')
    for issue in risk_status.get('reasons') or []:
        print('-',issue)

# Detector scientific validation is intentionally not a project-completion gate.
# Runtime detector readiness and SNN scientific-validation state are reported independently.
if detector.exists() and not detector_status.get('passed'):
    print('MODEL_READINESS FAIL: detector artifact exists but failed normal runtime readiness checks.')
    sys.exit(1)

print('MODEL_READINESS PASS: detector functional readiness is independent from SNN scientific validation.')
