"""Report whether the NAVORA RiskSNN is genuinely ready for validation."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "ai-service" / "trained_models"
MODEL_PATH = MODEL_DIR / "navora-risk-snn.pt"
METADATA_PATH = MODEL_DIR / "navora-risk-snn-metadata.json"
EVIDENCE_PATH = MODEL_DIR / "navora-risk-validation-evidence.json"


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> None:
    metadata = load_json(METADATA_PATH)
    evidence = load_json(EVIDENCE_PATH)
    model_exists = MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0
    validated = bool(metadata.get("validated", False))
    risk_validated = bool(metadata.get("riskValidated", False))

    if validated or risk_validated:
        if not model_exists:
            print("MODEL_READINESS FAIL: NAVORA RiskSNN weights are missing")
            return 1
        if evidence.get("passed") is not True:
            print("MODEL_READINESS FAIL: validation evidence is not passing")
            for problem in evidence.get("problems", []):
                print("-", problem)
            return 1
        print("MODEL_READINESS PASS: NAVORA RiskSNN is backed by passing evidence and matching model hashes.")
        return 0

    print("MODEL_READINESS PASS: development state remains truthful; validated safety status stays disabled until evidence is genuine.")
    print(f"- NAVORA RiskSNN weights present: {model_exists}")
    print(f"- metadata validated flag: {validated}")
    print(f"- metadata riskValidated flag: {risk_validated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
