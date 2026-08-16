from fastapi import APIRouter,HTTPException
from ..schemas.risk import RiskRequest,BatchRiskRequest,RiskResponse
from ..schemas.detection import DetectRequest,DetectResponse
from ..services.risk_service import engine
from ..services.detection_service import detector
from ..utils.image import decode_data_url
router=APIRouter()
@router.get('/model/info')
def model_info():return {'riskModel':{'version':engine.version,'mode':engine.mode,'validated':engine.validated,'validationIssues':engine.validation_issues},'detector':{'version':detector.version,'mode':detector.mode,'validated':detector.validated,'targets':detector.targets,'validationIssues':detector.validation_issues},'note':'Normal trained inference is enabled only for V30 evidence-bound validated weights. Unvalidated or research-only weights are blocked from normal prediction/detection and deterministic development fallbacks remain active.'}
@router.post('/api/v1/risk/predict',response_model=RiskResponse)
def risk(req:RiskRequest):return engine.predict(req.features)
@router.post('/api/v1/risk/batch')
def batch(req:BatchRiskRequest):return {'items':[engine.predict(x) for x in req.items],'modelVersion':engine.version,'mode':engine.mode}
@router.post('/api/v1/detect',response_model=DetectResponse)
def detect(req:DetectRequest):
    try:image=decode_data_url(req.image)
    except Exception as e:raise HTTPException(422,str(e))
    detections=detector.detect(image)
    return {'detections':detections,'mode':detector.mode,'modelVersion':detector.version,'validated':detector.validated,'explainability':{'targets':detector.targets,'fallbackNote':'Without V30 evidence-bound validated detector weights, normal detection uses only limited OpenCV development heuristics; unvalidated trained weights are not served by this endpoint.'}}
