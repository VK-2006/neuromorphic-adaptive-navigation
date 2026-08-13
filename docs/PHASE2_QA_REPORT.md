# Navora v5 — Phase 2 QA / Regression Report

Date: 2026-08-13

## Phase objective

**TEST → DETECT → FIND ROOT CAUSE → FIX → RETEST → REGRESSION TEST → STABILIZE**

## Automated project checks executed in the build environment

### Static assets

`python tests/static_assets.py`

Result: **PASS** — 28 HTML pages and all local static href/src targets present.

### World-class UI contract

`python tests/worldclass_ui_contracts.py`

Result: **PASS** — 28/28 pages load the unified design system/runtime, dual themes, map/camera/AI motion systems, responsive/mobile rules, accessibility systems and v7 Phase-2 PWA cache.

### DOM compatibility contract

`python tests/dom_contracts.py`

Result: **PASS** — all **168 pre-redesign element IDs** across the 28 pages are preserved.

This is important because existing JavaScript depends on those identifiers.

### Frontend/application contracts

`python tests/frontend_contracts.py`

Result: **PASS** — map/providers, journey/privacy/reroute/WebRTC, device/Bluetooth, chat, simulation/replay, PWA, themes/Three.js, auth/socket/AI/database-degraded contracts.

Admin/Render contracts: **PASS**.

### Failure-state contracts

`python tests/failure_contracts.py`

Result: **PASS** — DB, AI, routing, traffic, email, Socket.IO, browser permission, auth and payload failure paths remain represented.

### Compatibility contracts

- `python tests/senior_ui_contracts.py` — **PASS**
- `python tests/cinematic_ui_contracts.py` — **PASS**

These now assert that prior visual behavior has been consolidated into the v5 system instead of requiring obsolete files.

### JavaScript syntax

`node --check frontend/assets/js/worldclass-ui.js`

Result: **PASS**.

`node --check frontend/assets/js/theme.js`

Result: **PASS**.

### CSS parsing

`main.css`: **0 parser errors**.  
`worldclass.css`: **0 parser errors**.

### Pure algorithm smoke

`node tests/pure-smoke.js`

Result: **PASS** — DTW, EMA, segment map-match, heading-aware geofence, ACO preference fit and explainability.

### Performance smoke

`node tests/performance_smoke.js`

Final measured run in this environment:

- ACO 40 runs: ~39.1 ms
- DTW 60 runs: ~17.3 ms
- map-match 10,000 runs: ~2.2 ms

Result: **PASS**.

### AI service tests

`python -m pytest -q` from `ai-service`

Result: **6 passed**.

## Rendered visual QA

A network-free Chromium render harness was used to inspect the new presentation layer without depending on the user's localhost or external CDNs.

Rendered and visually inspected examples include:

- landing — light and dark,
- login — light and dark,
- dashboard — light and dark,
- route map shell — light and dark,
- live journey — light and dark,
- mobile map layout,
- mobile journey camera mode,
- mobile journey map/controls mode.

The harness reported no presentation-runtime page exceptions for those cases.

### Responsive sweep

A headless Chromium offline layout sweep executed:

**28 pages × 2 themes × 7 widths = 392 layout cases**

Widths: 1440, 1200, 1024, 768, 480, 375 and 320 px.

Result: **0 horizontal-overflow failures** in the offline presentation harness.

## Bugs detected and repaired during Phase 2

### 1. Dark hero multiline gradient rendering

**Symptom:** Chromium rendered opaque purple/gold rectangles over multiline hero emphasis text in dark mode.

**Root cause:** animated `background-clip:text` on a multiline inline emphasis span was not robust in the tested Chromium headless rendering path.

**Fix:** dark theme now uses stable metallic-gold emphasis text plus restrained purple/gold glow depth. Light mode retains the India-inspired gradient treatment.

**Retest:** desktop dark landing render — **PASS**.

### 2. Mobile live-journey overlay clipping

**Symptom:** desktop-positioned journey statistics could extend beyond/clipped inside the mobile navigation pane.

**Root cause:** absolute desktop overlay positioning was inappropriate after map/camera stacking.

**Fix:** introduced an accessible mobile **Camera + AI / Map + journey** mode switch. In map mode, the journey map has a dedicated viewport and the statistics/actions are normal-flow content below it.

**Retest:** 390 px camera mode and map mode — **PASS**.

