from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend' / 'public'
CSS = ROOT / 'frontend' / 'assets' / 'css' / 'right-pane-shell-v22.css'
JS = ROOT / 'frontend' / 'assets' / 'js' / 'scroll-surface-v22.js'
PROFILE = ROOT / 'frontend' / 'assets' / 'js' / 'profile-all-pages-v17.js'
SW = ROOT / 'frontend' / 'service-worker.js'
V20 = ROOT / 'frontend' / 'assets' / 'css' / 'universal-left-navbar-v20.css'

pages = sorted(PUBLIC.glob('*.html'))
assert len(pages) == 27, f'expected 27 pages, found {len(pages)}'
for page in pages:
    text = page.read_text(encoding='utf-8')
    assert '/assets/js/profile-all-pages-v17.js' in text, f'{page.name}: all-page profile/bootstrap loader missing'
    assert 'class="navora-nav' in text, f'{page.name}: navbar shell missing'

css = CSS.read_text(encoding='utf-8')
js = JS.read_text(encoding='utf-8')
profile = PROFILE.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')
v20 = V20.read_text(encoding='utf-8')

# V20 historically allows the menu well to scroll. V22 must load after it and
# become authoritative for normal-height app/admin screens.
assert 'overflow-y:auto !important' in v20
for token in [
    'body.navora-app,',
    'body.navora-admin{',
    'overflow:hidden !important',
    'body.navora-app > .navora-nav > .nav-links',
    'overflow-y:hidden !important',
    'body.navora-app > .page-shell',
    'overflow-y:auto !important',
    'height:100svh !important',
    '@media (max-height:760px)',
]:
    assert token in css, f'V22 right-pane shell contract missing: {token}'

# Short screens may independently scroll the link well, but the fixed rail does
# not become the document scroller.
short = re.search(r'@media \(max-height:760px\)\{(.*?)\n\}', css, re.S)
assert short and 'overflow-y:auto !important' in short.group(1)

# The late all-page loader must append V20 first, then V22 CSS/JS so equal-
# specificity !important rules cannot regress the navigation workspace.
for token in [
    'RIGHT_PANE_STYLE',
    'RIGHT_PANE_SCRIPT',
    '/assets/css/right-pane-shell-v22.css',
    '/assets/js/scroll-surface-v22.js',
    'ensureV22RightPaneShell()',
]:
    assert token in profile, f'V22 all-page loader missing: {token}'
assert profile.index('ensureV20NavbarStyle();') < profile.index('ensureV22RightPaneShell();')

# Existing motion engines still publish these variables; the V22 bridge must
# make .page-shell scrollTop authoritative for app/admin pages.
for token in [
    "document.querySelector('body > .page-shell')",
    "body.matches('.navora-app,.navora-admin')",
    "pane.addEventListener('scroll', schedule",
    'pane.scrollHeight - pane.clientHeight',
    'pane.scrollTop / max',
    "root.style.setProperty('--ui-scroll'",
    "root.style.setProperty('--motion-scroll'",
]:
    assert token in js, f'V22 scroll-surface bridge missing: {token}'

# Cache version and assets must move together so old V20/V21 cascades cannot
# remain sticky after deployment.
assert "navora-right-pane-v22-0-0" in sw
assert "navora-fixed-sidebar-v21-0-0" in sw
assert '"/assets/css/right-pane-shell-v22.css"' in sw
assert '"/assets/js/scroll-surface-v22.js"' in sw

without_comments = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
assert without_comments.count('{') == without_comments.count('}'), 'V22 CSS braces are unbalanced'

print('V22_RIGHT_PANE_SCROLL_CONTRACTS PASS: fixed navigation workspace, late cascade authority, right-pane scroll motion bridge, and cache delivery are locked')
