# Navora v6 — Live Field Navigation

- Field/PWA live navigation is now the default route-planning intent; simulation is testing-only and defaults OFF.
- Added live readiness API covering routing, traffic and validated AI state.
- Added continuous high-accuracy GPS HUD, throttled tracking, latest-fix offline recovery, Socket.IO state, Wake Lock, full-screen field mode, arrival auto-completion and field-specific mobile layout.
- Added additive AI `validated` metadata and a live-safety gate so unvalidated research AI cannot drive automatic camera safety decisions in LIVE mode.
- Added explicit Permissions-Policy for geolocation, camera, screen wake lock and Bluetooth.
- Added `tests/live_navigation_contracts.py` and PWA cache `navora-shell-v8-live-field`.
