from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
def test_health():
    response=client.get('/health')
    assert response.status_code==200
    assert response.json()['releasePolicy']=='exact-sha-v37'
def test_model_info_has_mode():
    j=client.get('/model/info').json(); assert 'riskModel' in j and 'mode' in j['riskModel']; assert 'validated' in j['riskModel']; assert isinstance(j['riskModel']['validationIssues'],list); assert 'detector' not in j

def test_ready_is_fail_closed():
    response=client.get('/ready')
    assert response.status_code in (200,503)
    payload=response.json()
    assert payload['status'] == ('ready' if response.status_code == 200 else 'not_ready')
    assert payload['validated'] is (response.status_code == 200)

def test_runtime_uses_canonical_artifacts_for_legacy_render_names(monkeypatch):
    monkeypatch.setenv('SNN_WEIGHTS_PATH','trained_models/risk_snn.pt')
    monkeypatch.setenv('MODEL_METADATA_PATH','trained_models/metadata.json')
    from app.config import Settings
    settings=Settings()
    assert settings.snn_weights.name=='navora-risk-snn.pt'
    assert settings.metadata_path.name=='navora-risk-snn-metadata.json'
