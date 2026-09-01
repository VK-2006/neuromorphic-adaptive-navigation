#!/usr/bin/env python3
"""Analyze class imbalance and compute class weights for RDD2022."""

import json
from pathlib import Path
import numpy as np

# Load audit
audit_path = Path("trained_models/rdd2022-data-audit.json")
with audit_path.open() as f:
    audit = json.load(f)

class_dist = audit["class_distribution"]
total = sum(class_dist.values())

print("=== RDD2022 CLASS DISTRIBUTION ===\n")
print(f"Total annotations: {total}\n")

# Display distribution
print("Class Distribution:")
for cls, count in sorted(class_dist.items(), key=lambda x: -x[1]):
    pct = 100 * count / total
    print(f"  {cls}: {count:>5} ({pct:>5.1f}%)")

# Compute class weights (inverse frequency)
print("\n=== CLASS WEIGHTS (Inverse Frequency) ===\n")
max_count = max(class_dist.values())
weights = {}
for cls, count in class_dist.items():
    weight = max_count / count  # Higher weight for rarer classes
    weights[cls] = weight
    print(f"  {cls}: {weight:.3f}")

# Normalize so mean is 1
mean_weight = np.mean(list(weights.values()))
normalized = {cls: w / mean_weight for cls, w in weights.items()}
print("\n=== NORMALIZED WEIGHTS (mean=1) ===\n")
for cls, weight in sorted(normalized.items(), key=lambda x: -x[1]):
    print(f"  {cls}: {weight:.3f}")

# Save weights
weights_file = Path("trained_models/rdd2022-class-weights.json")
with weights_file.open("w") as f:
    json.dump({"raw": weights, "normalized": normalized}, f, indent=2)
print(f"\nWeights saved to: {weights_file}")
