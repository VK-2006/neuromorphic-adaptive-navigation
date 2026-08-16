# NAVORA Model Validation Scope

NAVORA keeps **SNN/risk scientific validation** and **detector functional readiness** as separate concerns.

## SNN scientific validation

The SNN/risk model remains subject to the existing scientific-validation workflow, including leakage-safe data handling, held-out evaluation, class-aware gates, cryptographic evidence, the immutable Phase-4/2025 consumption record, and the V32 research-only lock. None of that work is removed or weakened by this scope change.

The locked 2025 one-time external SNN evaluation remains recorded in `docs/snn-phase4-2025-external-validation.md`. Its HIER_B candidate failed the final production gate and remains permanently `RESEARCH_ONLY / NOT_PRODUCTION_VALIDATED`. The consumed 2025 final set must not be reused for development decisions.

## Detector functional scope

The object-detection module is retained as a functional perception component developed using the project's BDD100K/RDD2022 detector workflow. Independent cross-dataset detector scientific validation is outside the current project scope and may be considered future work.

The detector module remains fully implemented:

- `ai-service/trained_models/detector.pt` is the normal local runtime artifact path.
- BDD100K detector classes such as `person`, `bicycle`, `motorcycle`, `car`, `bus`, and `truck` remain supported.
- RDD2022-derived `road damage` and `pothole` support remains available when those classes are trained.
- `app/detector_taxonomy.py`, `scripts/prepare_detection_data.py`, `scripts/train_detector.py`, and `scripts/evaluate_detector.py` remain available for normal development, diagnostics, and internal evaluation.
- `/api/v1/detect` remains the detector API.
- Runtime loading keeps artifact existence, SHA-256 when declared in metadata, class metadata, TorchScript loading, confidence thresholding, inference error handling, and deterministic fallback behavior.

Detector runtime readiness is **not** an independent scientific-validation claim. The service deliberately reports `validated=false` for the detector while also reporting functional `runtimeReady` status.

## Runtime pipeline

The supported project flow remains:

`Camera → Object Detector → objectClass + confidence → NAVORA runtime risk features → SNN / risk processing → ACO + Cognitive Route Memory → safest-route recommendation`

Detector scientific validation is not a completion gate for the current NAVORA project. The SNN/risk scientific-validation state remains authoritative for claims about scientifically validated risk inference.

## Claims boundary

NAVORA does not claim an independently validated detector, a safety-certified detector, cross-dataset validated perception, or an externally validated detector. BDD100K/RDD2022 training and evaluation utilities are retained without turning their results into those claims.
