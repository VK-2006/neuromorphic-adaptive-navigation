from fastapi import FastAPI
from .api.routes import router
app=FastAPI(title='Navora AI Service',version='1.0.0',description='Separate object detection and neuromorphic risk service')
@app.get('/health')
def health():return {'status':'ok','service':'navora-ai'}
app.include_router(router)
