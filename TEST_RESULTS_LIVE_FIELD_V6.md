# Navora Live Field v6 — Available Validation Results

Date: 2026-08-13

## Passed in build environment
- LIVE_NAVIGATION_CONTRACTS: PASS
- WORLDCLASS_UI_CONTRACTS: PASS (28/28 pages)
- DOM_CONTRACTS: PASS (168 IDs preserved)
- STATIC_ASSETS: PASS (28 pages)
- FRONTEND_CONTRACTS: PASS
- ADMIN/RENDER CONTRACTS: PASS
- FAILURE_CONTRACTS: PASS
- ACCESSIBILITY_CONTRACTS: PASS
- Repository secret crosscheck: PASS
- AI pytest: 6 passed
- Pure algorithm smoke: PASS
- Performance smoke: PASS
- JavaScript syntax checks: PASS

Latest performance smoke in this environment:
- ACO 40 runs: ~43.4 ms
- DTW 60 runs: ~12.0 ms
- map-match 10,000 runs: ~2.2 ms

## Environment-dependent tests still required on the user's Windows machine
- Backend Jest (`npm test`) because distribution ZIP intentionally excludes node_modules.
- `npm audit` using the user's installed dependency tree.
- Real phone HTTPS permission tests: GPS, camera, Screen Wake Lock, Web Bluetooth.
- Real field route/reroute and Socket.IO testing after public HTTPS deployment.
- Camera obstacle-detection safety behavior with trained and validated detector/SNN weights. Development heuristic fallback is not safety-validated.
