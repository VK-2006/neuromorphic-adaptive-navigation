from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EVIDENCE = ROOT / "field-validation" / "latest.json"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
VALID_STATUSES = {"PASS", "FAIL", "PENDING", "OUT_OF_SCOPE"}
REQUIRED_GATES = {
    "field": (
        "realOtpMailbox",
        "physicalGpsCameraBluetoothWebrtc",
        "turnCrossNetworkRelay",
    ),
    "all-external": (
        "realOtpMailbox",
        "physicalGpsCameraBluetoothWebrtc",
        "turnCrossNetworkRelay",
        "googleRealLogin",
        "heldOutValidatedDetectorAndSnn",
    ),
}


def fail(message: str) -> None:
    raise ValueError(message)


def validate_shape(data: object) -> dict:
    if not isinstance(data, dict):
        fail("evidence root must be an object")
    required = {"schemaVersion", "releaseCommit", "recordedAt", "evidenceQuality", "fieldSurface", "source", "gates", "profiles"}
    missing = sorted(required - data.keys())
    if missing:
        fail(f"missing top-level fields: {', '.join(missing)}")
    if data["schemaVersion"] != 1:
        fail("schemaVersion must be 1")
    if not isinstance(data["releaseCommit"], str) or not SHA_RE.fullmatch(data["releaseCommit"]):
        fail("releaseCommit must be an exact lowercase 40-character Git SHA")
    if data["evidenceQuality"] not in {"legacy-local-log-import", "github-field-issue"}:
        fail("unsupported evidenceQuality")
    surface = data["fieldSurface"]
    if not isinstance(surface, dict):
        fail("fieldSurface must be an object")
    paths = surface.get("paths")
    if not isinstance(paths, list) or not paths or len(paths) != len(set(paths)):
        fail("fieldSurface.paths must be a non-empty unique list")
    if not all(isinstance(path, str) and path and not Path(path).is_absolute() and ".." not in Path(path).parts for path in paths):
        fail("fieldSurface.paths contains an unsafe repository path")
    fingerprint = surface.get("sha256")
    if not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        fail("fieldSurface.sha256 must be a lowercase SHA-256 digest")
    source = data["source"]
    if not isinstance(source, dict):
        fail("source must be an object")
    for key in ("runner", "resultLog", "runLog", "note"):
        if not isinstance(source.get(key), str) or not source[key].strip():
            fail(f"source.{key} must be non-empty")
    gates = data["gates"]
    if not isinstance(gates, dict):
        fail("gates must be an object")
    for profile_gates in REQUIRED_GATES.values():
        for gate_name in profile_gates:
            gate = gates.get(gate_name)
            if not isinstance(gate, dict):
                fail(f"missing gate: {gate_name}")
            if gate.get("status") not in VALID_STATUSES:
                fail(f"invalid status for {gate_name}")
            if not isinstance(gate.get("note"), str) or not gate["note"].strip():
                fail(f"missing note for {gate_name}")
    profiles = data["profiles"]
    if not isinstance(profiles, dict):
        fail("profiles must be an object")
    return data


def current_surface_sha256(data: dict) -> str:
    digest = hashlib.sha256()
    for relative in data["fieldSurface"]["paths"]:
        path = ROOT / relative
        if not path.is_file():
            fail(f"field surface path is missing: {relative}")
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def profile_result(data: dict, profile: str) -> tuple[bool, list[str]]:
    blocked = [name for name in REQUIRED_GATES[profile] if data["gates"][name]["status"] != "PASS"]
    expected = "BLOCKED" if blocked else "PASS"
    stored_key = "field" if profile == "field" else "allExternal"
    if data["profiles"].get(stored_key) != expected:
        fail(f"profiles.{stored_key} must be {expected} for the recorded gate statuses")
    return not blocked, blocked


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate privacy-safe Navora field evidence")
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE)
    parser.add_argument("--profile", choices=tuple(REQUIRED_GATES), default="field")
    parser.add_argument("--require-current", action="store_true", help="Fail when field-sensitive source changed after the recorded run")
    args = parser.parse_args()
    path = args.evidence if args.evidence.is_absolute() else ROOT / args.evidence
    try:
        data = validate_shape(json.loads(path.read_text(encoding="utf-8")))
        passed, blocked = profile_result(data, args.profile)
        if args.require_current:
            current = current_surface_sha256(data)
            recorded = data["fieldSurface"]["sha256"]
            if current != recorded:
                fail(f"field evidence is stale for this source tree (recorded {recorded}, current {current})")
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"FIELD EVIDENCE: INVALID - {error}")
        return 2
    if not passed:
        print(f"FIELD EVIDENCE ({args.profile}): BLOCKED - {', '.join(blocked)}")
        return 2
    print(f"FIELD EVIDENCE ({args.profile}): PASS")
    print(f"Release evidence commit: {data['releaseCommit']}")
    print(f"Evidence quality: {data['evidenceQuality']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
