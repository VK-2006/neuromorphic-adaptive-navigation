from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT=Path('/mnt/data/navora_worldclass_v5')
PUB=ROOT/'frontend/public'
CSS=(ROOT/'frontend/assets/css/main.css').read_text(encoding='utf-8')+'\n'+(ROOT/'frontend/assets/css/worldclass.css').read_text(encoding='utf-8')
JS=(ROOT/'frontend/assets/js/worldclass-ui.js').read_text(encoding='utf-8')
OUT=ROOT/'qa-screens'
OUT.mkdir(exist_ok=True)

def build_html(name, theme='light'):
    raw=(PUB/name).read_text(encoding='utf-8')
    soup=BeautifulSoup(raw,'html.parser')
    # Strip scripts and stylesheet links to keep render deterministic/network-free.
    for s in soup.find_all('script'):
        s.decompose()
    for l in list(soup.find_all('link')):
        rel=' '.join(l.get('rel',[])) if isinstance(l.get('rel'),list) else str(l.get('rel',''))
        if 'stylesheet' in rel or l.get('rel')==['preconnect']:
            l.decompose()
    html=soup.html
    if html:
        html['data-theme']=theme
    style=soup.new_tag('style')
    style.string=CSS
    soup.head.append(style)
    patched=JS.replace("const pageFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();", f"const pageFile='{name}';")
    script=soup.new_tag('script')
    script.string=patched
    soup.body.append(script)
    return str(soup)

cases=[
 ('index.html','light',1440,1000),('index.html','dark',1440,1000),
 ('login.html','light',1440,900),('login.html','dark',1440,900),
 ('dashboard.html','light',1440,1000),('dashboard.html','dark',1440,1000),
 ('map.html','light',1440,1000),('map.html','dark',1440,1000),
 ('journey.html','light',1440,1000),('journey.html','dark',1440,1000),
 ('map.html','light',390,844),('journey.html','dark',390,844),
]

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-software-rasterizer'])
    for name,theme,w,h in cases:
        page=browser.new_page(viewport={'width':w,'height':h}, device_scale_factor=1)
        errs=[]
        page.on('pageerror',lambda exc: errs.append(str(exc)))
        page.set_content(build_html(name,theme), wait_until='domcontentloaded')
        page.wait_for_timeout(500)
        fn=f"{Path(name).stem}-{theme}-{w}.png"
        page.screenshot(path=str(OUT/fn), full_page=True)
        print(fn, 'pageerrors=', len(errs), errs[:2])
        page.close()
    browser.close()
