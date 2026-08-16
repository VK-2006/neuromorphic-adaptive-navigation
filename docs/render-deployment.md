# Render Deployment Guide

The integrated service is deployed from the repository root; production secrets remain outside source control.

Backend Render settings:

- Environment: Node
- Root Directory: leave blank (repository root; required because the backend serves `frontend/`)
- Build Command: `cd backend && npm ci`
- Start Command: `cd backend && npm start`
- **Health Check Path: `/ready`**
- Port contract: `const PORT = process.env.PORT || 5000;`

V34 separates liveness from readiness:

- `GET /health` is a liveness endpoint. It remains HTTP 200 while the Node process is alive and reports DB state, commit and a non-secret `ready` boolean.
- `GET /ready` is the deployment gate. It returns HTTP 200 only when MongoDB is connected and all critical production configuration checks pass; otherwise it returns HTTP 503 with non-secret per-check booleans/messages.
- Optional integrations such as Google, Brevo, TomTom, weather, Roboflow and TURN are reported separately and do not leak credentials.

The Git working repository must keep the verified `backend/package-lock.json`. The final pre-push audit checks that its direct dependency specifications match `package.json` so `npm ci` will not fail because of a stale lockfile.

## Critical production configuration

For `NODE_ENV=production`, configure these values in Render environment settings before treating `/ready` as a release gate:

- `MONGODB_URI`
- two different strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` values
- HTTPS `FRONTEND_URL`
- HTTPS `SOCKET_CORS_ORIGIN`
- HTTPS `AI_SERVICE_URL`
- `SIMULATION_MODE=false`
- `LIVE_REQUIRE_VALIDATED_AI=true`

The current Google Identity Services ID-token flow uses `GOOGLE_CLIENT_ID` and does **not** require `GOOGLE_CLIENT_SECRET`. Leave the client secret blank unless a future server-side authorization-code flow explicitly needs it.

Use `backend/.env.production.example` as the canonical variable checklist. Never commit real values.

## Full production integrations

For the complete demo/release experience, configure these external integrations in Render as applicable:

- Google Web client ID
- Brevo API key + verified sender email
- TomTom live traffic API key
- OpenWeather API key if live weather risk is required
- Roboflow key/workflow only if cloud detector mode is enabled
- TURN relay credentials for reliable remote WebRTC across NAT/firewalls

OSRM routing and policy-safe Nominatim manual geocoding can operate without API keys. Nominatim is not used for keystroke autocomplete. When a TomTom Search-capable key is available, predictive place suggestions can use TomTom.

## Production smoke verification

After both Render services deploy the same Git commit, run the core release smoke:

```powershell
python .\scripts\production_smoke.py `
  --backend https://YOUR-BACKEND.onrender.com `
  --ai https://YOUR-AI.onrender.com `
  --expected-commit (git rev-parse HEAD)
```

Core mode treats optional Google/Brevo/TomTom/passkey integrations as warnings while still failing on critical readiness, exact release SHA mismatch, routing/geocoding failure, Socket.IO failure, AI service failure, or the V33 validated-only inference policy.

For a full-integration release gate, add `--require-integrations`:

```powershell
python .\scripts\production_smoke.py `
  --backend https://YOUR-BACKEND.onrender.com `
  --ai https://YOUR-AI.onrender.com `
  --expected-commit (git rev-parse HEAD) `
  --require-integrations
```

V35 smoke verifies:

- backend liveness and `/ready`
- MongoDB production connection and live mode
- exact backend Render commit
- frontend/PWA assets
- Google/Brevo/WebAuthn non-secret configuration
- routing, geocoding and live TomTom traffic
- live route comparison and Socket.IO handshake
- AI health and **exact AI Render commit**
- AI model metadata and risk inference
- V33 rule that an unvalidated trained model cannot serve normal trained inference

Actual Google browser sign-in, delivered email receipt, held-out trained-model validation and physical phone GPS/camera/Bluetooth/WebRTC remain separate evidence gates and must not be fabricated.

## V35 automatic release watch

`.github/workflows/production-release-watch.yml` runs automatically after a successful `Navora CI` run on `main`. It uses `github.event.workflow_run.head_sha` rather than the `workflow_run` event's default `GITHUB_SHA`, waits for **both** Render `/health` endpoints to expose that exact release commit, and then runs the production smoke against the deployed services.

The automatic watcher uses core release mode so an optional integration does not incorrectly mark a healthy code deployment as failed. The manual `Navora Production Smoke` workflow defaults to strict integration mode for final demo/release sign-off. Both workflows require exact backend and AI commit parity.

The propagation watcher waits up to 20 minutes because Render builds/cold starts can lag behind GitHub CI. If either service never reaches the expected SHA, the workflow fails with the last observed non-secret HTTP/service status and commit value.

## Nominatim policy-safe geocoding

The public OSMF Nominatim service is retained as a configurable manual-search/reverse provider and is rate-limited/cached server-side. It is not used for keystroke autocomplete. When a TomTom geocoding key or the existing TomTom traffic key is available, Navora uses TomTom Search predictive typeahead for production place suggestions. `GEOCODING_API_KEY` is optional; if omitted, `TRAFFIC_API_KEY` is reused when that key is valid for the TomTom Search service.

## OTP and World Chat production diagnostics

`GET /api/v1/auth/email/status` returns only non-secret Brevo readiness booleans. Failed production OTP sends return a retryable error instead of redirecting to an unusable verification page, and failed sends do not consume the resend cooldown. World Chat uses authenticated REST for durable message creation plus Socket.IO for realtime fan-out, presence and typing; `GET /api/v1/chat/status` exposes non-secret transport readiness.
