# NAVORA Real-World Datasets

This directory manages the real-world dataset evaluation pipeline for NAVORA's Phase 16 validation requirements.

## Directory Structure
- `raw/`: Unprocessed downloaded archives.
- `processed/`: Formatted dataset images and labels.
- `manifests/`: JSON manifests mapping subsets of datasets for evaluation.
- `samples/`: Tiny representative samples for smoke testing.

## Supported Dataset

### RDD2022 (Road Damage Dataset)
- **Content:** Road surface hazards (cracks, potholes).
- **Access:** Publicly available on AWS Open Data / GitHub.
- **Classes Mapped:**
  - Canonical classes: `D00`, `D01`, `D10`, `D11`, `D20`, `D40`, `D43`, `D44`, `D50`

## Usage & Validation
NAVORA's V30 Cryptographic Evidence Chain strictly differentiates between `SYNTHETIC` and `REAL-WORLD` training datasets.

By default, the development environment utilizes synthetic datasets to guarantee reproducible build times and deterministic CI/CD environments.
However, **for production AI activation, the cryptographic gate now requires real-world data validation**.

If a real-world dataset is not present in this directory, the validation script will correctly output:
`REAL-WORLD VALIDATION NOT YET COMPLETED`
and the FastAPI service will safely fallback to heuristic perception.

### To Evaluate a Real Dataset:
1. Place formatted images in `datasets/processed/images/` and YOLO-formatted labels in `datasets/processed/labels/`.
2. Run the detector evaluation script against the held-out RDD2022 manifest.
3. This will generate the true `validation-evidence.json` with `datasetType: "real-world"`.
