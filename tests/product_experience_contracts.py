
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]
pages=sorted((ROOT/'frontend/public').glob('*.html'))
if len(pages)!=25:errors.append(f'expected 25 pages, found {len(pages)}')
for p in pages:
    t=p.read_text(encoding='utf-8')
    for asset in ('/assets/css/product-repair-v10.css','/assets/js/product-repair-v10.js'):
        if t.count(asset)!=1:errors.append(f'{p.name}: {asset} count={t.count(asset)}')
checks={
'landing fallback': 'route-network-backdrop' in (ROOT/'frontend/assets/js/product-repair-v10.js').read_text(encoding='utf-8'),
'sidebar fixed bottom': 'grid-template-rows:auto minmax(0,1fr) auto' in (ROOT/'frontend/assets/css/product-repair-v10.css').read_text(encoding='utf-8'),
'journey dock': 'journey-camera-dock' in (ROOT/'frontend/assets/js/product-repair-v10.js').read_text(encoding='utf-8'),
'journey no-active state': 'journey-no-active' in (ROOT/'frontend/assets/js/product-repair-v10.js').read_text(encoding='utf-8'),
'memory summary': '/memory/summary' in (ROOT/'frontend/assets/js/data-pages.js').read_text(encoding='utf-8'),
'history modal replay': '/replay' in (ROOT/'frontend/assets/js/data-pages.js').read_text(encoding='utf-8') and 'journey-detail-dialog' in (ROOT/'frontend/public/history.html').read_text(encoding='utf-8'),
'profile summary': '/users/me/summary' in (ROOT/'frontend/assets/js/account.js').read_text(encoding='utf-8'),
'profile richer fields': 'profile-phone' in (ROOT/'frontend/public/profile.html').read_text(encoding='utf-8'),
'settings richer fields': 'pref-detection-mode' in (ROOT/'frontend/public/settings.html').read_text(encoding='utf-8'),
'backend profile summary route': "r.get('/me/summary',c.profileSummary)" in (ROOT/'backend/src/routes/genericRoutes.js').read_text(encoding='utf-8'),
'backend memory summary route': "r.get('/summary',c.memorySummary)" in (ROOT/'backend/src/routes/genericRoutes.js').read_text(encoding='utf-8'),
'backend route-memory metadata': 'lastJourneyId' in (ROOT/'backend/src/models/RouteMemory.js').read_text(encoding='utf-8'),
'backend settings prefs': 'highAccuracyGps' in (ROOT/'backend/src/models/User.js').read_text(encoding='utf-8'),
}
for name,ok in checks.items():
    if not ok:errors.append(name)
sw=(ROOT/'frontend/service-worker.js').read_text(encoding='utf-8')
if 'product-repair-v10.css' not in sw or 'product-repair-v10.js' not in sw:errors.append('service worker product repair assets')
if errors:
    print('PRODUCT_EXPERIENCE_CONTRACTS FAIL')
    for e in errors:print('-',e)
    sys.exit(1)
print('PRODUCT_EXPERIENCE_CONTRACTS PASS')
for name in checks:print('-',name)
