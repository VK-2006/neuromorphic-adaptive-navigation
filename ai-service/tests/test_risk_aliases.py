from app.schemas.risk import RiskFeatures
from app.services.risk_service import engine, canonical_object_class

def test_custom_roboflow_class_aliases():
    assert canonical_object_class('road debris') == 'road blockage'
    assert canonical_object_class('road barrier') == 'barrier'
    assert canonical_object_class('fallen tree') == 'road blockage'
    assert canonical_object_class('construction equipment') == 'construction'

def test_aliases_share_the_same_object_prior_vector():
    a=RiskFeatures(objectClass='road debris')
    b=RiskFeatures(objectClass='road blockage')
    c=RiskFeatures(objectClass='road barrier')
    d=RiskFeatures(objectClass='barrier')
    assert float(engine.vector(a)[0]) == float(engine.vector(b)[0])
    assert float(engine.vector(c)[0]) == float(engine.vector(d)[0])
