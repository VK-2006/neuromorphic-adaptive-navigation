# Datasets

This repository does **not** redistribute the large upstream datasets or present demo fixtures as measured real-world data.

- **BDD100K**: current primary road-scene/object-detection source for cars, pedestrians, bicycles, motorcycles, buses and trucks.
- **RDD2022**: prepared road-damage source for potholes, longitudinal cracks, transverse cracks, alligator cracks and general road damage. The converter supports it, but these classes are not yet accepted by the current validated V4 detector trainer.
- **Cityscapes**: optional semantic-segmentation source.
- **OpenStreetMap**: geographic/road-network data; it is **not** an ML training dataset.
- **Custom SNN Risk data**: `demo-data/snn-risk-raw.csv` demonstrates the master-prompt fields `objectClass`, `confidence`, `estimatedDistance`, `relativeSpeed`, `userSpeed`, `objectPersistence`, `trafficDensity`, `hazardFrequency`, `visibility`, `weatherRisk`, `roadCondition`, `verifiedReports`, `riskScore`, and `riskLabel`. It is synthetic fixture data only.
- **Normalized SNN training fixture**: `derived-risk-data/risk-training.csv` contains the normalized 11-feature representation consumed by `scripts/train_snn.py`. The API/service performs the same feature transformation before SNN inference.
- **Cognitive Route Memory fixture**: `demo-data/crm-journeys.json` demonstrates the completed-journey fields used to build CRM/EMA history. It is synthetic and explicitly labelled.

`prepare_detection_data.py` can normalize locally downloaded BDD100K labels and RDD2022 Pascal-VOC annotations into a unified manifest. The **current `train_detector.py` validation path intentionally accepts only BDD100K samples for** `person`, `bicycle`, `motorcycle`, `car`, `bus`, and `truck`; RDD2022 output is preparation/research data until the trainer and held-out gate are expanded for those classes.

`train_detector.py` and `train_snn.py` create local model artifacts. V28 live validation requires non-weakened data/evaluation policy, zero train/eval leakage, exact held-out dataset fingerprints, passing evidence/report hashes and exact model-weight SHA-256 bindings; demo fixtures cannot satisfy the real-data validation claim.

Follow each upstream dataset's license and official download process.
