from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
def test_risk_low_vs_high():
    low={'features':{'objectClass':'car','confidence':.6,'estimatedDistance':40,'visibility':1}}
    high={'features':{'objectClass':'road blockage','confidence':.98,'estimatedDistance':2,'relativeSpeed':20,'userSpeed':25,'objectPersistence':1,'trafficDensity':.9,'hazardFrequency':.8,'visibility':.2,'weatherRisk':.7,'roadCondition':1,'verifiedReports':5}}
    a=client.post('/api/v1/risk/predict',json=low);b=client.post('/api/v1/risk/predict',json=high);assert a.status_code==b.status_code==200;assert b.json()['score']>a.json()['score'];assert b.json()['level'] in ['HIGH','CRITICAL']
def test_batch():
    r=client.post('/api/v1/risk/batch',json={'items':[{'objectClass':'person','confidence':.8,'estimatedDistance':10}]});assert r.status_code==200;assert len(r.json()['items'])==1
def test_fallback_risk_is_never_validated():
    info=client.get('/model/info');assert info.status_code==200
    risk=info.json()['riskModel']
    if 'fallback' in risk['mode']:
        assert risk['validated'] is False
    out=client.post('/api/v1/risk/predict',json={'features':{'objectClass':'pothole','confidence':.8,'estimatedDistance':8}});assert out.status_code==200
    if 'fallback' in out.json()['mode']:
        assert out.json()['validated'] is False
