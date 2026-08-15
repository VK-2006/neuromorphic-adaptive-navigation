from __future__ import annotations
from pathlib import Path
import argparse,hashlib,json,sys
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'ai-service'/'trained_models'

def sha(path:Path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def load(path:Path):
    if not path.exists():
        raise SystemExit(f'missing evidence file: {path}')
    return json.loads(path.read_text(encoding='utf-8'))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--det-train',type=Path,required=True)
    ap.add_argument('--det-eval',type=Path,required=True)
    ap.add_argument('--snn-train',type=Path,required=True)
    ap.add_argument('--snn-eval',type=Path,required=True)
    a=ap.parse_args()

    gate=load(MODEL/'data-gate-report.json')
    det=load(MODEL/'detector-evaluation.json')
    snn=load(MODEL/'snn-evaluation.json')
    meta=load(MODEL/'metadata.json')
    detector=MODEL/'detector.pt'; risk=MODEL/'risk_snn.pt'
    if not detector.exists() or not risk.exists():
        print('VALIDATION EVIDENCE: BLOCKED - missing trained weights');return 2

    problems=[]
    if gate.get('passed') is not True: problems.append('real-data gate did not pass')
    if gate.get('detector',{}).get('trainEvalImageOverlap')!=0: problems.append('detector train/eval overlap is not zero')
    if gate.get('snn',{}).get('trainEvalRowOverlap')!=0: problems.append('SNN train/eval overlap is not zero')
    if det.get('passed') is not True: problems.append('detector held-out evaluation did not pass')
    if snn.get('passed') is not True: problems.append('SNN held-out evaluation did not pass')
    if meta.get('detectorValidated') is not True: problems.append('metadata detectorValidated is not true')
    if meta.get('riskValidated') is not True: problems.append('metadata riskValidated is not true')
    if meta.get('validated') is not True: problems.append('metadata validated is not true')

    current={
        'detectorTrainSha256':sha(a.det_train),
        'detectorEvalSha256':sha(a.det_eval),
        'snnTrainSha256':sha(a.snn_train),
        'snnEvalSha256':sha(a.snn_eval),
    }
    expected={
        'detectorTrainSha256':gate.get('detector',{}).get('trainSha256'),
        'detectorEvalSha256':gate.get('detector',{}).get('evalSha256'),
        'snnTrainSha256':gate.get('snn',{}).get('trainSha256'),
        'snnEvalSha256':gate.get('snn',{}).get('evalSha256'),
    }
    for key in current:
        if current[key]!=expected[key]:
            problems.append(f'dataset changed after data gate: {key}')

    evidence={
        'passed':not problems,
        'createdAt':datetime.now(timezone.utc).isoformat(),
        'weights':{
            'detectorSha256':sha(detector),
            'riskSnnSha256':sha(risk)
        },
        'datasets':current,
        'metrics':{
            'detector':{k:det.get(k) for k in ['images','precision','recall','f1','passed']},
            'snn':{k:snn.get(k) for k in ['samples','accuracy','macroF1','passed']}
        },
        'problems':problems
    }
    out=MODEL/'validation-evidence.json'
    out.write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    print(json.dumps(evidence,indent=2))
    if problems:
        print('VALIDATION EVIDENCE: BLOCKED')
        return 2
    print('VALIDATION EVIDENCE: PASS')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
