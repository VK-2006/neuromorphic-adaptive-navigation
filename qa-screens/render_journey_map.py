from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
R=Path('/mnt/data/navora_worldclass_v5')
name='journey.html'; theme='dark'
raw=(R/'frontend/public'/name).read_text(encoding='utf-8')
soup=BeautifulSoup(raw,'html.parser')
for s in soup.find_all('script'): s.decompose()
for l in list(soup.find_all('link')):
    rel=' '.join(l.get('rel',[])) if isinstance(l.get('rel'),list) else str(l.get('rel',''))
    if 'stylesheet' in rel: l.decompose()
soup.html['data-theme']=theme
style=soup.new_tag('style');style.string=(R/'frontend/assets/css/main.css').read_text()+'\n'+(R/'frontend/assets/css/worldclass.css').read_text();soup.head.append(style)
js=(R/'frontend/assets/js/worldclass-ui.js').read_text().replace("const pageFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();", "const pageFile='journey.html';")
sc=soup.new_tag('script');sc.string=js;soup.body.append(sc)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 pg=b.new_page(viewport={'width':390,'height':844});pg.set_content(str(soup),wait_until='domcontentloaded');pg.wait_for_timeout(300)
 pg.locator('.wc-journey-switch button').nth(1).click();pg.wait_for_timeout(200)
 pg.screenshot(path=str(R/'qa-screens/journey-map-dark-390.png'),full_page=True)
 print('pageerror test done')
 b.close()
