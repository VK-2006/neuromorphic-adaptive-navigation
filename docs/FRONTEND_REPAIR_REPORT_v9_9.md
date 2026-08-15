# NAVORA Frontend Repair v9.9

## Scope
- Pages audited: 28
- HTML pages normalized: 28
- Malformed Obsidian link occurrences repaired: 28

## Shared root fixes
1. Normalized Obsidian, advanced motion, and Purple/Gold CSS/JS linkage on every page.
2. Restored `data-wc-page` so Dashboard/Map/Journey page-specific Obsidian rules activate.
3. Removed presentation-layer ownership of route selection; `map.js` remains the source of truth.
4. Added Enter/Space keyboard activation for generated route cards.
5. Made reveal/tilt/button/camera motion support dynamically inserted DOM.
6. Made dynamic Purple/Gold components register with the viewport observer.
7. Preserved the camera-pane `::after` video readability overlay with a pseudo-safe animated edge.
8. Prevented motion tilt `::after` from colliding with Purple/Gold border `::after`.
9. Kept Purple/Gold personality motion on border pseudo-elements instead of overwriting component shadows.
10. Added Obsidian base CSS/JS to the service-worker shell and bumped cache generation.
11. Added restrained overflow, focus-visible, `100dvh`, and small-screen hardening.

## Preserved
Backend, auth API contracts, routing algorithms, Leaflet behavior, journey logic, detection logic, Socket.IO behavior, and database/business logic were not replaced.
