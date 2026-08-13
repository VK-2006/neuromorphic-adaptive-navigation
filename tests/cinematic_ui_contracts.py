"""Compatibility contract after cinematic v4 was consolidated into world-class v5."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'frontend/public'
CSS=(ROOT/'frontend/assets/css/worldclass.css').read_text(errors='ignore')
JS=(ROOT/'frontend/assets/js/worldclass-ui.js').read_text(errors='ignore')
pages=list(PUBLIC.glob('*.html'))
assert len(pages)==28
for p in pages:
    t=p.read_text(errors='ignore')
    assert '/assets/css/worldclass.css' in t and '/assets/js/worldclass-ui.js' in t
    assert 'cinematic.css' not in t and 'cinematic-ui.js' not in t
for signal in ['--wc-saffron: #ff7a00','--wc-green: #078f57','--wc-navy: #061b46','--wc-purple: #8b5cf6','--wc-gold: #f6c453','wcAmbientOrbit','wcRouteDash','wcScan','.map-layout','.auth-shell','.chat-layout']:
    assert signal in CSS
for signal in ['wc-network-field','IntersectionObserver','requestAnimationFrame','pointermove','navora:theme','prefers-reduced-motion']:
    assert signal in JS
assert 'navora-shell-v7-worldclass-phase2' in (ROOT/'frontend/service-worker.js').read_text(errors='ignore')
print('CINEMATIC_UI_CONTRACTS PASS: v4 cinematic behavior is consolidated into the v5 world-class runtime with dual themes and reduced-motion support')
