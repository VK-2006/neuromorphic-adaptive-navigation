from __future__ import annotations
from pathlib import Path
import argparse,hashlib,json,sys
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'ai-service'/'trained_models'
sys.path.insert(0,str(ROOT/'ai-service'))
from app.model_validation import DATA_GATE_MINIMUMS,DETECTOR_EVAL_MINIMUMS,SNN_EVAL_MINIMUMS

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def load(path:Path):
    if not path.exists():
        raise SystemExit(f'missing evidence file: {path}')
    return json.loads(path.read_text(encoding='utf-8'))

def thresholds_meet(actual,minimums):
    return all(isinstance(actual.get(k),(int,float)) and not isinstance(actual.get(k),bool) and actual[k]>=v for k,v in minimums.items())

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--det-train',type=Path,required=True)
    ap.add_argument('--det-eval',type=Path,required=True)
    ap.add_argument('--snn-train',type=Path,required=True)
    ap.add_argument('--snn-eval',type=Path,required=True)
    a=ap.parse_args()

    gate_path=MODEL/'data-gate-report.json';det_path=MODEL/'detector-evaluation.json';snn_path=MODEL/'snn-evaluation.json';meta_path=MODEL/'metadata.json'
    gate=load(gate_path);det=load(det_path);snn=load(snn_path);meta=load(meta_path)
    detector=MODEL/'detector.pt'; risk=MODEL/'risk_snn.pt'
    if not detector.exists() or not risk.exists():
        print('VALIDATION EVIDENCE: BLOCKED - missing trained weights');return 2

    problems=[]
    gate_detector=gate.get('detector',{})
    gate_snn=gate.get('snn',{})
    if gate.get('passed') is not True: problems.append('real-data gate did not pass')
    if gate_detector.get('trainEvalImageOverlap')!=0: problems.append('detector train/eval overlap is not zero')
    if gate_snn.get('trainEvalRowOverlap')!=0: problems.append('SNN train/eval overlap is not zero')
    if not thresholds_meet(gate.get('thresholds',{}),DATA_GATE_MINIMUMS): problems.append('data-gate thresholds are below validation policy floors')
    if det.get('passed') is not True: problems.append('detector held-out evaluation did not pass')
    if snn.get('passed') is not True: problems.append('SNN held-out evaluation did not pass')
    if det.get('classPolicyPassed') is not True: problems.append('detector per-class validation policy did not pass')
    if snn.get('classPolicyPassed') is not True: problems.append('SNN per-class validation policy did not pass')
    if not thresholds_meet(det.get('thresholds',{}),DETECTOR_EVAL_MINIMUMS): problems.append('detector evaluation thresholds are below validation policy floors')
    if not thresholds_meet(snn.get('thresholds',{}),SNN_EVAL_MINIMUMS): problems.append('SNN evaluation thresholds are below validation policy floors')
    if det.get('validationEligible') is not True: problems.append('detector evaluation was not validation-eligible')
    if snn.get('validationEligible') is not True: problems.append('SNN evaluation was not validation-eligible')
    if meta.get('detectorValidated') is not True: problems.append('metadata detectorValidated is not true')
    if meta.get('riskValidated') is not True: problems.append('metadata riskValidated is not true')
    if meta.get('validated') is not True: problems.append('metadata validated is not true')

    gate_classes=gate_detector.get('trainClasses')
    if not isinstance(gate_classes,list) or meta.get('detectorClasses')!=gate_classes:
        problems.append('detector metadata class order does not match V29 data gate')
    det_per=det.get('perClass')
    if not isinstance(det_per,dict) or any(cls not in det_per for cls in (gate_classes or [])):
        problems.append('detector per-class evidence is incomplete for trained classes')
    snn_per=snn.get('perClass')
    if not isinstance(snn_per,dict) or any(cls not in snn_per for cls in ['LOW','MEDIUM','HIGH','CRITICAL']):
        problems.append('SNN per-class evidence is incomplete for risk classes')

    gate_sources=sorted((gate_detector.get('trainSources') or {}).keys())
    metadata_sources=meta.get('trainingSources')
    if not isinstance(metadata_sources,list) or sorted(metadata_sources)!=gate_sources:
        problems.append('detector metadata training sources do not match V29 data gate')
    if meta.get('trainingManifestSha256')!=gate_detector.get('trainSha256'):
        problems.append('detector metadata training manifest fingerprint does not match V29 data gate')

    current={
        'detectorTrainSha256':sha(a.det_train),
        'detectorEvalSha256':sha(a.det_eval),
        'snnTrainSha256':sha(a.snn_train),
        'snnEvalSha256':sha(a.snn_eval),
    }
    expected={
        'detectorTrainSha256':gate_detector.get('trainSha256'),
        'detectorEvalSha256':gate_detector.get('evalSha256'),
        'snnTrainSha256':gate_snn.get('trainSha256'),
        'snnEvalSha256':gate_snn.get('evalSha256'),
    }
    for key in current:
        if current[key]!=expected[key]:
            problems.append(f'dataset changed after data gate: {key}')

    if det.get('manifestSha256')!=current['detectorEvalSha256']:
        problems.append('detector evaluation report is not bound to the exact held-out manifest')
    if snn.get('datasetSha256')!=current['snnEvalSha256']:
        problems.append('SNN evaluation report is not bound to the exact held-out CSV')

    evidence={
        'schemaVersion':3,
        'passed':not problems,
        'createdAt':datetime.now(timezone.utc).isoformat(),
        'weights':{
            'detectorSha256':sha(detector),
            'riskSnnSha256':sha(risk)
        },
        'datasets':current,
        'detectorContract':{
            'classes':gate_classes,
            'trainingSources':gate_sources,
            'trainingManifestSha256':gate_detector.get('trainSha256'),
        },
        'reports':{
            'dataGateSha256':sha(gate_path),
            'detectorEvaluationSha256':sha(det_path),
            'snnEvaluationSha256':sha(snn_path),
            'metadataSha256':sha(meta_path),
        },
        'metrics':{
            'detector':{k:det.get(k) for k in ['images','precision','recall','f1','macroF1','classPolicyPassed','perClass','passed','validationEligible']},
            'snn':{k:snn.get(k) for k in ['samples','accuracy','macroF1','balancedAccuracy','negativeLogLikelihood','classPolicyPassed','perClass','passed','validationEligible']}
        },
        'policy':{
            'dataGateMinimums':DATA_GATE_MINIMUMS,
            'detectorEvaluationMinimums':DETECTOR_EVAL_MINIMUMS,
            'snnEvaluationMinimums':SNN_EVAL_MINIMUMS,
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
