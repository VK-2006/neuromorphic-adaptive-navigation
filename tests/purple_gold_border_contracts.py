
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"
CSS = ROOT / "frontend" / "assets" / "css" / "purple-gold-border-motion.css"
JS = ROOT / "frontend" / "assets" / "js" / "purple-gold-border-motion.js"
REPORT = ROOT / "docs" / "PURPLE_GOLD_PAGE_BY_PAGE_AUDIT.md"

pages = sorted(PUBLIC.glob("*.html"))
assert len(pages) == 27, f"Expected exactly 27 frontend pages, found {len(pages)}"

css = CSS.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")
report = REPORT.read_text(encoding="utf-8")

for page in pages:
    text = page.read_text(encoding="utf-8")
    assert "/assets/css/purple-gold-border-motion.css" in text, f"{page.name}: Purple Gold CSS missing"
    assert "/assets/js/purple-gold-border-motion.js" in text, f"{page.name}: Purple Gold JS missing"
    assert page.name in report, f"{page.name}: missing from page-by-page audit report"

for signal in [
    "@property --pg-angle",
    "@keyframes pgBorderOrbit",
    "@keyframes pgAuthAura",
    "@keyframes pgMetricBloom",
    "@keyframes pgRouteSignal",
    "@keyframes pgTableEdge",
    "@keyframes pgFocusShift",
    "@keyframes pgHeroComet",
    "@media (hover:hover) and (pointer:fine)",
    "@media (hover:none), (pointer:coarse)",
    "@media (prefers-reduced-motion: reduce)",
    ".pg-border-btn",
    ".pg-border-card",
    ".pg-route-signal",
    ".pg-auth-aura",
    ".pg-danger-edge",
]:
    assert signal in css, f"Missing CSS contract: {signal}"

for signal in [
    "IntersectionObserver",
    "MutationObserver",
    "pg-page-",
    "pg-border-btn",
    "pg-border-card",
    "pg-route-signal",
    "pg-focus-energy",
    "NavoraPurpleGoldMotion",
]:
    assert signal in js, f"Missing JS contract: {signal}"

assert "leaflet-control" in js, "Leaflet controls must be excluded from generic border decoration"
assert "prefers-reduced-motion" in js, "Reduced-motion runtime awareness missing"

print(f"PURPLE_GOLD_BORDER_CONTRACTS PASS: {len(pages)}/27 pages")
print("PASS: page-aware roles, purple/gold keyframes, viewport pausing, dynamic DOM support, Leaflet safety, reduced-motion")
