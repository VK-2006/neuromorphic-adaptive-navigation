from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend' / 'public'
CSS_PATH = ROOT / 'frontend' / 'assets' / 'css' / 'light-theme-profile-v17.css'
PROFILE_JS_PATH = ROOT / 'frontend' / 'assets' / 'js' / 'profile-all-pages-v17.js'
SHELL_JS_PATH = ROOT / 'frontend' / 'assets' / 'js' / 'app-shell.js'
SW_PATH = ROOT / 'frontend' / 'service-worker.js'

pages = sorted(PUBLIC.glob('*.html'))
assert len(pages) == 28, f'Expected 28 frontend pages, found {len(pages)}'

for page in pages:
    text = page.read_text(encoding='utf-8')
    assert '/assets/css/light-theme-profile-v17.css' in text, f'{page.name}: shared light/profile CSS missing'
    assert '/assets/js/profile-all-pages-v17.js' in text, f'{page.name}: shared profile shell JS missing'

css = CSS_PATH.read_text(encoding='utf-8')
profile_js = PROFILE_JS_PATH.read_text(encoding='utf-8')
shell_js = SHELL_JS_PATH.read_text(encoding='utf-8')
sw = SW_PATH.read_text(encoding='utf-8')

# Structural cascade contract: app/admin sidebar is viewport fixed and account is
# the final grid row. Only nav-links may scroll.
required_css = [
    'grid-template-rows: auto minmax(0,1fr) max-content !important',
    'height: 100dvh !important',
    'body.navora-app > .navora-nav > .nav-links',
    'body.navora-admin > .navora-nav > .nav-links',
    'grid-row: 2 !important',
    'overflow-y: auto !important',
    'body.navora-app > .navora-nav > .nav-account',
    'body.navora-admin > .navora-nav > .nav-account',
    'grid-row: 3 !important',
    'align-self: end !important',
    'bottom: 0 !important',
    'z-index: 1250 !important',
    'padding-bottom: max(10px,env(safe-area-inset-bottom)) !important',
]
for token in required_css:
    assert token in css, f'V19 fixed-bottom sidebar contract missing: {token}'

# Public/auth account remains viewport-bottom fixed too.
for token in [
    'body.navora-public > .navora-profile-global-v17',
    'body.navora-auth > .navora-profile-global-v17',
    'position: fixed !important',
    'bottom: max(16px,env(safe-area-inset-bottom)) !important',
]:
    assert token in css, f'V19 public/auth profile dock contract missing: {token}'

# Premium light identity must stay non-blue and high contrast.
for token in [
    '--nav-bg: #F3EFE8',
    '--nav-surface: #FFFEFB',
    '--nav-text: #17131B',
    '--nav-primary: #6D1FB1',
    '--nav-success: #007D68',
    '--nav-sidebar: #24172F',
    '--nav-sidebar-2: #321B43',
    '--gold-main: #C6962D',
    'radial-gradient(circle at 92% 2%',
    'linear-gradient(135deg,#5D159D 0%,#7D2FBB 52%,#9A5FC4 100%)',
]:
    assert token in css, f'V19 premium light palette contract missing: {token}'

# Profile runtime must mark both app and admin accounts as the fixed V19 dock.
assert 'sidebar-bottom-fixed' in profile_js
assert 'profileDockVersion = "19"' in profile_js
assert 'version: "19.0.0"' in profile_js
assert '"#F3EFE8"' in profile_js

# Shared app shell remains the single source of app/admin account markup.
assert 'account.className=\'nav-account nav-account-fixed\'' in shell_js
assert "document.body.classList.add('navora-admin')" in shell_js
assert "document.body.classList.add('navora-app')" in shell_js

# New cache name guarantees installed/PWA clients do not stay on stale sidebar CSS.
assert "navora-sidebar-light-v19-0-0" in sw
assert '"/assets/css/light-theme-profile-v17.css"' in sw
assert '"/assets/js/profile-all-pages-v17.js"' in sw

# Cheap syntax safety: strip comments/strings enough to catch accidental unbalanced braces.
without_comments = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
assert without_comments.count('{') == without_comments.count('}'), 'V19 CSS braces are unbalanced'

print('V19_SIDEBAR_LIGHT_THEME_CONTRACTS PASS: 28-page shared shell, fixed-bottom app/admin/public profile dock, premium non-blue light palette, and PWA cache bump are locked')
