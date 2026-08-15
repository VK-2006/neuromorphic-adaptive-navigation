"""Evaluate detector.pt against a held-out BDD100K/RDD2022-derived manifest.

Metrics use class-aware greedy IoU matching. The script can update detectorValidated, but only
when the held-out sample count and precision/recall/F1 thresholds are met.
"""
from __future__ import annotations
from pathlib import Path
import argparse,json,os,sys
import cv2
ROOT=Path(__file__).resolve().parents[1]

def iou(a,b):
    ax1,ay1,aw,ah=a;bx1,by1,bw,bh=b;ax2,ay2=ax1+aw,ay1+ah;bx2,by2=bx1+bw,by1+bh
    ix1,iy1=max(ax1,bx1),max(ay1,by1);ix2,iy2=min(ax2,bx2),min(ay2,by2)
    inter=max(0,ix2-ix1)*max(0,iy2-iy1);union=max(1e-9,aw*ah+bw*bh-inter);return inter/union

def norm_gt(box,w,h):
    x1,y1,x2,y2=map(float,box);return [x1/w,y1/h,max(0,(x2-x1)/w),max(0,(y2-y1)/h)]

def update_metadata(passed,report_path):
    model_dir=ROOT/'ai-service/trained_models';mp=model_dir/'metadata.json'
    try:m=json.loads(mp.read_text()) if mp.exists() else {}
    except Exception:m={}
    m['detectorValidated']=bool(passed);m['validated']=bool(m.get('riskValidated',False) and m.get('detectorValidated',False))
    m.setdefault('validation',{})['detectorReport']=report_path.name
    mp.write_text(json.dumps(m,indent=2),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--manifest',type=Path,required=True,help='Held-out JSONL manifest, not training data')
    ap.add_argument('--weights',type=Path,default=ROOT/'ai-service/trained_models/detector.pt');ap.add_argument('--metadata',type=Path,default=ROOT/'ai-service/trained_models/metadata.json')
    ap.add_argument('--iou',type=float,default=.5);ap.add_argument('--min-samples',type=int,default=200);ap.add_argument('--min-precision',type=float,default=.65);ap.add_argument('--min-recall',type=float,default=.60);ap.add_argument('--min-f1',type=float,default=.62);ap.add_argument('--mark-validation',action='store_true')
    a=ap.parse_args()
    if not a.weights.exists():raise SystemExit(f'Missing detector weights: {a.weights}')
    os.environ['DETECTOR_WEIGHTS_PATH']=str(a.weights.resolve().relative_to((ROOT/'ai-service').resolve())) if str(a.weights.resolve()).startswith(str((ROOT/'ai-service').resolve())) else str(a.weights.resolve())
    os.environ['MODEL_METADATA_PATH']=str(a.metadata.resolve().relative_to((ROOT/'ai-service').resolve())) if a.metadata.exists() and str(a.metadata.resolve()).startswith(str((ROOT/'ai-service').resolve())) else str(a.metadata.resolve())
    sys.path.insert(0,str(ROOT/'ai-service'))
    from app.services.detection_service import Detector
    detector=Detector()
    if detector.model is None:
        detail=getattr(detector,'load_error',None) or 'unknown TorchScript load error'
        raise SystemExit(f'Detector weights could not be loaded as TorchScript: {detail}')
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
    enough=used>=a.min_samples;passed=enough and precision>=a.min_precision and recall>=a.min_recall and f1>=a.min_f1
    report={'images':used,'tp':tp,'fp':fp,'fn':fn,'precision':round(precision,6),'recall':round(recall,6),'f1':round(f1,6),'iouThreshold':a.iou,'thresholds':{'minSamples':a.min_samples,'minPrecision':a.min_precision,'minRecall':a.min_recall,'minF1':a.min_f1},'passed':passed,'perClass':per,'manifest':str(a.manifest)}
    out=ROOT/'ai-service/trained_models/detector-evaluation.json';out.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
    if a.mark_validation:update_metadata(passed,out);print('metadata detectorValidated =',passed)
    if not enough:print('VALIDATION BLOCKED: held-out evaluation set is too small.')
    sys.exit(0 if passed else 2)
if __name__=='__main__':main()
