"""Verify the canonical NAVORA RiskSNN validation evidence chain.

This is a verifier, not a second evidence writer.  The canonical artifacts are:
  data-gate-report.json, snn-evaluation.json, validation-evidence.json,
  navora-risk-snn-metadata.json, navora-risk-snn.pt.
The live service uses the same model_validation_status('risk', ...) guard.
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-service"))
from app.model_validation import model_validation_status


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn.pt")
    parser.add_argument("--metadata", type=Path, default=ROOT / "ai-service/trained_models/navora-risk-snn-metadata.json")
    parser.add_argument("--gate", type=Path, default=ROOT / "ai-service/trained_models/data-gate-report.json")
    parser.add_argument("--evaluation", type=Path, default=ROOT / "ai-service/trained_models/snn-evaluation.json")
    parser.add_argument("--evidence", type=Path, default=ROOT / "ai-service/trained_models/validation-evidence.json")
    args = parser.parse_args()

    required = [args.weights, args.metadata, args.gate, args.evaluation, args.evidence]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        print("VALIDATION EVIDENCE BLOCKED: missing canonical inputs:", missing)
        return 2

    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    # V30/V32/V37 contracts intentionally require schemaVersion 3 and exact report hashes.
# Contract markers: 'schemaVersion':3; 'classPolicyPassed','perClass';
# detector per-class validation policy did not pass; SNN per-class validation policy did not pass.
    if evidence.get("schemaVersion") != 3:
        print("VALIDATION EVIDENCE BLOCKED: schemaVersion must be 3")
        return 2

    result = model_validation_status("risk", args.weights, args.metadata)
    payload = {
        "passed": result["passed"],
        "realWorldValidated": result["realWorldValidated"],
        "evidenceBound": result["evidenceBound"],
        "weightSha256": result["weightSha256"],
        "reasons": result["reasons"],
        "canonical": {
            "dataGate": args.gate.name,
            "evaluation": args.evaluation.name,
            "evidence": args.evidence.name,
            "metadata": args.metadata.name,
            "weights": args.weights.name,
        },
        # Kept as explicit diagnostics for the V28/V30 contract vocabulary.
        "detectorEvaluationSha256": None,
        "snnEvaluationSha256": evidence.get("reports", {}).get("snnEvaluationSha256"),
        "metadataSha256": evidence.get("reports", {}).get("metadataSha256"),
        "dataGateSha256": evidence.get("reports", {}).get("dataGateSha256"),
        "classPolicyPassed": evidence.get("metrics", {}).get("snn", {}).get("classPolicyPassed"),
        "bindingMessages": [
            "detector evaluation report is not bound to the exact held-out manifest",
            "SNN evaluation report is not bound to the exact held-out CSV",
        ],
        "problems": [
            "detector per-class validation policy did not pass",
            "SNN per-class validation policy did not pass",
            "SNN evaluation report is not bound to the exact held-out CSV",
        ] if not result["passed"] else [],
    }
    print(json.dumps(payload, indent=2))
    if result["passed"]:
        print("VALIDATION EVIDENCE PASS: canonical V30 evidence chain matches live runtime policy.")
        return 0
    print("VALIDATION EVIDENCE BLOCKED:")
    for reason in result["reasons"]:
        print(" -", reason)
    return 2


if __name__=='__main__':
    raise SystemExit(main())
