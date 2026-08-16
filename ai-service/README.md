# NAVORA AI Service

Separate FastAPI service for camera detections and SNN risk inference.

## Runtime

```bash
python -m uvicorn app.main:app --reload --port 8000
```

## Detector functional scope

The object-detection module is retained as a functional perception component developed using the project’s BDD100K detector workflow. Independent cross-dataset detector scientific validation is outside the current project scope and may be considered future work.

The service keeps:

- `trained_models/detector.pt` runtime loading;
- BDD100K detector classes such as `person`, `bicycle`, `motorcycle`, `car`, `bus` and `truck`;
- optional RDD2022 development support for `road damage` and `pothole`;
- detector taxonomy/class-order metadata;
- normal artifact existence/non-empty/hash checks when an expected artifact hash is present;
- TorchScript loadability and runtime error handling;
- the normal detector confidence threshold;
- OpenCV development fallback when trained weights are missing/unloadable;
- `/api/v1/detect` and `objectClass` + `confidence` outputs consumed by the NAVORA risk pipeline.

`/model/info` reports detector `functional`, `integrityReady` and `trainedWeightsActive` separately. The legacy detector `validated` field remains false so the service cannot accidentally claim independent scientific certification.

## Detector training / development evaluation

Create a unified local manifest from licensed BDD100K and/or RDD2022 files, then optionally create an internal leakage-aware development split:

```bash
python scripts/prepare_detection_data.py --bdd-labels <bdd-labels.json> --bdd-images <bdd-images-dir> --rdd-root <rdd-root> --out datasets/derived-risk-data/detection-manifest.jsonl
python scripts/split_detection_manifest.py --manifest datasets/derived-risk-data/detection-manifest.jsonl
```

Supported source/class pairs:

- BDD100K: `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, `barrier`.
- RDD2022: `road damage`, `pothole`.

The Faster R-CNN head is created dynamically from classes actually present in the training manifest. COCO-overlap classes reuse pretrained head rows; optional `road damage` and `pothole` rows are fresh and need real RDD2022 samples when those classes are trained.

Normal development commands remain available:

```bash
python scripts/train_detector.py --manifest datasets/derived-risk-data/detection-train.jsonl
python scripts/evaluate_detector.py --manifest datasets/derived-risk-data/detection-eval.jsonl
```

Detector evaluation is an internal development/debug diagnostic. It is not an official BDD100K/RDD2022 benchmark, safety certification or current project-completion gate.

## SNN scientific validation

The detector scope change does not modify SNN scientific-validation work. A trained SNN is served through normal risk prediction only when the existing SNN validation guard passes its held-out data, policy floors, class-aware metrics, exact dataset/report/metadata/weight bindings and V32 research lock.

If that SNN evidence is missing, stale, tampered or research-locked, the service reports an unvalidated SNN mode and uses the deterministic development fallback. `/model/info` exposes SNN `validationIssues` for this purpose.

The locked 2025 SNN final-evaluation disposition remains governed by `docs/snn-phase4-2025-external-validation.md` and is not changed by detector simplification.

## Retained end-to-end flow

`Camera → Object Detector → objectClass + confidence → NAVORA runtime risk features → SNN / risk processing → ACO + Cognitive Route Memory → safest-route recommendation`

No independently validated detector, safety-certified detector, cross-dataset validated perception or externally validated detector claim is made.
