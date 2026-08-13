# Navora Cinematic UI v4

## Direction

Navora's presentation layer now uses a dual visual identity:

- **Light theme:** India-inspired saffron, white, green and deep navy. The palette is used as a restrained product system rather than a literal flag treatment.
- **Dark theme:** royal purple with metallic gold highlights, luminous borders and controlled glow.

The redesign is intentionally presentation-only. Existing element IDs, API requests, authentication, Socket.IO, camera controls, map behavior and route intelligence logic remain unchanged.

## Motion system

The visual runtime adds a low-cost network canvas, moving route streaks, aurora fields, scroll progress, staggered reveals, magnetic controls, pointer spotlights, subtle card tilt, animated metrics and theme-aware Three.js route/research scenes. `prefers-reduced-motion` disables non-essential motion and low-width/coarse-pointer devices receive reduced effects.

## Major surfaces

- Landing hero: portfolio-grade full-height composition with route/neural Three.js scene.
- Authentication: cinematic split-screen treatment with orbit layers and high-contrast form surfaces.
- Dashboard: animated KPI hierarchy, glass data surfaces and cinematic page heading.
- Map: command-center route panel, elevated Leaflet viewport and highlighted recommended route state.
- Live journey: premium camera/navigation panes and live-perception treatment.
- Chat/admin/data pages: cohesive glass surfaces, refined tables, messages and status components.

## Files

Created:
- `frontend/assets/css/cinematic.css`
- `frontend/assets/js/cinematic-ui.js`
- `tests/cinematic_ui_contracts.py`

Modified:
- all 28 files under `frontend/public/*.html`
- `frontend/assets/js/three-scenes.js`
- `frontend/assets/js/three-research.js`
- `frontend/service-worker.js`
- `frontend/manifest.json`

## Verification

Verified in the sandbox source copy:

- JavaScript syntax checks: PASS
- CSS parser validation: PASS (0 parser errors across main/premium/cinematic CSS)
- Static asset/link validation: PASS (28/28 HTML pages)
- Cinematic UI contracts: PASS (28/28 pages)
- Frontend feature contracts: PASS
- Admin/Render contracts: PASS
- Pure algorithm smoke: PASS (DTW, EMA, map-match/geofence, ACO, explainability)
- Performance smoke: PASS
- Master prompt cross-check: PASS
- Secrets/repository cross-check: PASS
- Static HTTP page delivery: PASS (28/28 pages; cinematic assets HTTP 200)

Full Jest integration tests require the backend `node_modules` and a runtime environment; they were previously passing 22/22 on the user's Windows project before this frontend-only redesign. After merging this update, rerun `npm test` locally to confirm the environment-specific integration suite.
