# Trained model artifacts

Generated locally, not committed by default:

- `risk_snn.pt` — snnTorch risk-model state dict.
- `detector.pt` — TorchScript Faster R-CNN detector weights.
- `metadata.json` — model versions, detector class/source/training-manifest fingerprints, detector artifact SHA-256/readiness state, and SNN validation metadata.
- `data-gate-report.json` — retained SNN/data-development gate evidence where applicable.
- `snn-evaluation.json` — SNN held-out evaluation report.
- `validation-evidence.json` — retained SNN scientific-validation evidence.
- `detector-evaluation.json` — optional internal detector diagnostic output when `evaluate_detector.py` is used during development/debugging.

## Detector artifact scope

`detector.pt` is retained as a functional project artifact. Runtime startup checks that the file exists, is non-empty, matches `detectorSha256` when that fingerprint is declared, has usable detector-class metadata, and can be loaded as TorchScript. Runtime inference still applies the detector confidence threshold and preserves error/fallback behavior.

The supported detector workflow includes BDD100K classes `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, and `barrier`, with optional RDD2022 `road damage` and `pothole` classes when those sources are trained.

The object-detection module is a functional perception component. Independent cross-dataset detector scientific validation is outside the current project scope and may be considered future work. No independently validated, safety-certified, cross-dataset validated or externally validated detector claim is made.

## SNN scientific validation

SNN/risk scientific validation remains unchanged. Live validated SNN inference still requires the existing held-out evidence, class-aware policy, exact dataset/report/weight bindings, and the immutable research-only protections for failed final candidates. The consumed 2025 SNN holdout evidence remains untouched.
