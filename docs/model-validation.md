# NAVORA Model Validation and Functional Detector Scope

NAVORA separates **detector functional readiness** from **SNN scientific validation**. The detector remains an operational perception component; the SNN risk model retains its separately governed scientific-validation controls.

## Functional detector contract

The object-detection module is retained as a functional perception component developed using the project’s BDD100K detector workflow. Independent cross-dataset detector scientific validation is outside the current project scope and may be considered future work.

Current detector requirements are functional engineering requirements, not a new scientific holdout gate:

1. Keep the `ai-service/trained_models/detector.pt` runtime path and BDD100K-based training workflow.
2. Keep detector taxonomy and class order, including `person`, `bicycle`, `motorcycle`, `car`, `bus` and `truck`; optional RDD2022 road-damage classes remain supported by the development tooling.
3. Keep artifact existence, non-empty/hash integrity checks when metadata provides an expected artifact hash, TorchScript loadability checks, inference error handling and development fallback behavior.
4. Keep normal detector confidence thresholds and `/api/v1/detect` behavior.
5. Keep camera/local/cloud perception paths producing `objectClass` + `confidence` for NAVORA runtime risk features.
6. Keep `scripts/prepare_detection_data.py`, `scripts/split_detection_manifest.py`, `scripts/train_detector.py` and `scripts/evaluate_detector.py` available for normal development, debugging, regression measurement and reproducibility.
7. Treat internal detector evaluation metrics as diagnostics only. They are not a safety certification, official upstream benchmark or current project-completion prerequisite.

The detector API deliberately reports functional/integrity state separately from the legacy `validated` field. The legacy detector scientific-validation flag remains false so the project cannot accidentally claim an independently validated, safety-certified, cross-dataset validated or externally validated detector.

## SNN scientific-validation chain

Detector scope simplification does **not** weaken or replace SNN scientific validation. The SNN path retains its held-out-data, class-aware, exact-hash and research-lock controls.

1. Prepare the separately governed real SNN risk data under the applicable data policy.
2. Run the SNN data-quality/leakage checks and keep train/evaluation fingerprints stable.
3. Train with `scripts/train_snn.py`. Training alone never establishes scientific validation.
4. Evaluate with `scripts/evaluate_snn.py` on a fresh held-out SNN split. Configured thresholds cannot weaken the built-in policy floors.
5. Every SNN risk class must meet the class-aware policy, with the stronger recall requirement for `HIGH`/`CRITICAL` retained.
6. `riskValidated` remains evidence-bound to the exact held-out SNN CSV, SNN evaluation report, metadata and `risk_snn.pt` SHA-256.
7. `app/model_validation.py` continues to reject stale/tampered SNN evidence and retains the V32 research lock.
8. Normal `/api/v1/risk/*` trained inference remains validated-only; otherwise the deterministic development fallback is used.

Legacy combined detector+SNN evidence tooling may remain in the repository for reproducibility of older development runs, but detector evidence is no longer a runtime or current project-completion prerequisite. Runtime SNN validation evaluates the SNN-specific evidence bindings and does not require detector scientific-validation success.

## Phase-4 SNN research disposition

The locked 2025 one-time external SNN evaluation is recorded in `docs/snn-phase4-2025-external-validation.md`. Its HIER_B candidate failed the final production gate and is permanently `RESEARCH_ONLY / NOT_PRODUCTION_VALIDATED`. The consumed 2025 final set must not be reused for development decisions. Any future SNN production-validation claim requires a newly frozen candidate and a new independently reserved untouched final set.

## Detector development details

The retained Faster R-CNN trainer supports a dynamic class head built from the real classes present in the training manifest. Supported source/class pairs are:

- **BDD100K:** `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, `barrier`.
- **RDD2022:** `road damage`, `pothole`.

COCO-overlap classes reuse their pretrained Faster R-CNN classifier/regressor rows. NAVORA-specific road classes such as `road damage` and `pothole` use freshly initialized head rows and therefore require real RDD2022 samples if those classes are trained.

The deterministic split produced by `split_detection_manifest.py` is an internal development/evaluation split, not an official BDD100K or RDD2022 benchmark result. The OpenCV fallback remains a development fallback. Neither the fallback nor internal detector metrics should be described as detector scientific certification.

## End-to-end retained flow

`Camera → Object Detector → objectClass + confidence → NAVORA runtime risk features → SNN / risk processing → ACO + Cognitive Route Memory → safest-route recommendation`

This flow remains part of NAVORA even though independent detector scientific validation is outside current scope.
