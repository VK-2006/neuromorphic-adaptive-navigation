"""Validate the NAVORA route-risk CSV splits for the camera-free RiskSNN pipeline."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-service"))
from app.model_validation import DATA_GATE_MINIMUMS
from app.route_risk_preprocessing import FEATURES

CLASS_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
TARGET = "route_risk_score"
EXPECTED_TRAIN = 600
EXPECTED_VAL = 200
EXPECTED_TEST = 200


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def label_for_score(score: float) -> str:
    if score < 0.25:
        return "LOW"
    if score < 0.5:
        return "MEDIUM"
    if score < 0.75:
        return "HIGH"
    return "CRITICAL"


def read_route_risk_csv(path: Path) -> list[dict]:
    if not path.exists():
        raise ValueError(f"missing CSV: {path}")
    with path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = ["route_id"] + FEATURES + [TARGET]
        missing = [name for name in required if name not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{path}: missing columns: {missing}")
        rows = []
        for line_no, row in enumerate(reader, start=2):
            route_id = (row.get("route_id") or "").strip()
            if not route_id:
                raise ValueError(f"{path}:{line_no}: missing route_id")
            score = float(row.get(TARGET, "nan"))
            if not math.isfinite(score) or not 0.0 <= score <= 1.0:
                raise ValueError(f"{path}:{line_no}: route_risk_score must be finite and in [0,1]")
            for key in FEATURES:
                value = row.get(key)
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    raise ValueError(f"{path}:{line_no}: non-numeric {key}={value!r}")
                if key in {"accident_risk", "pedestrian_density", "vehicle_density", "historical_risk"} and not 0.0 <= value <= 1.0:
                    raise ValueError(f"{path}:{line_no}: {key}={value} is outside [0,1]")
                if not math.isfinite(value):
                    raise ValueError(f"{path}:{line_no}: {key} is not finite")
            rows.append({**row, "_inferred_label": label_for_score(score)})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk/train.csv")
    parser.add_argument("--val", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk/val.csv")
    parser.add_argument("--test", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk/test.csv")
    parser.add_argument("--out", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-data-gate.json")
    parser.add_argument("--min-train", type=int, default=DATA_GATE_MINIMUMS["minSnnTrainRows"])
    parser.add_argument("--min-eval", type=int, default=DATA_GATE_MINIMUMS["minSnnEvalRows"])
    parser.add_argument("--min-class", type=int, default=DATA_GATE_MINIMUMS["minSnnEvalSamplesPerClass"])
    args = parser.parse_args()

    problems = []
    if args.min_train < DATA_GATE_MINIMUMS["minSnnTrainRows"]:
        problems.append(f"--min-train {args.min_train} below policy floor {DATA_GATE_MINIMUMS['minSnnTrainRows']}")
    if args.min_eval < DATA_GATE_MINIMUMS["minSnnEvalRows"]:
        problems.append(f"--min-eval {args.min_eval} below policy floor {DATA_GATE_MINIMUMS['minSnnEvalRows']}")
    if args.min_class < DATA_GATE_MINIMUMS["minSnnEvalSamplesPerClass"]:
        problems.append(f"--min-class {args.min_class} below policy floor {DATA_GATE_MINIMUMS['minSnnEvalSamplesPerClass']}")

    try:
        train_rows = read_route_risk_csv(args.train)
        val_rows = read_route_risk_csv(args.val)
        test_rows = read_route_risk_csv(args.test)
    except Exception as exc:
        print("NAVORA DATA GATE: BLOCKED")
        print("-", exc)
        return 2

    train_ids = {row["route_id"] for row in train_rows}
    val_ids = {row["route_id"] for row in val_rows}
    test_ids = {row["route_id"] for row in test_rows}
    train_val_overlap = train_ids & val_ids
    train_test_overlap = train_ids & test_ids
    val_test_overlap = val_ids & test_ids

    if len(train_rows) < args.min_train:
        problems.append(f"train rows {len(train_rows)} < {args.min_train}")
    if len(val_rows) < args.min_eval:
        problems.append(f"validation rows {len(val_rows)} < {args.min_eval}")
    if len(test_rows) < args.min_eval:
        problems.append(f"final test rows {len(test_rows)} < {args.min_eval}")
    if len(train_rows) != EXPECTED_TRAIN:
        problems.append(f"train rows expected {EXPECTED_TRAIN}, found {len(train_rows)}")
    if len(val_rows) != EXPECTED_VAL:
        problems.append(f"validation rows expected {EXPECTED_VAL}, found {len(val_rows)}")
    if len(test_rows) != EXPECTED_TEST:
        problems.append(f"final test rows expected {EXPECTED_TEST}, found {len(test_rows)}")

    if train_val_overlap:
        problems.append(f"train/val overlap: {len(train_val_overlap)} shared route IDs")
    if train_test_overlap:
        problems.append(f"train/test overlap: {len(train_test_overlap)} shared route IDs")
    if val_test_overlap:
        problems.append(f"val/test overlap: {len(val_test_overlap)} shared route IDs")

    if len(train_ids) != len(train_rows):
        problems.append(f"train split contains duplicate route IDs: {len(train_rows) - len(train_ids)}")
    if len(val_ids) != len(val_rows):
        problems.append(f"validation split contains duplicate route IDs: {len(val_rows) - len(val_ids)}")
    if len(test_ids) != len(test_rows):
        problems.append(f"final test split contains duplicate route IDs: {len(test_rows) - len(test_ids)}")

    train_counts = Counter(row["_inferred_label"] for row in train_rows)
    val_counts = Counter(row["_inferred_label"] for row in val_rows)
    test_counts = Counter(row["_inferred_label"] for row in test_rows)
    for label in CLASS_ORDER:
        if train_counts.get(label, 0) < 150:
            problems.append(f"train class {label} count {train_counts.get(label, 0)} < 150")
        if val_counts.get(label, 0) < 50:
            problems.append(f"validation class {label} count {val_counts.get(label, 0)} < 50")
        if test_counts.get(label, 0) < 50:
            problems.append(f"final test class {label} count {test_counts.get(label, 0)} < 50")

    report = {
        "passed": not problems,
	"policyCompliant": not problems,
        "datasetVersion": "prototype-v2",
        "featureCount": len(FEATURES),
        "featureNames": FEATURES,
        "seed": 42,
        "expected": {
            "trainRows": EXPECTED_TRAIN,
            "validationRows": EXPECTED_VAL,
            "finalTestRows": EXPECTED_TEST,
            "trainClassCounts": {label: 150 for label in CLASS_ORDER},
            "validationClassCounts": {label: 50 for label in CLASS_ORDER},
            "finalTestClassCounts": {label: 50 for label in CLASS_ORDER},
        },
        "observed": {
            "trainRows": len(train_rows),
            "validationRows": len(val_rows),
            "finalTestRows": len(test_rows),
            "trainClassCounts": dict(train_counts),
            "validationClassCounts": dict(val_counts),
            "finalTestClassCounts": dict(test_counts),
        },
        "hashes": {
            "trainCsvSha256": sha256_file(args.train),
            "valCsvSha256": sha256_file(args.val),
            "testCsvSha256": sha256_file(args.test),
        },
        "splitOverlap": {
            "trainValRouteIds": len(train_val_overlap),
            "trainTestRouteIds": len(train_test_overlap),
            "valTestRouteIds": len(val_test_overlap),
        },
        "thresholds": {
            "minSnnTrainRows": DATA_GATE_MINIMUMS["minSnnTrainRows"],
            "minSnnEvalRows": DATA_GATE_MINIMUMS["minSnnEvalRows"],
            "minSnnEvalSamplesPerClass": DATA_GATE_MINIMUMS["minSnnEvalSamplesPerClass"],
        },
        "problems": problems,
    }
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if problems:
        print("NAVORA DATA GATE: BLOCKED")
        return 2
    print("NAVORA DATA GATE: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
