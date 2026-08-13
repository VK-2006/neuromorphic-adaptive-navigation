"""Evaluate risk_snn.pt on a held-out normalized CSV and optionally update validation metadata.

This script intentionally refuses to mark a tiny/demo fixture as validated. Validation should
use a held-out real dataset representative of the intended navigation environment.
"""
from __future__ import annotations
from pathlib import Path
import argparse,csv,json,sys
import torch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'ai-service'))
from app.models.snn import RiskSNN
FEATURES=['objectPrior','confidence','proximity','relativeSpeed','userSpeed','objectPersistence','trafficDensity','hazardFrequency','lowVisibility','weatherRisk','roadOrReports']
LABELS=['LOW','MEDIUM','HIGH','CRITICAL'];L2I={x:i for i,x in enumerate(LABELS)}

def load_csv(path):
    xs,ys=[],[]
    with open(path,newline='',encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r.get('riskLabel') not in L2I:continue
            xs.append([float(r[k]) for k in FEATURES]);ys.append(L2I[r['riskLabel']])
    if not xs:raise SystemExit('No evaluation rows found')
    return torch.tensor(xs,dtype=torch.float32),torch.tensor(ys)

def macro_f1(y,p):
    vals=[];matrix=[[0]*4 for _ in range(4)]
    for a,b in zip(y,p):matrix[a][b]+=1
    for c in range(4):
        tp=matrix[c][c];fp=sum(matrix[r][c] for r in range(4) if r!=c);fn=sum(matrix[c][r] for r in range(4) if r!=c)
        precision=tp/(tp+fp) if tp+fp else 0;recall=tp/(tp+fn) if tp+fn else 0
        vals.append(2*precision*recall/(precision+recall) if precision+recall else 0)
    return sum(vals)/4,matrix

def update_metadata(passed,report_path):
    model_dir=ROOT/'ai-service/trained_models';mp=model_dir/'metadata.json'
    try:m=json.loads(mp.read_text()) if mp.exists() else {}
    except Exception:m={}
    m['riskValidated']=bool(passed)
    m['validated']=bool(m.get('riskValidated',False) and m.get('detectorValidated',False))
    m.setdefault('validation',{})['riskReport']=report_path.name
    mp.write_text(json.dumps(m,indent=2),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--csv',type=Path,required=True,help='Held-out normalized evaluation CSV')
    ap.add_argument('--weights',type=Path,default=ROOT/'ai-service/trained_models/risk_snn.pt')
    ap.add_argument('--min-samples',type=int,default=200);ap.add_argument('--min-accuracy',type=float,default=.75);ap.add_argument('--min-macro-f1',type=float,default=.70)
    ap.add_argument('--seed',type=int,default=2026);ap.add_argument('--mark-validation',action='store_true',help='Write riskValidated based on thresholds')
    a=ap.parse_args();x,y=load_csv(a.csv)
    if not a.weights.exists():raise SystemExit(f'Missing weights: {a.weights}')
    model=RiskSNN(input_size=len(FEATURES));model.load_state_dict(torch.load(a.weights,map_location='cpu',weights_only=True));model.eval();torch.manual_seed(a.seed)
    with torch.no_grad():
        seq=torch.stack([(torch.rand_like(x)<x.clamp(0,1)).float() for _ in range(30)]);spikes,mem=model(seq);rates=spikes.float().mean(0);pred=torch.argmax(rates+torch.softmax(mem[-1],dim=1),dim=1)
    yy=y.tolist();pp=pred.tolist();accuracy=sum(int(a==b) for a,b in zip(yy,pp))/len(yy);mf1,matrix=macro_f1(yy,pp)
    enough=len(yy)>=a.min_samples;passed=enough and accuracy>=a.min_accuracy and mf1>=a.min_macro_f1
    report={'samples':len(yy),'accuracy':round(accuracy,6),'macroF1':round(mf1,6),'thresholds':{'minSamples':a.min_samples,'minAccuracy':a.min_accuracy,'minMacroF1':a.min_macro_f1},'passed':passed,'confusionMatrix':matrix,'labels':LABELS,'dataset':str(a.csv)}
    out=ROOT/'ai-service/trained_models/snn-evaluation.json';out.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
    if a.mark_validation:update_metadata(passed,out);print('metadata riskValidated =',passed)
    if not enough:print('VALIDATION BLOCKED: evaluation set is too small to be treated as held-out real validation.')
    sys.exit(0 if passed else 2)
if __name__=='__main__':main()
