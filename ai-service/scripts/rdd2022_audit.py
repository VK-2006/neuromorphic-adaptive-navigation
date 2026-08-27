import sys
import json
import hashlib
from pathlib import Path
import os
import zipfile

# Add repository root to sys.path for imports
repo_root = Path(__file__).resolve().parents[2]
sys.path.append(str(repo_root / "ai-service"))

# Local imports
from app.datasets.rdd2022_voc import Rdd2022Dataset

IMG_W = 640
IMG_H = 384
GRID_W = 20
GRID_H = 12

def _resolve_zip_path() -> Path:
    """Resolve the path to the RDD2022 India.zip archive.

    Preference order:
    1. RDD2022_ROOT environment variable pointing to a directory containing India.zip
    2. Repository‑relative fallback: <repo_root>/datasets/navora-realworld/raw/rdd2022/RDD2022/India.zip
    """
    env_root = os.getenv("RDD2022_ROOT")
    if env_root:
        candidate = Path(env_root) / "India.zip"
        if candidate.is_file():
            return candidate
    fallback = repo_root / "ai-service" / "datasets" / "navora-realworld" / "raw" / "rdd2022" / "RDD2022" / "India.zip"
    if fallback.is_file():
        return fallback
    raise FileNotFoundError("RDD2022 India.zip not found. Set RDD2022_ROOT or ensure repository layout is correct.")

def compute_sha256(file_path: Path) -> str:
    """Compute SHA‑256 checksum of a file in a memory‑efficient way."""
    h = hashlib.sha256()
    with file_path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def generate_audit() -> dict:
    zip_path = _resolve_zip_path()
    zip_sha256 = compute_sha256(zip_path)

    # Instantiate datasets for each split
    train_ds = Rdd2022Dataset(split="train")
    val_ds = Rdd2022Dataset(split="val")
    test_ds = Rdd2022Dataset(split="test")

    # Iterate through datasets to accumulate statistics
    print("Collecting train set statistics...")
    for i in range(len(train_ds)):
        _ = train_ds[i]
        if (i + 1) % 1000 == 0:
            print(f"  Processed {i + 1}/{len(train_ds)}")

    print("Collecting validation set statistics...")
    for i in range(len(val_ds)):
        _ = val_ds[i]
        if (i + 1) % 500 == 0:
            print(f"  Processed {i + 1}/{len(val_ds)}")

    print("Collecting test set statistics...")
    for i in range(len(test_ds)):
        _ = test_ds[i]
        if (i + 1) % 500 == 0:
            print(f"  Processed {i + 1}/{len(test_ds)}")

    # Gather accumulated statistics
    train_stats = train_ds.stats()
    val_stats = val_ds.stats()
    test_stats = test_ds.stats()

    # Combine class distribution (train + val) — test split has no annotations typically
    combined_class_counts = {}
    for cls in train_stats["per_class_counts"]:
        combined_class_counts[cls] = train_stats["per_class_counts"][cls] + val_stats["per_class_counts"].get(cls, 0)

    audit = {
        "dataset_name": "RDD2022 India",
        "zip_path": str(zip_path),
        "zip_sha256": zip_sha256,
        "image_dimensions": {"width": IMG_W, "height": IMG_H},
        "grid_dimensions": {"grid_w": GRID_W, "grid_h": GRID_H},
        "splits": {
            "train": {"num_images": len(train_ds), "ids": train_ds._ids},
            "val": {"num_images": len(val_ds), "ids": val_ds._ids},
            "test": {"num_images": len(test_ds), "ids": test_ds._ids},
        },
        "total_images": train_stats["total_images"] + val_stats["total_images"] + test_stats["total_images"],
        "total_annotations": train_stats["total_annotations"] + val_stats["total_annotations"] + test_stats["total_annotations"],
        "class_distribution": combined_class_counts,
        "quarantine_D0w0": train_stats["quarantine_D0w0"] + val_stats["quarantine_D0w0"] + test_stats["quarantine_D0w0"],
        "unknown_classes": train_stats["unknown_classes"] + val_stats["unknown_classes"] + test_stats["unknown_classes"],
        "invalid_bboxes": train_stats["invalid_bboxes"] + val_stats["invalid_bboxes"] + test_stats["invalid_bboxes"],
        "malformed_xml": train_stats["malformed_xml"] + val_stats["malformed_xml"] + test_stats["malformed_xml"],
    }
    return audit

def main():
    audit_data = generate_audit()
    # Write JSON files under trained_models (or fallback to repo root if missing)
    out_dir = repo_root / "trained_models"
    out_dir.mkdir(parents=True, exist_ok=True)
    audit_path = out_dir / "rdd2022-data-audit.json"
    manifest_path = out_dir / "rdd2022-india-manifest.json"
    # Save the same data to both files (they are effectively the same manifest)
    with audit_path.open("w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2, sort_keys=True)
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(audit_data, f, indent=2, sort_keys=True)
    print(f"Audit JSON written to {audit_path}\nManifest JSON written to {manifest_path}")

if __name__ == "__main__":
    main()
