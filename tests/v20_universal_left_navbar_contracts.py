from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend' / 'public'
CSS = ROOT / 'frontend' / 'assets' / 'css' / 'universal-left-navbar-v20.css'
PROFILE = ROOT / 'frontend' / 'assets' / 'js' / 'profile-all-pages-v17.js'
SHELL = ROOT / 'frontend' / 'assets' / 'js' / 'app-shell.js'
SW = ROOT / 'frontend' / 'service-worker.js'

pages = sorted(PUBLIC.glob('*.html'))
assert len(pages) == 28, f'expected 28 pages, found {len(pages)}'
for page in pages:
    text = page.read_text(encoding='utf-8')
    assert 'class="navora-nav' in text, f'{page.name}: navora navbar shell missing'
    assert '/assets/js/app-shell.js' in text, f'{page.name}: app shell missing'
    assert '/assets/js/profile-all-pages-v17.js' in text, f'{page.name}: V20 late stylesheet loader missing'

css = CSS.read_text(encoding='utf-8')
profile = PROFILE.read_text(encoding='utf-8')
shell = SHELL.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')

for token in [
    '@media (min-width:821px)',
    'body.navora-public > .navora-nav',
    'body.navora-auth > .navora-nav',
    'body.navora-app > .navora-nav',
    'body.navora-admin > .navora-nav',
    'position:fixed !important',
    'inset:0 auto 0 0 !important',
    'width:var(--navora-left-rail-w) !important',
    'height:100dvh !important',
    'grid-template-rows:auto minmax(0,1fr) auto !important',
    'body.navora-public,\n  body.navora-auth',
    'padding-left:var(--navora-left-rail-w) !important',
    '@media (max-width:820px)',
    'transform:translate3d(-105%,0,0) !important',
    'body.nav-open > .navora-nav',
    '.nav-mobile-toggle',
]:
    assert token in css, f'V20 navbar CSS contract missing: {token}'

for token in [
    'const NAVBAR_STYLE = "/assets/css/universal-left-navbar-v20.css"',
    "link.dataset.navoraLeftNavbarV20 = \"true\"",
    'window.NavoraLeftNavbar',
    'version: "20.0.0"',
]:
    assert token in profile, f'V20 navbar loader contract missing: {token}'

assert "if(!protectedPages.has(page)&&!adminPages.has(page))return" not in shell
for token in [
    "b.setAttribute('aria-expanded','false')",
    "event.key==='Escape'",
    "document.body.classList.toggle('nav-open',open)",
    "window.matchMedia?.('(max-width:820px)').matches",
]:
    assert token in shell, f'V20 universal mobile nav contract missing: {token}'

assert "navora-left-navbar-v20-0-0" in sw
assert '"/assets/css/universal-left-navbar-v20.css"' in sw
assert "navora-sidebar-light-v19-0-0" in sw, 'V19 cache lineage marker must remain for backward contract compatibility'

without_comments = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
assert without_comments.count('{') == without_comments.count('}'), 'V20 navbar CSS braces are unbalanced'

print('V20_UNIVERSAL_LEFT_NAVBAR_CONTRACTS PASS: all 28 pages use a fixed desktop left rail with universal mobile drawer behavior and cache-safe delivery')
