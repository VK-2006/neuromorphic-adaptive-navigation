# Datasets

This repository does **not** redistribute large upstream datasets or present demo fixtures as measured real-world data.

- **BDD100K**: primary road-scene/object-detection source for `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, and `barrier` after NAVORA normalization.
- **RDD2022**: optional road-damage source normalized to `road damage` and `pothole` from potholes, longitudinal cracks, transverse cracks and alligator cracks.
- **OpenStreetMap**: geographic/road-network data; it is **not** an ML training dataset.
- **Custom SNN Risk data**: `demo-data/snn-risk-raw.csv` demonstrates the fields `objectClass`, `confidence`, `estimatedDistance`, `relativeSpeed`, `userSpeed`, `objectPersistence`, `trafficDensity`, `hazardFrequency`, `visibility`, `weatherRisk`, `roadCondition`, `verifiedReports`, `riskScore`, and `riskLabel`. It is synthetic fixture data only.
- **Normalized SNN training fixture**: `derived-risk-data/risk-training.csv` contains the normalized 11-feature representation consumed by `scripts/train_snn.py`. The API/service performs the same feature transformation before SNN inference.
- **Cognitive Route Memory fixture**: `demo-data/crm-journeys.json` demonstrates the completed-journey fields used to build CRM/EMA history. It is synthetic and explicitly labelled.

## Detector preparation and development split

`prepare_detection_data.py` can normalize locally downloaded BDD100K labels and RDD2022 Pascal-VOC annotations into one unified JSONL manifest. `split_detection_manifest.py` can then create deterministic source-aware train/evaluation manifests while preventing duplicate image rows and train/evaluation image overlap.

The detector trainer builds its Faster R-CNN head dynamically from supported classes actually present in the training manifest. COCO-overlap classes reuse compatible pretrained head rows; `road damage` and `pothole` start with fresh rows and therefore require real RDD2022 samples if those optional road-damage classes are trained.

The data-gate/evaluation utilities remain useful for normal development diagnostics: they check source/class validity, class coverage, duplicate/leakage issues, manifest fingerprints and per-class detector metrics. Their output is an **internal development diagnostic**, not an official BDD100K/RDD2022 benchmark, safety certification, or independent scientific-validation requirement for current NAVORA completion.

## Current detector scope

The object-detection module is retained as a functional perception component developed using the project’s BDD100K detector workflow. Independent cross-dataset detector scientific validation is outside the current project scope and may be considered future work.

The runtime still keeps detector taxonomy, `detector.pt`, confidence thresholds, artifact integrity/readiness checks, inference/error handling, camera integration, and the `objectClass` + `confidence` outputs consumed by NAVORA risk processing.

## SNN validation truthfulness

Detector scope changes do not modify SNN scientific-validation requirements. SNN training/evaluation continues to require the project’s separately governed real held-out risk data, class-aware gates and research-lock rules. Demo fixtures cannot establish that SNN claim.

Follow each upstream dataset's license and official download process.
