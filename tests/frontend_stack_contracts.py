from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'frontend'/'public'
WC=(ROOT/'frontend'/'assets'/'js'/'worldclass-ui.js').read_text(encoding='utf-8')
SW=(ROOT/'frontend'/'service-worker.js').read_text(encoding='utf-8')
ANIM=ROOT/'frontend'/'assets'/'animations'/'navora-pulse.json'

BOOT_CSS='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'
BOOT_JS='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
GSAP='https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js'
AOS_CSS='https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css'
AOS_JS='https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js'
LOTTIE='https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie.min.js'

class ContractParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs=[]
        self.srcs=[]
        self.nav_classes=[]
        self.ids=set()
    def handle_starttag(self, tag, attrs):
        data=dict(attrs)
        if tag=='link' and data.get('href'):
            self.hrefs.append(data['href'])
        elif tag=='script' and data.get('src'):
            self.srcs.append(data['src'])
        if data.get('id'):
            self.ids.add(data['id'])
        if tag=='nav':
            classes=(data.get('class') or '').split()
            if 'navora-nav' in classes:
                self.nav_classes=classes

def parse(path):
    parser=ContractParser()
    parser.feed(path.read_text(encoding='utf-8'))
    parser.close()
    return parser

pages=sorted(PUB.glob('*.html'))
assert len(pages)==28, f'expected 28 pages, found {len(pages)}'
for p in pages:
    doc=parse(p)
    assert BOOT_CSS in doc.hrefs, f'{p.name}: Bootstrap CSS missing'
    assert AOS_CSS in doc.hrefs, f'{p.name}: AOS CSS missing'
    assert BOOT_JS in doc.srcs, f'{p.name}: Bootstrap bundle missing'
    assert GSAP in doc.srcs, f'{p.name}: GSAP missing'
    assert AOS_JS in doc.srcs, f'{p.name}: AOS JS missing'
    assert '/assets/js/worldclass-ui.js' in doc.srcs, f'{p.name}: worldclass runtime missing'
    assert doc.srcs.index(BOOT_JS) < doc.srcs.index('/assets/js/worldclass-ui.js'), f'{p.name}: Bootstrap must load before runtime'
    assert doc.srcs.index(GSAP) < doc.srcs.index('/assets/js/worldclass-ui.js'), f'{p.name}: GSAP must load before runtime'
    assert doc.srcs.index(AOS_JS) < doc.srcs.index('/assets/js/worldclass-ui.js'), f'{p.name}: AOS must load before runtime'
    assert 'container-fluid' in doc.nav_classes, f'{p.name}: Bootstrap utility integration missing'

index=parse(PUB/'index.html')
assert LOTTIE in index.srcs, 'landing Lottie runtime missing'
assert 'lottie-status' in index.ids, 'landing Lottie host missing'
assert ANIM.exists() and ANIM.stat().st_size>500, 'local Lottie animation asset missing/empty'

for fn in ['bootstrapIntegration','gsapMotion','aosMotion','lottieMotion']:
    assert f'function {fn}' in WC, f'{fn} runtime bridge missing'
assert 'window.bootstrap' in WC and 'window.gsap' in WC and 'window.AOS' in WC and 'window.lottie' in WC
assert '/assets/animations/navora-pulse.json' in WC
assert 'navora-shell-v9-stack-compliance' in SW
assert '/assets/animations/navora-pulse.json' in SW
print('FRONTEND_STACK_CONTRACTS PASS: Bootstrap 5 + GSAP + AOS + Lottie integrated across 28 pages with Navora runtime bridges and PWA animation caching (stdlib-only test)')
