from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'frontend/public'
CSS=(ROOT/'frontend/assets/css/worldclass.css').read_text(errors='ignore')
JS=(ROOT/'frontend/assets/js/worldclass-ui.js').read_text(errors='ignore')
SW=(ROOT/'frontend/service-worker.js').read_text(errors='ignore')
THREE=(ROOT/'frontend/assets/js/three-scenes.js').read_text(errors='ignore')
RESEARCH=(ROOT/'frontend/assets/js/three-research.js').read_text(errors='ignore')
pages=sorted(PUBLIC.glob('*.html'))

assert len(pages)==28, f'Expected 28 HTML pages, got {len(pages)}'
for page in pages:
    text=page.read_text(errors='ignore')
    assert '/assets/css/main.css' in text, f'{page.name}: base CSS missing'
    assert '/assets/css/worldclass.css' in text, f'{page.name}: world-class CSS missing'
    assert '/assets/js/worldclass-ui.js' in text, f'{page.name}: world-class runtime missing'
    assert '/assets/css/premium.css' not in text and '/assets/css/cinematic.css' not in text, f'{page.name}: legacy CSS still loaded'
    assert '/assets/js/premium-ui.js' not in text and '/assets/js/cinematic-ui.js' not in text, f'{page.name}: legacy UI runtime still loaded'
    assert 'bootstrap@5.3.3' not in text, f'{page.name}: unused Bootstrap dependency still loaded'
    assert '<meta name="description"' in text or 'name="description"' in text, f'{page.name}: description metadata missing'

# First-class light and dark product identities.
for token in [
    '--wc-saffron: #ff7a00','--wc-green: #078f57','--wc-navy: #061b46','--wc-white: #ffffff',
    '--wc-purple: #8b5cf6','--wc-gold: #f6c453','[data-theme="dark"]','--wc-motion-fast','--wc-ease-spring'
]:
    assert token in CSS, f'design token missing: {token}'

# Core product-wide systems.
for selector in [
    '.navora-nav','.page-head','.card','.btn-navora','.auth-shell','.auth-visual','.map-layout','.route-panel',
    '.journey-layout','.camera-pane','.chat-layout','.wc-command-backdrop','.wc-mobile-bottom','.wc-network-banner',
    '.data-list:empty::before','.wc-journey-switch',':focus-visible','@view-transition','@media (prefers-reduced-motion: reduce)'
]:
    assert selector in CSS, f'worldclass.css missing {selector}'

# Motion vocabulary includes functional, interaction, structural and atmospheric motion.
for motion in [
    'wcRouteDash','wcScan','wcNodePulse','wcPanelIn','wcRipple','wcViewIn','wcMenuIn','wcToastIn',
    'wcTextFlow','wcGridDrift','wcNeuralFlow','wcRouteCardIn'
]:
    assert motion in CSS, f'animation missing: {motion}'

# Runtime must be cleanup-aware and capability-aware.
for signal in [
    'AbortController','IntersectionObserver','MutationObserver','requestAnimationFrame','prefers-reduced-motion',
    'navigator.connection?.saveData','pagehide','life.abort','commandPalette','mobileBottom','passwordToggles',
    'mapExperience','journeyExperience','journeyMobileMode','memoryExperience','deviceExperience','networkState','dynamicAccessibility'
]:
    assert signal in JS, f'worldclass runtime missing {signal}'

# No old general-purpose animation libraries are required on the landing page.
index=(PUBLIC/'index.html').read_text(errors='ignore')
for legacy in ['gsap.min.js','aos.js','lottie.min.js','motion.js']:
    assert legacy not in index, f'index still loads avoidable animation dependency {legacy}'
assert 'three.min.js' in index and '/assets/js/three-scenes.js' in index, 'meaningful Three.js hero visualization must remain'

# Map / journey / AI identity must stay explicit without changing core DOM contracts.
map_html=(PUBLIC/'map.html').read_text(errors='ignore')
for signal in ['route-form','route-list','why-route','begin-selected-journey','simulation']:
    assert signal in map_html, f'map functional contract missing {signal}'
journey=(PUBLIC/'journey.html').read_text(errors='ignore')
for signal in ['camera-video','overlay-canvas','risk','journey-map','reroute-panel','detection-toggle']:
    assert signal in journey, f'journey functional contract missing {signal}'
memory=(PUBLIC/'memory.html').read_text(errors='ignore')
for signal in ['Input Features','Spike Encoding','LIF Neurons','Risk Output','three-research']:
    assert signal in memory, f'memory research contract missing {signal}'

# Three.js must remain optimized, themed and disposable.
for source,name in [(THREE,'hero'),(RESEARCH,'research')]:
    for signal in ['prefers-reduced-motion','requestAnimationFrame','IntersectionObserver','dispose','forceContextLoss','navora:theme']:
        assert signal in source, f'Three.js {name} missing {signal}'

# PWA shell must cache the new UI rather than deleted legacy layers.
assert 'navora-shell-v8-live-field' in SW
assert '/assets/css/worldclass.css' in SW and '/assets/js/worldclass-ui.js' in SW
assert 'premium.css' not in SW and 'cinematic.css' not in SW

print('WORLDCLASS_UI_CONTRACTS PASS: 28/28 pages, unified design system, dual themes, map/camera/AI motion, responsive/mobile, accessibility, cleanup-aware runtime and PWA cache')
