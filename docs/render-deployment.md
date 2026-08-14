# Render Deployment Guide

The integrated service is deployed from the repository root; production secrets remain outside source control.

Backend Render settings:

- Environment: Node
- Root Directory: leave blank (repository root; required because the backend serves `frontend/`)
- Build Command: `cd backend && npm ci`
- Start Command: `cd backend && npm start`
- Health Check Path: `/health`
- Port contract: `const PORT = process.env.PORT || 5000;`

The Git working repository must keep the verified `backend/package-lock.json`. The final pre-push audit checks that its direct dependency specifications match `package.json` so `npm ci` will not fail because of a stale lockfile.

Production configuration must supply MongoDB Atlas, strong JWT secrets, HTTPS frontend/socket origins, the separately deployed FastAPI AI URL, Google/Brevo credentials and any live traffic/routing credentials. Use HTTPS/WSS and secure cookies. Do not commit those values.


Production smoke verification:

```powershell
python .\scripts\production_smoke.py `
  --backend https://YOUR-BACKEND.onrender.com `
  --ai https://YOUR-AI.onrender.com `
  --expected-commit (git rev-parse HEAD)
```

This verifies the exact Render commit, backend/Mongo health, static PWA pages, non-secret Google/Brevo/WebAuthn configuration, routing/geocoding, live TomTom annotation, Socket.IO, AI health/model metadata and risk inference. Actual Google browser sign-in, delivered email receipt, held-out trained-model validation and physical phone hardware remain separate evidence gates.


## Nominatim policy-safe geocoding

The public OSMF Nominatim service is retained as a configurable manual-search/reverse provider and is rate-limited/cached server-side. It is not used for keystroke autocomplete. When a TomTom geocoding key or the existing TomTom traffic key is available, Navora uses TomTom Search predictive typeahead for production place suggestions. `GEOCODING_API_KEY` is optional; if omitted, `TRAFFIC_API_KEY` is reused when that key is valid for the TomTom Search service.
