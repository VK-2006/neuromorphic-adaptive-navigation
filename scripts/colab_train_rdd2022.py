"""Reproducible Google Colab GPU entry point for the RDD2022 detector."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ["D00", "D01", "D10", "D11", "D20", "D40", "D43", "D44", "D50"]


def rows(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def verify_manifest(path: Path, expected: int, dataset_root: Path) -> None:
    data = rows(path)
    if len(data) != expected:
        raise SystemExit(f"{path}: expected {expected} rows, found {len(data)}")
    classes = {ann["class"] for row in data for ann in row.get("boxes", [])}
    if classes != set(CANONICAL):
        raise SystemExit(f"{path}: class contract mismatch: {sorted(classes)}")
    missing = [row["image"] for row in data if not (dataset_root / row["image"]).exists() and not Path(row["image"]).is_absolute()]
    if missing:
        raise SystemExit(f"{path}: {len(missing)} relative image paths are missing under {dataset_root}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset-root", type=Path, default=ROOT)
    ap.add_argument("--train-manifest", type=Path, default=ROOT / "datasets/derived-risk-data/detection-train.jsonl")
    ap.add_argument("--eval-manifest", type=Path, default=ROOT / "datasets/derived-risk-data/detection-eval.jsonl")
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--num-workers", type=int, default=2)
    ap.add_argument("--architecture", choices=("resnet50", "mobilenet320"), default="resnet50")
    ap.add_argument("--checkpoint", type=Path, default=ROOT / "ai-service/trained_models/detector-training-checkpoint.pt")
    ap.add_argument("--no-resume", action="store_true")
    ap.add_argument("--amp", action="store_true")
    ap.add_argument("--validate", action="store_true")
    args = ap.parse_args()

    if not __import__("torch").cuda.is_available():
        raise SystemExit("CUDA is required for Colab training but is unavailable")
    verify_manifest(args.train_manifest, 6163, args.dataset_root)
    verify_manifest(args.eval_manifest, 1542, args.dataset_root)
    args.checkpoint.parent.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable, str(ROOT / "scripts/train_detector.py"),
        "--manifest", str(args.train_manifest), "--dataset-root", str(args.dataset_root),
        "--device", "cuda", "--epochs", str(args.epochs), "--batch-size", str(args.batch_size),
        "--num-workers", str(args.num_workers), "--architecture", args.architecture,
        "--resume", str(args.checkpoint),
    ]
    if args.no_resume: command.append("--no-resume")
    if args.amp: command.append("--amp")
    log_path = args.checkpoint.with_suffix(".log")
    with log_path.open("a", encoding="utf-8") as log:
        subprocess.run(command, check=True, stdout=log, stderr=subprocess.STDOUT)
    if args.validate:
        subprocess.run([
            sys.executable, str(ROOT / "scripts/evaluate_detector.py"),
            "--manifest", str(args.eval_manifest), "--dataset-root", str(args.dataset_root),
            "--weights", str(ROOT / "ai-service/trained_models/detector.pt"),
        ], check=True)


if __name__ == "__main__":
    main()
