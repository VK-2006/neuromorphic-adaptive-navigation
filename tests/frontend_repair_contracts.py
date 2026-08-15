from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
pages=sorted((ROOT/'frontend'/'public').glob('*.html'))
errors=[]
if len(pages)!=28:errors.append(f'expected 28 pages, found {len(pages)}')
styles=['/assets/css/obsidian.css','/assets/css/obsidian-motion.css','/assets/css/purple-gold-border-motion.css']
scripts=['/assets/js/obsidian-ui.js','/assets/js/obsidian-motion.js','/assets/js/purple-gold-border-motion.js']
for p in pages:
    t=p.read_text(encoding='utf-8')
    if '/assets/css/obsidian.css rel=stylesheet' in t:errors.append(f'{p.name} malformed obsidian link')
    for a in styles:
        if t.count(a)!=1:errors.append(f'{p.name} style {a} count={t.count(a)}')
    for a in scripts:
        if t.count(a)!=1:errors.append(f'{p.name} script {a} count={t.count(a)}')
ui=(ROOT/'frontend/assets/js/obsidian-ui.js').read_text(encoding='utf-8')
motion=(ROOT/'frontend/assets/js/obsidian-motion.js').read_text(encoding='utf-8')
pg=(ROOT/'frontend/assets/js/purple-gold-border-motion.js').read_text(encoding='utf-8')
pgcss=(ROOT/'frontend/assets/css/purple-gold-border-motion.css').read_text(encoding='utf-8')
mcss=(ROOT/'frontend/assets/css/obsidian-motion.css').read_text(encoding='utf-8')
sw=(ROOT/'frontend/service-worker.js').read_text(encoding='utf-8')
checks=[
 ('data-wc-page identity',"body.dataset.wcPage=page" in ui),
 ('route keyboard activation',"card.click()" in ui and "e.key!=='Enter'" in ui),
 ('motion does not own route selection',"classList.toggle('selected'" not in motion),
 ('dynamic motion observer',"new MutationObserver" in motion and "decorate(node)" in motion),
 ('dynamic PG viewport observer',"observeEnergy" in pg and "io.observe(el)" in pg),
 ('camera pseudo safety',"pg-safe-edge" in pg),
 ('PG avoids element box-shadow keyframes',"@keyframes pgEdgeBreathe" in pgcss and "box-shadow:" not in pgcss),
 ('tilt pseudo collision fixed',".motion-tilt:not(.pg-border-energy)::after" in mcss),
 ('SW caches obsidian css','"/assets/css/obsidian.css"' in sw),
 ('SW caches obsidian ui','"/assets/js/obsidian-ui.js"' in sw),
]
for name,ok in checks:
    if not ok:errors.append(name)
if errors:
    print('FRONTEND_REPAIR_CONTRACTS FAIL')
    for e in errors:print('-',e)
    sys.exit(1)
print(f'FRONTEND_REPAIR_CONTRACTS PASS: {len(pages)}/28 pages')
for name,_ in checks:print('-',name)
