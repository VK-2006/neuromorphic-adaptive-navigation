from fastapi.testclient import TestClient
from app.main import app

client=TestClient(app)

def test_health_contains_render_fields():
    r=client.get('/health')
    assert r.status_code==200
    j=r.json()
    assert j['status']=='ok'
    assert j['service']=='navora-ai'
    assert 'commit' in j
    assert 'port' in j

def test_model_info_available():
    r=client.get('/model/info')
    assert r.status_code==200
    j=r.json()
    assert 'riskModel' in j
    assert 'detector' in j
