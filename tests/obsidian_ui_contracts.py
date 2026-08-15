from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'frontend/public'
CSS=(ROOT/'frontend/assets/css/obsidian.css').read_text(errors='ignore')
JS=(ROOT/'frontend/assets/js/obsidian-ui.js').read_text(errors='ignore')
SW=(ROOT/'frontend/service-worker.js').read_text(errors='ignore')
MAIN=(ROOT/'frontend/assets/css/main.css').read_text(errors='ignore')
THREE=(ROOT/'frontend/assets/js/three-scenes.js').read_text(errors='ignore')
RESEARCH=(ROOT/'frontend/assets/js/three-research.js').read_text(errors='ignore')
pages=sorted(PUBLIC.glob('*.html'))

assert len(pages)==28
for page in pages:
    text=page.read_text(errors='ignore')
    assert '/assets/css/obsidian.css' in text, f'{page.name}: Obsidian CSS missing'
    assert '/assets/js/obsidian-ui.js' in text, f'{page.name}: Obsidian runtime missing'

for token in [
    '--obs-bg-primary: #F6F5EF','--obs-primary: #087F68','--obs-accent: #B56332',
    '--obs-bg-primary: #090C0B','--obs-primary: #2ED3A7','--obs-accent: #D4935B',
    '--obs-text-primary: #F4F7F5','--obs-border-primary: #27332F',
    '--obs-gradient-brand','--obs-duration-fast','--obs-ease-emphasized'
]:
    assert token in CSS, f'missing Obsidian token: {token}'

for selector in [
    '.navora-nav','.hero','.auth-shell','.map-layout','.route-panel','.journey-layout',
    '.camera-pane','.navigation-pane','.card','.btn-navora','.input','.wc-command',
    '.wc-mobile-bottom',':focus-visible','@media (prefers-reduced-motion: reduce)'
]:
    assert selector in CSS, f'missing Obsidian selector: {selector}'

for signal in ['obsPageIn','obsPanelIn','obsUnderline','obsRouteFlow','obsPulse','obsSkeleton']:
    assert signal in CSS, f'missing motion signal {signal}'

for signal in ['semanticCards','mapMobileSheet','routeStates','journeyCockpit','themeSync','accessibility','IntersectionObserver']:
    assert signal in JS, f'missing runtime behavior {signal}'

# Product fallbacks and WebGL scenes must also use the new visual identity.
for signal in ['#F6F5EF','#087F68','#B56332','#090C0B','#2ED3A7','#D4935B']:
    assert signal in MAIN, f'fallback palette missing {signal}'
for signal in ['0x2ED3A7','0xD4935B','0x087F68','0xB56332']:
    assert signal in THREE or signal in RESEARCH, f'WebGL palette missing {signal}'

assert '/assets/css/obsidian.css' in SW and '/assets/js/obsidian-ui.js' in SW
assert 'navora-shell-v10-obsidian-intelligence' in SW

print('OBSIDIAN_UI_CONTRACTS PASS: 28/28 pages use Jade × Copper, map/journey master experience, responsive mobile sheet, accessibility, motion and PWA cache')
