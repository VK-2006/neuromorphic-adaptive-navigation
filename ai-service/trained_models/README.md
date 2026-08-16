# Trained model artifacts

Generated locally, not committed by default:

- `risk_snn.pt` — snnTorch risk-model state dict.
- `detector.pt` — TorchScript Faster R-CNN detector weights.
- `metadata.json` — model versions, detector class/source/training-manifest fingerprints, and per-model evaluation flags.
- `data-gate-report.json` — dataset size, source/class coverage, leakage and SHA-256 gate.
- `snn-evaluation.json` / `detector-evaluation.json` — held-out evaluation reports.
- `validation-evidence.json` — evidence binding datasets, reports, metadata and exact weight hashes.

Training always leaves validation false. Evaluation may set the per-model flags only when the built-in policy floors are not weakened and the exact held-out file matches the passing data gate. Global `validated` becomes true only when both model flags are true.

Even then, live service startup does **not** trust the flags alone. The V28+ guard re-checks the passing data gate, policy floors, evaluation eligibility, report/dataset fingerprints, evidence schema and exact `.pt` SHA-256. V29 also binds detector class order, training sources and the exact training-manifest SHA-256 to the data gate before exposing `validated: true`.

V29 can train a dynamic detector head from:

- BDD100K: `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, `barrier`.
- RDD2022: `road damage`, `pothole`.

COCO-overlap classes may receive pretrained head rows. Road-specific classes such as `road damage` and `pothole` start fresh and require real RDD2022 training. Supporting those classes in code does not mean a validated pothole model is already bundled.

Without a complete evidence chain the service explicitly reports research/development fallback or unvalidated trained mode and does not present the output as validated safety AI.
