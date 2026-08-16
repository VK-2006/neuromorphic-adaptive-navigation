from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RISK = ROOT / 'ai-service' / 'app' / 'services' / 'risk_service.py'
DETECT = ROOT / 'ai-service' / 'app' / 'services' / 'detection_service.py'
ROUTES = ROOT / 'ai-service' / 'app' / 'api' / 'routes.py'
DOC = ROOT / 'docs' / 'model-validation.md'
TEST = ROOT / 'ai-service' / 'tests' / 'test_validated_inference_gate.py'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    risk = RISK.read_text(encoding='utf-8')
    detect = DETECT.read_text(encoding='utf-8')
    routes = ROUTES.read_text(encoding='utf-8')
    doc = DOC.read_text(encoding='utf-8')
    test = TEST.read_text(encoding='utf-8')

    require('if self.model is None or not self.validated:' in risk,
            'risk API must fall back unless trained SNN is validated')
    require("self.mode='development/heuristic-fallback-unvalidated-weights'" in risk,
            'risk service must explicitly identify blocked unvalidated weights')
    require('self.model=None' in risk and 'self.unvalidated_weights_present=True' in risk,
            'unvalidated SNN candidate must not remain active for normal inference')

    require('if self.model is not None and self.validated:' in detect,
            'detector must execute trained inference only when validated')
    require("self.mode='development/heuristic-fallback-unvalidated-weights'" in detect,
            'detector must explicitly identify blocked unvalidated weights')
    require('return self._fallback_detect(image)' in detect,
            'detector must have an explicit normal fallback path')

    require('Unvalidated or research-only weights are blocked from normal prediction/detection' in routes,
            'model-info truthfulness note missing')
    require('unvalidated trained weights are not served by this endpoint' in routes,
            'detection endpoint must describe validated-only policy')

    require('V33 validated-only runtime inference' in doc,
            'validated-only runtime policy must be documented')
    require('test_unvalidated_snn_never_serves_trained_prediction' in test,
            'SNN unvalidated inference regression missing')
    require('test_unvalidated_detector_never_serves_trained_detection' in test,
            'detector unvalidated inference regression missing')
    require('test_validated_snn_serves_trained_prediction' in test and
            'test_validated_detector_serves_trained_detection' in test,
            'validated trained inference positive controls missing')

    print('V33 VALIDATED-ONLY AI INFERENCE CONTRACTS PASS')


if __name__ == '__main__':
    main()
