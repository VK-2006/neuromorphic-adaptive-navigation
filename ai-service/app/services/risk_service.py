import cv2, numpy as np, json
from ..config import settings
from ..models.snn import RiskSNN,SNN_AVAILABLE
from ..model_validation import model_validation_status
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
        self.unvalidated_weights_present=False
        self.load_error=None
        self.validation_issues=[]
        if settings.metadata_path.exists():
            try:
                m=json.loads(settings.metadata_path.read_text())
                self.version=m.get('riskModelVersion',self.version)
            except Exception:
                pass
        validation=model_validation_status('risk',settings.snn_weights,settings.metadata_path)
        self.validation_issues=list(validation.get('reasons') or [])
        if SNN_AVAILABLE and torch is not None and settings.snn_weights.exists():
            try:
                candidate=RiskSNN(input_size=14)
                candidate.load_state_dict(
                    torch.load(settings.snn_weights,map_location=settings.device,weights_only=True)
                )
                candidate.eval()
                self.validated=bool(validation.get('passed'))
                if self.validated:
                    self.model=candidate
                    self.mode='snn-trained-weights-validated'
                else:
                    # Research weights may be observed explicitly, but remain unvalidated.
                    # They must never be used for normal inference; the service must
                    # fail closed to the deterministic heuristic fallback.
                    self.model=None
                    self.validated=False
                    self.unvalidated_weights_present=True
                    self.mode='development/heuristic-fallback-unvalidated-weights'
            except Exception as e:
                self.model=None
                self.validated=False
                self.load_error=f'{type(e).__name__}: {e}'
                self.mode='development/heuristic-fallback-load-error'
        if self.model is None:
            self.validated=False

    def vector(self,f):
        canonical=canonical_object_class(f.objectClass)
        obj=CLASS_RISK.get(canonical,CLASS_RISK['unknown'])
        dist=max(0,min(1,1-f.estimatedDistance/50))
        rel=max(0,min(1,abs(f.relativeSpeed)/30))
        speed=max(0,min(1,f.userSpeed/35))
        reports=max(0,min(1,f.verifiedReports/5))
        return np.array([
            min(1, (f.distanceKm if f.distanceKm is not None else f.estimatedDistance) / 24),
            min(1, (f.travelTimeMin if f.travelTimeMin is not None else f.estimatedDistance * 2) / 100),
            (f.trafficLevel / 2 if f.trafficLevel is not None else f.trafficDensity),
            (f.roadCondition / 2 if f.roadCondition > 1 else f.roadCondition),
            (f.potholeLevel / 3 if f.potholeLevel is not None else obj),
            (f.roadDamageLevel / 3 if f.roadDamageLevel is not None else f.roadCondition),
            (f.roadBlockageLevel / 3 if f.roadBlockageLevel is not None else obj),
            f.weatherRisk,
            (f.accidentRisk if f.accidentRisk is not None else f.hazardFrequency),
            (f.pedestrianDensity if f.pedestrianDensity is not None else f.objectPersistence),
            (f.vehicleDensity if f.vehicleDensity is not None else min(1, f.userSpeed / 35)),
            max(0, 1 - (f.roadWidth if f.roadWidth is not None else 10) / 14),
            (f.lightingCondition / 2 if f.lightingCondition is not None else 1 - f.visibility),
            (f.historicalRisk if f.historicalRisk is not None else max(f.roadCondition, reports)),
        ], dtype=np.float32)

    def heuristic(self,f):
        v=self.vector(f)
        weights=np.array([.08,.10,.10,.08,.11,.10,.12,.08,.07,.04,.04,.03,.02,.03],dtype=np.float32)
        score=float(np.clip(np.dot(v,weights)/weights.sum()*1.35,0,1))
        idx=0 if score<.3 else 1 if score<.55 else 2 if score<.78 else 3
        confidence=float(np.clip(.55+.35*f.confidence,0,1))
        note='Deterministic development fallback; not a validated trained SNN prediction.'
        if self.unvalidated_weights_present:
            note='Unvalidated/research-only SNN weights are present but blocked from normal inference; deterministic development fallback is active.'
        return score,CLASSES[idx],confidence,{
            'topFactors':self.top_factors(f,v),
            'canonicalObjectClass':canonical_object_class(f.objectClass),
            'note':note
        }

    def top_factors(self,f,v):
        names=[
            'distance','travel time','traffic','road condition','potholes',
            'road damage','road blockage','weather','accident risk',
            'pedestrian density','vehicle density','narrow road','lighting',
            'historical risk'
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
        # Defense in depth: only an evidence-bound validated model may serve trained inference.
        if self.model is None or not self.validated:
            score,level,confidence,explanation=self.heuristic(f)
        else:
            try:
                score,level,confidence,explanation=self.snn_predict(f)
            except Exception as e:
                self.load_error=f'runtime {type(e).__name__}: {e}'
                self.model=None
                self.validated=False
                self.mode='development/heuristic-fallback-runtime'
                self.validation_issues=list(dict.fromkeys(self.validation_issues+['SNN runtime inference failed']))
                score,level,confidence,explanation=self.heuristic(f)
        return {
            'score':score,'level':level,'confidence':confidence,
            'modelVersion':self.version,'mode':self.mode,
            'validated':self.validated and self.model is not None,'explanation':explanation
        }

engine=RiskEngine()
