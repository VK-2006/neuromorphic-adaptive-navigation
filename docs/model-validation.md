# Detector + SNN Validation Workflow

Navora separates **training**, **evaluation**, and **live safety eligibility**.

1. Prepare real upstream data under its license.
2. Create separate training and genuinely held-out evaluation splits.
3. Run `scripts/model_data_gate.py`. It blocks too-small datasets, malformed images/boxes, non-normalized SNN rows, duplicate detector images, train/evaluation leakage, and weak held-out class coverage.
4. Train with `scripts/train_detector.py` and `scripts/train_snn.py`. Training still leaves validation false.
5. Evaluate with `scripts/evaluate_detector.py` and `scripts/evaluate_snn.py` using only the held-out splits.
6. Only use `--mark-validation` after the V12 data gate passes.
7. Run `scripts/validation_evidence.py` immediately after both evaluations. It binds the passing evaluation state to SHA-256 fingerprints of the exact datasets and model weight files.
8. Run `scripts/model_readiness.py`. `validated=true` now also requires passing validation evidence whose weight hashes match the current `.pt` files.
9. Run `scripts/model_artifact_bundle.py` to create a local validated model ZIP under `model-artifacts/`.

The model ZIP, `.pt` weights, generated metadata, reports and evidence are local artifacts and must not be committed to Git. The demo fixtures in this repository remain insufficient for real-world validation.
