from __future__ import annotations
from pathlib import Path
import json
import sys

ROOT=Path(__file__).resolve().parents[1]
MODEL_DIR=ROOT/'ai-service'/'trained_models'
meta_path=MODEL_DIR/'metadata.json'
detector=MODEL_DIR/'detector.pt'
snn=MODEL_DIR/'risk_snn.pt'

meta={}
if meta_path.exists():
    try:meta=json.loads(meta_path.read_text(encoding='utf-8'))
    except Exception as e:
        print('MODEL_READINESS FAIL: invalid metadata.json:',e);sys.exit(1)

validated=bool(meta.get('validated',False))
detector_ready=detector.exists() and detector.stat().st_size>0
snn_ready=snn.exists() and snn.stat().st_size>0

if validated and not (detector_ready and snn_ready):
    print('MODEL_READINESS FAIL: metadata says validated=true but one or more trained weight files are missing.')
    sys.exit(1)

if validated:
    print('MODEL_READINESS PASS: detector + SNN weights are present and metadata is marked validated.')
else:
    print('MODEL_READINESS PASS: research/development fallback is truthful; validated safety AI is NOT claimed.')
    print(f'- detector weights present: {detector_ready}')
    print(f'- SNN weights present: {snn_ready}')
    print('- To enable validated live AI, train/evaluate both models and only then set metadata validated=true.')
