
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"
CSS = ROOT / "frontend" / "assets" / "css" / "obsidian-motion.css"
JS = ROOT / "frontend" / "assets" / "js" / "obsidian-motion.js"

pages = sorted(PUBLIC.glob("*.html"))
assert len(pages) >= 20, f"Expected full page set, found {len(pages)}"

css = CSS.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")

for page in pages:
    text = page.read_text(encoding="utf-8")
    assert "/assets/css/obsidian-motion.css" in text, f"{page.name}: motion CSS missing"
    assert "/assets/js/obsidian-motion.js" in text, f"{page.name}: motion JS missing"
    assert text.index("/assets/css/obsidian.css") < text.index("/assets/css/obsidian-motion.css"), f"{page.name}: motion CSS must load after Obsidian CSS"

required_keyframes = [
    "motionPageEnter",
    "motionClipReveal",
    "motionRipple",
    "motionInvalid",
    "motionStatusBreath",
    "motionGradientDrift",
    "motionSoftFloat",
    "motionRouteSelected",
    "motionPopupIn",
    "motionPathDraw",
    "motionCameraScan",
    "motionHudBreathe",
    "motionToastIn",
    "motionDialogIn",
    "motionSkeletonSweep",
    "motionProgressSweep",
    "motionViewLinked",
    "motionParallaxSoft",
]
for name in required_keyframes:
    assert f"@keyframes {name}" in css, f"Missing keyframe: {name}"

for signal in [
    "@media (hover:hover) and (pointer:fine)",
    "@media (hover:none), (pointer:coarse)",
    "@media (max-width: 820px)",
    "@media (prefers-reduced-motion: reduce)",
    "@supports (animation-timeline: view())",
    "@view-transition",
    ".btn-navora::before",
    ".motion-ripple",
    ".motion-tilt",
    ".motion-reveal",
    ".obs-motion-progress",
]:
    assert signal in css, f"Missing CSS motion contract: {signal}"

for signal in [
    "IntersectionObserver",
    "requestAnimationFrame",
    "prefers-reduced-motion",
    "pointerdown",
    "motion-ripple",
    "motion-tilt",
    "animation-timeline: view()",
    "motion-camera-live",
]:
    assert signal in js, f"Missing JS motion contract: {signal}"

assert "prefers-reduced-motion: reduce" in css
assert "hover:none" in css and "pointer:coarse" in css

print(f"MOTION_SYSTEM_CONTRACTS PASS: {len(pages)} pages use the shared advanced motion layer")
print(f"Keyframes checked: {len(required_keyframes)}")
print("PASS: reduced-motion, touch safety, fine-pointer enhancement, scroll reveal, ripple, tilt and progressive scroll/view transitions")
