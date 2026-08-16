"""Evaluate detector.pt against an internal BDD100K/RDD2022 development manifest.

Metrics use class-aware greedy IoU matching and publish aggregate/per-class diagnostics.
This utility is retained for normal development, regression debugging and reproducibility.
It does not establish independent cross-dataset detector scientific validation, safety
certification, or a current NAVORA project-completion requirement.
"""
from __future__ import annotations
from pathlib import Path
import argparse,json,os,sys
import cv2
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ai-service'))
from app.model_validation import DATA_GATE_MINIMUMS,DETECTOR_EVAL_MINIMUMS,sha256_file

def iou(a,b):
    ax1,ay1,aw,ah=a;bx1,by1,bw,bh=b;ax2,ay2=ax1+aw,ay1+ah;bx2,by2=bx1+bw,by1+bh
    ix1,iy1=max(ax1,bx1),max(ay1,by1);ix2,iy2=min(ax2,bx2),min(ay2,by2)
    inter=max(0,ix2-ix1)*max(0,iy2-iy1);union=max(1e-9,aw*ah+bw*bh-inter);return inter/union

def norm_gt(box,w,h):
    x1,y1,x2,y2=map(float,box);return [x1/w,y1/h,max(0,(x2-x1)/w),max(0,(y2-y1)/h)]

def thresholds_meet(actual,minimums):
    return all(isinstance(actual.get(k),(int,float)) and not isinstance(actual.get(k),bool) and actual[k]>=v for k,v in minimums.items())

def update_metadata(metadata_path,diagnostic_passed,report_path):
    metadata_path.parent.mkdir(parents=True,exist_ok=True)
    try:m=json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    except Exception:m={}
    m['detectorDiagnosticPassed']=bool(diagnostic_passed)
    m['detectorValidated']=False
    m['detectorScientificValidationInScope']=False
    m['validated']=bool(m.get('riskValidated',False))
    m.setdefault('validation',{})['detectorReport']=report_path.name
    metadata_path.write_text(json.dumps(m,indent=2),encoding='utf-8')

def gated_manifest_status(manifest):
    gate_path=ROOT/'ai-service/trained_models/data-gate-report.json'
    problems=[]
    try:gate=json.loads(gate_path.read_text(encoding='utf-8'))
    except Exception as e:return False,[f'missing/invalid data-gate report: {type(e).__name__}'],{}
    if gate.get('detector',{}).get('trainEvalImageOverlap')!=0:problems.append('detector train/eval overlap is not zero')
    current=sha256_file(manifest)
    expected=gate.get('detector',{}).get('evalSha256')
    if not expected or current!=expected:problems.append('internal detector evaluation manifest SHA-256 does not match the data gate')
    return not problems,problems,gate

def per_class_metrics(per):
    output={};f1s=[]
    for cls,counts in sorted(per.items()):
        tp=counts['tp'];fp=counts['fp'];fn=counts['fn'];support=tp+fn
        precision=tp/(tp+fp) if tp+fp else 0
        recall=tp/(tp+fn) if tp+fn else 0
        f1=2*precision*recall/(precision+recall) if precision+recall else 0
        output[cls]={**counts,'support':support,'precision':round(precision,6),'recall':round(recall,6),'f1':round(f1,6)}
        if support:f1s.append(f1)
    return output,(sum(f1s)/len(f1s) if f1s else 0)

