from fastapi.testclient import TestClient
from app.main import app
import cv2,base64,numpy as np
client=TestClient(app)
def test_detect_accepts_image():
    img=np.full((240,320,3),180,dtype=np.uint8);ok,buf=cv2.imencode('.jpg',img);raw='data:image/jpeg;base64,'+base64.b64encode(buf).decode();r=client.post('/api/v1/detect',json={'image':raw});assert r.status_code==200;assert 'detections' in r.json();assert 'mode' in r.json()
def test_detect_rejects_invalid(): assert client.post('/api/v1/detect',json={'image':'notbase64'}).status_code==422
def test_fallback_detector_is_never_validated():
    info=client.get('/model/info');assert info.status_code==200
    detector=info.json()['detector']
    if 'fallback' in detector['mode']:
        assert detector['validated'] is False
    img=np.full((120,160,3),180,dtype=np.uint8);ok,buf=cv2.imencode('.jpg',img);raw='data:image/jpeg;base64,'+base64.b64encode(buf).decode();r=client.post('/api/v1/detect',json={'image':raw});assert r.status_code==200
    if 'fallback' in r.json()['mode']:
        assert r.json()['validated'] is False
