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

    # V33 SNN protection remains unchanged.
    require('if self.model is None or not self.validated:' in risk,
            'risk API must fall back unless trained SNN is validated')
    require("self.mode='development/heuristic-fallback-unvalidated-weights'" in risk,
            'risk service must explicitly identify blocked unvalidated weights')
    require('self.model=None' in risk and 'self.unvalidated_weights_present=True' in risk,
            'unvalidated SNN candidate must not remain active for normal inference')

    # Detector inference is now functional/integrity-gated rather than science-gated.
    require('if self.model is not None and self.integrity_ready:' in detect,
            'detector trained inference must depend on functional artifact integrity')
    require("self.mode='torchscript-trained-weights-functional'" in detect,
            'detector functional trained mode missing')
    require('self.validated=False' in detect,
            'detector must not claim independent scientific validation')
    require('return self._fallback_detect(image)' in detect,
            'detector must retain explicit fallback path')
    require('if float(score)<.3:continue' in detect,
            'detector normal confidence threshold must be preserved')

    require('scientificValidationRequired' in routes and 'integrityReady' in routes,
            'model-info detector functional scope fields missing')
    require('independent cross-dataset detector scientific validation' in routes,
            'detector scope truthfulness note missing')

    require('SNN scientific-validation chain' in doc,
            'independent SNN scientific runtime policy must be documented')
    require('test_unvalidated_snn_never_serves_trained_prediction' in test,
            'SNN unvalidated inference regression missing')
    require('test_validated_snn_serves_trained_prediction' in test,
            'validated SNN positive control missing')
    require('test_integrity_ready_detector_serves_trained_detection_without_science_gate' in test,
            'functional detector positive control missing')
    require('test_detector_without_active_trained_artifact_uses_fallback' in test,
            'detector fallback regression missing')

    print('V33 AI INFERENCE CONTRACTS PASS: validated-only SNN + functional detector integrity')


if __name__ == '__main__':
    main()
