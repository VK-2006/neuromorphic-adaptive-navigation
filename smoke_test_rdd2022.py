#!/usr/bin/env python3
"""
STEP 7: RDD2022 Smoke Training Test
Phase 17 verification of RDD2022 training pipeline

Tests:
1. Dataset loading (training and validation splits)
2. Data shapes (images, bboxes, targets)
3. Model forward pass on mini-batch
4. Loss computation
5. Backward propagation
6. Optimizer updates
7. Training loop (2 epochs, ~100 images)
8. Checkpoint saving
9. No official test leakage
10. Metadata preservation

Status codes:
  [OK]     = test passed
  [FAIL]   = test failed
  [SKIP]   = test skipped
  [INFO]   = informational message
"""

import sys
import os
import json
import torch
import torch.nn as nn
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "ai-service"))

from app.datasets.rdd2022_voc import Rdd2022Dataset
from app.detector_taxonomy import NUM_CLASSES, TRAINABLE_CLASSES
import torch.optim as optim
from torch.utils.data import DataLoader
import torchvision.models as tvm

# Configuration
SEED = 42
BATCH_SIZE = 4
NUM_EPOCHS = 2
SMOKE_TRAIN_IMAGES = 100
IMG_W = 640
IMG_H = 384
GRID_W = 20
GRID_H = 12

class SimpleDetector(nn.Module):
    """Simple detector model for smoke testing"""
    def __init__(self, num_classes):
        super().__init__()
        # Load pretrained MobileNetV3-Small
        backbone = tvm.mobilenet_v3_small(weights=tvm.MobileNet_V3_Small_Weights.DEFAULT)
        self.backbone = backbone.features
        for p in self.backbone.parameters():
            p.requires_grad_(False)

        # Detection head
        self.pool = nn.AdaptiveAvgPool2d((GRID_H, GRID_W))
        self.head = nn.Sequential(
            nn.Conv2d(576, 256, 1),
            nn.ReLU(),
            nn.Conv2d(256, 128, 1),
            nn.ReLU(),
            nn.Conv2d(128, 5 + num_classes, 1)
        )

    def forward(self, x):
        x = self.backbone(x)
        x = self.pool(x)
        x = self.head(x)
        return x.permute(0, 2, 3, 1)  # [B, H, W, C]

def build_detector_model(num_classes):
    """Build detector model"""
    return SimpleDetector(num_classes)

def collate_batch(batch):
    """Custom collate function for RDD2022 dataset"""
    images = []
    target_grids = []
    raw_annotations = []

    for img, target, ann in batch:
        images.append(img)
        target_grids.append(target)
        raw_annotations.append(ann)

    return (
        torch.stack(images),
        torch.stack(target_grids),
        raw_annotations
    )

def print_status(step, message, status="INFO"):
    """Print test status message with ASCII-safe formatting"""
    print(f"[{status:5s}] {message}")

def test_01_load_dataset():
    """Test 1: Load RDD2022 training dataset"""
    print_status(1, "Loading RDD2022 training dataset...")
    try:
        train_dataset = Rdd2022Dataset(split="train")
        val_dataset = Rdd2022Dataset(split="val")

        print_status(1, f"RDD2022 training dataset loaded ({len(train_dataset)} images)", "OK")
        print_status(1, f"RDD2022 validation dataset loaded ({len(val_dataset)} images)", "OK")
        return train_dataset, val_dataset
    except Exception as e:
        print_status(1, f"FAILED to load RDD2022 dataset: {e}", "FAIL")
        import traceback
        traceback.print_exc()
        return None, None

def test_02_data_shapes(train_dataset, val_dataset):
    """Test 2: Verify data shapes and formats"""
    print_status(2, "Checking data shapes and formats...")
    try:
        # Sample a few items
        for i in range(min(5, len(train_dataset))):
            image, target_grid, raw_annotations = train_dataset[i]

            if not isinstance(image, torch.Tensor):
                print_status(2, f"Image is not a tensor (got {type(image)})", "FAIL")
                return False

            if image.shape != torch.Size([3, 384, 640]):
                print_status(2, f"Image shape mismatch: {image.shape} (expected [3, 384, 640])", "FAIL")
                return False

            if image.dtype != torch.float32:
                print_status(2, f"Image dtype should be float32 (got {image.dtype})", "FAIL")
                return False

            if not isinstance(target_grid, torch.Tensor):
                print_status(2, f"Target grid should be tensor (got {type(target_grid)})", "FAIL")
                return False

            if target_grid.shape != torch.Size([12, 20, 14]):  # GRID_H x GRID_W x (5 + NUM_CLASSES)
                print_status(2, f"Target grid shape mismatch: {target_grid.shape} (expected [12, 20, 14])", "FAIL")
                return False

        print_status(2, "All sampled data shapes are valid", "OK")
        return True
    except Exception as e:
        print_status(2, f"Data shape validation failed: {e}", "FAIL")
        return False

