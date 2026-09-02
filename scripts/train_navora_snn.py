"""Train RiskSNN on the reproducible NAVORA Route Risk prototype CSVs."""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-service"))
from app.models.snn import RiskSNN

FEATURES = ["distance_km", "travel_time_min", "traffic_level", "road_condition",
            "pothole_level", "road_damage_level", "road_blockage_level",
            "weather_condition", "accident_risk", "pedestrian_density",
            "vehicle_density", "road_width", "lighting_condition", "historical_risk"]


def read_csv(path: Path):
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    x = np.array([[float(row[key]) for key in FEATURES] for row in rows], dtype=np.float32)
    x[:, 0] /= 24; x[:, 1] /= 100; x[:, 2:3] /= 2; x[:, 3:7] /= 3
    x[:, 7] /= 3; x[:, 11] = 1 - x[:, 11] / 14; x[:, 12] /= 2
    y_score = np.array([float(row["route_risk_score"]) for row in rows], dtype=np.float32)
    y = np.select([y_score < .25, y_score < .5, y_score < .75], [0, 1, 2], default=3).astype(np.int64)
    return torch.from_numpy(x), torch.from_numpy(y), y_score


def sequence(x: torch.Tensor, steps: int = 20) -> torch.Tensor:
    return torch.stack([(torch.rand_like(x) < x.clamp(0, 1)).float() for _ in range(steps)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    train_x, train_y, _ = read_csv(args.dataset / "train.csv")
    val_x, val_y, _ = read_csv(args.dataset / "val.csv")
    test_x, test_y, test_scores = read_csv(args.dataset / "test.csv")
    model = RiskSNN(input_size=len(FEATURES))
    optimizer = torch.optim.Adam(model.parameters(), lr=5e-3)
    criterion = torch.nn.CrossEntropyLoss()
    loader = DataLoader(TensorDataset(train_x, train_y), batch_size=args.batch_size, shuffle=True)
    best = (float("inf"), None)
    history = []
    for epoch in range(1, args.epochs + 1):
        model.train(); loss_sum = 0.0
        for xb, yb in loader:
            optimizer.zero_grad()
            spikes, mem = model(sequence(xb))
            logits = spikes.float().mean(0) + torch.softmax(mem[-1], -1)
            loss = criterion(logits, yb); loss.backward(); optimizer.step()
            loss_sum += loss.item() * len(xb)
        model.eval()
        with torch.no_grad():
            spikes, mem = model(sequence(val_x))
            val_logits = spikes.float().mean(0) + torch.softmax(mem[-1], -1)
            val_loss = criterion(val_logits, val_y).item()
        history.append({"epoch": epoch, "trainLoss": loss_sum / len(train_x), "valLoss": val_loss})
        if val_loss < best[0]: best = (val_loss, {k: v.detach().clone() for k, v in model.state_dict().items()})
    model.load_state_dict(best[1]); model.eval()
    with torch.no_grad():
        spikes, mem = model(sequence(test_x)); logits = spikes.float().mean(0) + torch.softmax(mem[-1], -1)
        pred = logits.argmax(1).numpy()
    metrics = {"samples": len(test_y), "accuracy": float(accuracy_score(test_y, pred)),
               "macroF1": float(f1_score(test_y, pred, average="macro", zero_division=0)),
               "maeRiskScore": float(mean_absolute_error(test_scores, pred / 3))}
    out = ROOT / "ai-service/trained_models"; out.mkdir(exist_ok=True)
    weights = out / "navora-risk-snn.pt"; torch.save(model.state_dict(), weights)
    (out / "navora-risk-snn-metadata.json").write_text(json.dumps({
        "model": "RiskSNN", "riskModelVersion": "navora-risk-snn-prototype-v1",
        "dataset": "NAVORA Route Risk Dataset prototype-v1",
        "features": FEATURES, "seed": args.seed, "epochs": args.epochs,
        "batchSize": args.batch_size, "optimizer": "Adam", "learningRate": 5e-3,
        "trainSamples": len(train_y), "validationSamples": len(val_y),
        "testSamples": len(test_y), "history": history, "testMetrics": metrics,
        "validated": False, "note": "Prototype data; independent real-world validation is required.",
    }, indent=2), encoding="utf-8")
    print(json.dumps({"weights": str(weights), "metrics": metrics}, indent=2))


if __name__ == "__main__":
    main()
