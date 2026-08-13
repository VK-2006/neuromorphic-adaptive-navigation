"""Portable focused screenshot for the mobile Journey map mode.
Run from any clone path. Generated PNGs are ignored by Git.
"""
from __future__ import annotations
from pathlib import Path
import os,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'qa-screens'))
from render_qa import offline_html

def main():
    try:from playwright.sync_api import sync_playwright
    except ImportError:
        print('JOURNEY_MAP_QA SKIP: Playwright is not installed.');return 2
    out=ROOT/'qa-screens'/'journey-map-dark-390.png';exe=os.getenv('PLAYWRIGHT_CHROMIUM') or None
    opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']};
    if exe:opts['executable_path']=exe
    with sync_playwright() as p:
        browser=p.chromium.launch(**opts);page=browser.new_page(viewport={'width':390,'height':844});errs=[];page.on('pageerror',lambda exc:errs.append(str(exc)))
        page.set_content(offline_html('journey.html','dark'),wait_until='domcontentloaded');page.wait_for_timeout(250)
        btn=page.locator('.wc-journey-switch button');
        if btn.count()>1:btn.nth(1).click();page.wait_for_timeout(150)
        overflow=page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1');page.screenshot(path=str(out),full_page=True);browser.close()
    if errs or overflow:print('JOURNEY_MAP_QA FAIL',errs,'overflow=',overflow);return 1
    print('JOURNEY_MAP_QA PASS:',out);return 0
if __name__=='__main__':sys.exit(main())
