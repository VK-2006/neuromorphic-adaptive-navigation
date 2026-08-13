# Master Prompt Compliance Cross-Check

The repository is built against the locked master prompt, not a reduced CRUD interpretation. `scripts/master_prompt_crosscheck.py` verifies the prompt's required page/model inventory plus representative code contracts for routing providers, traffic labels, map autocomplete, GPS/camera privacy, SNN/CRM/DTW/EMA/ACO/XAI, private Socket.IO rooms, authentication, PWA, Three.js lifecycle, blank secrets, dataset fields and Render configuration.

## Application chain

`User authentication → source/destination autocomplete → road candidate routes → traffic → community/camera/SNN hazard exposure → CRM/DTW/EMA → ACO → explainable adaptive recommendation → journey → GPS + optional camera → detection/SNN → geofence/risk re-evaluation → user-confirmed reroute → completion → CRM/EMA → replay.`

The backend remains the main orchestrator; the FastAPI service is a separate perception/risk service.

## Non-negotiable safeguards implemented

- No real secret values are committed; only `.env.example` files exist.
- OTPs and refresh/reset grants are hashed at rest.
- Camera detection is opt-in and off by default; raw camera footage is not permanently stored by the application.
- Bluetooth is not treated as a high-quality video transport; WebRTC/MediaDevices are used for video.
- Simulation/mock traffic and routing are explicitly labelled and are not represented as live provider data.
- Exact private GPS is not broadcast to global chat.
- GPS, camera, Socket.IO and Three.js lifecycle code prevents duplicate watchers/streams/loops/listeners through single-state cleanup patterns.
- SNN/detector fallback outputs explicitly report development/unvalidated mode when trained weights are absent.
- Familiarity alone never equals safety; safety, traffic, hazards, history and preferences remain independent scoring inputs.
- Rerouting has cooldown and displays current-vs-alternative comparison before switching.
- No Git push, cloud deployment, production Atlas setup or real credential configuration is performed.

## Validation boundary

Source-level master-prompt coverage can be cross-checked locally with:

```bash
python scripts/master_prompt_crosscheck.py
node scripts/check-backend.js
python tests/frontend_contracts.py
node tests/pure-smoke.js
python tests/static_assets.py
python scripts/repository_crosscheck.py
python -m pytest ai-service/tests -q
```

Full Node/Jest/Mongo/Docker/browser-device live testing still depends on locally installed npm packages, MongoDB/Docker and browser hardware/permissions. Google, Brevo and live traffic verification additionally require user-supplied credentials. Those environment dependencies are not treated as permission to fake a PASS.
