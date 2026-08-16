from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
APP=(ROOT/'backend/src/app.js').read_text(encoding='utf-8')
OFFLINE=(ROOT/'frontend/public/offline.html').read_text(encoding='utf-8')
SW=(ROOT/'frontend/service-worker.js').read_text(encoding='utf-8')

class Assets(HTMLParser):
    def __init__(self):
        super().__init__();self.urls=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=='script' and d.get('src'):self.urls.append(d['src'])
        if tag=='link' and d.get('href'):self.urls.append(d['href'])

assert 'contentSecurityPolicy:false' not in APP, 'Helmet CSP is still disabled'
for token in [
    'contentSecurityPolicy:{directives:cspDirectives}',
    "defaultSrc:[\"'self'\"]",
    "objectSrc:[\"'none'\"]",
    "scriptSrcAttr:[\"'none'\"]",
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    'https://accounts.google.com',
    'https://*.tile.openstreetmap.org',
    'https://storage.googleapis.com',
    "crossOriginOpenerPolicy:{policy:'same-origin-allow-popups'}",
    'Permissions-Policy',
]:
    assert token in APP, f'CSP/security contract missing: {token}'

assets=Assets();assets.feed(OFFLINE)
external=[u for u in assets.urls if u.startswith('http://') or u.startswith('https://')]
assert not external, f'offline.html depends on network assets: {external}'
for token in [
    '/assets/css/main.css','/assets/css/navora-v7.css','/assets/css/premium-ui.css',
    '/assets/js/theme.js','/assets/js/app-shell.js','/assets/js/offline.js',
    '/assets/js/profile-all-pages-v17.js'
]:
    assert token in assets.urls, f'offline local asset missing: {token}'

# V23 established the hardened offline/cache boundary. Later releases are allowed
# to rotate the active cache name, but must retain V23 lineage and all V23 assets.
assert "navora-security-pwa-v23-0-0" in SW, 'V23 hardened cache lineage was lost'
assert "const CACHE='navora-security-pwa-v23-0-0'" in SW or "V23_CACHE_LINEAGE='navora-security-pwa-v23-0-0'" in SW, 'V23 cache must remain active or explicitly retained as lineage'
for token in [
    "V22_CACHE_LINEAGE='navora-right-pane-v22-0-0'",
    '"/offline.html"',
    '"/assets/css/right-pane-shell-v22.css"',
    '"/assets/js/scroll-surface-v22.js"',
]:
    assert token in SW, f'V23 service-worker contract missing: {token}'

assert "u.origin!==self.location.origin" in SW, 'service worker must not claim/cache cross-origin CDN requests'
assert "u.pathname.startsWith('/api/')" in SW, 'service worker must not cache live API truth'

print('V23_SECURITY_PWA_CONTRACTS PASS: CSP enabled with required providers, offline shell is same-origin only, and hardened cache/live-data boundaries remain in the release lineage')
