# Datasets

This repository does **not** redistribute the large upstream datasets or present demo fixtures as measured real-world data.

- **BDD100K**: road-scene/object-detection development source for `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, and `barrier` after NAVORA normalization.
- **RDD2022**: road-damage development source normalized to `road damage` and `pothole` from potholes, longitudinal cracks, transverse cracks and alligator cracks.
- **OpenStreetMap**: geographic/road-network data; it is **not** an ML training dataset.
- **Custom SNN Risk data**: `demo-data/snn-risk-raw.csv` demonstrates the master-prompt fields `objectClass`, `confidence`, `estimatedDistance`, `relativeSpeed`, `userSpeed`, `objectPersistence`, `trafficDensity`, `hazardFrequency`, `visibility`, `weatherRisk`, `roadCondition`, `verifiedReports`, `riskScore`, and `riskLabel`. It is synthetic fixture data only.
- **Normalized SNN training fixture**: `derived-risk-data/risk-training.csv` contains the normalized 11-feature representation consumed by `scripts/train_snn.py`. The API/service performs the same feature transformation before SNN inference.
- **Cognitive Route Memory fixture**: `demo-data/crm-journeys.json` demonstrates the completed-journey fields used to build CRM/EMA history. It is synthetic and explicitly labelled.

## Detector preparation and development

`prepare_detection_data.py` can normalize locally downloaded BDD100K labels and RDD2022 Pascal-VOC annotations into one unified JSONL manifest. `split_detection_manifest.py` remains available for deterministic train/evaluation splits used during normal development/debugging.

The detector trainer builds its Faster R-CNN head dynamically from supported classes actually present in the training manifest. COCO-overlap classes reuse compatible pretrained head rows; `road damage` and `pothole` start with fresh rows and therefore require real RDD2022 training when those classes are part of the model.

Detector metadata records class order, source list, training-manifest SHA-256 and detector artifact SHA-256. Runtime readiness checks preserve artifact existence/integrity and class metadata. `evaluate_detector.py` remains available for internal diagnostics, but independent cross-dataset detector scientific validation is outside the current project scope and is not required for project completion.

## SNN validation truthfulness

SNN training, held-out evaluation, evidence binding, the consumed 2025 final holdout record and the research-only lock remain unchanged. Demo fixtures cannot satisfy a real SNN scientific-validation claim.

The detector is described only as a functional perception component developed with the BDD100K/RDD2022 workflow. No independently validated, safety-certified, cross-dataset validated or externally validated detector claim is made.

Follow each upstream dataset's license and official download process.
