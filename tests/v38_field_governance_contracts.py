from pathlib import Path
import json


ROOT = Path(__file__).resolve().parents[1]


def text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


owners = text(".github/CODEOWNERS")
pr_template = text(".github/pull_request_template.md")
issue_template = text(".github/ISSUE_TEMPLATE/field-validation.yml")
workflow = text(".github/workflows/field-governance.yml")
docs = text("docs/field-validation-governance.md")
evidence = json.loads(text("field-validation/latest.json"))

assert "* @VK-2006" in owners
for token in ["No secret", "Field-sensitive", "Model claims remain truthful"]:
    assert token in pr_template, f"PR governance checklist missing: {token}"
for token in ["Release commit SHA", "Device, OS, and browser", "Cross-network WebRTC", "Attestation"]:
    assert token in issue_template, f"field issue form missing: {token}"
for token in ["source-and-backend", "browser-e2e", "ai-fallback-contract", "field-governance", "verify-production"]:
    assert token in docs, f"branch policy missing check guidance: {token}"
assert "python scripts/validate_field_evidence.py --profile field" in workflow
assert "--require-current" in workflow
assert "python tests/v38_field_governance_contracts.py" in workflow
assert evidence["profiles"]["field"] == "PASS"
assert evidence["profiles"]["allExternal"] == "BLOCKED"
assert len(evidence["fieldSurface"]["sha256"]) == 64
assert evidence["gates"]["googleRealLogin"]["status"] == "PENDING"
assert evidence["gates"]["heldOutValidatedDetectorAndSnn"]["status"] == "PENDING"

print("V38 FIELD GOVERNANCE CONTRACTS: PASS")
print("Field evidence is machine-checked; ownership, PR, issue, and branch-policy guidance are present.")
