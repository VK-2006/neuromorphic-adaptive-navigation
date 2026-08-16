# Dataset Documentation

## Detection

NAVORA retains a **source-aware BDD100K + optional RDD2022 Faster R-CNN development pipeline**. The repository does not redistribute either upstream dataset or treat internal metrics as an official upstream benchmark.

Supported normalized detector classes are:

- BDD100K: `person`, `bicycle`, `motorcycle`, `car`, `bus`, `truck`, `traffic cone`, `barrier`.
- RDD2022: `road damage`, `pothole`.

`prepare_detection_data.py` creates a unified JSONL manifest from locally licensed upstream files. `split_detection_manifest.py` can create a deterministic source-aware internal train/evaluation split. The split prevents duplicate image rows from crossing the train/evaluation boundary and can support normal model development/debugging.

Generated local files normally include:

- `datasets/derived-risk-data/detection-manifest.jsonl`
- `datasets/derived-risk-data/detection-train.jsonl`
- `datasets/derived-risk-data/detection-eval.jsonl`
- optional BDD preparation provenance such as `datasets/derived-risk-data/bdd100k-hf-provenance.json`

They contain machine-local paths and are intentionally ignored by Git.

The detector data/evaluation utilities validate source/class pairs, dataset sizes, duplicate images, train/evaluation leakage, class coverage and dataset fingerprints. Detector training records the training-manifest SHA-256 plus dynamic class order and training-source list in metadata. These checks remain useful for reproducibility and debugging; they are not a current independent detector scientific-validation gate.

COCO-overlap classes may reuse pretrained Faster R-CNN head rows. `road damage` and `pothole` are NAVORA-specific rows that begin freshly initialized and require real RDD2022 samples only when those optional classes are trained.

`scripts/evaluate_detector.py` remains available for internal diagnostic precision/recall/F1 evaluation. Any split produced by NAVORA's deterministic splitter is an **internal development/evaluation split**, not an official BDD100K or RDD2022 benchmark result and not evidence of a safety-certified or independently cross-dataset scientifically validated detector.

### Detector scope boundary

The object-detection module is retained as a functional perception component developed using the project’s BDD100K detector workflow. Independent cross-dataset detector scientific validation is outside the current project scope and may be considered future work.

The detector taxonomy, `detector.pt` path, normal artifact/hash/readiness checks, inference confidence thresholds, API behavior and camera-to-risk metadata flow remain part of the current project.

Hazards outside the trained taxonomy, such as generic debris or fallen trees, may still appear through explicitly separate provider/research paths; they do not change the detector's documented BDD100K/RDD2022 taxonomy.

## SNN risk data

The SNN schema includes object prior/class, confidence, proximity/distance, relative/user speed, persistence, traffic density, hazard frequency, visibility, weather risk, road/reports and a risk label.

Demo/fixture risk data is not real validation data. **SNN training and scientific evaluation remain unchanged by the detector scope simplification** and continue to require the separately governed labeled risk data and research-lock policy.

## Cognitive Route Memory

CRM data is generated from completed user journeys and stores route coordinates/signature, journey/success counts, travel time, risk, hazard/reroute frequency, historical safety, reliability/familiarity, feedback and recency.
