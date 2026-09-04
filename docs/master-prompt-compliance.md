# Final Master-Prompt Compliance Cross-Check

The repository is checked against the locked Navora master prompt rather than a reduced CRUD interpretation.

## Connected application chain

`Authentication → source/destination → road candidates → traffic → verified/community/camera hazard evidence → SNN risk → CRM/DTW/EMA → ACO → explainable adaptive route → journey → live GPS + optional camera → geofence/risk re-evaluation → reroute → completion → CRM/EMA update → replay.`

## Final compliance hardening included

- All 28 frontend pages are included in the master cross-check.
- Bootstrap 5, GSAP, AOS and Lottie are actually integrated while the custom Navora design system remains the visual authority.
- Hazard deduplication uses type + geographic proximity + time window + journey + detection similarity.
- QA scripts are repository-relative and have no hardcoded `/mnt/data` or BeautifulSoup dependency.
- Detector and SNN validation are independent; one model cannot accidentally validate the other.
- Training scripts never mark a model validated. Held-out evaluation scripts own validation decisions.
- Historical update/backup files and generated QA screenshots are excluded from final source and ignored going forward.
- `prepush_audit.py` checks Git-tracked secrets, ignored runtime env files, backup/generated artifacts and package-lock consistency.
- GitHub Actions CI runs source contracts, backend Jest/audit, Mongo-backed runtime E2E and lightweight AI fallback/API tests after push.

## Safeguards

- No real secrets are committed; only `.env.example` templates belong in source.
- OTPs, reset grants and refresh tokens are hashed at rest.
- Camera processing is explicit opt-in; raw camera footage is not permanently stored by default.
- Camera and WebRTC flows are explicitly treated as separate from route telemetry; no device-controller assumptions are used for core navigation.
- Simulation/mock traffic and routing remain visibly labelled.
- Exact private GPS is not globally broadcast.
- Single-state GPS/camera/Socket/Three.js lifecycle avoids duplicate watchers/streams/listeners/RAF loops.
- Familiarity is not equated with safety.
- Unvalidated detector/SNN output is research-only when live safety validation is required.

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

The remaining non-code gates are real production credentials, real held-out model evaluation and physical browser/device permission testing. They are intentionally not replaced with fabricated PASS claims.
