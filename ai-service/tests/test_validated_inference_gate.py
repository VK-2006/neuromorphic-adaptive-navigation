from app.services.risk_service import RiskEngine
from app.services.detection_service import Detector


def _risk_engine(validated: bool):
    engine = RiskEngine.__new__(RiskEngine)
    engine.model = object()
    engine.validated = validated
    engine.version = 'test-risk'
    engine.mode = 'snn-trained-weights-validated' if validated else 'development/heuristic-fallback-unvalidated-weights'
    engine.unvalidated_weights_present = not validated
    engine.load_error = None
    engine.validation_issues = []
    return engine


def test_unvalidated_snn_never_serves_trained_prediction():
    engine = _risk_engine(False)
    engine.snn_predict = lambda _: (_ for _ in ()).throw(AssertionError('unvalidated SNN inference executed'))
    engine.heuristic = lambda _: (0.2, 'LOW', 0.6, {'source': 'fallback'})
    out = RiskEngine.predict(engine, object())
    assert out['validated'] is False
    assert out['level'] == 'LOW'
    assert out['explanation']['source'] == 'fallback'


def test_validated_snn_serves_trained_prediction():
    engine = _risk_engine(True)
    engine.heuristic = lambda _: (_ for _ in ()).throw(AssertionError('validated SNN was sent to fallback'))
    engine.snn_predict = lambda _: (0.8, 'HIGH', 0.9, {'source': 'snn'})
    out = RiskEngine.predict(engine, object())
    assert out['validated'] is True
    assert out['level'] == 'HIGH'
    assert out['explanation']['source'] == 'snn'


def _detector(integrity_ready: bool, model_present: bool = True):
    detector = Detector.__new__(Detector)
    detector.model = object() if model_present else None
    detector.validated = False
    detector.functional = True
    detector.integrity_ready = integrity_ready
    detector.trained_weights_active = bool(model_present and integrity_ready)
    detector.mode = 'torchscript-trained-weights-functional' if detector.trained_weights_active else 'development/heuristic-fallback'
    detector.load_error = None
    detector.integrity_issues = []
    detector.validation_issues = detector.integrity_issues
    return detector


def test_integrity_ready_detector_serves_trained_detection_without_science_gate():
    detector = _detector(True)
    detector._fallback_detect = lambda _: (_ for _ in ()).throw(AssertionError('functional detector was sent to fallback'))
    detector._torchscript = lambda _: [{'objectClass': 'trained'}]
    out = Detector.detect(detector, object())
    assert detector.validated is False
    assert out == [{'objectClass': 'trained'}]


def test_detector_without_active_trained_artifact_uses_fallback():
    detector = _detector(False, model_present=False)
    detector._torchscript = lambda _: (_ for _ in ()).throw(AssertionError('inactive trained detector inference executed'))
    detector._fallback_detect = lambda _: [{'objectClass': 'fallback'}]
    out = Detector.detect(detector, object())
    assert detector.validated is False
    assert out == [{'objectClass': 'fallback'}]
