from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request


SHA_RE = re.compile(r"^[0-9a-fA-F]{40}$")


def base(url: str) -> str:
    return url.rstrip("/")


def get_json(url: str, timeout: int = 45):
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Navora-Release-Watch/1.0",
            "Cache-Control": "no-cache",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = None
            return resp.status, parsed, None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = None
        return exc.code, parsed, f"HTTP {exc.code}"
    except Exception as exc:
        return None, None, str(exc)


def short(value):
    return str(value)[:12] if value else "missing"


def probe(name: str, url: str, expected: str):
    status, body, error = get_json(url)
    commit = body.get("commit") if isinstance(body, dict) else None
    service_status = body.get("status") if isinstance(body, dict) else None
    matched = status == 200 and commit == expected
    return {
        "name": name,
        "url": url,
        "httpStatus": status,
        "serviceStatus": service_status,
        "commit": commit,
        "matched": matched,
        "error": error,
    }


def main():
    ap = argparse.ArgumentParser(
        description="Wait until both NAVORA Render services expose the exact expected Git commit."
    )
    ap.add_argument("--backend", required=True)
    ap.add_argument("--ai", required=True)
    ap.add_argument("--expected-commit", required=True)
    ap.add_argument("--wait-seconds", type=int, default=1200)
    ap.add_argument("--poll-seconds", type=int, default=20)
    args = ap.parse_args()

    expected = args.expected_commit.strip()
    if not SHA_RE.fullmatch(expected):
        raise SystemExit("--expected-commit must be an exact 40-character Git SHA")
    if args.wait_seconds < 0:
        raise SystemExit("--wait-seconds must be >= 0")
    if args.poll_seconds < 1:
        raise SystemExit("--poll-seconds must be >= 1")

    backend_health = base(args.backend) + "/health"
    ai_health = base(args.ai) + "/health"
    deadline = time.monotonic() + args.wait_seconds
    attempt = 0
    last_signature = None

    print("=" * 76)
    print("NAVORA PRODUCTION RELEASE WATCH V35")
    print(f"Expected release SHA: {expected}")
    print("=" * 76)

    while True:
        attempt += 1
        backend = probe("backend", backend_health, expected)
        ai = probe("ai", ai_health, expected)

        signature = (
            backend["httpStatus"], backend["commit"], backend["serviceStatus"], backend["error"],
            ai["httpStatus"], ai["commit"], ai["serviceStatus"], ai["error"],
        )
        if signature != last_signature or attempt == 1:
            print(
                f"[{attempt:02d}] backend http={backend['httpStatus']} "
                f"status={backend['serviceStatus'] or 'unknown'} commit={short(backend['commit'])}; "
                f"ai http={ai['httpStatus']} status={ai['serviceStatus'] or 'unknown'} "
                f"commit={short(ai['commit'])}"
            )
            if backend["error"]:
                print(f"     backend note: {backend['error']}")
            if ai["error"]:
                print(f"     ai note: {ai['error']}")
            last_signature = signature

        if backend["matched"] and ai["matched"]:
            print()
            print("PASS  Both Render services expose the exact release commit.")
            print(f"      backend={short(backend['commit'])} ai={short(ai['commit'])}")
            return 0

        if time.monotonic() >= deadline:
            print()
            print("FAIL  Timed out waiting for both Render services to reach the exact release.")
            print(json.dumps({"expectedCommit": expected, "backend": backend, "ai": ai}, indent=2, sort_keys=True))
            return 1

        time.sleep(args.poll_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