### 3. Competing UI layers

**Risk:** v3/v4 premium/cinematic files could become a long-term source of selector, animation-loop and maintenance conflicts.

**Fix:** consolidated visual ownership into `worldclass.css` + `worldclass-ui.js`; removed legacy visual layers from the distribution and from all page references.

**Regression checks:** static assets, DOM contract, frontend contract and world-class contract — **PASS**.

## Security/functionality preservation checks

- No `.env` values were moved into frontend code.
- No backend route/API payload was intentionally changed for visual styling.
- 168 existing DOM IDs are preserved.
- Camera/video IDs, map IDs, route form IDs, Socket/device hooks and auth forms remain present.
- No fake route, hazard, metric, user or analytics data was inserted.
- Empty states are used when data is absent.

## Environment-dependent checks that still require the user's Windows runtime

The build environment cannot directly access `http://127.0.0.1:5000` running on the user's PC and cannot physically validate local camera/Bluetooth hardware permissions.

Therefore the following must be confirmed after merging v5 into the user's working project:

1. Backend Jest suite with the user's installed `backend/node_modules`.
2. `npm audit` against the user's installed/locked backend dependencies.
3. Live browser auth using the user's MongoDB and local environment.
4. Live Leaflet tile delivery / OSRM request behavior.
5. Real browser camera permission and object-detection overlay.
6. WebRTC phone-camera flow.
7. Web Bluetooth support with a compatible device/browser.
8. Live Socket.IO multi-client behavior.
9. Browser console during authenticated route/journey flows.

The user's immediately preceding v4 Windows run reported **8/8 Jest suites, 22/22 tests and 0 npm vulnerabilities**. v5 preserves backend source and concentrates changes in frontend presentation, but v5 should still be rerun locally before final deployment.

## Phase 2 status

All reproducible source-level, static, offline-render, responsive, algorithm and AI-service checks available in this environment are **PASS** after fixes.

## Additional Phase 2 stabilization pass — accessibility + cache coherency

A second source audit identified one real accessibility regression class that the original contracts did not catch: several visible form labels were visually adjacent to controls but were not programmatically associated with them using `for`/`id`, and a few compact replay/trusted-contact controls relied only on visual context/placeholders.

### Root cause

The v5 visual refactor preserved DOM IDs but some pre-existing plain `<label>` elements were retained without `for` attributes. This can reduce screen-reader form navigation quality and makes label-click focus behavior inconsistent.

### Fixes applied

- Added explicit `for` associations to auth, profile, route-preference and settings labels.
- Added `.sr-only` labels to compact replay controls and trusted-contact fields where a persistent visible label would add unnecessary visual noise.
- Preserved every existing control ID and API/event-handler contract.
- Added `tests/accessibility_contracts.py` using Python standard-library parsing so the regression check runs without new dependencies.
- Bumped the PWA shell cache to `navora-shell-v7-worldclass-phase2` so precached HTML is coherently refreshed after the stabilization update.

Affected pages: `forgot-password.html`, `journey-replay.html`, `login.html`, `map.html`, `profile.html`, `register.html`, `reset-password.html`, `settings.html`, `verify-email.html`, `verify-otp.html`.

### Retest results

- Accessibility static contract: **PASS** — 28 pages.
- Targeted Chromium visual regression: **PASS** — 60 cases (10 changed pages × 2 themes × 3 representative widths: 1440, 768, 320) with 0 horizontal-overflow and 0 presentation page-error failures.
- DOM-ID preservation: **PASS** — 168 IDs.
- Static assets, frontend contracts, failure-state contracts and compatibility contracts: **PASS**.
- JS syntax: **PASS**.
- CSS parse: **PASS**, 0 parser errors.
- Algorithms/performance: **PASS**.
- AI pytest: **6 passed**.
- Repository/master-prompt cross-checks: **PASS**.

### Backend regression evidence

The v5 backend directory is byte-for-byte identical to the v4 backend source tree (excluding no files other than the absent local lock/runtime artifacts); the comparison found **0 changed backend files**. The user's immediately preceding Windows v4 run already reported 8/8 Jest suites, 22/22 tests and 0 npm vulnerabilities. The build sandbox still cannot install the full backend dependency tree to independently rerun Jest, so the final v5.1 Windows Jest/audit check remains environment-dependent.
