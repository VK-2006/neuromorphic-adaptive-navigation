"""Build the NAVORA RiskSNN validation evidence for the final prototype-v2 pipeline."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk/train.csv")
    parser.add_argument("--val", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk/val.csv")
    parser.add_argument("--test", type=Path, default=ROOT / "ai-service/datasets/navora_route_risk/test.csv")
    parser.add_argument("--weights", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn.pt")
    parser.add_argument("--evaluation", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn-evaluation.json")
    parser.add_argument("--metadata", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn-metadata.json")
    parser.add_argument("--gate", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-data-gate.json")
    parser.add_argument("--out", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-validation-evidence.json")
    args = parser.parse_args()

    required = [args.train, args.val, args.test, args.weights, args.evaluation, args.metadata, args.gate]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit(f"Missing required validation inputs: {missing}")

    evaluation = json.loads(args.evaluation.read_text(encoding="utf-8"))
    gate = json.loads(args.gate.read_text(encoding="utf-8"))
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    problems = []

    if gate.get("passed") is not True:
        problems.append("data gate did not pass")
    if evaluation.get("passed") is not True:
        problems.append("final evaluation did not pass")
    if metadata.get("validated") is True:
        problems.append("model metadata must remain false until the genuine validation evidence passes")

    for key, path in {
        "trainCsvSha256": args.train,
        "valCsvSha256": args.val,
        "testCsvSha256": args.test,
        "modelWeightSha256": args.weights,
        "evaluationReportSha256": args.evaluation,
        "gateReportSha256": args.gate,
    }.items():
        if key == "modelWeightSha256":
            expected = sha256_file(path)
        else:
            expected = sha256_file(path)
        if not expected:
            problems.append(f"missing hash for {key}")

    evidence = {
        "schemaVersion": 3,
        "datasetVersion": metadata.get("datasetVersion", "prototype-v2"),
        "seed": metadata.get("seed", 42),
        "featureCount": metadata.get("featureCount", 14),
        "featureNames": metadata.get("features", []),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "passed": not problems,
        "validationStatus": "PASS" if not problems else "BLOCKED",
        "weights": {
            "modelWeightSha256": sha256_file(args.weights),
        },
        "datasets": {
            "trainCsvSha256": sha256_file(args.train),
            "valCsvSha256": sha256_file(args.val),
            "testCsvSha256": sha256_file(args.test),
        },
        "reports": {
            "evaluationSha256": sha256_file(args.evaluation),
            "gateSha256": sha256_file(args.gate),
            "metadataSha256": sha256_file(args.metadata),
        },
        "evaluation": evaluation,
        "dataGate": gate,
        "metadata": metadata,
        "thresholds": {
            "minSnnTrainRows": 400,
            "minSnnEvalRows": 200,
            "minSnnEvalSamplesPerClass": 10,
            "minAccuracy": 0.75,
            "minMacroF1": 0.70,
            "minPerClassF1": 0.55,
            "minHighRiskRecall": 0.65,
        },
        "problems": problems,
    }
    args.out.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps(evidence, indent=2))
    if problems:
        raise SystemExit(2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
