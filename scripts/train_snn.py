"""Train the Navora snnTorch risk classifier on an exported CSV. This is not run automatically."""
from pathlib import Path
import csv,sys
import torch, torch.nn as nn
import snntorch as snn
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'ai-service'))
from app.models.snn import RiskSNN
FEATURES=['objectPrior','confidence','proximity','relativeSpeed','userSpeed','objectPersistence','trafficDensity','hazardFrequency','lowVisibility','weatherRisk','roadOrReports']
LABELS={'LOW':0,'MEDIUM':1,'HIGH':2,'CRITICAL':3}
def load(path):
    xs,ys=[],[]
    with open(path,newline='') as f:
        for r in csv.DictReader(f):xs.append([float(r[k]) for k in FEATURES]);ys.append(LABELS[r['riskLabel']])
    return torch.tensor(xs,dtype=torch.float32),torch.tensor(ys)
def main(path):
    x,y=load(path);model=RiskSNN(input_size=len(FEATURES));opt=torch.optim.Adam(model.parameters(),lr=1e-3);loss_fn=nn.CrossEntropyLoss()
    for epoch in range(50):
        seq=torch.stack([(torch.rand_like(x)<x.clamp(0,1)).float() for _ in range(20)]);spikes,mem=model(seq);logits=mem[-1];loss=loss_fn(logits,y);opt.zero_grad();loss.backward();opt.step()
        if epoch%10==0:print(epoch,float(loss))
    out=ROOT/'ai-service/trained_models/risk_snn.pt';torch.save(model.state_dict(),out);print('saved',out)
if __name__=='__main__':main(sys.argv[1] if len(sys.argv)>1 else ROOT/'datasets/derived-risk-data/risk-training.csv')
