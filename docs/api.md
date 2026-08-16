# REST and Real-Time API

The Node orchestration API uses the base path `/api/v1`. JSON success responses use `{ "success": true, "data": ... }`; validation/auth/provider failures use a consistent error response. Exact private GPS is never published to public/global rooms.

## Backend health and configuration

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Backend + MongoDB degraded/connected health |
| GET | `/api/v1/auth/config` | Public | Credential-dependent auth capabilities |
| GET | `/api/v1/routes/providers` | Public | Routing provider configuration summary |
| GET | `/api/v1/traffic/status` | Public | Live-provider vs simulation/unknown traffic status |
| GET | `/api/v1/simulation/status` | Public | Explicit classroom simulation capability |

## Authentication

`/api/v1/auth`: register, verify email OTP, resend OTP, login, refresh, logout, forgot password, verify reset OTP, reset password, Google ID-token login, WebAuthn/passkey registration options + verification, and passkey authentication options + verification. OTP values are hashed at rest; refresh tokens rotate and are hashed/revocable.

## Geocoding and routes

- `GET /api/v1/geocoding/search?q=...` — autocomplete/search.
- `GET /api/v1/geocoding/reverse?lat=...&lng=...` — reverse geocoding.
- `POST /api/v1/routes/compare` — candidate routes → traffic → hazards/SNN exposure → CRM/DTW/EMA → ACO → explainable recommendation.
- `POST /api/v1/routes/reroute` — authenticated current-vs-alternative adaptive re-evaluation.

Routing adapters support OSRM, GraphHopper, Valhalla and a clearly labelled development/mock provider. Mock geometry is never presented as a live road route.

## Journeys and tracking

`/api/v1/journeys` supports create/list/read/start/pause/resume/switch-route/complete, secure share-link creation/revocation and replay. `GET /api/v1/journeys/shared/:token` is a constrained public-by-token viewer. `POST /api/v1/tracking/update` stores authorized journey GPS and returns map-matched covered/remaining distance, progress, ETA, deviation, nearby route-relevant hazards and reroute recommendations.

## Hazards and AI orchestration

`/api/v1/hazards` supports camera detection, nearby hazards, community reports and proximity-limited confirmations. Repeated camera detections are deduplicated geographically/temporally rather than creating one document per frame. Community confirmation requires the confirmer to be within 500 m and does not persist the confirmer's supplied location.

Camera/object detections remain functional perception inputs. `objectClass` + `confidence` are transformed into NAVORA risk features, passed to SNN/fallback risk processing, and then consumed by route/hazard/ACO/CRM logic. Detector scientific validation is not a current API eligibility prerequisite; SNN live-risk validation remains separately governed.

## Devices, memory, notifications and profile

- `/api/v1/users/me`, `/api/v1/users/dashboard`
- `/api/v1/devices`
- `/api/v1/memory`
- `/api/v1/notifications`
- `/api/v1/trusted-contacts`

All are authenticated and ownership-scoped. Device/contact update fields use allowlists so clients cannot overwrite ownership fields.

## World Chat

`/api/v1/chat` provides room discovery/creation, paginated message history, own-message edit/delete, emoji reactions, reports and blocking. Socket.IO supplies live messages, typing, presence and unread events. Nearby rooms use a coarse client-generated cell instead of exposing exact GPS.

## SOS and admin

- `POST /api/v1/sos` — authenticated journey SOS to opted-in trusted contacts via the Brevo email architecture; no police/ambulance integration is claimed.
- `/api/v1/admin` — ADMIN-only overview, users, devices, hazard verification, chat moderation, system health and audit logs.

## Simulation

`POST /api/v1/simulation/step` performs a classroom-safe synthetic perception step, invokes the same AI-risk interface/fallback contract, records simulated hazards/decision events and can trigger adaptive reroute behavior. The UI visibly displays **SIMULATION MODE**.

## FastAPI AI service

Separate service, normally port 8000:

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | AI health |
| GET | `/model/info` | Detector functional/integrity state plus SNN mode/version/validation state |
| POST | `/api/v1/detect` | Image detection metadata (`objectClass`, `confidence`, boxes, detector mode) |
| POST | `/api/v1/risk/predict` | Single SNN/fallback risk prediction |
| POST | `/api/v1/risk/batch` | Batch risk prediction |

Detector responses expose `functional`, `integrityReady` and `trainedWeightsActive`. The legacy detector `validated` field remains false because independent detector scientific validation is outside the current project scope. If `detector.pt` is missing or cannot pass normal integrity/load checks, the detector uses its documented development fallback instead of breaking the API.

SNN responses continue to identify validated vs development/fallback mode through the separate SNN evidence guard.

## Socket.IO room model

Authenticated sockets may join authorized `user:{userId}`, `journey:{journeyId}`, `device:{deviceId}`, `route:{routeId}`, `chat:{roomId}` and `admin` rooms. WebRTC signaling is additionally journey-scoped. Live journey position, hazard, SNN, route, device and notification events stay in private/authorized rooms; exact GPS is not globally broadcast.
