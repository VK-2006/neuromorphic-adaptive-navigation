# Datasets

This repository does **not** redistribute the large upstream datasets or present demo fixtures as measured real-world data.

- **BDD100K**: road-scene/object-detection source for `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, and `barrier` after Navora normalization.
- **RDD2022**: road-damage source normalized to `road damage` and `pothole` from potholes, longitudinal cracks, transverse cracks and alligator cracks.
- **Cityscapes**: optional semantic-segmentation source.
- **OpenStreetMap**: geographic/road-network data; it is **not** an ML training dataset.
- **Custom SNN Risk data**: `demo-data/snn-risk-raw.csv` demonstrates the master-prompt fields `objectClass`, `confidence`, `estimatedDistance`, `relativeSpeed`, `userSpeed`, `objectPersistence`, `trafficDensity`, `hazardFrequency`, `visibility`, `weatherRisk`, `roadCondition`, `verifiedReports`, `riskScore`, and `riskLabel`. It is synthetic fixture data only.
- **Normalized SNN training fixture**: `derived-risk-data/risk-training.csv` contains the normalized 11-feature representation consumed by `scripts/train_snn.py`. The API/service performs the same feature transformation before SNN inference.
- **Cognitive Route Memory fixture**: `demo-data/crm-journeys.json` demonstrates the completed-journey fields used to build CRM/EMA history. It is synthetic and explicitly labelled.

## Detector preparation and split

`prepare_detection_data.py` can normalize locally downloaded BDD100K labels and RDD2022 Pascal-VOC annotations into one unified JSONL manifest. `split_detection_manifest.py` then creates deterministic source-aware train/evaluation manifests while preventing duplicate image rows and guaranteeing zero train/evaluation image overlap.

The V29 trainer builds its Faster R-CNN head dynamically from supported classes actually present in the training manifest. COCO-overlap classes reuse compatible pretrained head rows; `road damage` and `pothole` start with fresh rows and therefore require real RDD2022 training.

The V29 data gate checks source/class validity, trained-source held-out coverage, evaluation-only classes/sources, minimum class coverage and exact train/evaluation fingerprints. Detector metadata records the exact training-manifest SHA-256, class order and source list so a stale or mismatched model cannot later be reported as validated.

## Validation truthfulness

`train_detector.py` and `train_snn.py` create local model artifacts but training never enables validation. V28+ live validation requires non-weakened data/evaluation policy, zero train/eval leakage, exact dataset fingerprints, passing evidence/report hashes and exact model-weight SHA-256 bindings. V29 adds detector taxonomy/source/training-manifest binding.

The generated detector split is an internal development/validation split, **not** an official BDD100K or RDD2022 benchmark. Demo fixtures cannot satisfy the real-data validation claim.

Follow each upstream dataset's license and official download process.
