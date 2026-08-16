from fastapi import APIRouter,HTTPException
from ..schemas.risk import RiskRequest,BatchRiskRequest,RiskResponse
from ..schemas.detection import DetectRequest,DetectResponse
from ..services.risk_service import engine
from ..services.detection_service import detector
from ..utils.image import decode_data_url

router=APIRouter()

@router.get('/model/info')
def model_info():
    return {
        'riskModel':{
            'version':engine.version,
            'mode':engine.mode,
            'validated':engine.validated,
            'validationIssues':engine.validation_issues
        },
        'detector':{
            'version':detector.version,
            'mode':detector.mode,
            'validated':False,
            'functional':detector.functional,
            'integrityReady':detector.integrity_ready,
            'trainedWeightsActive':detector.trained_weights_active,
            'targets':detector.targets,
            'integrityIssues':detector.integrity_issues,
            'scientificValidationRequired':False,
            'scope':'functional perception component'
        },
        'note':(
            'SNN trained inference remains evidence-bound to its scientific-validation guard. '
            'The detector is retained as a functional perception module and uses normal artifact '
            'integrity/loadability checks; independent cross-dataset detector scientific validation '
            'is outside the current project scope.'
        )
    }

@router.post('/api/v1/risk/predict',response_model=RiskResponse)
def risk(req:RiskRequest):
    return engine.predict(req.features)

@router.post('/api/v1/risk/batch')
def batch(req:BatchRiskRequest):
    return {'items':[engine.predict(x) for x in req.items],'modelVersion':engine.version,'mode':engine.mode}

@router.post('/api/v1/detect',response_model=DetectResponse)
def detect(req:DetectRequest):
    try:
        image=decode_data_url(req.image)
    except Exception as e:
        raise HTTPException(422,str(e))
    detections=detector.detect(image)
    return {
        'detections':detections,
        'mode':detector.mode,
        'modelVersion':detector.version,
        'validated':False,
        'functional':detector.functional,
        'integrityReady':detector.integrity_ready,
        'trainedWeightsActive':detector.trained_weights_active,
        'explainability':{
            'targets':detector.targets,
            'integrityIssues':detector.integrity_issues,
            'scope':'functional perception component',
            'fallbackNote':(
                'detector.pt is used when its artifact integrity checks and TorchScript loading pass; '
                'otherwise the development fallback remains available. No independent cross-dataset '
                'detector scientific-validation claim is made.'
            )
        }
    }
