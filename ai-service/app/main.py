import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .api.routes import router
from .config import settings
from .services.risk_service import engine

app=FastAPI(title='Navora AI Service',version='1.0.0',description='Camera-free route-risk service using RiskSNN')

@app.get('/health')
def health():
    return {
        'status':'ok',
        'service':'navora-ai',
        'commit':os.getenv('RENDER_GIT_COMMIT'),
        'releasePolicy':'exact-sha-v37',
        'port':os.getenv('PORT') or os.getenv('AI_PORT') or '8000'
    }

@app.get('/ready')
def ready():
    if not engine.validated or engine.model is None:
        return JSONResponse(status_code=503, content={
            'status': 'not_ready',
            'service': 'navora-ai',
            'validated': False,
            'mode': engine.mode,
            'validationIssues': engine.validation_issues,
        })
    return {
        'status': 'ready',
        'service': 'navora-ai',
        'validated': True,
        'mode': engine.mode,
        'modelVersion': engine.version,
        'weightsPath': str(settings.snn_weights),
    }

app.include_router(router)
