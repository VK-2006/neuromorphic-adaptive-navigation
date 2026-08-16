from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def text(path):
    return (ROOT / path).read_text(encoding='utf-8', errors='ignore')

api = text('frontend/assets/js/api.js')
v9 = text('frontend/assets/js/v9-functional.js')
shell = text('frontend/assets/js/app-shell.js')
replay = text('frontend/assets/js/replay.js')
data_pages = text('frontend/assets/js/data-pages.js')
history = text('frontend/public/history.html')

# Custom request headers must be merged rather than replacing the default JSON
# header. FormData remains browser-owned so its multipart boundary is preserved.
assert 'const headers=new Headers(options.headers||{})' in api
assert "!headers.has('Content-Type')" in api
assert "body instanceof FormData" in api
assert "return{...options,credentials:options.credentials??'include',headers}" in api
assert "headers:{'Content-Type':'application/json',...(options.headers||{})},...options" not in api

# The History guard must discover the Status column from the actual table header.
assert '<th>Status</th>' in history
assert "statusIndex=headers.findIndex" in v9
assert "toUpperCase()==='STATUS'" in v9
assert "cells[4].textContent" not in v9
assert "tr.querySelector('a[data-replay]')" in v9

# User-controlled profile strings rendered via innerHTML must be escaped.
assert 'function esc(s)' in shell
assert "${esc(user?.name||'Navora user')}" in shell
assert "${esc(user?.email||'')}" in shell
assert "<strong>${String(user?.name||'Navora user')}</strong>" not in shell

# Leaflet DivOverlay treats string content as HTML. Route/hazard labels therefore
# must pass through the local HTML escaper before bindTooltip/bindPopup receives them.
assert "esc(r.label||'route')" in replay
assert "m.bindTooltip(`${esc(h?.type||'Hazard')} · ${esc(h?.snnRiskLevel||'UNKNOWN')}`)" in data_pages

print('V24 RUNTIME HARDENING CONTRACTS: PASS')
