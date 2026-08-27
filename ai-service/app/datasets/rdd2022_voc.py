import io
import os
import random
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Tuple, Dict, Any

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

# Local imports for constants and taxonomy
# pyrefly: ignore [missing-import]
from ..detector_taxonomy import TRAINABLE_CLASSES, NUM_CLASSES, ordered_classes, validate_source_class

# Image / grid configuration (should stay in sync with training pipeline)
IMG_W = 640
IMG_H = 384
GRID_W = 20
GRID_H = 12

# Resolve the RDD2022 zip archive location
def _resolve_zip_path() -> Path:
    """Return the Path to the India.zip archive.

    Preference order:
    1. RDD2022_ROOT environment variable (must point to a directory containing India.zip)
    2. Repository‑relative fallback: <repo_root>/datasets/navora-realworld/raw/rdd2022/RDD2022/India.zip
    """
    env_root = os.getenv("RDD2022_ROOT")
    if env_root:
        candidate = Path(env_root) / "India.zip"
        if candidate.is_file():
            return candidate
    # Fallback — relative to this file (two levels up to ai-service)
    fallback = Path(__file__).resolve().parents[2] / "datasets" / "navora-realworld" / "raw" / "rdd2022" / "RDD2022" / "India.zip"
    if fallback.is_file():
        return fallback
    raise FileNotFoundError("RDD2022 India.zip not found. Set RDD2022_ROOT env var or ensure repository layout is correct.")

