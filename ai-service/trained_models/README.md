# Trained model artifacts

Generated locally, not committed by default:

- `risk_snn.pt` — snnTorch risk-model state dict.
- `detector.pt` — TorchScript Faster R-CNN detector weights.
- `metadata.json` — model versions and per-model evaluation flags.
- `data-gate-report.json` — dataset size, coverage, leakage and SHA-256 gate.
- `snn-evaluation.json` / `detector-evaluation.json` — held-out evaluation reports.
- `validation-evidence.json` — V28 evidence binding datasets, reports, metadata and exact weight hashes.

Training always leaves validation false. Evaluation may set the per-model flags only when the built-in policy floors are not weakened and the exact held-out file matches the passing data gate. Global `validated` becomes true only when both model flags are true.

Even then, live service startup does **not** trust the flags alone. V28 re-checks the passing data gate, policy floors, evaluation eligibility, report/dataset fingerprints, evidence schema and exact `.pt` SHA-256 before exposing `validated: true`.

Current validatable detector scope is the six BDD100K road-actor classes: `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`. Pothole/road-damage preparation exists but is not yet part of the validated detector trainer.

Without a complete V28 evidence chain the service explicitly reports research/development fallback or unvalidated trained mode and does not present the output as validated safety AI.
