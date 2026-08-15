from __future__ import annotations
from pathlib import Path
import argparse,os,re,sys

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'frontend'/'public'
OUT=ROOT/'qa-screens'
CSS='\n'.join((ROOT/'frontend/assets/css'/name).read_text(encoding='utf-8') for name in ['main.css','worldclass.css','obsidian.css'])
JS=(ROOT/'frontend/assets/js/worldclass-ui.js').read_text(encoding='utf-8')+'\n'+(ROOT/'frontend/assets/js/obsidian-ui.js').read_text(encoding='utf-8')

CASES=[
 ('index.html','light',1440,1000),('index.html','dark',1440,1000),
 ('login.html','light',1440,900),('login.html','dark',1440,900),
 ('dashboard.html','light',1440,1000),('dashboard.html','dark',1440,1000),
 ('map.html','light',1440,1000),('map.html','dark',1440,1000),
 ('journey.html','light',1440,1000),('journey.html','dark',1440,1000),
 ('map.html','light',390,844),('journey.html','dark',390,844),
]

def offline_html(name,theme,include_js=True):
    raw=(PUB/name).read_text(encoding='utf-8')
    raw=re.sub(r'<script\b[^>]*>.*?</script>','',raw,flags=re.I|re.S)
    raw=re.sub(r'<link\b(?=[^>]*(?:rel=["\'](?:stylesheet|preconnect)["\']))[^>]*>','',raw,flags=re.I)
    raw=re.sub(r'<html(\s|>)',lambda m:f'<html data-theme="{theme}"'+m.group(1),raw,count=1,flags=re.I)
    page_name=Path(name).stem
    raw=re.sub(r'<body(\s|>)',lambda m:f'<body data-wc-page="{page_name}"'+m.group(1),raw,count=1,flags=re.I)
    raw=raw.replace('</head>',f'<style>{CSS}</style></head>',1)
    if include_js:
        patched=JS.replace("const pageFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();",f"const pageFile='{name}';")
        raw=raw.replace('</body>',f'<script>{patched}</script></body>',1)
    return raw

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check-only',action='store_true');ap.add_argument('--matrix',action='store_true',help='Check every HTML page in both themes at 7 responsive widths');ap.add_argument('--out',type=Path,default=OUT);a=ap.parse_args()
    try:from playwright.sync_api import sync_playwright
    except ImportError:
        print('BROWSER_QA SKIP: Playwright is not installed. Install with: python -m pip install playwright && python -m playwright install chromium')
        return 2
    a.out.mkdir(parents=True,exist_ok=True)
    cases=CASES
    if a.matrix:
        widths=[1440,768,320]
        cases=[(p.name,theme,w,1000 if w>=768 else 844) for p in sorted(PUB.glob('*.html')) for theme in ('light','dark') for w in widths]
    exe=os.getenv('PLAYWRIGHT_CHROMIUM') or None
    launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
    if exe:launch['executable_path']=exe
    failures=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(**launch)
        try:
            page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
            error_box={'items':[]}
            page.on('pageerror',lambda exc:error_box['items'].append(str(exc)))
            for name,theme,w,h in cases:
                error_box['items']=[]
                page.set_viewport_size({'width':w,'height':h})
                if not a.matrix: page.goto('about:blank',wait_until='commit')
                page.set_content(offline_html(name,theme,include_js=not a.matrix),wait_until='domcontentloaded');page.wait_for_timeout(5 if a.matrix else 850)
                errs=list(error_box['items'])
                overflow=page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1')
                if errs or overflow:failures.append((name,theme,w,errs,overflow))
                if not a.check_only:page.screenshot(path=str(a.out/f'{Path(name).stem}-{theme}-{w}.png'),full_page=True)
                print(f'{name:22} {theme:5} {w:4}px pageerrors={len(errs)} overflow={overflow}')
            page.close()
        finally:browser.close()
    if failures:
        print('BROWSER_QA FAIL');
        for f in failures:print('-',f)
        return 1
    print(f'BROWSER_QA PASS: {len(cases)} responsive/theme cases')
    return 0
if __name__=='__main__':sys.exit(main())