def test_03_model_forward(train_dataset):
    """Test 3: Model forward pass on mini-batch"""
    print_status(3, "Testing model forward pass...")
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = build_detector_model(num_classes=NUM_CLASSES)
        model.to(device)
        model.eval()

        # Create mini-batch
        loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=False, collate_fn=collate_batch)
        batch = next(iter(loader))
        images = batch[0].to(device)

        # Forward pass
        with torch.no_grad():
            predictions = model(images)

        if predictions is None:
            print_status(3, "Model returned None predictions", "FAIL")
            return False

        if not isinstance(predictions, torch.Tensor):
            print_status(3, f"Predictions should be tensor (got {type(predictions)})", "FAIL")
            return False

        print_status(3, f"Forward pass successful (batch size={BATCH_SIZE}, output shape={predictions.shape})", "OK")
        return True
    except Exception as e:
        print_status(3, f"Forward pass failed: {e}", "FAIL")
        return False

def test_04_loss_computation(train_dataset):
    """Test 4: Loss computation"""
    print_status(4, "Testing loss computation...")
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = build_detector_model(num_classes=NUM_CLASSES)
        model.to(device)
        model.train()

        criterion = nn.MSELoss()  # Use MSE for grid-based loss

        loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=False, collate_fn=collate_batch)
        batch = next(iter(loader))
        images = batch[0].to(device)
        target_grids = batch[1].to(device)

        predictions = model(images)

        # Reshape predictions to match target grid if needed
        if predictions.shape != target_grids.shape:
            # Resize predictions to match target grid
            predictions_reshaped = torch.nn.functional.interpolate(
                predictions.permute(0, 3, 1, 2),
                size=(target_grids.shape[1], target_grids.shape[2]),
                mode='bilinear',
                align_corners=False
            ).permute(0, 2, 3, 1)
        else:
            predictions_reshaped = predictions

        loss = criterion(predictions_reshaped, target_grids)

        if loss.item() <= 0:
            print_status(4, f"Loss should be positive (got {loss.item()})", "FAIL")
            return False

        print_status(4, f"Loss computation successful (loss={loss.item():.4f})", "OK")
        return True
    except Exception as e:
        print_status(4, f"Loss computation failed: {e}", "FAIL")
        return False

def test_05_backward_pass(train_dataset):
    """Test 5: Backward propagation"""
    print_status(5, "Testing backward propagation...")
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = build_detector_model(num_classes=NUM_CLASSES)
        model.to(device)
        model.train()

        criterion = nn.MSELoss()

        loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=False, collate_fn=collate_batch)
        batch = next(iter(loader))
        images = batch[0].to(device)
        target_grids = batch[1].to(device)

        predictions = model(images)

        # Reshape predictions to match target grid
        if predictions.shape != target_grids.shape:
            predictions_reshaped = torch.nn.functional.interpolate(
                predictions.permute(0, 3, 1, 2),
                size=(target_grids.shape[1], target_grids.shape[2]),
                mode='bilinear',
                align_corners=False
            ).permute(0, 2, 3, 1)
        else:
            predictions_reshaped = predictions

        loss = criterion(predictions_reshaped, target_grids)
        loss.backward()

        # Verify gradients exist
        grad_count = 0
        for param in model.parameters():
            if param.grad is not None:
                grad_count += 1

        if grad_count == 0:
            print_status(5, "No gradients computed", "FAIL")
            return False

        print_status(5, f"Backward pass successful ({grad_count} params with gradients)", "OK")
        return True
    except Exception as e:
        print_status(5, f"Backward pass failed: {e}", "FAIL")
        return False

