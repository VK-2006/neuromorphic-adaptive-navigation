# Navora — Neuromorphic Adaptive Navigation Using Cognitive Route Memory and Swarm Intelligence

Navora is a research-oriented, camera-free intelligent-navigation web platform that combines conventional road routing with an adaptive route-risk layer. It does not claim to replace or universally outperform Google Maps. The connected research components are a custom NAVORA Route Risk prototype dataset, RiskSNN processing, Cognitive Route Memory (CRM), DTW, EMA, verified community hazards/reputation, ACO and explainable route decisions.

## What the application recommends

For a source and destination the orchestration layer obtains road-route candidates and calculates distance, base/travel time, traffic delay/severity, hazard exposure, SNN hazard risk, CRM familiarity, DTW similarity, EMA historical reliability, previous successful journeys, user preference fit, safety, ACO score and final utility. The UI can identify **Shortest**, **Fastest**, **Safest**, **Familiar** and final **Adaptive** recommendations. A slightly longer route may win only when calculated safety/reliability benefits justify it.

## Connected architecture

`Browser/PWA → Node.js/Express 5 + Socket.IO orchestration → MongoDB + routing/geocoding/traffic providers → separate FastAPI AI service`

During an active journey:

`GPS → route features → RiskSNN/RiskEngine → hazard trust → route-corridor geofence → CRM/DTW/EMA → ACO alternative → explanation → user-confirmed reroute → destination → CRM update → journey replay.`

## Technology stack

**Frontend:** HTML5, CSS3, ES6+, Bootstrap 5, Leaflet/OpenStreetMap, Chart.js, Three.js, GSAP, AOS/Lottie where useful, Socket.IO client, Web Speech, Geolocation, Service Worker/PWA.

**Backend:** Node.js, Express 5, MongoDB/Mongoose, Socket.IO, JWT access tokens + rotating hashed refresh tokens, bcrypt, Helmet, CORS, rate limiting, express-validator, Winston/Morgan, Google identity verification and Brevo transactional-email architecture.

**AI:** Python, FastAPI, PyTorch, snnTorch RiskSNN, NumPy, scikit-learn, Pydantic and Pytest.

## Main implemented modules

- Premium responsive LIGHT/DARK/SYSTEM UI and original Navora visual identity.
- Place-name autocomplete + reverse geocoding, current location, click/draggable markers and Leaflet road routes.
- Routing adapters: OSRM, GraphHopper, Valhalla and clearly labelled development/mock.
- TomTom traffic-flow adapter plus explicit `UNKNOWN`, degraded and `SIMULATION` behavior.
- Live GPS `watchPosition`, segment map matching, covered/remaining distance, progress, speed, heading, arrival/ETA and route deviation using distance + accuracy + heading + speed + time outside route.
- Journey start/pause/resume/complete, reroute cooldown and current-vs-alternative comparison.
- Camera-free route-risk service using RiskSNN with an explicit unvalidated/research fallback.
- CRM, DTW, EMA, ACO and WHY THIS ROUTE? explainability using calculated values.
- Hazard deduplication, admin/community verification, proximity-limited confirmations, reputation and route-aware geofenced alerts.
- Turn-by-turn instructions and Web Speech voice/language/volume/voice selection.
- SOS to opted-in trusted contacts, expiring/revocable journey sharing and constrained shared viewer.
- World Chat: global/nearby coarse-cell/region/route/journey rooms, history/pagination, typing, presence, emoji reactions, replies, own-message edit/delete, blocking, reporting and admin moderation.
- Journey replay/digital twin with original/current/rerouted route traces, GPS, hazards and decision events.
- Classroom-safe simulation of GPS, traffic, detection, SNN/fallback risk, hazards, rerouting and completion with visible **SIMULATION MODE**.
- PWA manifest/icons/service worker/offline page with recent/last route/settings and no stale-live-data claims.
- Three.js landing + SNN/ACO/CRM research visualizations with single state/RAF lifecycle, disposal, reduced-motion and adaptive quality.
- User/admin dashboards, live Mongo-backed history/memory/notifications/profile/devices and audit/system-health pages.

## Dataset and model

- **NAVORA Route Risk Dataset:** 800 manually curated/generated prototype records, split 560/120/120, with 14 route-risk inputs and a continuous `route_risk_score` target. It is not a public or real-world benchmark.
- **OpenStreetMap/OSRM:** geographic and routing data, not ML training data.
- `datasets/demo-data/snn-risk-raw.csv`: synthetic/demo-only fixture with all master-prompt SNN risk fields.
- `datasets/derived-risk-data/risk-training.csv`: normalized SNN training fixture.
- `datasets/demo-data/crm-journeys.json`: synthetic/demo-only CRM journey fixture.

Reproduce the dataset with `python scripts/create_navora_dataset.py --seed 42 --records 800`. Train RiskSNN with `python scripts/train_navora_snn.py`. Trained weights remain local and research-only until independent validation.

### SNN truthfulness rule

`ai-service/app/models/snn.py` contains the real snnTorch LIF architecture and the risk engine contains temporal/spike/membrane processing. The current model is a mini-project prototype: held-out results on the custom dataset are accuracy 0.8417, macro-F1 0.5743 and MAE 0.0954. These are not evidence of production-grade generalization. Missing/unvalidated weights remain explicitly research/development output.

## Authentication and security

