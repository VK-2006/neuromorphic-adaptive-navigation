import cv2, numpy as np, json
from ..config import settings
from ..models.snn import RiskSNN,SNN_AVAILABLE
try:
    import torch
except Exception:
    torch=None

CLASSES=['LOW','MEDIUM','HIGH','CRITICAL']

CLASS_RISK={
    'person':.55,'pedestrian':.55,'bicycle':.42,'motorcycle':.48,
    'car':.34,'bus':.4,'truck':.48,'animal':.58,'barrier':.65,
    'traffic cone':.38,'traffic control':.35,'construction':.62,
    'stopped vehicle':.62,'road blockage':.9,'pothole':.72,
    'road damage':.6,'unknown':.25
}

CLASS_ALIASES={
    'road debris':'road blockage',
    'debris':'road blockage',
    'road barrier':'barrier',
    'fallen tree':'road blockage',
    'construction equipment':'construction',
    'construction vehicle':'construction',
}

def canonical_object_class(value):
    raw=str(value or 'unknown').strip().lower()
    return CLASS_ALIASES.get(raw,raw or 'unknown')

class RiskEngine:
    def __init__(self):
        self.version='risk-snn-dev-1'
        self.mode='development/heuristic-fallback'
        self.validated=False
        self.model=None
        if settings.metadata_path.exists():
            try:
                m=json.loads(settings.metadata_path.read_text())
                self.version=m.get('riskModelVersion',self.version)
                self.validated=bool(m.get('riskValidated',m.get('validated',False)))
            except Exception:
                pass
        if SNN_AVAILABLE and torch is not None and settings.snn_weights.exists():
            try:
                self.model=RiskSNN()
                self.model.load_state_dict(
                    torch.load(settings.snn_weights,map_location=settings.device,weights_only=True)
                )
                self.model.eval()
                self.mode='snn-trained-weights'
            except Exception:
                self.model=None

    def vector(self,f):
        canonical=canonical_object_class(f.objectClass)
        obj=CLASS_RISK.get(canonical,CLASS_RISK['unknown'])
        dist=max(0,min(1,1-f.estimatedDistance/50))
        rel=max(0,min(1,abs(f.relativeSpeed)/30))
        speed=max(0,min(1,f.userSpeed/35))
        reports=max(0,min(1,f.verifiedReports/5))
        return np.array([
            obj,f.confidence,dist,rel,speed,f.objectPersistence,
            f.trafficDensity,f.hazardFrequency,1-f.visibility,
            f.weatherRisk,max(f.roadCondition,reports)
        ],dtype=np.float32)

    def heuristic(self,f):
        v=self.vector(f)
        weights=np.array([.18,.08,.16,.10,.08,.07,.08,.07,.05,.05,.08],dtype=np.float32)
        score=float(np.clip(np.dot(v,weights)/weights.sum()*1.35,0,1))
        idx=0 if score<.3 else 1 if score<.55 else 2 if score<.78 else 3
        confidence=float(np.clip(.55+.35*f.confidence,0,1))
        return score,CLASSES[idx],confidence,{
            'topFactors':self.top_factors(f,v),
            'canonicalObjectClass':canonical_object_class(f.objectClass),
            'note':'Deterministic development fallback; not a validated trained SNN prediction.'
        }

    def top_factors(self,f,v):
        names=[
            'object class prior','detection confidence','proximity','relative speed',
            'user speed','persistence','traffic density','hazard frequency',
            'low visibility','weather risk','road/reports'
        ]
        pairs=sorted(zip(names,v.tolist()),key=lambda x:x[1],reverse=True)
        return [{'factor':n,'normalizedValue':round(x,3)} for n,x in pairs[:4]]

    def snn_predict(self,f):
        x=torch.tensor(self.vector(f),dtype=torch.float32).unsqueeze(0)
        steps=20
        rate=torch.clamp(x,0,1)
        seq=torch.stack([(torch.rand_like(rate)<rate).float() for _ in range(steps)])
        with torch.no_grad():
            spikes,mem=self.model(seq)
            rates=spikes.float().mean(0).squeeze(0)
            membrane=mem[-1].squeeze(0)
            logits=rates+torch.softmax(membrane,dim=0)
            prob=torch.softmax(logits,dim=0)
            idx=int(torch.argmax(prob))
            score=float(torch.dot(prob,torch.tensor([.12,.42,.7,.95])))
        return score,CLASSES[idx],float(prob[idx]),{
            'classProbabilities':{c:round(float(prob[i]),4) for i,c in enumerate(CLASSES)},
            'temporalSteps':steps,
            'decoder':'spike-rate + membrane',
            'canonicalObjectClass':canonical_object_class(f.objectClass)
        }

    def predict(self,f):
        if self.model is None:
            score,level,confidence,explanation=self.heuristic(f)
        else:
            score,level,confidence,explanation=self.snn_predict(f)
        return {
            'score':score,'level':level,'confidence':confidence,
            'modelVersion':self.version,'mode':self.mode,
            'validated':self.validated,'explanation':explanation
        }

engine=RiskEngine()
