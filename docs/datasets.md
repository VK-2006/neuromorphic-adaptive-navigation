# Dataset Documentation

## Detection

- **BDD100K** — primary road-scene/object source.
- **RDD2022** — pothole/crack/road-damage source.
- **Cityscapes** — optional segmentation research source.
- **OpenStreetMap** — geographic/road-network data, not an ML training dataset.

The repository does not redistribute the large upstream datasets. `scripts/prepare_detection_data.py` converts locally downloaded BDD100K/RDD2022 labels into the unified detection manifest consumed by `scripts/train_detector.py`.

Training output is explicitly unvalidated. Use `scripts/evaluate_detector.py` on a separate held-out manifest before `detectorValidated` can become true.

## SNN risk data

The SNN schema includes object prior/class, confidence, proximity/distance, relative/user speed, persistence, traffic density, hazard frequency, visibility, weather risk, road/reports and a risk label.

The small files under `datasets/demo-data` and `datasets/derived-risk-data` are demonstration/training-pipeline fixtures only. They are not sufficient to claim real-world validation. Use a separate real held-out risk CSV with `scripts/evaluate_snn.py`.

## Cognitive Route Memory

CRM data is generated from completed user journeys and stores route coordinates/signature, journey/success counts, travel time, risk, hazard/reroute frequency, historical safety, reliability/familiarity, feedback and recency.
