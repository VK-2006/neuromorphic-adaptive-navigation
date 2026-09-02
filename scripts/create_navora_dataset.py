"""Create the deterministic NAVORA route-risk prototype-v2 dataset."""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
from pathlib import Path

FEATURES = [
    "distance_km",
    "travel_time_min",
    "traffic_level",
    "road_condition",
    "pothole_level",
    "road_damage_level",
    "road_blockage_level",
    "weather_condition",
    "accident_risk",
    "pedestrian_density",
    "vehicle_density",
    "road_width",
    "lighting_condition",
    "historical_risk",
]
TARGET = "route_risk_score"
CLASS_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
CLASS_BOUNDS = {
    "LOW": (0.08, 0.24),
    "MEDIUM": (0.30, 0.49),
    "HIGH": (0.55, 0.74),
    "CRITICAL": (0.80, 0.94),
}
EXPECTED_CLASS_COUNTS = {label: 250 for label in CLASS_ORDER}
EXPECTED_SPLITS = {"train": 600, "val": 200, "test": 200}
ENCODINGS = {
    "traffic_level": "0=low, 1=medium, 2=high",
    "road_condition": "0=good, 1=moderate, 2=poor",
    "pothole_level": "0=none, 1=low, 2=medium, 3=severe",
    "road_damage_level": "0=none, 1=low, 2=medium, 3=severe",
    "road_blockage_level": "0=none, 1=low, 2=medium, 3=severe",
    "weather_condition": "0=clear, 1=cloudy, 2=rain, 3=heavy rain",
    "lighting_condition": "0=good, 1=moderate, 2=poor",
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def label_for_score(score: float) -> str:
    if score < 0.25:
        return "LOW"
    if score < 0.5:
        return "MEDIUM"
    if score < 0.75:
        return "HIGH"
    return "CRITICAL"


def make_record(label: str, route_index: int, rng: random.Random) -> dict:
    if label == "LOW":
        distance = round(rng.uniform(1.5, 8.0), 3)
        traffic = rng.choice([0, 0, 1, 1])
        road = rng.choice([0, 0, 1])
        pothole = rng.choice([0, 0, 1])
        damage = rng.choice([0, 0, 1])
        blockage = rng.choice([0, 0, 0, 1])
        weather = rng.choice([0, 0, 1, 2])
        lighting = rng.choice([0, 0, 1])
        accident = round(rng.uniform(0.02, 0.28), 4)
        pedestrian = round(rng.uniform(0.02, 0.28), 4)
        vehicle = round(clamp(traffic / 2 + rng.uniform(-0.10, 0.12)), 4)
        width = round(rng.uniform(8.0, 14.0), 2)
        historical = round(rng.uniform(0.05, 0.28), 4)
    elif label == "MEDIUM":
        distance = round(rng.uniform(5.0, 14.0), 3)
        traffic = rng.choice([1, 1, 1, 2])
        road = rng.choice([0, 1, 1, 2])
        pothole = rng.choice([0, 1, 1, 2])
        damage = rng.choice([0, 1, 1, 2])
        blockage = rng.choice([0, 1, 2])
        weather = rng.choice([1, 2, 2, 3])
        lighting = rng.choice([0, 1, 1, 2])
        accident = round(rng.uniform(0.25, 0.52), 4)
        pedestrian = round(rng.uniform(0.22, 0.55), 4)
        vehicle = round(clamp(traffic / 2 + rng.uniform(-0.08, 0.18)), 4)
        width = round(rng.uniform(4.5, 12.0), 2)
        historical = round(rng.uniform(0.24, 0.52), 4)
    elif label == "HIGH":
        distance = round(rng.uniform(9.0, 19.0), 3)
        traffic = rng.choice([1, 2, 2])
        road = rng.choice([1, 1, 2, 2])
        pothole = rng.choice([1, 2, 2, 3])
        damage = rng.choice([1, 2, 2, 3])
        blockage = rng.choice([1, 2, 3])
        weather = rng.choice([2, 2, 3])
        lighting = rng.choice([1, 1, 2])
        accident = round(rng.uniform(0.55, 0.78), 4)
        pedestrian = round(rng.uniform(0.50, 0.78), 4)
        vehicle = round(clamp(traffic / 2 + rng.uniform(-0.05, 0.22)), 4)
        width = round(rng.uniform(3.0, 9.5), 2)
        historical = round(rng.uniform(0.55, 0.78), 4)
    else:
        distance = round(rng.uniform(12.0, 24.0), 3)
        traffic = 2
        road = 2
        pothole = rng.choice([2, 3, 3])
        damage = rng.choice([2, 3, 3])
        blockage = 3
        weather = rng.choice([2, 3, 3])
        lighting = rng.choice([1, 2, 2])
        accident = round(rng.uniform(0.75, 0.98), 4)
        pedestrian = round(rng.uniform(0.72, 0.96), 4)
        vehicle = round(clamp(0.95 + rng.uniform(-0.08, 0.08)), 4)
        width = round(rng.uniform(3.0, 7.5), 2)
        historical = round(rng.uniform(0.72, 0.96), 4)

    travel = round(distance * rng.uniform(1.8, 4.2) * (1 + traffic * 0.18), 3)
    frag = {
        "distance_km": distance,
        "travel_time_min": travel,
        "traffic_level": traffic,
        "road_condition": road,
        "pothole_level": pothole,
        "road_damage_level": damage,
        "road_blockage_level": blockage,
        "weather_condition": weather,
        "accident_risk": accident,
        "pedestrian_density": pedestrian,
        "vehicle_density": vehicle,
        "road_width": width,
        "lighting_condition": lighting,
        "historical_risk": historical,
    }
    score = (
        0.08 * min(distance / 24, 1)
        + 0.10 * min(travel / 100, 1)
        + 0.10 * traffic / 2
        + 0.08 * road / 2
        + 0.11 * pothole / 3
        + 0.10 * damage / 3
        + 0.12 * blockage / 3
        + 0.08 * weather / 3
        + 0.07 * accident
        + 0.04 * pedestrian
        + 0.04 * vehicle
        + 0.03 * (1 - min(width / 14, 1))
        + 0.02 * lighting / 2
        + 0.03 * historical
    )
    lower, upper = CLASS_BOUNDS[label]
    if label == "LOW":
        score = clamp(score * 0.45 + 0.08, lower, upper)
    elif label == "MEDIUM":
        score = clamp(score * 0.65 + 0.12, lower, upper)
    elif label == "HIGH":
        score = clamp(score * 0.82 + 0.12, lower, upper)
    else:
        score = clamp(score * 0.92 + 0.10, lower, upper)
    score = round(clamp(score, 0.0, 1.0), 6)
    return {"route_id": f"route-{route_index:04d}", **frag, TARGET: score}


def make_records(total: int, seed: int) -> list[dict]:
    if total != 1000:
        raise ValueError("NAVORA prototype-v2 requires exactly 1000 rows for exact 250/class balance")
    rng = random.Random(seed)
    records: list[dict] = []
    route_index = 1
    for label in CLASS_ORDER:
        for _ in range(EXPECTED_CLASS_COUNTS[label]):
            records.append(make_record(label, route_index, rng))
            route_index += 1
    rng.shuffle(records)
    return records


def validate_records(records: list[dict]) -> dict:
    invalid = []
    route_ids = set()
    class_counts = {label: 0 for label in CLASS_ORDER}
    range_checks = {
        "vehicle_density": (0.0, 1.0),
        "accident_risk": (0.0, 1.0),
        "pedestrian_density": (0.0, 1.0),
        "historical_risk": (0.0, 1.0),
        "route_risk_score": (0.0, 1.0),
    }
    for row in records:
        route_id = row.get("route_id")
        if route_id in route_ids:
            invalid.append(f"duplicate route_id {route_id}")
        route_ids.add(route_id)
        s = float(row[TARGET])
        inferred = label_for_score(s)
        class_counts[inferred] = class_counts.get(inferred, 0) + 1
        for key in FEATURES + [TARGET]:
            value = row.get(key)
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                invalid.append(f"{route_id}:{key}: non-numeric")
                continue
            lower, upper = range_checks.get(key, (-float("inf"), float("inf")))
            if value < lower or value > upper:
                invalid.append(f"{route_id}:{key}:{value}")
    expected_total = sum(EXPECTED_CLASS_COUNTS.values())
    class_ok = class_counts == EXPECTED_CLASS_COUNTS
    passed = (
        len(records) == expected_total
        and len(route_ids) == len(records)
        and not invalid
        and class_ok
    )
    return {
        "passed": passed,
        "records": len(records),
        "duplicateRecords": len(records) - len(route_ids),
        "featureCount": len(FEATURES),
        "target": TARGET,
        "classCounts": class_counts,
        "expectedClassCounts": EXPECTED_CLASS_COUNTS,
        "invalidValues": invalid,
        "featureRanges": {
            key: [min(float(r[key]) for r in records), max(float(r[key]) for r in records)]
            for key in FEATURES + [TARGET]
        },
    }


def split_records(records: list[dict], seed: int) -> dict[str, list[dict]]:
    by_class = {label: [] for label in CLASS_ORDER}
    for row in records:
        by_class[label_for_score(float(row[TARGET]))].append(row)
    rng = random.Random(seed)
    splits = {"train": [], "val": [], "test": []}
    for label in CLASS_ORDER:
        rows = by_class[label][:]
        rng.shuffle(rows)
        splits["train"].extend(rows[:150])
        splits["val"].extend(rows[150:200])
        splits["test"].extend(rows[200:250])
    return splits


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["route_id"] + FEATURES + [TARGET])
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("ai-service/datasets/navora_route_risk"))
    parser.add_argument("--records", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if args.records != 1000:
        raise SystemExit("NAVORA prototype-v2 requires exactly 1000 rows; exact 250/class balance is mandatory")
    records = make_records(args.records, args.seed)
    validation = validate_records(records)
    if not validation["passed"]:
        raise SystemExit(json.dumps(validation, indent=2))

    splits = split_records(records, args.seed)
    args.output.mkdir(parents=True, exist_ok=True)
    write_csv(args.output / "navora_route_risk.csv", records)
    for split_name, rows in splits.items():
        write_csv(args.output / f"{split_name}.csv", rows)

    split_counts = {name: len(rows) for name, rows in splits.items()}
    class_counts = {name: {label: sum(1 for row in rows if label_for_score(float(row[TARGET])) == label) for label in CLASS_ORDER} for name, rows in splits.items()}
    metadata = {
        "name": "NAVORA Route Risk Dataset",
        "version": "prototype-v2",
        "description": "NAVORA camera-free route-risk prototype dataset generated deterministically for reproducible validation and evaluation.",
        "seed": args.seed,
        "records": len(records),
        "features": FEATURES,
        "target": TARGET,
        "encodings": ENCODINGS,
        "splits": split_counts,
        "classCounts": {
            "total": validation["classCounts"],
            "train": class_counts["train"],
            "val": class_counts["val"],
            "test": class_counts["test"],
        },
        "validation": "dataset_validation.json",
    }
    (args.output / "dataset_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (args.output / "dataset_validation.json").write_text(json.dumps(validation, indent=2), encoding="utf-8")

    print(json.dumps({
        "output": str(args.output),
        "total": len(records),
        "splits": split_counts,
        "classCounts": metadata["classCounts"],
        "passed": True,
    }, indent=2))


if __name__ == "__main__":
    main()
