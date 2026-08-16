"""Train the Navora snnTorch risk classifier on a normalized risk CSV.

Training does NOT mark the model validated. Run scripts/evaluate_snn.py on a held-out
real evaluation set before enabling safety-eligible live AI. V32 also refuses every
scientifically consumed external final set so a final benchmark can never leak back into
training after it has been opened once.
"""
from __future__ import annotations
from pathlib import Path
import argparse,csv,json,sys
import torch, torch.nn as nn
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'ai-service'))
from app.models.snn import RiskSNN
from app.research_lock import assert_not_consumed_snn_final
FEATURES=['objectPrior','confidence','proximity','relativeSpeed','userSpeed','objectPersistence','trafficDensity','hazardFrequency','lowVisibility','weatherRisk','roadOrReports']
LABELS={'LOW':0,'MEDIUM':1,'HIGH':2,'CRITICAL':3}

def load(path):
    xs,ys=[],[]
    with open(path,newline='',encoding='utf-8') as f:
        for r in csv.DictReader(f):
            xs.append([float(r[k]) for k in FEATURES]);ys.append(LABELS[r['riskLabel']])
    if not xs:raise SystemExit('No training rows found')
    return torch.tensor(xs,dtype=torch.float32),torch.tensor(ys)

def update_metadata(version):
    out=ROOT/'ai-service/trained_models';out.mkdir(parents=True,exist_ok=True);p=out/'metadata.json'
    try:m=json.loads(p.read_text()) if p.exists() else {}
    except Exception:m={}
    m['riskModelVersion']=version;m['riskValidated']=False;m['validated']=bool(m.get('detectorValidated',False) and False)
    m.setdefault('note','Validation flags must only be enabled after held-out evaluation.')
    p.write_text(json.dumps(m,indent=2),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--csv',type=Path,default=ROOT/'datasets/derived-risk-data/risk-training.csv');ap.add_argument('--epochs',type=int,default=50);ap.add_argument('--lr',type=float,default=1e-3);ap.add_argument('--seed',type=int,default=1337);ap.add_argument('--version',default='risk-snn-trained-v1');a=ap.parse_args()
    try:assert_not_consumed_snn_final(a.csv,'training or tuning')
    except ValueError as exc:raise SystemExit(f'RESEARCH LOCK: {exc}') from exc
    torch.manual_seed(a.seed);x,y=load(a.csv);model=RiskSNN(input_size=len(FEATURES));opt=torch.optim.Adam(model.parameters(),lr=a.lr);loss_fn=nn.CrossEntropyLoss()
    for epoch in range(a.epochs):
        seq=torch.stack([(torch.rand_like(x)<x.clamp(0,1)).float() for _ in range(20)]);_,mem=model(seq);loss=loss_fn(mem[-1],y);opt.zero_grad();loss.backward();opt.step()
        if epoch%10==0 or epoch==a.epochs-1:print(f'epoch {epoch+1}/{a.epochs} loss={float(loss):.5f}')
    out=ROOT/'ai-service/trained_models';out.mkdir(parents=True,exist_ok=True);torch.save(model.state_dict(),out/'risk_snn.pt');update_metadata(a.version)
    print('saved',out/'risk_snn.pt');print('validation remains FALSE; evaluate on a fresh held-out real dataset before live safety use')
if __name__=='__main__':main()
