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
ENCODINGS = {
    "traffic_level": "0=low, 1=medium, 2=high",
    "road_condition": "0=good, 1=moderate, 2=poor",
    "pothole_level": "0=none, 1=low, 2=medium, 3=severe",
    "road_damage_level": "0=none, 1=low, 2=medium, 3=severe",
    "road_blockage_level": "0=none, 1=low, 2=medium, 3=severe",
    "weather_condition": "0=clear, 1=cloudy, 2=rain, 3=heavy rain",
    "lighting_condition": "0=good, 1=moderate, 2=poor",
}


def make_records(count: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    records = []
    for i in range(count):
        distance = round(rng.uniform(1.5, 24.0), 3)
        traffic = rng.randint(0, 2)
        road = rng.randint(0, 2)
        pothole = rng.randint(0, 3)
        damage = rng.randint(0, 3)
        blockage = 3 if rng.random() < 0.04 else rng.randint(0, 2)
        weather = rng.randint(0, 3)
        lighting = rng.randint(0, 2)
        accident = round(rng.random(), 4)
        pedestrian = round(rng.random(), 4)
        vehicle = round(min(1.0, traffic / 2 + rng.uniform(-0.12, 0.12)), 4)
        width = round(rng.uniform(3.0, 14.0), 2)
        historical = round(rng.random(), 4)
        travel = round(distance * rng.uniform(1.8, 4.2) * (1 + traffic * 0.18), 3)
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
        score = round(max(0.0, min(1.0, score + rng.uniform(-0.025, 0.025))), 6)
        records.append({
            "route_id": f"route-{i + 1:04d}", "distance_km": distance,
            "travel_time_min": travel, "traffic_level": traffic,
            "road_condition": road, "pothole_level": pothole,
            "road_damage_level": damage, "road_blockage_level": blockage,
            "weather_condition": weather, "accident_risk": accident,
            "pedestrian_density": pedestrian, "vehicle_density": vehicle,
            "road_width": width, "lighting_condition": lighting,
            "historical_risk": historical, TARGET: score,
        })
    return records


def validate(records: list[dict]) -> dict:
    invalid = []
    ids = set()
    for row in records:
        if row["route_id"] in ids:
            invalid.append(row["route_id"])
        ids.add(row["route_id"])
        for key in FEATURES + [TARGET]:
            value = row.get(key)
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                invalid.append(f"{row['route_id']}:{key}")
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
    shuffled = records[:]
    random.Random(args.seed).shuffle(shuffled)
    n_train = int(len(records) * 0.70)
    n_val = int(len(records) * 0.15)
    splits = {"train": shuffled[:n_train], "val": shuffled[n_train:n_train + n_val], "test": shuffled[n_train + n_val:]}
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