def class_policy_status(per_class,trained_classes,configured):
    problems=[]
    minimum_support=DATA_GATE_MINIMUMS['minDetectorEvalInstancesPerTrainedClass']
    if not trained_classes:
        return False,['trained detector class contract is missing from the development data gate']
    for cls in trained_classes:
        metrics=per_class.get(cls)
        if not isinstance(metrics,dict):
            problems.append(f'{cls}: no internal evaluation metrics')
            continue
        support=int(metrics.get('support',0) or 0)
        if support<minimum_support:problems.append(f'{cls}: support {support} < {minimum_support}')
        if float(metrics.get('precision',0))<configured['minPerClassPrecision']:problems.append(f"{cls}: precision {metrics.get('precision',0)} < {configured['minPerClassPrecision']}")
        if float(metrics.get('recall',0))<configured['minPerClassRecall']:problems.append(f"{cls}: recall {metrics.get('recall',0)} < {configured['minPerClassRecall']}")
        if float(metrics.get('f1',0))<configured['minPerClassF1']:problems.append(f"{cls}: f1 {metrics.get('f1',0)} < {configured['minPerClassF1']}")
    return not problems,problems

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--manifest',type=Path,required=True,help='Internal detector development/evaluation JSONL manifest')
    ap.add_argument('--weights',type=Path,default=ROOT/'ai-service/trained_models/detector.pt');ap.add_argument('--metadata',type=Path,default=ROOT/'ai-service/trained_models/metadata.json')
    ap.add_argument('--iou',type=float,default=.5);ap.add_argument('--min-samples',type=int,default=DETECTOR_EVAL_MINIMUMS['minSamples']);ap.add_argument('--min-precision',type=float,default=DETECTOR_EVAL_MINIMUMS['minPrecision']);ap.add_argument('--min-recall',type=float,default=DETECTOR_EVAL_MINIMUMS['minRecall']);ap.add_argument('--min-f1',type=float,default=DETECTOR_EVAL_MINIMUMS['minF1']);ap.add_argument('--min-per-class-precision',type=float,default=DETECTOR_EVAL_MINIMUMS['minPerClassPrecision']);ap.add_argument('--min-per-class-recall',type=float,default=DETECTOR_EVAL_MINIMUMS['minPerClassRecall']);ap.add_argument('--min-per-class-f1',type=float,default=DETECTOR_EVAL_MINIMUMS['minPerClassF1']);ap.add_argument('--mark-validation',action='store_true',help='Legacy flag: record internal diagnostic result only; never marks detector scientifically validated')
    a=ap.parse_args()
    configured={'minSamples':a.min_samples,'minPrecision':a.min_precision,'minRecall':a.min_recall,'minF1':a.min_f1,'minPerClassPrecision':a.min_per_class_precision,'minPerClassRecall':a.min_per_class_recall,'minPerClassF1':a.min_per_class_f1}
    policy_problems=[f'configured diagnostic threshold {k}={configured[k]} is below development floor {v}' for k,v in DETECTOR_EVAL_MINIMUMS.items() if configured[k]<v]
    if not a.weights.exists():raise SystemExit(f'Missing detector weights: {a.weights}')
    os.environ['DETECTOR_WEIGHTS_PATH']=str(a.weights.resolve().relative_to((ROOT/'ai-service').resolve())) if str(a.weights.resolve()).startswith(str((ROOT/'ai-service').resolve())) else str(a.weights.resolve())
    os.environ['MODEL_METADATA_PATH']=str(a.metadata.resolve().relative_to((ROOT/'ai-service').resolve())) if a.metadata.exists() and str(a.metadata.resolve()).startswith(str((ROOT/'ai-service').resolve())) else str(a.metadata.resolve())
    from app.services.detection_service import Detector
    detector=Detector()
    if detector.model is None:
        detail=getattr(detector,'load_error',None) or '; '.join(getattr(detector,'integrity_issues',[]) or []) or 'unknown TorchScript load/integrity error'
        raise SystemExit(f'Detector weights could not be activated as TorchScript: {detail}')
    rows=[json.loads(x) for x in a.manifest.read_text(encoding='utf-8').splitlines() if x.strip()]
    tp=fp=fn=0;used=0;per={}
    for row in rows:
        image=cv2.imread(str(row['image']))
        if image is None:continue
        h,w=image.shape[:2];preds=detector.detect(image);gts=[{'objectClass':g['class'],'boundingBox':norm_gt(g['box'],w,h)} for g in row.get('boxes',[])]
        matched=set();used+=1
        for p in sorted(preds,key=lambda x:float(x.get('confidence',0)),reverse=True):
            cls=p.get('objectClass');best=(-1,0)
            for i,g in enumerate(gts):
                if i in matched or g['objectClass']!=cls:continue
                v=iou(p.get('boundingBox') or [0,0,0,0],g['boundingBox'])
                if v>best[1]:best=(i,v)
            bucket=per.setdefault(cls,{'tp':0,'fp':0,'fn':0})
            if best[0]>=0 and best[1]>=a.iou:matched.add(best[0]);tp+=1;bucket['tp']+=1
            else:fp+=1;bucket['fp']+=1
        for i,g in enumerate(gts):
            if i not in matched:fn+=1;per.setdefault(g['objectClass'],{'tp':0,'fp':0,'fn':0})['fn']+=1
    precision=tp/(tp+fp) if tp+fp else 0;recall=tp/(tp+fn) if tp+fn else 0;f1=2*precision*recall/(precision+recall) if precision+recall else 0
    detailed_per,macro_f1=per_class_metrics(per)
    enough=used>=a.min_samples
    metric_pass=enough and precision>=a.min_precision and recall>=a.min_recall and f1>=a.min_f1
    policy_compliant=not policy_problems
    passed=metric_pass and policy_compliant
    gate_ok,gate_problems,gate=gated_manifest_status(a.manifest)
    trained_classes=gate.get('detector',{}).get('trainClasses') if isinstance(gate,dict) else []
    class_policy_pass,class_problems=class_policy_status(detailed_per,trained_classes,configured)
    diagnostic_passed=passed and gate_ok and class_policy_pass
    report={'images':used,'tp':tp,'fp':fp,'fn':fn,'precision':round(precision,6),'recall':round(recall,6),'f1':round(f1,6),'macroF1':round(macro_f1,6),'iouThreshold':a.iou,'thresholds':configured,'policyFloors':DETECTOR_EVAL_MINIMUMS,'policyCompliant':policy_compliant,'metricPassed':metric_pass,'classPolicyPassed':class_policy_pass,'dataGateBound':gate_ok,'diagnosticPassed':diagnostic_passed,'validationEligible':False,'scientificValidationInScope':False,'passed':passed,'perClass':detailed_per,'trainedClasses':trained_classes,'manifest':str(a.manifest),'manifestSha256':sha256_file(a.manifest),'problems':policy_problems+gate_problems+class_problems}
    out=ROOT/'ai-service/trained_models/detector-evaluation.json';out.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
    if a.mark_validation:
        update_metadata(a.metadata,diagnostic_passed,out);print('metadata detectorDiagnosticPassed =',diagnostic_passed);print('metadata detectorValidated = False')
    if not enough:print('DETECTOR DIAGNOSTIC: evaluation set is below the configured development sample floor.')
    if policy_problems:print('DETECTOR DIAGNOSTIC: configured thresholds are weaker than development floors.')
    print('Detector scientific validation is outside current NAVORA scope; this report is development diagnostics only.')
    sys.exit(0 if (passed and (not a.mark_validation or diagnostic_passed)) else 2)
if __name__=='__main__':main()