Email/password, Google identity and WebAuthn/passkeys are supported. Email verification/reset OTPs are hashed, expiring, attempt-limited, resend-limited and one-time. Reset grants and refresh tokens are hashed; refresh tokens rotate and token-family reuse revokes the family. RBAC provides `USER`/`ADMIN` authorization.

Exact private GPS is never globally broadcast. Chat strips HTML and checks room/ownership access. Device/contact mutation fields are allowlisted. Socket.IO checks journey/device/route/chat room access. Development JWT secrets are generated ephemerally at runtime when missing; production requires real secrets supplied outside source control. Only `.env.example` files are committed.

## Repository layout

```text
frontend/       static PWA/UI, Leaflet, Three.js, browser APIs
backend/        Express 5/Mongo/Socket orchestration, tests, .env.example, Dockerfile
ai-service/     FastAPI RiskSNN route-risk service, tests, .env.example, Dockerfile
datasets/       documentation + explicitly labelled demo/derived fixtures
docs/           architecture/API/database/AI/security/testing/deployment/user docs
postman/        82-request API collection
scripts/        checks, data prep/training, demo seed, Windows setup
tests/          dependency-light source/algorithm/failure/performance tests
docker-compose.yml
```

## Local installation

1. Install Node.js 20+, Python and MongoDB (or Docker on your machine).
2. Keep `backend/.env.example` and `ai-service/.env.example` as templates. Create your own local `.env` files only on your machine and never commit secrets.
3. Backend:

```bash
cd backend
npm install
npm start
```

4. AI service:

```bash
cd ai-service
python -m venv .venv
# activate the environment for your OS
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

5. Open `http://localhost:5000`.

## Testing

Use the consolidated verifier from the repository root:

```bash
python scripts/final_verify.py
```

With local MongoDB and installed backend dependencies, include the isolated runtime E2E flow:

```bash
python scripts/final_verify.py --runtime
```

That runtime test covers registration/OTP/login/refresh, route comparison/ACO, persisted journeys, GPS tracking, reroute, Socket.IO + World Chat, live readiness, trusted-contact SOS, completion/CRM/replay, password reset and admin RBAC. See `docs/testing.md`.

For the final merge, `scripts/apply_final_release.ps1 -Target <repo> -Verify` preserves local runtime state, removes obsolete tracked artifacts and runs the consolidated verifier. Before commit, `python scripts/prepush_audit.py` checks tracked secrets, backups/generated artifacts and `package.json`/`package-lock.json` direct dependency consistency.

## Docker

Future/local machine command: `docker compose up --build`. The compose file starts MongoDB, AI and backend in development/simulation configuration. The current execution sandbox has no Docker daemon, so Docker runtime validation is intentionally reported as an environment warning rather than a false PASS.

## Credential-dependent integrations

Google Identity, Brevo and live traffic are source-complete but require user-supplied credentials for live verification. MongoDB Atlas also requires a future production URI. Missing external credentials are not treated as code defects and are never replaced with invented secrets.

## Render-ready source contract

Current integrated backend + frontend Render target:

- Environment: Node
- Root Directory: leave blank (repository root; the backend serves `frontend/` at runtime)
- Build Command: `cd backend && npm ci`
- Start Command: `cd backend && npm start`
- Health Check Path: `/health`
- Code: `const PORT = process.env.PORT || 5000;`

The user's Git working repository already preserves `backend/package-lock.json`; the final pre-push audit verifies its direct dependency specifications match `package.json` before push.

## Limitations / validation boundary

No fabricated SNN validation is claimed. The custom 800-record dataset and reported metrics are prototype/held-out research results, not production evidence. Geolocation, Screen Wake Lock and passkeys depend on HTTPS, browser support and physical permissions. Public OSRM does not provide live traffic. Real emergency-service dispatch is not claimed. Production Google/Brevo/TomTom/Atlas behavior requires real user-owned credentials.

The source contains training/evaluation/runtime-validation tooling so those gates can be completed without redesigning the application.

## Pre-push / deployment status

All identified source/compliance cleanup is consolidated into the final pre-push build. The user performs the Git commit/push after `final_verify.py --runtime` and `prepush_audit.py` pass. Render/Atlas/production secrets remain a separate later step.


## Production smoke verification

After a production auto-deploy, verify the exact deployed Git commit and public integrations:

```powershell
python .\scripts\production_smoke.py `
  --backend https://YOUR-BACKEND.onrender.com `
  --ai https://YOUR-AI.onrender.com `
  --expected-commit (git rev-parse HEAD)
```

The smoke verifier does not print secrets. It checks backend/Mongo health, frontend/PWA assets, non-secret Google/Brevo/WebAuthn configuration, routing, geocoding, real TomTom route annotation, Socket.IO, AI health/model metadata and AI risk inference. Actual Google browser sign-in, delivered Brevo email receipt, trained held-out model validation and physical GPS testing remain explicit external gates.


### Production geocoding policy

Navora does not use the public OSMF Nominatim endpoint for autocomplete. Nominatim remains available for rate-limited, cached manual search/reverse geocoding. If a TomTom key is available, predictive place suggestions use TomTom Search; the dedicated `GEOCODING_API_KEY` is optional and falls back to the existing `TRAFFIC_API_KEY`.

## Navora V7 functional product UI

Production pages use `navora-v7.css` and the domain JavaScript modules. The previous `worldclass.css` / `worldclass-ui.js` showcase layer is no longer loaded. V7 prioritizes authenticated workflow state, map/journey usability, visible form/error states, responsive navigation, cache-safe updates and real Playwright browser wiring checks.
