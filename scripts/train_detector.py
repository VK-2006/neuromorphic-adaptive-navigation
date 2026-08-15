"""Train a PyTorch/TorchVision detector from the unified BDD100K + RDD2022 manifest.

This script intentionally requires local dataset files and does not download or pretend to ship validated weights.
It saves a scripted detector plus metadata for ai-service/app/services/detection_service.py.
"""
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
import cv2,torch
from torch.utils.data import Dataset,DataLoader
from torchvision.transforms.functional import to_tensor
from torchvision.models.detection import fasterrcnn_resnet50_fpn
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

ROOT=Path(__file__).resolve().parents[1]
CLASSES=['__background__','person','bicycle','motorcycle','car','bus','truck','animal','barrier','traffic cone','construction','stopped vehicle','road blockage','pothole','road damage']
C2I={c:i for i,c in enumerate(CLASSES)}
class ManifestDataset(Dataset):
    def __init__(self,path): self.rows=[json.loads(x) for x in Path(path).read_text().splitlines() if x.strip()]
    def __len__(self): return len(self.rows)
    def __getitem__(self,i):
        r=self.rows[i];img=cv2.imread(r['image']);
        if img is None: raise FileNotFoundError(r['image'])
        img=cv2.cvtColor(img,cv2.COLOR_BGR2RGB);boxes=[];labels=[]
        for a in r['boxes']:
            if a['class'] not in C2I: continue
            boxes.append(a['box']);labels.append(C2I[a['class']])
        target={'boxes':torch.tensor(boxes,dtype=torch.float32),'labels':torch.tensor(labels,dtype=torch.int64),'image_id':torch.tensor([i])}
        return to_tensor(img),target

def collate(x): return tuple(zip(*x))
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--manifest',default=ROOT/'datasets/derived-risk-data/detection-manifest.jsonl');ap.add_argument('--epochs',type=int,default=5);ap.add_argument('--batch-size',type=int,default=2);ap.add_argument('--device',default='cuda' if torch.cuda.is_available() else 'cpu');a=ap.parse_args()
    ds=ManifestDataset(a.manifest);dl=DataLoader(ds,batch_size=a.batch_size,shuffle=True,collate_fn=collate,num_workers=0)
    model=fasterrcnn_resnet50_fpn(weights=None,weights_backbone=None);model.roi_heads.box_predictor=FastRCNNPredictor(model.roi_heads.box_predictor.cls_score.in_features,len(CLASSES));model.to(a.device);opt=torch.optim.AdamW(model.parameters(),lr=1e-4,weight_decay=1e-4)
    for epoch in range(a.epochs):
        model.train();total=0.0
        for images,targets in dl:
            images=[x.to(a.device) for x in images];targets=[{k:v.to(a.device) for k,v in t.items()} for t in targets];losses=model(images,targets);loss=sum(losses.values());opt.zero_grad();loss.backward();opt.step();total+=float(loss.detach())
        print(f'epoch {epoch+1}/{a.epochs} loss={total/max(1,len(dl)):.4f}')
    out=ROOT/'ai-service/trained_models';out.mkdir(parents=True,exist_ok=True);state=out/'detector_state.pt';torch.save(model.state_dict(),state)
    # TorchVision detection models support scripting. The AI service also understands scripted tuple/list-dict output.
    model.eval().cpu();scripted=torch.jit.script(model);scripted.save(str(out/'detector.pt'))
    meta_path=out/'metadata.json'
    try: meta=json.loads(meta_path.read_text()) if meta_path.exists() else {}
    except Exception: meta={}
    meta.update({'detectorModelVersion':'bdd100k-rdd2022-fasterrcnn-trained-v1','detectorClasses':CLASSES[1:],'detectorValidated':False,'trainingSources':['BDD100K','RDD2022'],'note':'Training never implies validation. Run evaluate_detector.py on held-out real data.'})
    meta['validated']=bool(meta.get('detectorValidated',False) and meta.get('riskValidated',False))
    meta_path.write_text(json.dumps(meta,indent=2));print('saved',out/'detector.pt');print('validation remains FALSE; evaluate on held-out data before live safety use')
if __name__=='__main__': main()
