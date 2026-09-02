"""Evaluate the NAVORA RiskSNN on the final 200-row held-out test set."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-service"))
from app.model_validation import SNN_EVAL_MINIMUMS
from app.models.snn import RiskSNN
from app.route_risk_preprocessing import FEATURES, normalize_route_risk_vector

LABELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
LABEL_TO_INDEX = {label: idx for idx, label in enumerate(LABELS)}
EXPECTED_TEST_COUNTS = {"LOW": 50, "MEDIUM": 50, "HIGH": 50, "CRITICAL": 50}


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


def load_test_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = ["route_id", "route_risk_score"] + FEATURES
        missing = [name for name in required if name not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{path}: missing required columns: {missing}")
        rows = []
        for row in reader:
            score = float(row["route_risk_score"])
            rows.append({**row, "riskLabel": label_for_score(score)})
    return rows


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray):
    matrix = [[0 for _ in LABELS] for _ in LABELS]
    for actual, predicted in zip(y_true, y_pred):
        matrix[actual][predicted] += 1

    per_class = {}
    recalls = []
    f1_values = []
    for idx, label in enumerate(LABELS):
        tp = matrix[idx][idx]
        fp = sum(matrix[r][idx] for r in range(len(LABELS)) if r != idx)
        fn = sum(matrix[idx][c] for c in range(len(LABELS)) if c != idx)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        support = sum(matrix[idx])
        per_class[label] = {
            "precision": round(float(precision), 6),
            "recall": round(float(recall), 6),
            "f1": round(float(f1), 6),
            "support": support,
        }
        recalls.append(recall)
        f1_values.append(f1)

    accuracy = float(np.mean(y_true == y_pred))
    macro_f1 = float(np.mean(f1_values))
    balanced_accuracy = float(np.mean(recalls))
    return accuracy, macro_f1, balanced_accuracy, matrix, per_class


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk")
    parser.add_argument("--weights", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn.pt")
    parser.add_argument("--metadata", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn-metadata.json")
    parser.add_argument("--output", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn-evaluation.json")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    dataset_path = args.dataset / "test.csv"
    if not dataset_path.exists():
        raise SystemExit(f"Missing final test CSV: {dataset_path}")
    if not args.metadata.exists():
        raise SystemExit(f"Missing model metadata: {args.metadata}")
    if not args.weights.exists():
        raise SystemExit(f"Missing model weights: {args.weights}")

    rows = load_test_rows(dataset_path)
    if len(rows) != 200:
        raise SystemExit(f"Final test set must contain exactly 200 rows; found {len(rows)}")

    counts = {label: sum(1 for row in rows if row["riskLabel"] == label) for label in LABELS}
    if counts != EXPECTED_TEST_COUNTS:
        raise SystemExit(f"Final test set class counts must match {EXPECTED_TEST_COUNTS}; found {counts}")

    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    x = np.stack([normalize_route_risk_vector(row).astype(np.float32) for row in rows], axis=0)
    y = np.array([LABEL_TO_INDEX[row["riskLabel"]] for row in rows], dtype=np.int64)

    model = RiskSNN(input_size=len(FEATURES))
    model.load_state_dict(torch.load(args.weights, map_location="cpu", weights_only=True))
    model.eval()
    torch.manual_seed(args.seed)

    with torch.no_grad():
        seq = torch.stack([ (torch.rand_like(torch.from_numpy(x)) < torch.from_numpy(x).clamp(0, 1)).float() for _ in range(20) ])
        spikes, membranes = model(seq)
        logits = spikes.float().mean(0) + torch.softmax(membranes[-1], dim=-1)
        probs = torch.softmax(logits, dim=-1)
        pred = logits.argmax(dim=1).numpy()

    accuracy, macro_f1, balanced_accuracy, matrix, per_class = compute_metrics(y, pred)
    true_probs = probs[torch.arange(len(y)), y].clamp_min(1e-9)
    nll = float((-torch.log(true_probs).mean()).item())

    min_samples = SNN_EVAL_MINIMUMS["minSamples"]
    min_accuracy = SNN_EVAL_MINIMUMS["minAccuracy"]
    min_macro_f1 = SNN_EVAL_MINIMUMS["minMacroF1"]
    min_per_class_f1 = SNN_EVAL_MINIMUMS["minPerClassF1"]
    min_high_risk_recall = SNN_EVAL_MINIMUMS["minHighRiskRecall"]

    problems = []
    if len(rows) < min_samples:
        problems.append(f"sample count {len(rows)} below policy minimum {min_samples}")
    if accuracy < min_accuracy:
        problems.append(f"accuracy {accuracy:.6f} below policy minimum {min_accuracy}")
    if macro_f1 < min_macro_f1:
        problems.append(f"macroF1 {macro_f1:.6f} below policy minimum {min_macro_f1}")
    for label in LABELS:
        metric = per_class[label]
        if metric["f1"] < min_per_class_f1:
            problems.append(f"{label} F1 {metric['f1']:.6f} below policy minimum {min_per_class_f1}")
        if label in {"HIGH", "CRITICAL"} and metric["recall"] < min_high_risk_recall:
            problems.append(f"{label} recall {metric['recall']:.6f} below policy minimum {min_high_risk_recall}")

    # evalSha256 is bound externally by validation_evidence.py to the exact evaluation JSON.
    report = {
        "datasetVersion": metadata.get("datasetVersion", "prototype-v2"),
        "seed": metadata.get("seed", args.seed),
        "model": metadata.get("model", "RiskSNN"),
        "featureCount": len(FEATURES),
        "featureNames": FEATURES,
        "dataset": str(dataset_path),
        "testCsvSha256": sha256_file(dataset_path),
        "datasetSha256": sha256_file(dataset_path),
        "modelWeightSha256": sha256_file(args.weights),
        "samples": len(rows),
        "labels": LABELS,
        "accuracy": round(float(accuracy), 6),
        "macroF1": round(float(macro_f1), 6),
        "balancedAccuracy": round(float(balanced_accuracy), 6),
        "negativeLogLikelihood": round(float(nll), 6),
        "classSupport": counts,
        "confusionMatrix": matrix,
        "perClass": per_class,
        "thresholds": {
            "minSamples": min_samples,
            "minAccuracy": min_accuracy,
            "minMacroF1": min_macro_f1,
            "minPerClassF1": min_per_class_f1,
            "minHighRiskRecall": min_high_risk_recall,
        },
        "policyPassed": not problems,
        "validationEligible": not problems,
        "passed": not problems,
        "problems": problems,
    }
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if problems:
        raise SystemExit(2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
