from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'frontend/assets/css/ui-layout-v23.css').read_text(encoding='utf-8')
theme=(ROOT/'frontend/assets/js/theme.js').read_text(encoding='utf-8')
e2e=(ROOT/'scripts/browser_v23_all_pages_ui_e2e.js').read_text(encoding='utf-8')

required_css=[
    '--navora-page-pad','--navora-card-gap','--navora-frame-radius',
    'box-sizing:border-box','overflow-x:hidden','.page-head',
    '.grid-4','.journey-layout','.map-layout','.replay-grid',
    '.camera-pane','#map','#journey-map','.three-shell',
    '@media (max-width:820px)','@media (max-width:560px)',
    'prefers-reduced-motion'
]
for token in required_css:
    assert token in css, f'missing V23 CSS contract: {token}'
assert "ui-layout-v23.css" in theme
assert 'navora-ui-layout-v23' in theme
assert 'browser_v23_all_pages_ui_e2e.js' in e2e or 'NAVORA V23 ALL-PAGES UI E2E' in e2e
assert len([p for p in (ROOT/'frontend/public').glob('*.html')]) >= 20
print('V23 clean UI contracts: PASS')
