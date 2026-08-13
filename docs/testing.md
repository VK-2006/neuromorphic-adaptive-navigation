# Testing Guide

Run after the complete codebase has been generated. Recommended order follows the master prompt:

1. Dependency/import verification.
2. Backend syntax/unit tests.
3. AI unit tests.
4. DTW and EMA tests.
5. ACO/XAI tests.
6. Authentication and authorization tests.
7. Database behavior/integration tests.
8. Socket.IO tests.
9. Frontend serving/E2E smoke.
10. Navigation and live-journey tests.
11. Light/dark/system and Three.js lifecycle checks.
12. Security/failure/performance checks.
13. End-to-end simulation.

Available dependency-light checks:

```bash
node scripts/check-backend.js
python tests/frontend_contracts.py
node tests/pure-smoke.js
python tests/static_assets.py
python scripts/repository_crosscheck.py
python scripts/master_prompt_crosscheck.py
python -m compileall -q ai-service/app ai-service/tests scripts
python -m pytest ai-service/tests -q
```

With npm dependencies and MongoDB available:

```bash
cd backend
npm test
```

Browser/device tests should exercise camera permission denied/allowed, GPS permission denied/allowed, WebRTC, Web Bluetooth where supported, passkeys, mobile/tablet/desktop responsive layouts and LIGHT/DARK/SYSTEM themes. Credential-dependent integrations must be tested only after providing real credentials outside source control.

Never mark unexecuted Docker/browser/credential/trained-model checks as PASS. Record them as environment/credentials warnings.
