from __future__ import annotations
from pathlib import Path
import argparse,csv,hashlib,json,math,sys
from collections import Counter

FEATURES=['objectPrior','confidence','proximity','relativeSpeed','userSpeed','objectPersistence','trafficDensity','hazardFrequency','lowVisibility','weatherRisk','roadOrReports']
RISK_LABELS=['LOW','MEDIUM','HIGH','CRITICAL']
DETECTOR_CLASSES=['person','bicycle','motorcycle','car','bus','truck','animal','barrier','traffic cone','construction','stopped vehicle','road blockage','pothole','road damage']

def sha256_file(path:Path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def risk_signature(row):
    vals=[f'{float(row[k]):.12g}' for k in FEATURES]
    return hashlib.sha256(('|'.join(vals+[row['riskLabel']])).encode()).hexdigest()

def read_risk(path:Path):
    if not path.exists():
        raise ValueError(f'missing file: {path}')
    rows=[]; labels=Counter()
    with path.open(newline='',encoding='utf-8') as f:
        reader=csv.DictReader(f)
        missing=[x for x in FEATURES+['riskLabel'] if x not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f'{path}: missing columns {missing}')
        for n,row in enumerate(reader,2):
            label=(row.get('riskLabel') or '').strip().upper()
            if label not in RISK_LABELS:
                raise ValueError(f'{path}:{n}: invalid riskLabel {label!r}')
            for key in FEATURES:
                try:
                    value=float(row[key])
                except Exception:
                    raise ValueError(f'{path}:{n}: non-numeric {key}')
                if not math.isfinite(value) or not 0<=value<=1:
                    raise ValueError(f'{path}:{n}: {key}={value} must be normalized to [0,1]')
            row['riskLabel']=label
            rows.append(row); labels[label]+=1
    return rows,labels

def read_manifest(path:Path):
    if not path.exists():
        raise ValueError(f'missing file: {path}')
    rows=[]; classes=Counter(); images=[]
    for n,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip():
            continue
        try:
            row=json.loads(line)
        except Exception as e:
            raise ValueError(f'{path}:{n}: invalid JSON: {e}')
        image=Path(str(row.get('image') or '')).expanduser()
        if not image.is_absolute():
            image=(Path.cwd()/image)
        image=image.resolve()
        if not image.exists():
            raise ValueError(f'{path}:{n}: image missing: {image}')
        boxes=row.get('boxes')
        if not isinstance(boxes,list) or not boxes:
            raise ValueError(f'{path}:{n}: boxes must be a non-empty list')
        for boxrow in boxes:
            cls=str(boxrow.get('class') or '')
            if cls not in DETECTOR_CLASSES:
                raise ValueError(f'{path}:{n}: unsupported class {cls!r}')
            box=boxrow.get('box')
            if not isinstance(box,list) or len(box)!=4:
                raise ValueError(f'{path}:{n}: invalid box for {cls}')
            vals=[float(x) for x in box]
            if not all(math.isfinite(x) for x in vals) or vals[2]<=vals[0] or vals[3]<=vals[1]:
                raise ValueError(f'{path}:{n}: invalid xyxy box {box}')
            classes[cls]+=1
        rows.append(row)
        images.append(str(image).lower())
    return rows,classes,images

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--det-train',type=Path,required=True)
    ap.add_argument('--det-eval',type=Path,required=True)
    ap.add_argument('--snn-train',type=Path,required=True)
    ap.add_argument('--snn-eval',type=Path,required=True)
    ap.add_argument('--min-det-train',type=int,default=400)
    ap.add_argument('--min-det-eval',type=int,default=200)
    ap.add_argument('--min-snn-train',type=int,default=400)
    ap.add_argument('--min-snn-eval',type=int,default=200)
    ap.add_argument('--min-det-eval-class-instances',type=int,default=5)
    ap.add_argument('--min-snn-eval-class-samples',type=int,default=10)
    ap.add_argument('--out',type=Path,default=Path('ai-service/trained_models/data-gate-report.json'))
    a=ap.parse_args()

    try:
        dtr,dtr_cls,dtr_images=read_manifest(a.det_train)
        dev,dev_cls,dev_images=read_manifest(a.det_eval)
        str_rows,str_labels=read_risk(a.snn_train)
        sev_rows,sev_labels=read_risk(a.snn_eval)
    except Exception as e:
        print('MODEL DATA GATE: BLOCKED')
        print('-',e)
        return 2

    problems=[]
    det_overlap=set(dtr_images)&set(dev_images)
    snn_overlap=set(map(risk_signature,str_rows))&set(map(risk_signature,sev_rows))
    det_dup_train=len(dtr_images)-len(set(dtr_images))
    det_dup_eval=len(dev_images)-len(set(dev_images))

    if len(dtr)<a.min_det_train: problems.append(f'detector training images {len(dtr)} < {a.min_det_train}')
    if len(dev)<a.min_det_eval: problems.append(f'detector held-out images {len(dev)} < {a.min_det_eval}')
    if len(str_rows)<a.min_snn_train: problems.append(f'SNN training rows {len(str_rows)} < {a.min_snn_train}')
    if len(sev_rows)<a.min_snn_eval: problems.append(f'SNN held-out rows {len(sev_rows)} < {a.min_snn_eval}')
    if det_overlap: problems.append(f'detector train/eval leakage: {len(det_overlap)} shared image(s)')
    if snn_overlap: problems.append(f'SNN train/eval leakage: {len(snn_overlap)} identical row(s)')
    if det_dup_train: problems.append(f'detector train manifest has {det_dup_train} duplicate image row(s)')
    if det_dup_eval: problems.append(f'detector eval manifest has {det_dup_eval} duplicate image row(s)')

    trained_classes=sorted(c for c,n in dtr_cls.items() if n>0)
    low_eval={c:dev_cls.get(c,0) for c in trained_classes if dev_cls.get(c,0)<a.min_det_eval_class_instances}
    if low_eval:
        problems.append(f'detector held-out class coverage below {a.min_det_eval_class_instances}: {low_eval}')
    low_risk={c:sev_labels.get(c,0) for c in RISK_LABELS if sev_labels.get(c,0)<a.min_snn_eval_class_samples}
    if low_risk:
        problems.append(f'SNN held-out label coverage below {a.min_snn_eval_class_samples}: {low_risk}')

    report={
        'passed':not problems,
        'thresholds':{
            'minDetectorTrainImages':a.min_det_train,
            'minDetectorEvalImages':a.min_det_eval,
            'minSnnTrainRows':a.min_snn_train,
            'minSnnEvalRows':a.min_snn_eval,
            'minDetectorEvalInstancesPerTrainedClass':a.min_det_eval_class_instances,
            'minSnnEvalSamplesPerClass':a.min_snn_eval_class_samples
        },
        'detector':{
            'trainImages':len(dtr),'evalImages':len(dev),
            'trainClassInstances':dict(dtr_cls),'evalClassInstances':dict(dev_cls),
            'trainEvalImageOverlap':len(det_overlap),
            'trainSha256':sha256_file(a.det_train),'evalSha256':sha256_file(a.det_eval)
        },
        'snn':{
            'trainRows':len(str_rows),'evalRows':len(sev_rows),
            'trainLabels':dict(str_labels),'evalLabels':dict(sev_labels),
            'trainEvalRowOverlap':len(snn_overlap),
            'trainSha256':sha256_file(a.snn_train),'evalSha256':sha256_file(a.snn_eval)
        },
        'problems':problems
    }
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    if problems:
        print('MODEL DATA GATE: BLOCKED')
        for p in problems:
            print('-',p)
        return 2
    print('MODEL DATA GATE: PASS')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