def test_06_optimizer_step(train_dataset):
    """Test 6: Optimizer step"""
    print_status(6, "Testing optimizer step...")
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = build_detector_model(num_classes=NUM_CLASSES)
        model.to(device)
        model.train()

        optimizer = optim.Adam(model.parameters(), lr=1e-2)  # Increased LR for visible changes
        criterion = nn.MSELoss()

        loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=False, collate_fn=collate_batch)
        batch = next(iter(loader))
        images = batch[0].to(device)
        target_grids = batch[1].to(device)

        # Store initial weights
        initial_weight = None
        for param in model.parameters():
            if param.requires_grad:
                initial_weight = param.data.clone()
                break

        predictions = model(images)

        # Reshape predictions to match target grid
        if predictions.shape != target_grids.shape:
            predictions_reshaped = torch.nn.functional.interpolate(
                predictions.permute(0, 3, 1, 2),
                size=(target_grids.shape[1], target_grids.shape[2]),
                mode='bilinear',
                align_corners=False
            ).permute(0, 2, 3, 1)
        else:
            predictions_reshaped = predictions

        loss = criterion(predictions_reshaped, target_grids)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        # Verify weights changed (check trainable params)
        final_weight = None
        for param in model.parameters():
            if param.requires_grad:
                final_weight = param.data
                break

        if initial_weight is not None and final_weight is not None:
            weight_change = (initial_weight - final_weight).abs().sum().item()
            if weight_change < 1e-8:
                print_status(6, f"Weights did not change after optimizer step (change={weight_change:.2e})", "FAIL")
                return False

        print_status(6, "Optimizer step successful (weights updated)", "OK")
        return True
    except Exception as e:
        print_status(6, f"Optimizer step failed: {e}", "FAIL")
        return False

def test_07_mini_training_loop(train_dataset):
    """Test 7: Mini training loop (2 epochs, ~100 images)"""
    print_status(7, "Running mini training loop...")
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = build_detector_model(num_classes=NUM_CLASSES)
        model.to(device)

        optimizer = optim.Adam(model.parameters(), lr=1e-4)
        criterion = nn.MSELoss()

        loader = DataLoader(
            train_dataset,
            batch_size=BATCH_SIZE,
            shuffle=True,
            collate_fn=collate_batch
        )

        total_loss = 0.0
        batch_count = 0

        for epoch in range(NUM_EPOCHS):
            model.train()
            epoch_loss = 0.0

            for batch_idx, (images, target_grids, raw_annotations) in enumerate(loader):
                if batch_idx * BATCH_SIZE >= SMOKE_TRAIN_IMAGES:
                    break

                images = images.to(device)
                target_grids = target_grids.to(device)
                predictions = model(images)

                # Reshape predictions to match target grid
                if predictions.shape != target_grids.shape:
                    predictions_reshaped = torch.nn.functional.interpolate(
                        predictions.permute(0, 3, 1, 2),
                        size=(target_grids.shape[1], target_grids.shape[2]),
                        mode='bilinear',
                        align_corners=False
                    ).permute(0, 2, 3, 1)
                else:
                    predictions_reshaped = predictions

                loss = criterion(predictions_reshaped, target_grids)

                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

                epoch_loss += loss.item()
                batch_count += 1

            avg_loss = epoch_loss / max(batch_count, 1)
            print_status(7, f"Epoch {epoch+1}/{NUM_EPOCHS} - Avg Loss: {avg_loss:.4f}", "INFO")

        print_status(7, f"Training loop completed ({batch_count} batches, {NUM_EPOCHS} epochs)", "OK")
        return True
    except Exception as e:
        print_status(7, f"Training loop failed: {e}", "FAIL")
        import traceback
        traceback.print_exc()
        return False

def test_08_checkpoint_save():
    """Test 8: Checkpoint saving"""
    print_status(8, "Testing checkpoint save...")
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = build_detector_model(num_classes=NUM_CLASSES)
        model.to(device)

        checkpoint_dir = Path("trained_models")
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
        checkpoint_path = checkpoint_dir / "smoke_test_checkpoint.pth"

        checkpoint = {
            "model_state": model.state_dict(),
            "num_classes": NUM_CLASSES,
            "dataset": "rdd2022_india",
            "timestamp": "smoke_test"
        }

        torch.save(checkpoint, checkpoint_path)

        if not checkpoint_path.exists():
            print_status(8, f"Checkpoint file not created at {checkpoint_path}", "FAIL")
            return False

        # Verify it can be loaded
        loaded_checkpoint = torch.load(checkpoint_path)
        if "model_state" not in loaded_checkpoint:
            print_status(8, "Loaded checkpoint missing model_state", "FAIL")
            return False

        print_status(8, f"Checkpoint saved and verified ({checkpoint_path.stat().st_size} bytes)", "OK")
        checkpoint_path.unlink()  # Clean up
        return True
    except Exception as e:
        print_status(8, f"Checkpoint save failed: {e}", "FAIL")
        return False

