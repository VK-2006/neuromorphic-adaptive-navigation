# Master Feature Matrix

Status meanings: **IMPLEMENTED** = source path is present and connected; **VERIFIED** = exercised by available automated/static/runtime tests in this environment; **CREDENTIAL/ENV** = implementation exists but external credentials, packages, browser hardware or services are required for live verification.

| Area | Status | Connected implementation |
|---|---|---|
| Premium frontend + light/dark/system | IMPLEMENTED / VERIFIED static | Shared design tokens, responsive layouts, theme persistence, reduced motion |
| Leaflet + OpenStreetMap navigation | IMPLEMENTED / VERIFIED static | Place autocomplete/reverse geocode, draggable/click markers, multiple road routes, route cards, hazards |
| Routing providers | IMPLEMENTED | OSRM + GraphHopper + Valhalla + labelled mock abstraction |
| Traffic | IMPLEMENTED | TomTom flow adapter; FREE_FLOW→SEVERE/UNKNOWN; labelled simulation/degraded mode |
| Live GPS + map matching | IMPLEMENTED / VERIFIED algorithms | Single `watchPosition`, segment projection, covered/remaining/progress/ETA |
| Route deviation | IMPLEMENTED / VERIFIED static | Distance + accuracy + heading + speed + time-outside corridor |
| Journey lifecycle | IMPLEMENTED | Plan/start/pause/resume/reroute/complete + CRM update |
| Camera privacy | IMPLEMENTED / VERIFIED static | Explicit Detection OFF default; no inference/hazard creation while off; no MediaRecorder storage |
| Object / road-damage detection | IMPLEMENTED / DATASET GATE | BDD100K/RDD2022 prep/train/evaluate path; independent detectorValidated gate; explicit OpenCV fallback |
| SNN | IMPLEMENTED / AI tests VERIFIED fallback / DATASET GATE | snnTorch LIF, temporal encoding, spike/membrane decode, train/evaluate path, independent riskValidated gate |
| CRM + DTW + EMA | IMPLEMENTED / VERIFIED algorithms | Completed journeys update memory; future route scoring uses history and route similarity |
| ACO | IMPLEMENTED / VERIFIED algorithms | Multi-ant exploration, pheromone/deposit/evaporation/iterations, route-specific utility |
| Explainable AI | IMPLEMENTED / VERIFIED algorithms | Real SNN/hazard/traffic/DTW/EMA/history/preference/ACO metrics and reasons |
| Community hazards | IMPLEMENTED / VERIFIED CONTRACTS | Type + geographic proximity + time window + journey + detection similarity dedup, reporter reputation, 500 m confirmation, admin verify/reject |
| Smart geofencing | IMPLEMENTED / VERIFIED algorithms | Route corridor + direction/heading + distance ahead + risk |
| Dynamic rerouting | IMPLEMENTED | Critical obstacle/blockage/severe traffic/deviation/safety drop/better alternative + cooldown + comparison |
| Turn-by-turn + voice | IMPLEMENTED | Provider steps, next maneuver, Web Speech language/volume/voice selection + duplicate suppression |
| SOS + trusted sharing | IMPLEMENTED | Confirmed SOS, authorized contacts, Brevo email architecture, expiring/revocable journey share token |
| World Chat | IMPLEMENTED | Global/nearby/region/route/journey, history/pagination, typing, presence, reactions, replies, edit/delete, block/report/moderation |
| Journey replay / digital twin | IMPLEMENTED | Original/current/reroute traces, GPS, hazards, SNN, traffic/ACO/XAI/CRM decision events, speed controls |
| Simulation mode | IMPLEMENTED | GPS + traffic + detection + SNN/fallback + hazard + rerouting + completion, visibly labelled |
| PWA | IMPLEMENTED / VERIFIED static | Manifest/icons, service worker, offline UI, last/recent routes/settings without stale live claims |
| Three.js | IMPLEMENTED / VERIFIED static | Landing route network and research SNN/ACO/CRM scenes, single RAF/state, disposal/adaptive quality |
| Email/password auth | IMPLEMENTED | bcrypt, JWT access, rotating hashed refresh, session revocation |
| Google auth | IMPLEMENTED / CREDENTIAL | Google Identity Services frontend → backend verified ID token; credentials required |
| Brevo OTP/reset | IMPLEMENTED / CREDENTIAL | Hashed/expiring/attempt-limited OTP + cooldown; Brevo transactional email; credentials required |
| Passkeys | IMPLEMENTED / ENV | SimpleWebAuthn + browser credentials; secure-context/browser support required |
| MongoDB models | IMPLEMENTED | All 19 active prompt models with ownership/index/TTL/geospatial rules where applicable; device-controller persistence was removed |
| Socket.IO | IMPLEMENTED | Authenticated rooms, ownership checks, journey/GPS/hazard/SNN/route/chat/notification events |
| Admin | IMPLEMENTED | Dashboard, users/RBAC, hazard verification, chat moderation, health, audit |
| Security | IMPLEMENTED / VERIFIED static | Helmet/CORS/rate limits/validation/RBAC/ownership, no committed real secrets, private-location rules |
| Tests | GENERATED / VERIFIED LOCALLY | Windows Jest 9/9 suites, 25/25 tests; AI Pytest 6/6; static/algorithm/compliance suites; consolidated runtime E2E + CI included |
| Docker | GENERATED / ENV | Compose + backend/AI Dockerfiles; Docker daemon unavailable in sandbox |
| Render readiness | SOURCE READY | Exact PORT/start contract; pre-push audit verifies the preserved checked-in `backend/package-lock.json` matches direct dependency specs |
