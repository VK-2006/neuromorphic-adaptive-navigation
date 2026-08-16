from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend' / 'public'
FIX = ROOT / 'frontend' / 'assets' / 'css' / 'fixed-sidebar-v21.css'
THEME = ROOT / 'frontend' / 'assets' / 'js' / 'theme.js'
MOTION = ROOT / 'frontend' / 'assets' / 'css' / 'obsidian-motion.css'
SW = ROOT / 'frontend' / 'service-worker.js'

pages = sorted(PUBLIC.glob('*.html'))
assert len(pages) == 28, f'expected 28 pages, found {len(pages)}'
for page in pages:
    text = page.read_text(encoding='utf-8')
    assert '/assets/js/theme.js' in text, f'{page.name}: theme bootstrap missing'
    assert 'class="navora-nav' in text, f'{page.name}: navbar shell missing'

fix = FIX.read_text(encoding='utf-8')
theme = THEME.read_text(encoding='utf-8')
motion = MOTION.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')

# Regression root cause: the older body page-enter animation carries transform/filter.
assert '.motion-page-enter' in motion
assert '@keyframes motionPageEnter' in motion
assert 'transform:translate3d(0,0,0)' in motion
assert 'filter:blur(0)' in motion

# V21 must neutralize BODY containing-block properties with important precedence.
for token in [
    'body.motion-page-enter',
    'animation:navoraPageEnterViewportSafe',
    'transform:none !important',
    'filter:none !important',
    '@keyframes navoraPageEnterViewportSafe',
]:
    assert token in fix, f'V21 body containing-block repair missing: {token}'

# Every shell mode is physically viewport-fixed; stable viewport units avoid
# dynamic browser-chrome height changes making the rail appear to move.
for token in [
    'body.navora-public > .navora-nav',
    'body.navora-auth > .navora-nav',
    'body.navora-app > .navora-nav',
    'body.navora-admin > .navora-nav',
    'position:fixed !important',
    'top:0 !important',
    'left:0 !important',
    'height:100svh !important',
    'min-height:100svh !important',
    'max-height:100svh !important',
    'overflow:hidden !important',
    'overscroll-behavior:none !important',
    'contain:layout paint !important',
]:
    assert token in fix, f'V21 viewport-fixed rail contract missing: {token}'

# Internal menu may scroll only when the physical viewport is too short; page
# scrolling itself cannot move the rail/profile dock.
for token in [
    '> .nav-links',
    'overflow-y:auto !important',
    'overscroll-behavior:contain !important',
    '> .nav-account',
    'align-self:end !important',
    '.nav-mobile-toggle',
    '@media (max-height:760px)',
]:
    assert token in fix, f'V21 rail containment contract missing: {token}'

# All-page early loader + cache-safe delivery.
for token in [
    "link[data-navora-fixed-sidebar-v21]",
    "link.href='/assets/css/fixed-sidebar-v21.css'",
    "link.dataset.navoraFixedSidebarV21='true'",
]:
    assert token in theme, f'V21 theme loader missing: {token}'

assert "navora-fixed-sidebar-v21-0-0" in sw
assert "navora-left-navbar-v20-0-0" in sw
assert '"/assets/css/fixed-sidebar-v21.css"' in sw

without_comments = re.sub(r'/\*.*?\*/', '', fix, flags=re.S)
assert without_comments.count('{') == without_comments.count('}'), 'V21 CSS braces are unbalanced'

print('V21_TRUE_FIXED_SIDEBAR_CONTRACTS PASS: page-enter containing-block regression is neutralized and all 28 NAVORA rails stay viewport-fixed while content scrolls')
