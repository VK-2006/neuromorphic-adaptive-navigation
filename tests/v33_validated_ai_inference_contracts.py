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

    require('if self.model is not None and self.runtime_ready:' in detect,
            'detector trained inference must depend on functional runtime readiness')
    require("self.mode='development/heuristic-fallback-unready-weights'" in detect,
            'detector must explicitly identify unready weights')
    require('return self._fallback_detect(image)' in detect,
            'detector must retain an explicit normal fallback path')

    require('SNN trained inference remains scientific-validation gated' in routes,
            'model-info SNN truthfulness note missing')
    require('independent cross-dataset detector scientific validation is outside the current project scope' in routes,
            'detector scope boundary missing')

    require('SNN scientific validation' in doc,
            'SNN scientific-validation policy must remain documented')
    require('test_unvalidated_snn_never_serves_trained_prediction' in test,
            'SNN unvalidated inference regression missing')
    require('test_runtime_ready_detector_serves_trained_detection' in test,
            'detector runtime-readiness positive control missing')

    print('V33 AI INFERENCE CONTRACTS PASS: SNN validation retained, detector functional readiness retained')


if __name__ == '__main__':
    main()
