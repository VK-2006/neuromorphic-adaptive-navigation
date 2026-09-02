"""Create and validate the small, deterministic NAVORA route-risk prototype dataset."""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
from pathlib import Path

FEATURES = [
    "distance_km", "travel_time_min", "traffic_level", "road_condition",
    "pothole_level", "road_damage_level", "road_blockage_level",
    "weather_condition", "accident_risk", "pedestrian_density",
    "vehicle_density", "road_width", "lighting_condition", "historical_risk",
]
TARGET = "route_risk_score"
CLASS_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
CLASS_BOUNDS = {
    "LOW": (0.08, 0.24),
    "MEDIUM": (0.30, 0.49),
    "HIGH": (0.55, 0.74),
    "CRITICAL": (0.80, 0.94),
}
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


def _choose_by_class(label: str, rng: random.Random, options: list[float]) -> float:
    return round(float(rng.choice(options)), 4)


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
    return {
        "route_id": f"route-{route_index:04d}",
        **frag,
        TARGET: score,
    }


def make_records(count: int, seed: int) -> list[dict]:
    if count % len(CLASS_ORDER) != 0:
        raise ValueError("count must be divisible by the number of target classes")
    rng = random.Random(seed)
    per_class = count // len(CLASS_ORDER)
    records: list[dict] = []
    route_index = 1
    for label in CLASS_ORDER:
        for _ in range(per_class):
            records.append(make_record(label, route_index, rng))
            route_index += 1
    rng.shuffle(records)
    return records


def validate(records: list[dict]) -> dict:
    invalid = []
    ids = set()
    range_checks = {
        "vehicle_density": (0.0, 1.0),
        "accident_risk": (0.0, 1.0),
        "pedestrian_density": (0.0, 1.0),
        "historical_risk": (0.0, 1.0),
        "route_risk_score": (0.0, 1.0),
    }
    for row in records:
        if row["route_id"] in ids:
            invalid.append(row["route_id"])
        ids.add(row["route_id"])
        for key in FEATURES + [TARGET]:
            value = row.get(key)
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                invalid.append(f"{row['route_id']}:{key}")
                continue
            lower, upper = range_checks.get(key, (-float("inf"), float("inf")))
            if value < lower or value > upper:
                invalid.append(f"{row['route_id']}:{key}:{value}")
    return {
        "records": len(records),
        "featureCount": len(FEATURES),
        "target": TARGET,
        "duplicateRecords": len(records) - len(ids),
        "invalidValues": invalid,
        "passed": not invalid and len(records) == len(ids),
        "featureRanges": {key: [min(float(r[key]) for r in records), max(float(r[key]) for r in records)] for key in FEATURES + [TARGET]},
    }


def write_csv(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["route_id"] + FEATURES + [TARGET])
        writer.writeheader()
        writer.writerows(records)


def label_for_score(score: float) -> str:
    if score < 0.25:
        return "LOW"
    if score < 0.5:
        return "MEDIUM"
    if score < 0.75:
        return "HIGH"
    return "CRITICAL"


def stratified_splits(records: list[dict], seed: int) -> dict[str, list[dict]]:
    by_class = {label: [] for label in CLASS_ORDER}
    for row in records:
        by_class[label_for_score(float(row[TARGET]))].append(row)
    rng = random.Random(seed)
    splits = {"train": [], "val": [], "test": []}
    for label in CLASS_ORDER:
        rows = by_class[label][:]
        rng.shuffle(rows)
        n_train = int(len(rows) * 0.70)
        n_val = int(len(rows) * 0.15)
        splits["train"].extend(rows[:n_train])
        splits["val"].extend(rows[n_train:n_train + n_val])
        splits["test"].extend(rows[n_train + n_val:])
    return splits


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("ai-service/datasets/navora_route_risk"))
    parser.add_argument("--records", type=int, default=800)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.records < 500 or args.records > 1000:
        raise SystemExit("--records must be between 500 and 1000")
    records = make_records(args.records, args.seed)
    report = validate(records)
    if not report["passed"]:
        raise SystemExit(json.dumps(report, indent=2))
    splits = stratified_splits(records, args.seed)
    args.output.mkdir(parents=True, exist_ok=True)
    write_csv(args.output / "navora_route_risk.csv", records)
    for name, rows in splits.items():
        write_csv(args.output / f"{name}.csv", rows)
    (args.output / "dataset_validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    metadata = {
        "name": "NAVORA Route Risk Dataset", "version": "prototype-v1",
        "description": "NAVORA Route Risk Dataset is a manually curated prototype dataset created for evaluating and demonstrating the NAVORA mini-project.",
        "seed": args.seed, "records": len(records), "features": FEATURES,
        "target": TARGET, "encodings": ENCODINGS,
        "splits": {name: len(rows) for name, rows in splits.items()},
        "validation": "dataset_validation.json",
    }
    (args.output / "dataset_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "splits": metadata["splits"], "passed": True}, indent=2))


if __name__ == "__main__":
    main()
