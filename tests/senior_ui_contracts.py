"""Compatibility contract after the v5 design-system consolidation."""
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
    assert 'premium.css' not in t and 'premium-ui.js' not in t
for signal in ['.navora-nav','.wc-command-backdrop','.auth-shell','.map-layout','.journey-layout','.chat-layout','.wc-mobile-bottom',':focus-visible','prefers-reduced-motion']:
    assert signal in CSS
for signal in ['commandPalette','mobileBottom','authVisual','passwordToggles','networkState','dynamicAccessibility']:
    assert signal in JS
print('SENIOR_UI_CONTRACTS PASS: v5 consolidated world-class design system replaces the legacy premium runtime across 28 pages')
