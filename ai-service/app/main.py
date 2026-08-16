import os
from fastapi import FastAPI
from .api.routes import router

app=FastAPI(title='Navora AI Service',version='1.0.0',description='Separate object detection and neuromorphic risk service')

@app.get('/health')
def health():
    return {
        'status':'ok',
        'service':'navora-ai',
        'commit':os.getenv('RENDER_GIT_COMMIT'),
        'releasePolicy':'exact-sha-v37',
        'port':os.getenv('PORT') or os.getenv('AI_PORT') or '8000'
    }

app.include_router(router)
