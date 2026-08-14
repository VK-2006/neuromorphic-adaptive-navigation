from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'frontend/public'
pages=sorted(PUB.glob('*.html'));assert len(pages)==28
for p in pages:
    t=p.read_text(encoding='utf-8')
    assert '/assets/css/navora-v7.css' in t,f'{p.name}: V7 CSS missing'
    assert 'worldclass.css' not in t and 'worldclass-ui.js' not in t,f'{p.name}: retired UI reference'
    assert '/assets/js/app-shell.js' in t,f'{p.name}: shell missing'
shell=(ROOT/'frontend/assets/js/app-shell.js').read_text(encoding='utf-8');assert all(x in shell for x in ['protectedPages','dashboard.html','map.html','journey.html','world-chat.html','navora:returnTo','location.replace'])
auth=(ROOT/'frontend/assets/js/auth.js').read_text(encoding='utf-8');assert all(x in auth for x in ['Creating account','Verifying','Signing in','busy(','status('])
api=(ROOT/'frontend/assets/js/api.js').read_text(encoding='utf-8');assert 'navora:auth-required' in api
assert 'async function initGoogle()' in auth, 'Google GIS initializer must be named initGoogle'
assert 'async function google()' not in auth, 'Function name google shadows window.google'
assert 'const gis=window.google?.accounts?.id' in auth, 'Google GIS must be resolved from window.google'
assert 'gis.initialize' in auth and 'gis.renderButton' in auth, 'Google GIS initialize/render wiring missing'
assert 'google.accounts.id.initialize' not in auth and 'google.accounts.id.renderButton' not in auth, 'Unsafe shadowed Google GIS reference remains'
assert 'beforeinstallprompt' in shell and 'serviceWorker.register' in shell
sw=(ROOT/'frontend/service-worker.js').read_text(encoding='utf-8');assert 'navora-v7-functional-product-1' in sw and 'networkFirst' in sw and '/assets/js/journey.js' in sw
journey=(ROOT/'frontend/assets/js/journey.js').read_text(encoding='utf-8');assert 'setJourneyControls' in journey and 'showNoJourneyState' in journey
pkg=json.loads((ROOT/'backend/package.json').read_text(encoding='utf-8'));assert pkg['devDependencies'].get('playwright')=='1.60.0'

auth_submit_forms={
  'login.html':'login-form',
  'register.html':'register-form',
  'verify-email.html':'verify-form',
  'forgot-password.html':'forgot-form',
  'verify-otp.html':'verify-reset-form',
  'reset-password.html':'reset-form',
}
for page_name,form_id in auth_submit_forms.items():
    html=(PUB/page_name).read_text(encoding='utf-8')
    start=html.find(f'id="{form_id}"')
    assert start>=0,f'{page_name}: form {form_id} missing'
    end=html.find('</form>',start)
    assert end>start,f'{page_name}: form closing tag missing'
    segment=html[start:end]
    assert 'type="submit"' in segment,f'{page_name}: {form_id} requires an explicit type="submit" button'

print('V7_FRONTEND_AUDIT PASS: product UI, auth guards, auth feedback, journey prerequisites, cache fix and browser E2E dependency present')
