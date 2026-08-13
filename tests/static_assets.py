from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'frontend/public'; FRONT=ROOT/'frontend'
missing=[]
for page in PUBLIC.glob('*.html'):
    text=page.read_text(errors='ignore')
    for attr,url in re.findall(r'\b(href|src)=["\']([^"\']+)["\']',text,re.I):
        if url.startswith(('http://','https://','data:','#','mailto:','tel:','javascript:')) or url.startswith('/socket.io/') or '?' in url:
            continue
        if url.startswith('/assets/'):
            target=ROOT/'frontend'/url.lstrip('/')
        elif url in ['/manifest.json','/service-worker.js']:
            target=FRONT/url.lstrip('/')
        elif url.startswith('/'):
            target=PUBLIC/url.lstrip('/')
        else:
            target=(page.parent/url).resolve()
        if not target.exists(): missing.append((page.name,url,str(target.relative_to(ROOT)) if target.is_relative_to(ROOT) else str(target)))
assert not missing, 'Missing local assets/links: '+repr(missing[:20])
print(f'STATIC_ASSETS PASS: {len(list(PUBLIC.glob("*.html")))} HTML pages, all static local href/src targets exist')
