from pathlib import Path
from html.parser import HTMLParser
import re, sys

ROOT=Path(__file__).resolve().parents[1]
public=ROOT/'frontend/public'
htmls=sorted(public.glob('*.html'))
errors=[]

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.hrefs=[]; self.srcs=[]; self.ids=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        if tag=='link' and d.get('href'): self.hrefs.append(d['href'])
        if tag=='script' and d.get('src'): self.srcs.append(d['src'])

if len(htmls)!=25:
    errors.append(f'expected 25 HTML pages, found {len(htmls)}')

for p in htmls:
    t=p.read_text(encoding='utf-8')
    parsed=Parser(); parsed.feed(t)
    if parsed.hrefs.count('/assets/css/premium-ui.css')!=1:
        errors.append(f'{p.name}: premium CSS count != 1')
    if parsed.srcs.count('/assets/js/premium-ui.js')!=1:
        errors.append(f'{p.name}: premium JS count != 1')
    if '/assets/css/navora-v7.css' not in parsed.hrefs:
        errors.append(f'{p.name}: functional V7 CSS missing')
    if '/assets/js/app-shell.js' not in parsed.srcs:
        errors.append(f'{p.name}: app-shell.js missing')
    if '/assets/css/worldclass.css' in parsed.hrefs or '/assets/js/worldclass-ui.js' in parsed.srcs:
        errors.append(f'{p.name}: retired worldclass runtime must remain unloaded')
    if '/assets/js/theme.js' not in parsed.srcs:
        errors.append(f'{p.name}: early theme script missing')

contracts={
    'map.html':['map','route-form','source','destination','route-list','begin-selected-journey'],
    'journey.html':['journey-map','start-journey','reroute-panel'],
    'login.html':['login-form','email','password'],
    'dashboard.html':['metric-safety','safety-chart'],
    'memory.html':['memory-list'],
}
for name,ids in contracts.items():
    parsed=Parser(); parsed.feed((public/name).read_text(encoding='utf-8'))
    missing=[x for x in ids if x not in parsed.ids]
    if missing: errors.append(f'{name}: preserved DOM IDs missing: {missing}')

css=(ROOT/'frontend/assets/css/premium-ui.css').read_text(encoding='utf-8')
for token in [
 '#0B0712','#120B1F','#171022','#21152F','#7A5CFF','#D4AF37','#F2D675',
 '#F7F3EA','#EFE8DD','#FFFDFC','#6E3B6E','#8E5C8E','#B58A32','#D5B86A','#B86B77','#D8A0A8',
 '@media (max-width: 1200px)','@media (max-width: 1024px)','@media (max-width: 768px)',
 '@media (max-width: 480px)','@media (max-width: 375px)','@media (max-width: 320px)',
 '@media (prefers-reduced-motion: reduce)','@view-transition','uiPageEnter','uiPageExit','uiScanner',
 'NAVORA PREMIUM UI v12.3.4'
]:
    if token not in css: errors.append(f'premium-ui.css missing {token}')

js=(ROOT/'frontend/assets/js/premium-ui.js').read_text(encoding='utf-8')
for token in [
    'IntersectionObserver','requestAnimationFrame','ui-page-exit','navora:theme',
    'prefers-reduced-motion','eligibleInternalLink','enterWhenReady',"version:'12.3.4'"
]:
    if token not in js: errors.append(f'premium-ui.js missing {token}')

sw=(ROOT/'frontend/service-worker.js').read_text(encoding='utf-8')
m=re.search(r"const CACHE='([^']+)';",sw)
cache=m.group(1) if m else None
if cache!='navora-completion-v37-0-0':
    errors.append(f'service-worker cache mismatch: {cache!r}')
for token in ['/assets/css/premium-ui.css','/assets/js/premium-ui.js','navora-v7-functional-product-1']:
    if token not in sw: errors.append(f'service-worker.js missing {token}')

if errors:
    print('NAVORA UI STATIC AUDIT: FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)

print('NAVORA UI STATIC AUDIT: PASS')
print('HTML pages:',len(htmls))
print('Premium UI runtime version: 12.3.4')
print('Service-worker cache: navora-completion-v37-0-0')
print('DOM/function shell/theme/responsive/reduced-motion contracts: PASS')
