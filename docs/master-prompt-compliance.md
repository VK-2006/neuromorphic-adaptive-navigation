# Final Master-Prompt Compliance Cross-Check

The repository is checked against the locked Navora master prompt rather than a reduced CRUD interpretation.

## Connected application chain

`Authentication → source/destination → road candidates → traffic → verified/community/camera hazard evidence → SNN risk → CRM/DTW/EMA → ACO → explainable adaptive route → journey → live GPS + optional camera → geofence/risk re-evaluation → reroute → completion → CRM/EMA update → replay.`

## Final compliance hardening included

- All 28 frontend pages are included in the master cross-check.
- Bootstrap 5, GSAP, AOS and Lottie are actually integrated while the custom Navora design system remains the visual authority.
- Hazard deduplication uses type + geographic proximity + time window + journey + detection similarity.
- QA scripts are repository-relative and have no hardcoded `/mnt/data` or BeautifulSoup dependency.
- The detector remains a functional BDD100K/RDD2022 perception module with runtime artifact/readiness checks, taxonomy, API, confidence filtering and fallback/error handling.
- Independent cross-dataset detector scientific validation is outside the current project scope and is not a completion gate.
- SNN scientific validation remains fully in scope; its held-out evidence, research-only lock and consumed 2025 holdout record are unchanged.
- Historical update/backup files and generated QA screenshots are excluded from final source and ignored going forward.
- `prepush_audit.py` checks Git-tracked secrets, ignored runtime env files, backup/generated artifacts and package-lock consistency.
- GitHub Actions CI runs source contracts, backend Jest/audit, Mongo-backed runtime E2E and lightweight AI fallback/API tests after push.

## Safeguards

- No real secrets are committed; only `.env.example` templates belong in source.
- OTPs, reset grants and refresh tokens are hashed at rest.
- Camera processing is explicit opt-in; raw camera footage is not permanently stored by default.
- Bluetooth is used for appropriate GATT control/sensor metadata, not falsely treated as normal high-quality video transport.
- Simulation/mock traffic and routing remain visibly labelled.
- Exact private GPS is not globally broadcast.
- Single-state GPS/camera/Socket/Three.js lifecycle avoids duplicate watchers/streams/listeners/RAF loops.
- Familiarity is not equated with safety.
- Detector output is presented as functional perception, never as independently validated or safety-certified perception.
- Unvalidated SNN output remains research-only when live safety validation is required.

## Verification commands

Normal consolidated check:

```bash
python scripts/final_verify.py
```

Full local Mongo-backed runtime check:

```bash
python scripts/final_verify.py --runtime
```

Pre-push Git audit:

```bash
python scripts/prepush_audit.py
```

The remaining non-code gates include real production credentials, SNN scientific-validation status and physical browser/device permission testing. A new external detector-validation dataset is not required for current NAVORA completion.
