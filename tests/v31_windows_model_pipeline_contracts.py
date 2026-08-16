from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAT = ROOT / 'scripts' / 'run_real_model_pipeline_windows.bat'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    text = BAT.read_text(encoding='utf-8')
    lower = text.lower()

    require('setlocal enableextensions' in lower, 'V31 BAT must use an isolated command environment')
    require('cd /d "%~dp0.."' in lower, 'V31 BAT must anchor itself to repository root')

    for variable in ['RDD_ROOT', 'SNN_TRAIN_CSV', 'SNN_EVAL_CSV']:
        require(variable in text, f'V31 required dataset variable missing: {variable}')
    require('BDD_LABELS' in text and 'BDD_IMAGES' in text, 'V31 optional BDD100K pair missing')

    required_scripts = [
        'prepare_detection_data.py',
        'split_detection_manifest.py',
        'model_data_gate.py',
        'train_detector.py',
        'train_snn.py',
        'evaluate_detector.py',
        'evaluate_snn.py',
        'validation_evidence.py',
        'model_readiness.py',
        'model_artifact_bundle.py',
    ]
    for name in required_scripts:
        require(name in text, f'V31 pipeline stage missing: {name}')

    positions = [lower.index(name.lower()) for name in required_scripts]
    require(positions == sorted(positions), 'V31 model pipeline stages are not in guarded order')

    require('--mark-validation' in lower, 'held-out evaluators must be the only marking stage')
    require(lower.count('--mark-validation') == 2, 'both and only both held-out evaluators must mark validation')
    require('--max-samples' not in lower, 'V31 real detector training must not use partial-sample mode')
    require('--smoke' not in lower, 'V31 real model pipeline must not use smoke training')
    require('validation_evidence.py' in lower and 'model_readiness.py' in lower, 'V30 evidence/readiness chain missing')
    require('model_artifact_bundle.py' in lower, 'validated artifact bundle stage missing')
    require('if errorlevel 1 goto :failed' in lower, 'V31 must fail closed after guarded commands')
    require('no success claim is made' in lower, 'V31 failure path must explicitly avoid success claims')
    require('do not commit datasets, trained weights, .env files or model-artifacts zips' in lower, 'V31 artifact hygiene warning missing')

    print('V31 WINDOWS REAL MODEL PIPELINE CONTRACTS PASS')


if __name__ == '__main__':
    main()
