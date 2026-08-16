# Detector + SNN Validation Workflow

Navora separates **training**, **evaluation**, and **live safety eligibility**. A metadata boolean is never enough to make a live model validated.

## V30 validation chain

1. Prepare real upstream data under each dataset's license.
2. For detector data, `prepare_detection_data.py` can create a unified BDD100K/RDD2022 manifest. `split_detection_manifest.py` can then create a deterministic source-aware internal train/evaluation split with zero shared image rows and minimum held-out class coverage.
3. Run `scripts/model_data_gate.py`. It blocks too-small datasets, malformed images/boxes, invalid source/class pairs, duplicate detector images, train/evaluation leakage, evaluation-only detector classes/sources, trained sources missing from held-out data, weak held-out class coverage, non-normalized SNN rows, and any attempt to weaken the built-in validation policy floors.
4. Train with `scripts/train_detector.py` and `scripts/train_snn.py`. Training always leaves live validation false. Detector training stores the exact training-manifest SHA-256 in metadata.
5. Evaluate with `scripts/evaluate_detector.py` and `scripts/evaluate_snn.py` using only the held-out splits. The evaluators publish global plus per-class diagnostics and refuse safety validation when configured thresholds are weaker than policy.
6. **V30 class-aware gate:** aggregate accuracy/F1 is not enough. Every trained detector class must meet minimum held-out precision, recall and F1, including `pothole`/`road damage`. Every SNN risk class must meet minimum F1, and `HIGH`/`CRITICAL` must also meet a stronger recall floor. This prevents common/easy classes from hiding a failed safety-critical class.
7. `--mark-validation` is bound to the passing data gate: the exact held-out manifest/CSV SHA-256 must match the gated evaluation split. A different or modified file cannot be marked validated.
8. Run `scripts/validation_evidence.py` immediately after both evaluations. V30 evidence schema 3 binds the exact training/evaluation dataset fingerprints, data-gate report, detector evaluation report, SNN evaluation report, per-class metrics/policy results, metadata, and both weight files with SHA-256.
9. Run `scripts/model_readiness.py`. `validated=true` is accepted only when both live model guards independently reproduce the complete V30 evidence chain.
10. Run `scripts/model_artifact_bundle.py` to create a local validated model ZIP under `model-artifacts/`.
11. At service startup, `app/model_validation.py` re-checks policy/report/dataset/weight bindings and the V30 per-class gates. Detector startup also verifies that metadata class order, training sources and training-manifest SHA-256 match the V29+ data gate. Any stale or tampered component immediately downgrades the model to unvalidated mode.

## Detector scope

The V29+ Faster R-CNN trainer supports a dynamic class head built from the real classes present in the training manifest. Supported source/class pairs are:

- **BDD100K:** `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, `barrier`.
- **RDD2022:** `road damage`, `pothole`.

COCO-overlap classes reuse their pretrained Faster R-CNN classifier/regressor rows. Navora-specific road classes such as `road damage` and `pothole` use freshly initialized head rows and therefore become meaningful only after real RDD2022 training.

This support does **not** mean the repository already contains a validated pothole model. The upstream datasets and generated weights are intentionally not committed. A real detector remains unvalidated until the local training data, held-out data, class-level metrics, evidence and exact weights all pass the complete gate. The OpenCV road-damage heuristic remains development-only and must not be described as validated pothole AI.

The deterministic split produced by `split_detection_manifest.py` is an internal development/validation split, not an official BDD100K or RDD2022 benchmark result.
