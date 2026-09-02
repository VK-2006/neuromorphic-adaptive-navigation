from fastapi import APIRouter,HTTPException
from ..schemas.risk import RiskRequest,BatchRiskRequest,RiskResponse
from ..services.risk_service import engine
router=APIRouter()
@router.get('/model/info')
def model_info():return {'riskModel':{'version':engine.version,'mode':engine.mode,'validated':engine.validated,'validationIssues':engine.validation_issues},'note':'NAVORA camera-free route-risk engine.'}
@router.post('/api/v1/risk/predict',response_model=RiskResponse)
def risk(req:RiskRequest):return engine.predict(req.features)
@router.post('/api/v1/risk/batch')
def batch(req:BatchRiskRequest):return {'items':[engine.predict(x) for x in req.items],'modelVersion':engine.version,'mode':engine.mode}
