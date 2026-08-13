from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
def test_health(): assert client.get('/health').status_code==200
def test_model_info_has_mode():
    j=client.get('/model/info').json(); assert 'riskModel' in j and 'mode' in j['riskModel']
