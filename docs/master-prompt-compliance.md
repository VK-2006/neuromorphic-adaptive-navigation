# Final Master-Prompt Compliance Cross-Check

The repository is checked against the locked NAVORA product requirements rather than a reduced CRUD interpretation.

## Connected application chain

`Authentication → source/destination → road candidates → traffic → verified/community/camera hazard evidence → objectClass + confidence → SNN risk → CRM/DTW/EMA → ACO → explainable adaptive route → journey → live GPS + optional camera → geofence/risk re-evaluation → reroute → completion → CRM/EMA update → replay.`

## Final compliance hardening included

- All 28 frontend pages are included in the master cross-check.
- Bootstrap 5, GSAP, AOS and Lottie are integrated while the custom NAVORA design system remains the visual authority.
- Hazard deduplication uses type + geographic proximity + time window + journey + detection similarity.
- QA scripts are repository-relative and have no hardcoded `/mnt/data` or BeautifulSoup dependency.
- Detector functionality and SNN scientific validation are separate concerns. Detector runtime uses functional artifact/integrity readiness; SNN validation retains its evidence-bound scientific gate.
- Detector training/evaluation utilities remain for normal development/debugging and never create a safety-certification claim.
- Historical update/backup files and generated QA screenshots are excluded from final source and ignored going forward.
- `prepush_audit.py` checks Git-tracked secrets, ignored runtime env files, backup/generated artifacts and package-lock consistency.
- GitHub Actions CI runs source contracts, backend Jest/audit, Mongo-backed runtime E2E and lightweight AI fallback/API tests after push.

## Detector scope boundary

The object-detection module is retained as a functional perception component developed using the project’s BDD100K detector workflow. Independent cross-dataset detector scientific validation is outside the current project scope and may be considered future work.

Current completion therefore requires the detector module, taxonomy, camera/perception integration, detection API, `objectClass`/`confidence` risk inputs, runtime loading/error handling and normal integrity/readiness checks. It does **not** require a new external detector holdout or a cross-dataset detector scientific claim.

## Safeguards

- No real secrets are committed; only `.env.example` templates belong in source.
- OTPs, reset grants and refresh tokens are hashed at rest.
- Camera processing is explicit opt-in; raw camera footage is not permanently stored by default.
- Bluetooth is used for appropriate GATT control/sensor metadata, not falsely treated as normal high-quality video transport.
- Simulation/mock traffic and routing remain visibly labelled.
- Exact private GPS is not globally broadcast.
- Single-state GPS/camera/Socket/Three.js lifecycle avoids duplicate watchers/streams/listeners/RAF loops.
- Familiarity is not equated with safety.
- Detector output is documented as functional perception, not independently validated or safety-certified perception.
- SNN trained inference remains governed by its independent evidence-bound scientific-validation policy and V32 research lock.

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

The remaining non-code gates are real production credentials, SNN scientific evidence where applicable, and physical browser/device permission testing. Detector cross-dataset scientific validation is not a current NAVORA completion gate.