def test_09_no_test_leakage(train_dataset):
    """Test 9: Verify no official test set in training data"""
    print_status(9, "Checking for test set leakage...")
    try:
        test_dataset = Rdd2022Dataset(split="test")

        # Get the image IDs from each dataset
        train_ids = set(train_dataset._ids) if hasattr(train_dataset, '_ids') else set()
        test_ids = set(test_dataset._ids) if hasattr(test_dataset, '_ids') else set()
        val_dataset = Rdd2022Dataset(split="val")
        val_ids = set(val_dataset._ids) if hasattr(val_dataset, '_ids') else set()

        # Check for overlaps
        train_val_overlap = train_ids & val_ids
        train_test_overlap = train_ids & test_ids
        val_test_overlap = val_ids & test_ids

        if len(train_val_overlap) > 0:
            print_status(9, f"TRAIN/VAL LEAKAGE: {len(train_val_overlap)} images", "FAIL")
            return False
        if len(train_test_overlap) > 0:
            print_status(9, f"TRAIN/TEST LEAKAGE: {len(train_test_overlap)} images", "FAIL")
            return False
        if len(val_test_overlap) > 0:
            print_status(9, f"VAL/TEST LEAKAGE: {len(val_test_overlap)} images", "FAIL")
            return False

        print_status(9, f"No leakage verified (train={len(train_ids)}, val={len(val_ids)}, test={len(test_ids)})", "OK")
        return True
    except Exception as e:
        print_status(9, f"Leakage check failed: {e}", "FAIL")
        return False

def test_10_metadata_preservation():
    """Test 10: Metadata preservation"""
    print_status(10, "Testing metadata preservation...")
    try:
        metadata_path = Path("trained_models/rdd2022-data-audit.json")
        if not metadata_path.exists():
            print_status(10, f"Metadata file not found at {metadata_path}", "FAIL")
            return False

        with open(metadata_path) as f:
            metadata = json.load(f)

        required_keys = ["zip_sha256", "total_images", "splits", "class_distribution"]
        for key in required_keys:
            if key not in metadata:
                print_status(10, f"Metadata missing required key: {key}", "FAIL")
                return False

        # Check that splits exist
        if not all(k in metadata["splits"] for k in ["train", "val", "test"]):
            print_status(10, f"Metadata splits missing train/val/test", "FAIL")
            return False

        if metadata["total_images"] != 9665:
            print_status(10, f"Total images mismatch: {metadata['total_images']} vs 9665", "FAIL")
            return False

        print_status(10, f"Metadata verified (archive SHA-256 present, splits valid)", "OK")
        return True
    except Exception as e:
        print_status(10, f"Metadata check failed: {e}", "FAIL")
        return False

def main():
    print("\n" + "="*70)
    print("SMOKE TEST: RDD2022 Detector Training (Phase 17)")
    print("="*70 + "\n")

    print("[INFO] CONFIGURATION")
    print(f"  Seed: {SEED}")
    print(f"  Batch size: {BATCH_SIZE}")
    print(f"  Epochs: {NUM_EPOCHS}")
    print(f"  Training images (smoke): {SMOKE_TRAIN_IMAGES}")
    print(f"  Classes: {NUM_CLASSES} ({', '.join(TRAINABLE_CLASSES)})")
    print()

    results = {}

    # Test 1: Load dataset
    train_dataset, val_dataset = test_01_load_dataset()
    results["test_01_load_dataset"] = train_dataset is not None and val_dataset is not None

    if not results["test_01_load_dataset"]:
        print("\n[FAIL] SMOKE TEST ABORTED: Cannot load dataset")
        return False

    # Test 2: Data shapes
    results["test_02_data_shapes"] = test_02_data_shapes(train_dataset, val_dataset)

    # Test 3: Model forward
    results["test_03_model_forward"] = test_03_model_forward(train_dataset)

    # Test 4: Loss computation
    results["test_04_loss_computation"] = test_04_loss_computation(train_dataset)

    # Test 5: Backward pass
    results["test_05_backward_pass"] = test_05_backward_pass(train_dataset)

    # Test 6: Optimizer step
    results["test_06_optimizer_step"] = test_06_optimizer_step(train_dataset)

    # Test 7: Mini training loop
    results["test_07_mini_training_loop"] = test_07_mini_training_loop(train_dataset)

    # Test 8: Checkpoint save
    results["test_08_checkpoint_save"] = test_08_checkpoint_save()

    # Test 9: No test leakage
    results["test_09_no_test_leakage"] = test_09_no_test_leakage(train_dataset)

    # Test 10: Metadata preservation
    results["test_10_metadata_preservation"] = test_10_metadata_preservation()

    # Summary
    print("\n" + "="*70)
    print("SMOKE TEST SUMMARY")
    print("="*70 + "\n")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"[{status:4s}] {test_name}")

    print()
    print(f"Overall: {passed}/{total} tests passed")

    if passed == total:
        print("\n[OK] RDD2022 SMOKE TEST PASSED - Ready for full training")
        return True
    else:
        print(f"\n[FAIL] RDD2022 SMOKE TEST FAILED - {total - passed} test(s) failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
