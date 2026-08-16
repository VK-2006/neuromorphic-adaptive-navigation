from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
workflow = ROOT / '.github' / 'workflows' / 'external-validation.yml'
google = ROOT / 'scripts' / 'google_real_login_e2e.js'
turn = ROOT / 'scripts' / 'turn_relay_e2e.js'
docs = ROOT / 'docs' / 'external-validation.md'

for path in (workflow, google, turn, docs):
    assert path.exists(), f'missing external validation file: {path}'

text = workflow.read_text(encoding='utf-8')
assert 'workflow_dispatch:' in text
assert 'GOOGLE_AUTH_STORAGE_STATE_B64' in text
assert 'WEBRTC_TURN_URL' in text
assert 'WEBRTC_TURN_USERNAME' in text
assert 'WEBRTC_TURN_CREDENTIAL' in text
assert 'DETECTOR_EVAL_BUNDLE_URL' in text
assert 'SNN_EVAL_BUNDLE_URL' in text
assert '--mark-validation' in text
assert 'model_readiness.py' in text

for path in (google, turn):
    source = path.read_text(encoding='utf-8')
    assert 'process.env' in source
    assert not re.search(r'gho_[A-Za-z0-9_]+', source)
    assert not re.search(r'AIza[0-9A-Za-z_-]{20,}', source)

assert 'does **not** replace the final physical cross-network field test' in docs.read_text(encoding='utf-8')
print('V39 external validation contracts: PASS')
