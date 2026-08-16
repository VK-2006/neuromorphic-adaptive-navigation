# Detector + SNN Validation Workflow

Navora separates **training**, **evaluation**, and **live safety eligibility**. A metadata boolean is never enough to make a live model validated.

## V28 validation chain

1. Prepare real upstream data under its license.
2. Create separate training and genuinely held-out evaluation splits.
3. Run `scripts/model_data_gate.py`. It blocks too-small datasets, malformed images/boxes, non-normalized SNN rows, duplicate detector images, train/evaluation leakage, weak held-out class coverage, and any attempt to weaken the built-in validation policy floors.
4. Train with `scripts/train_detector.py` and `scripts/train_snn.py`. Training always leaves live validation false.
5. Evaluate with `scripts/evaluate_detector.py` and `scripts/evaluate_snn.py` using only the held-out splits. The evaluators publish global plus per-class diagnostics and refuse safety validation when configured thresholds are weaker than policy.
6. `--mark-validation` is bound to the passing data gate: the exact held-out manifest/CSV SHA-256 must match the gated evaluation split. A different or modified file cannot be marked validated.
7. Run `scripts/validation_evidence.py` immediately after both evaluations. V28 evidence binds the exact training/evaluation dataset fingerprints, data-gate report, detector evaluation report, SNN evaluation report, metadata, and both weight files with SHA-256.
8. Run `scripts/model_readiness.py`. `validated=true` is accepted only when both live model guards independently reproduce the complete V28 evidence chain.
9. Run `scripts/model_artifact_bundle.py` to create a local validated model ZIP under `model-artifacts/`.
10. At service startup, `app/model_validation.py` re-checks the same policy/report/dataset/weight bindings. Any stale or tampered report, metadata file, evidence file, or `.pt` weight immediately downgrades the model to unvalidated mode.

## Current detector scope

The current trainable/validatable Faster R-CNN pipeline (`scripts/train_detector.py`) is intentionally limited to the six BDD100K road-actor classes:

`person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`.

`prepare_detection_data.py` can also normalize RDD2022 road-damage/pothole annotations and extra BDD labels, but those classes are **not yet part of the current validated V4 detector trainer**. The OpenCV road-damage heuristic remains development-only and must not be described as validated pothole AI.

The model ZIP, `.pt` weights, generated metadata, reports and evidence are local artifacts and must not be committed to Git. Demo fixtures in this repository remain insufficient for real-world validation.
