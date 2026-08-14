from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'frontend/public'
CSS=(ROOT/'frontend/assets/css/navora-v7.css').read_text(encoding='utf-8');SW=(ROOT/'frontend/service-worker.js').read_text(encoding='utf-8');SHELL=(ROOT/'frontend/assets/js/app-shell.js').read_text(encoding='utf-8')
BOOT_CSS='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';BOOT_JS='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
class P(HTMLParser):
    def __init__(self):super().__init__();self.hrefs=[];self.srcs=[]
    def handle_starttag(self,t,a):
        d=dict(a)
        if t=='link' and d.get('href'):self.hrefs.append(d['href'])
        if t=='script' and d.get('src'):self.srcs.append(d['src'])
pages=sorted(PUB.glob('*.html'));assert len(pages)==28
for p in pages:
    x=P();x.feed(p.read_text(encoding='utf-8'))
    assert BOOT_CSS in x.hrefs,f'{p.name}: Bootstrap CSS missing'
    assert BOOT_JS in x.srcs,f'{p.name}: Bootstrap JS missing'
    assert '/assets/css/main.css' in x.hrefs and '/assets/css/navora-v7.css' in x.hrefs,f'{p.name}: V7 CSS stack missing'
    assert '/assets/js/app-shell.js' in x.srcs,f'{p.name}: app shell missing'
    assert '/assets/css/worldclass.css' not in x.hrefs and '/assets/js/worldclass-ui.js' not in x.srcs,f'{p.name}: retired showcase UI still loaded'
for s in ['--nav-sidebar','.map-layout','.journey-layout','.chat-layout','.auth-shell',':focus-visible','prefers-reduced-motion']:assert s in CSS,s
for s in ['protectedPages','adminPages','navora:returnTo','navora:auth-required','buildAppNav','serviceWorker.register']:assert s in SHELL,s
assert 'navora-v7-functional-product-1' in SW and '/assets/css/navora-v7.css' in SW
print('FRONTEND_STACK_CONTRACTS PASS: V7 functional 28-page product shell, protected workflow navigation, Bootstrap foundation and cache-safe PWA')
