import os
import pytest
from pathlib import Path

# Adjust PYTHONPATH to import from repository root
repo_root = Path(__file__).resolve().parents[2]
import sys
sys.path.append(str(repo_root / "ai-service"))

from app.datasets.rdd2022_voc import Rdd2022Dataset, IMG_W, IMG_H, GRID_W, GRID_H, NUM_CLASSES


def require_rdd2022_archive():
    """Skip only when the optional real RDD2022 archive is absent."""
    env_root = os.getenv("RDD2022_ROOT")
    candidates = []
    if env_root:
        candidates.append(Path(env_root) / "India.zip")
    candidates.append(repo_root / "datasets" / "navora-realworld" / "raw" / "rdd2022" / "RDD2022" / "India.zip")
    candidates.append(repo_root / "ai-service" / "datasets" / "navora-realworld" / "raw" / "rdd2022" / "RDD2022" / "India.zip")
    if not any(path.is_file() for path in candidates):
        pytest.skip("RDD2022 India.zip is not present in this CI/local environment")

def test_dataset_lengths():
    require_rdd2022_archive()
    train_ds = Rdd2022Dataset(split="train")
    val_ds = Rdd2022Dataset(split="val")
    test_ds = Rdd2022Dataset(split="test")
    # Expected counts based on official train size 7706
    assert len(train_ds) + len(val_ds) == 7706
    assert len(test_ds) == 1959
    # Ensure split sizes roughly 80/20
    assert abs(len(train_ds) - int(0.8 * 7706)) <= 1
    assert abs(len(val_ds) - int(0.2 * 7706)) <= 1

def test_split_disjointness():
    require_rdd2022_archive()
    train_ds = Rdd2022Dataset(split="train")
    val_ds = Rdd2022Dataset(split="val")
    test_ds = Rdd2022Dataset(split="test")
    train_ids = set(train_ds._ids)
    val_ids = set(val_ds._ids)
    test_ids = set(test_ds._ids)
    assert train_ids.isdisjoint(val_ids)
    assert train_ids.isdisjoint(test_ids)
    assert val_ids.isdisjoint(test_ids)

def test_data_shapes_and_stats():
    require_rdd2022_archive()
    ds = Rdd2022Dataset(split="train")
    img, target, raw_ann = ds[0]
    # Image tensor shape [3, H, W]
    assert img.shape == (3, IMG_H, IMG_W)
    # Target grid shape [GRID_H, GRID_W, 5 + NUM_CLASSES]
    assert target.shape == (GRID_H, GRID_W, 5 + NUM_CLASSES)
    # Iterate through a few samples to accumulate stats
    for i in range(min(10, len(ds))):
        _ = ds[i]
    # Stats should be populated after iteration
    stats = ds.stats()
    assert stats["total_images"] >= 10  # We iterated through at least 10 samples
    # Quarantine count for D0w0 should be non-negative
    assert stats["quarantine_D0w0"] >= 0
    # Unknown classes count should be non-negative
    assert stats["unknown_classes"] >= 0
