from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAT = ROOT / 'scripts' / 'run_real_model_pipeline_windows.bat'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    text = BAT.read_text(encoding='utf-8')
    lower = text.lower()
    executable = '\n'.join(
        line for line in lower.splitlines()
        if line.strip() and not line.lstrip().startswith(('rem ', 'echo '))
    )

    require('setlocal enableextensions' in lower, 'Windows BAT must use an isolated command environment')
    require('cd /d "%~dp0.."' in lower, 'Windows BAT must anchor itself to repository root')
    require('BDD_LABELS' in text and 'BDD_IMAGES' in text, 'BDD100K functional detector inputs missing')
    require('RDD_ROOT' in text, 'optional RDD2022 detector input missing')
    require('SNN_TRAIN_CSV' in text and 'SNN_EVAL_CSV' in text, 'retained SNN inputs missing')

    for name in ['prepare_detection_data.py', 'train_detector.py', 'model_readiness.py']:
        require(name in executable, f'functional detector pipeline stage missing: {name}')
    for name in ['train_snn.py', 'evaluate_snn.py']:
        require(name in executable, f'retained SNN workflow stage missing: {name}')

    require('RUN_INTERNAL_DETECTOR_EVAL' in text, 'optional detector diagnostic switch missing')
    require('evaluate_detector.py' in executable, 'internal detector evaluation utility should remain available')
    require('--mark-validation' not in '\n'.join(
        line for line in executable.splitlines() if 'evaluate_detector.py' in line
    ), 'detector internal diagnostic must not mark scientific validation')
    require('evaluate_snn.py' in executable and '--mark-validation' in executable,
            'SNN scientific-validation evaluation must remain available')
    require('independent cross-dataset detector scientific validation is out of current scope' in lower,
            'detector scientific-validation scope boundary missing')
    require('if errorlevel 1 goto :failed' in lower, 'workflow must fail closed after guarded commands')

    print('V31/V36 WINDOWS MODEL PIPELINE CONTRACTS PASS')


if __name__ == '__main__':
    main()
