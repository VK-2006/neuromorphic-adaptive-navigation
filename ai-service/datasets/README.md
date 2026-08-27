# NAVORA Real-World Datasets

This directory manages the real-world dataset evaluation pipeline for NAVORA's Phase 16 validation requirements.

## Directory Structure
- `raw/`: Unprocessed downloaded archives.
- `processed/`: Formatted dataset images and labels.
- `manifests/`: JSON manifests mapping subsets of datasets for evaluation.
- `samples/`: Tiny representative samples for smoke testing.

## Supported Datasets

### 1. BDD100K (Berkeley DeepDrive)
- **Content:** Urban driving scenes.
- **Access:** Requires registration at [bdd-data.berkeley.edu](https://bdd-data.berkeley.edu/).
- **Classes Mapped:**
  - `pedestrian` -> `person` (HIGH RISK)
  - `car` -> `car` (MEDIUM RISK)
  - `truck`, `bus` -> `car` (mapped for compatibility)

### 2. RDD2022 (Road Damage Dataset)
- **Content:** Road surface hazards (cracks, potholes).
- **Access:** Publicly available on AWS Open Data / GitHub.
- **Classes Mapped:**
  - `D00`, `D10`, `D20` -> `road damage` (MEDIUM RISK)
  - `D40` -> `pothole` (CRITICAL RISK)

## Usage & Validation
NAVORA's V30 Cryptographic Evidence Chain strictly differentiates between `SYNTHETIC` and `REAL-WORLD` training datasets.

By default, the development environment utilizes synthetic datasets to guarantee reproducible build times and deterministic CI/CD environments.
However, **for production AI activation, the cryptographic gate now requires real-world data validation**.

If a real-world dataset is not present in this directory, the validation script will correctly output:
`REAL-WORLD VALIDATION NOT YET COMPLETED`
and the FastAPI service will safely fallback to heuristic perception.

### To Evaluate a Real Dataset:
1. Place formatted images in `datasets/processed/images/` and YOLO-formatted labels in `datasets/processed/labels/`.
2. Run the evaluation script (e.g. `python scripts/evaluate_detector.py --dataset BDD100K --split val`).
3. This will generate the true `validation-evidence.json` with `datasetType: "real-world"`.
