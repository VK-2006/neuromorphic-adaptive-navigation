from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / 'ai-service' / 'app' / 'research_lock.py'
VALIDATION = ROOT / 'ai-service' / 'app' / 'model_validation.py'
TRAIN = ROOT / 'scripts' / 'train_snn.py'
EVAL = ROOT / 'scripts' / 'evaluate_snn.py'
DOC = ROOT / 'docs' / 'snn-phase4-2025-external-validation.md'

FAILED_MODEL_SHA = '8a1aadd1950a87fcf60192976605f514367024d66790365c24ede04281d1d1ae'
CONSUMED_FINAL_SHA = '633249567e95479a1c30b3f10b0a6271ced11684fb338d0b8b4054ca94b80aa6'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    lock = LOCK.read_text(encoding='utf-8')
    validation = VALIDATION.read_text(encoding='utf-8')
    train = TRAIN.read_text(encoding='utf-8')
    evaluate = EVAL.read_text(encoding='utf-8')
    doc = DOC.read_text(encoding='utf-8')

    require(FAILED_MODEL_SHA in lock, 'failed Phase-4 model SHA must be permanently registered')
    require(CONSUMED_FINAL_SHA in lock, 'consumed 2025 final SHA must be permanently registered')
    require('RESEARCH_ONLY_RISK_MODELS' in lock, 'research-only model registry missing')
    require('CONSUMED_SNN_FINAL_DATASETS' in lock, 'consumed-final registry missing')
    require('assert_not_consumed_snn_final' in lock, 'consumed-final fail-closed helper missing')

    require('RESEARCH_ONLY_RISK_MODELS' in validation, 'live model validation must import research-only registry')
    require("kind == 'risk' and actual_sha in RESEARCH_ONLY_RISK_MODELS" in validation,
            'live risk validation must reject the failed model fingerprint')
    require('permanently research-only' in validation, 'runtime rejection reason must be explicit')

    require('assert_not_consumed_snn_final' in train, 'SNN training must enforce consumed-final lock')
    require("'training or tuning'" in train, 'SNN training lock purpose must cover tuning')
    require('assert_not_consumed_snn_final' in evaluate, 'SNN evaluation must enforce consumed-final lock')
    require('re-evaluation, threshold tuning, or model selection' in evaluate,
            'SNN evaluation lock must cover post-final feedback loops')

    require('FINAL_2025_EXTERNAL_VALIDATION_FAIL' in doc, 'Phase-4 failure decision must be documented')
    require('0.382427' in doc and '0.258087' in doc, 'Phase-4 final metrics must be preserved')
    require('new independently reserved untouched final set' in doc,
            'future validation must require a fresh untouched final set')

    print('V32 PHASE-5 RESEARCH LOCK CONTRACTS PASS')


if __name__ == '__main__':
    main()
