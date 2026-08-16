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
validated=bool(meta.get('validated',False))
detector_ready=detector.exists() and detector.stat().st_size>0
snn_ready=snn.exists() and snn.stat().st_size>0

if validated:
    detector_status=model_validation_status('detector',detector,meta_path)
    risk_status=model_validation_status('risk',snn,meta_path)
    problems=[]
    if not detector_status['passed']:
        problems.extend(f'detector: {x}' for x in detector_status['reasons'])
    if not risk_status['passed']:
        problems.extend(f'SNN: {x}' for x in risk_status['reasons'])
    if problems:
        print('MODEL_READINESS FAIL: validated=true is not backed by V28 live validation evidence.')
        for problem in dict.fromkeys(problems):
            print('-',problem)
        sys.exit(1)
    print('MODEL_READINESS PASS: both validated models are present and bound to V28 passing evidence, exact reports, datasets, and weight hashes.')
else:
    print('MODEL_READINESS PASS: research/development state is truthful; validated safety AI is NOT claimed.')
    print(f'- detector weights present: {detector_ready}')
    print(f'- SNN weights present: {snn_ready}')
    print(f"- detector independently evaluated flag: {bool(meta.get('detectorValidated',False))}")
    print(f"- SNN independently evaluated flag: {bool(meta.get('riskValidated',False))}")
    print('- Live validated mode remains disabled until both held-out evaluations, data binding, and V28 validation evidence pass.')
