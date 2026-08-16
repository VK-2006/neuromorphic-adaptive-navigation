import cv2, numpy as np, json
from ..config import settings
from ..model_validation import model_validation_status
try:
    import torch
    import torchvision  # registers TorchVision custom ops used by scripted Faster R-CNN
except Exception:
    torch=None
    torchvision=None
DEFAULT_TARGETS=['person','bicycle','motorcycle','car','bus','truck','animal','barrier','traffic cone','construction','stopped vehicle','road blockage','pothole','road damage']
class Detector:
    def __init__(self):
        self.model=None;self.mode='development/heuristic-fallback';self.version='detector-dev-1';self.validated=False;self.targets=list(DEFAULT_TARGETS);self.load_error=None;self.validation_issues=[];self.unvalidated_weights_present=False
        if settings.metadata_path.exists():
            try:
                m=json.loads(settings.metadata_path.read_text());self.version=m.get('detectorModelVersion',self.version);self.targets=m.get('detectorClasses') or self.targets
            except Exception:pass
        validation=model_validation_status('detector',settings.detector_weights,settings.metadata_path)
        self.validation_issues=list(validation.get('reasons') or [])
        if torch is not None and settings.detector_weights.exists():
            try:
                if torchvision is None:
                    raise RuntimeError('torchvision is unavailable; scripted Faster R-CNN ops cannot be registered')
                candidate=torch.jit.load(str(settings.detector_weights),map_location=settings.device).eval()
                if bool(validation.get('passed')):
                    self.model=candidate;self.validated=True;self.mode='torchscript-trained-weights-validated'
                else:
                    # Preserve the file only as research evidence. Normal detection must remain on
                    # the deterministic development fallback until the exact model is validated.
                    self.model=None;self.validated=False;self.unvalidated_weights_present=True;self.mode='development/heuristic-fallback-unvalidated-weights'
            except Exception as e:
                self.model=None;self.validated=False;self.load_error=f'{type(e).__name__}: {e}';self.mode='development/heuristic-fallback-load-error'
        if self.model is None:self.validated=False
        self.hog=cv2.HOGDescriptor();self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    def detect(self,image):
        # Defense in depth: normal API inference can use trained weights only after validation.
        if self.model is not None and self.validated:
            try:return self._torchscript(image)
            except Exception as e:
                self.load_error=f'runtime {type(e).__name__}: {e}';self.mode='development/heuristic-fallback-runtime';self.model=None;self.validated=False
                self.validation_issues=list(dict.fromkeys(self.validation_issues+['detector runtime inference failed']))
        return self._fallback_detect(image)
    def _fallback_detect(self,image):
        out=[];h,w=image.shape[:2]
        boxes,weights=self.hog.detectMultiScale(image,winStride=(8,8),padding=(8,8),scale=1.05)
        for (x,y,bw,bh),conf in zip(boxes,weights):out.append({'objectClass':'person','confidence':float(min(1,conf)),'boundingBox':[x/w,y/h,bw/w,bh/h],'approximateDistance':float(max(1,45*(1-bh/h))),'metadata':{'detector':'opencv-hog','validated':False}})
        roi=image[h//2:];gray=cv2.cvtColor(roi,cv2.COLOR_BGR2GRAY);blur=cv2.GaussianBlur(gray,(7,7),0);thr=cv2.adaptiveThreshold(blur,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,7);contours,_=cv2.findContours(thr,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        candidates=[]
        for c in contours:
            area=cv2.contourArea(c)
            if area<.003*w*h or area>.12*w*h:continue
            x,y,bw,bh=cv2.boundingRect(c);aspect=bw/max(1,bh)
            if .7<aspect<5:candidates.append((area,x,y+h//2,bw,bh))
        if candidates:
            _,x,y,bw,bh=max(candidates);out.append({'objectClass':'road damage','confidence':.42,'boundingBox':[x/w,y/h,bw/w,bh/h],'approximateDistance':8.0,'metadata':{'detector':'opencv-development-heuristic','validated':False,'notValidated':True}})
        return out[:12]
    def _torchscript(self,image):
        rgb=cv2.cvtColor(image,cv2.COLOR_BGR2RGB);arr=cv2.resize(rgb,(640,384));tensor=torch.from_numpy(arr).permute(2,0,1).float()/255
        with torch.no_grad():
            try: raw=self.model([tensor])
            except Exception: raw=self.model(tensor.unsqueeze(0))
        # TorchVision scripted detection models may return (losses, detections).
        if isinstance(raw,tuple) and len(raw)==2: raw=raw[1]
        if isinstance(raw,(list,tuple)) and raw and isinstance(raw[0],dict):
            d=raw[0];boxes=d.get('boxes',torch.empty((0,4))).detach().cpu().numpy();scores=d.get('scores',torch.empty(0)).detach().cpu().numpy();labels=d.get('labels',torch.empty(0,dtype=torch.long)).detach().cpu().numpy();out=[]
            for (x1,y1,x2,y2),score,label in zip(boxes,scores,labels):
                if float(score)<.3:continue
                idx=int(label)-1;cls=self.targets[idx] if 0<=idx<len(self.targets) else 'unknown';out.append({'objectClass':cls,'confidence':float(score),'boundingBox':[float(x1/640),float(y1/384),float((x2-x1)/640),float((y2-y1)/384)],'approximateDistance':None,'metadata':{'detector':'torchvision-scripted','validated':self.validated}})
            return out[:50]
        # Alternate exported row contract: [x1,y1,x2,y2,score,classIndex].
        rows=raw[0] if isinstance(raw,(list,tuple)) else raw
        if hasattr(rows,'detach'): rows=rows.detach().cpu().numpy()
        out=[]
        for x1,y1,x2,y2,score,idx in rows:
            if float(score)<.3:continue
            i=int(idx);cls=self.targets[i] if 0<=i<len(self.targets) else 'unknown';out.append({'objectClass':cls,'confidence':float(score),'boundingBox':[float(x1/640),float(y1/384),float((x2-x1)/640),float((y2-y1)/384)],'approximateDistance':None,'metadata':{'detector':'torchscript-row-contract','validated':self.validated}})
        return out[:50]
detector=Detector()