class Rdd2022Dataset(Dataset):
    """Pascal‑VOC style loader for the RDD2022 India dataset.

    Returns a tuple ``(image_tensor, target_grid, raw_ann_list)`` where ``raw_ann_list`` is a list of
    ``(class_name, [xmin, ymin, xmax, ymax])`` for possible debugging.
    """
    def __init__(self, split: str = "train"):
        if split not in ("train", "val", "test"):
            raise ValueError(f"split must be 'train', 'val' or 'test', got {split!r}")
        self.split = split
        self._zip_path = _resolve_zip_path()
        self._zip = zipfile.ZipFile(str(self._zip_path), "r")

        # Build index of image identifiers (basename without extension) for train and test
        # Actual structure: India/train/images/*.jpg and India/test/images/*.jpg
        namelist = [p for p in self._zip.namelist() if p.lower().endswith('.jpg')]
        self._train_ids = [Path(p).stem for p in namelist if 'train/images/' in p.lower()]
        self._test_ids = [Path(p).stem for p in namelist if 'test/images/' in p.lower()]

        # Deterministic 80/20 split of official training set
        if split in ("train", "val"):
            rng = random.Random(42)
            shuffled = self._train_ids[:]
            rng.shuffle(shuffled)
            cutoff = int(0.8 * len(shuffled))
            if split == "train":
                self._ids = shuffled[:cutoff]
            else:
                self._ids = shuffled[cutoff:]
        else:
            self._ids = self._test_ids

        # Leak‑protection asserts — executed at init time
        # Build the full sets
        train_set_full = set(self._train_ids)
        test_set = set(self._test_ids)

        # Determine what this instance's IDs are
        if split in ("train", "val"):
            rng_check = random.Random(42)
            shuffled_check = self._train_ids[:]
            rng_check.shuffle(shuffled_check)
            cutoff = int(0.8 * len(shuffled_check))
            train_ids_actual = set(shuffled_check[:cutoff])
            val_ids_actual = set(shuffled_check[cutoff:])
        else:
            train_ids_actual = set()
            val_ids_actual = set()

        # Verify disjointness
        assert train_ids_actual.isdisjoint(val_ids_actual), "Train/val overlap detected!"
        assert train_ids_actual.isdisjoint(test_set), "Train/test overlap detected!"
        assert val_ids_actual.isdisjoint(test_set), "Val/test overlap detected!"

        # Statistics placeholders — filled during first iteration
        self._stats: Dict[str, Any] = {
            "total_images": 0,
            "total_annotations": 0,
            "per_class_counts": {cls: 0 for cls in TRAINABLE_CLASSES},
            "quarantine_D0w0": 0,
            "unknown_classes": 0,
            "invalid_bboxes": 0,
            "malformed_xml": 0,
        }
        # Mapping from class name to channel index in target grid
        self._class_to_idx = {cls: i for i, cls in enumerate(TRAINABLE_CLASSES)}

    def __len__(self) -> int:
        return len(self._ids)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, List[Tuple[str, List[int]]]]:
        img_id = self._ids[idx]
        # Determine zip internal paths — actual structure: India/train/images/, India/train/annotations/xmls/, etc.
        if self.split != "test":
            img_path = f"India/train/images/{img_id}.jpg"
            ann_path = f"India/train/annotations/xmls/{img_id}.xml"
        else:
            img_path = f"India/test/images/{img_id}.jpg"
            ann_path = f"India/test/annotations/xmls/{img_id}.xml"  # will not exist; handle gracefully

        # Load and decode image
        img_bytes = self._zip.read(img_path)
        img_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)  # BGR
        if img is None:
            raise RuntimeError(f"Failed to decode image {img_path} in zip")

        # Resize to standard dimensions (IMG_H x IMG_W)
        orig_h, orig_w = img.shape[:2]
        img = cv2.resize(img, (IMG_W, IMG_H), interpolation=cv2.INTER_LINEAR)

        # Scale factors for bounding box adjustment
        scale_x = IMG_W / orig_w
        scale_y = IMG_H / orig_h

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(rgb.transpose(2, 0, 1))  # [3, H, W]

        # Prepare target grid (only for train/val)
        target = torch.zeros(GRID_H, GRID_W, 5 + NUM_CLASSES, dtype=torch.float32)
        raw_ann: List[Tuple[str, List[int]]] = []

        if self.split != "test":
            try:
                ann_bytes = self._zip.read(ann_path)
            except KeyError:
                self._stats["malformed_xml"] += 1
                return img_tensor, target, raw_ann
            try:
                root = ET.fromstring(ann_bytes)
            except ET.ParseError:
                self._stats["malformed_xml"] += 1
                return img_tensor, target, raw_ann
            for obj in root.findall('object'):
                name_el = obj.find('name')
                if name_el is None or name_el.text is None:
                    self._stats["malformed_xml"] += 1
                    continue
                class_name = name_el.text.strip()
                # Validate source class — raises if not allowed (including D0w0)
                try:
                    validate_source_class("RDD2022", class_name)
                except ValueError:
                    # Quarantine unknown / D0w0
                    if class_name == "D0w0":
                        self._stats["quarantine_D0w0"] += 1
                    else:
                        self._stats["unknown_classes"] += 1
                    continue
                bnd = obj.find('bndbox')
                if bnd is None:
                    self._stats["invalid_bboxes"] += 1
                    continue
                try:
                    x1 = int(float(bnd.find('xmin').text) * scale_x)
                    y1 = int(float(bnd.find('ymin').text) * scale_y)
                    x2 = int(float(bnd.find('xmax').text) * scale_x)
                    y2 = int(float(bnd.find('ymax').text) * scale_y)
                except (AttributeError, ValueError):
                    self._stats["invalid_bboxes"] += 1
                    continue
                # Clip / sanity checks
                if x1 >= x2 or y1 >= y2:
                    self._stats["invalid_bboxes"] += 1
                    continue
                # Clamp to image dimensions
                h, w = img.shape[:2]
                x1 = max(0, min(w, x1))
                x2 = max(0, min(w, x2))
                y1 = max(0, min(h, y1))
                y2 = max(0, min(h, y2))
                if x1 >= x2 or y1 >= y2:
                    self._stats["invalid_bboxes"] += 1
                    continue

                # Normalise
                bx = (x1 + x2) / 2.0 / IMG_W
                by = (y1 + y2) / 2.0 / IMG_H
                bw = (x2 - x1) / IMG_W
                bh = (y2 - y1) / IMG_H
                gi = min(int(bx * GRID_W), GRID_W - 1)
                gj = min(int(by * GRID_H), GRID_H - 1)

                target[gj, gi, 0] = 1.0  # objectness
                target[gj, gi, 1] = bx * GRID_W - gi
                target[gj, gi, 2] = by * GRID_H - gj
                target[gj, gi, 3] = bw
                target[gj, gi, 4] = bh
                cls_idx = self._class_to_idx[class_name]
                target[gj, gi, 5 + cls_idx] = 1.0

                # Record raw annotation for debugging / stats
                raw_ann.append((class_name, [x1, y1, x2, y2]))
                self._stats["total_annotations"] += 1
                self._stats["per_class_counts"][class_name] += 1
        # Update image count stat (once per call — cheap)
        self._stats["total_images"] += 1
        return img_tensor, target, raw_ann

    def stats(self) -> Dict[str, Any]:
        """Return a dictionary with dataset statistics collected so far.

        The statistics are accumulated lazily during iteration; calling ``stats()`` after iterating
        over the whole dataset will give complete numbers.
        """
        return self._stats.copy()

    def close(self) -> None:
        """Close the underlying ZipFile — useful for deterministic shutdown."""
        self._zip.close()

    def __del__(self):
        try:
            self._zip.close()
        except Exception:
            pass
            pass
