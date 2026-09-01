from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RISK = ROOT / 'ai-service' / 'app' / 'services' / 'risk_service.py'
ROUTES = ROOT / 'ai-service' / 'app' / 'api' / 'routes.py'
DOC = ROOT / 'docs' / 'model-validation.md'
RISK_TEST = ROOT / 'ai-service' / 'tests' / 'test_model_validation.py'
RENDER_TEST = ROOT / 'ai-service' / 'tests' / 'test_render_runtime.py'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    risk = RISK.read_text(encoding='utf-8')
    routes = ROUTES.read_text(encoding='utf-8')
    doc = DOC.read_text(encoding='utf-8')
    risk_test = RISK_TEST.read_text(encoding='utf-8')
    render_test = RENDER_TEST.read_text(encoding='utf-8')

    require('if self.model is None or not self.validated:' in risk,
            'risk API must fall back unless trained SNN is validated')
    require("self.mode='development/heuristic-fallback-unvalidated-weights'" in risk,
            'risk service must explicitly identify blocked unvalidated weights')
    require('self.model=None' in risk and 'self.unvalidated_weights_present=True' in risk,
            'unvalidated SNN candidate must not remain active for normal inference')

    require('Object detection subsystem has been removed.' in routes,
            'risk-only model info contract missing current camera-free architecture note')
    require("'riskModel'" in routes and 'validated' in routes,
            'risk endpoint must expose validated-model metadata contract')

    require('V33 validated-only runtime inference' in doc,
            'validated-only runtime policy must be documented')
    require('model_validation_status' in risk_test,
            'current model validation regression tests are missing')
    require('test_model_info_available' in render_test,
            'current model-info contract test is missing')

    print('V33 VALIDATED-ONLY AI INFERENCE CONTRACTS PASS')


if __name__ == '__main__':
    main()
