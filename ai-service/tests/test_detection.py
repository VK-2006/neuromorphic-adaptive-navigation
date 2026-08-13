from fastapi.testclient import TestClient
from app.main import app
import cv2,base64,numpy as np
client=TestClient(app)
def test_detect_accepts_image():
    img=np.full((240,320,3),180,dtype=np.uint8);ok,buf=cv2.imencode('.jpg',img);raw='data:image/jpeg;base64,'+base64.b64encode(buf).decode();r=client.post('/api/v1/detect',json={'image':raw});assert r.status_code==200;assert 'detections' in r.json();assert 'mode' in r.json()
def test_detect_rejects_invalid(): assert client.post('/api/v1/detect',json={'image':'notbase64'}).status_code==422
