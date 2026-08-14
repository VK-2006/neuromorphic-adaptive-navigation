from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'frontend/public'
CSS=(ROOT/'frontend/assets/css/navora-v7.css').read_text(encoding='utf-8');S=(ROOT/'frontend/assets/js/app-shell.js').read_text(encoding='utf-8');A=(ROOT/'frontend/assets/js/api.js').read_text(encoding='utf-8');AUTH=(ROOT/'frontend/assets/js/auth.js').read_text(encoding='utf-8');SW=(ROOT/'frontend/service-worker.js').read_text(encoding='utf-8')
pages=sorted(P.glob('*.html'));assert len(pages)==28
for p in pages:
    t=p.read_text(encoding='utf-8')
    assert '/assets/css/navora-v7.css' in t,f'{p.name}: V7 css missing'
    assert 'worldclass.css' not in t and 'worldclass-ui.js' not in t,f'{p.name}: retired showcase layer loaded'
for x in ['.navora-nav','.page-shell','.card','.btn-navora','.auth-shell','.map-layout','.journey-layout','.chat-layout','.toast-stack','@media(max-width:820px)','@media(prefers-reduced-motion:reduce)']:assert x in CSS,x
for x in ['protectedPages','buildAuthNav','buildAppNav','navora-booting','nav-mobile-toggle']:assert x in S,x
for x in ['ApiError','navora:auth-required','Network request failed']:assert x in A,x
for x in ['busy(','status(','resend-verification','target()']:assert x in AUTH,x
assert 'navora-v7-functional-product-1' in SW and 'networkFirst' in SW
print('WORLDCLASS_UI_CONTRACTS PASS: clumsy showcase runtime retired; V7 clean application design, workflow guards, responsive layout and PWA update strategy active')
