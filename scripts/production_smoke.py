from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request


def base(url):
    return url.rstrip("/")


def call(method, url, payload=None, timeout=90, retries=4):
    data = None
    headers = {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Navora-Production-Smoke/1.3",
        "Cache-Control": "no-cache",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                try:
                    parsed = json.loads(raw)
                except Exception:
                    parsed = None
                return resp.status, raw, parsed
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            last = RuntimeError(f"HTTP {exc.code}: {raw[:500]}")
            if exc.code < 500:
                break
        except Exception as exc:
            last = exc
        if attempt < retries:
            time.sleep(min(12, attempt * 3))
    raise RuntimeError(f"{method} {url} failed: {last}")


def unwrap(obj):
    return obj.get("data") if isinstance(obj, dict) and isinstance(obj.get("data"), dict) else obj


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", required=True)
    ap.add_argument("--ai", required=True)
    ap.add_argument("--expected-commit", required=True)
    ap.add_argument(
        "--require-integrations",
        action="store_true",
        help="Fail when optional production integrations such as Google/Brevo/TomTom/passkeys are unavailable.",
    )
    args = ap.parse_args()

    backend = base(args.backend)
    ai = base(args.ai)
    host = urllib.parse.urlparse(backend).hostname
    errors = []
    warnings = []

    def ok(name, detail=""):
        print(f"PASS  {name}" + (f" — {detail}" if detail else ""))

    def fail(name, detail):
        errors.append(f"{name}: {detail}")
        print(f"FAIL  {name} — {detail}")

    def warn(name, detail):
        warnings.append(f"{name}: {detail}")
        print(f"WARN  {name} — {detail}")

    def integration(name, passed, detail="not configured"):
        if passed:
            # Callers provide `detail` as the failure diagnosis. Never print a
            # missing-credential/error message beside a PASS result.
            ok(name)
        elif args.require_integrations:
            fail(name, detail)
        else:
            warn(name, detail)

    print("=" * 76)
    print("NAVORA PRODUCTION SMOKE V35")
    print(
        "Mode: "
        + ("FULL-INTEGRATION STRICT" if args.require_integrations else "CORE RELEASE + OPTIONAL-INTEGRATION WARNINGS")
    )
    print("=" * 76)

    try:
        status, _, h = call("GET", backend + "/health")
        ok("Backend liveness") if status == 200 and isinstance(h, dict) and h.get("status") == "ok" else fail("Backend liveness", repr(h))
        ok("MongoDB production") if isinstance(h, dict) and h.get("database") == "connected" else fail("MongoDB production", repr(h))
        ok("Backend live mode") if isinstance(h, dict) and h.get("mode") == "live" else fail("Backend live mode", repr(h))
        deployed = h.get("commit") if isinstance(h, dict) else None
        ok("Exact backend Render commit", deployed[:12]) if deployed == args.expected_commit else fail(
            "Exact backend Render commit",
            f"expected={args.expected_commit[:12]} deployed={(deployed or 'missing')[:12]}",
        )
    except Exception as exc:
        fail("Backend liveness", str(exc))

    try:
        status, _, ready = call("GET", backend + "/ready", timeout=45, retries=2)
        if status == 200 and isinstance(ready, dict) and ready.get("status") == "ready" and ready.get("criticalReady") is True:
            ok("Backend deployment readiness")
            missing = ready.get("missingIntegrations") or []
            if missing:
                integration("Optional production integrations", False, ", ".join(map(str, missing)))
        else:
            fail("Backend deployment readiness", repr(ready))
    except Exception as exc:
        fail("Backend deployment readiness", str(exc))

    for path, name, needle in [
        ("/", "Frontend landing", "Navora"),
        ("/login.html", "Login page", "Navora"),
        ("/register.html", "Register page", "Navora"),
        ("/journey.html", "Journey page", "Navora"),
        ("/manifest.json", "PWA manifest", None),
        ("/service-worker.js", "Service worker", None),
    ]:
        try:
            status, raw, _ = call("GET", backend + path, timeout=45)
            ok(name) if status == 200 and (needle is None or needle.lower() in raw.lower()) else fail(name, f"HTTP {status}")
        except Exception as exc:
            fail(name, str(exc))

    try:
        _, _, obj = call("GET", backend + "/api/v1/auth/config", timeout=45)
        d = unwrap(obj)
        google = d.get("google", {}) if isinstance(d, dict) else {}
        passkeys = d.get("passkeys", {}) if isinstance(d, dict) else {}
        email = d.get("email", {}) if isinstance(d, dict) else {}
        integration(
            "Google client configuration",
            google.get("enabled") is True and bool(google.get("clientId")),
            "GOOGLE_CLIENT_ID missing",
        )
        integration(
            "WebAuthn production configuration",
            passkeys.get("enabled") is True and passkeys.get("rpId") == host,
            repr(passkeys),
        )
        integration(
            "Brevo credential configuration",
            email.get("brevoConfigured") is True,
            "BREVO_API_KEY and BREVO_SENDER_EMAIL required",
        )
    except Exception as exc:
        if args.require_integrations:
            fail("Auth integration configuration", str(exc))
        else:
            warn("Auth integration configuration", str(exc))

    try:
        _, _, obj = call("GET", backend + "/api/v1/routes/providers", timeout=45)
        d = unwrap(obj)
        ok("Routing provider", str(d.get("activeRouting"))) if isinstance(d, dict) and d.get("activeRouting") in {"osrm", "graphhopper", "valhalla"} else fail("Routing provider", repr(d))
        integration(
            "Traffic provider selection",
            isinstance(d, dict) and d.get("activeTraffic") == "tomtom",
            repr(d),
        )
        ok("Geocoding provider", str(d.get("activeGeocoding"))) if isinstance(d, dict) and d.get("activeGeocoding") in {"nominatim", "graphhopper", "tomtom"} else fail("Geocoding provider", repr(d))
    except Exception as exc:
        fail("Provider status", str(exc))

    try:
        _, _, obj = call("GET", backend + "/api/v1/geocoding/status", timeout=45)
        d = unwrap(obj)
        if isinstance(d, dict) and d.get("effective") in {"nominatim", "graphhopper", "tomtom"} and isinstance(d.get("typeahead"), bool):
            ok("Geocoding capability status", f"effective={d.get('effective')}, typeahead={d.get('typeahead')}")
        else:
            fail("Geocoding capability status", repr(d))
    except Exception as exc:
        fail("Geocoding capability status", str(exc))

    try:
        _, _, obj = call("GET", backend + "/api/v1/traffic/status", timeout=45)
        d = unwrap(obj)
        integration(
            "TomTom credential readiness",
            isinstance(d, dict) and d.get("provider") == "tomtom" and d.get("live") is True,
            repr(d),
        )
    except Exception as exc:
        if args.require_integrations:
            fail("TomTom credential readiness", str(exc))
        else:
            warn("TomTom credential readiness", str(exc))

    try:
        q = urllib.parse.urlencode({"q": "Hyderabad", "limit": "2"})
        _, _, obj = call("GET", backend + "/api/v1/geocoding/search?" + q, timeout=60)
        data = obj.get("data") if isinstance(obj, dict) else None
        ok("Live geocoding", f"{len(data)} result(s)") if isinstance(data, list) and data else fail("Live geocoding", repr(obj))
    except Exception as exc:
        fail("Live geocoding", str(exc))

    payload = {
        "source": {"lat": 17.3850, "lng": 78.4867},
        "destination": {"lat": 17.4375, "lng": 78.4483},
        "simulation": False,
    }
    try:
        _, _, obj = call("POST", backend + "/api/v1/routes/compare", payload, timeout=120, retries=3)
        d = obj.get("data") if isinstance(obj, dict) else None
        routes = d.get("routes") if isinstance(d, dict) else None
        if isinstance(routes, list) and routes and d.get("recommendedRouteId"):
            ok("Live route comparison", f"{len(routes)} route(s)")
        else:
            fail("Live route comparison", repr(obj))
            routes = []
        live_tt = [r for r in routes if r.get("trafficProvider") == "tomtom" and r.get("trafficMode") == "live"]
        integration(
            "Live TomTom annotation",
            bool(live_tt),
            repr([{"id": r.get("id"), "mode": r.get("trafficMode"), "error": r.get("trafficError")} for r in routes]),
        )
    except Exception as exc:
        fail("Live route comparison", str(exc))

    try:
        stamp = int(time.time() * 1000)
        _, raw, _ = call("GET", f"{backend}/socket.io/?EIO=4&transport=polling&t={stamp}", timeout=45)
        ok("Socket.IO handshake") if raw.startswith("0") and '"sid"' in raw else fail("Socket.IO handshake", raw[:180])
    except Exception as exc:
        fail("Socket.IO handshake", str(exc))

    try:
        _, _, h = call("GET", ai + "/health", timeout=90, retries=5)
        if isinstance(h, dict) and h.get("status") == "ok":
            ok("AI health")
            deployed = h.get("commit")
            ok("Exact AI Render commit", deployed[:12]) if deployed == args.expected_commit else fail(
                "Exact AI Render commit",
                f"expected={args.expected_commit[:12]} deployed={(deployed or 'missing')[:12]}",
            )
        else:
            fail("AI health", repr(h))
    except Exception as exc:
        fail("AI health", str(exc))

    info = None
    try:
        _, _, info = call("GET", ai + "/model/info", timeout=90, retries=5)
        ok("AI model metadata") if isinstance(info, dict) and info.get("riskModel") and info.get("detector") else fail("AI model metadata", repr(info))
    except Exception as exc:
        fail("AI model metadata", str(exc))

    risk_payload = {
        "features": {
            "objectClass": "pothole",
            "confidence": 0.9,
            "estimatedDistance": 4.0,
            "relativeSpeed": 2.0,
            "userSpeed": 8.0,
            "objectPersistence": 0.8,
            "trafficDensity": 0.5,
            "hazardFrequency": 0.6,
            "visibility": 0.75,
            "weatherRisk": 0.2,
            "roadCondition": 0.7,
            "verifiedReports": 2,
        }
    }
    try:
        _, _, risk = call("POST", ai + "/api/v1/risk/predict", risk_payload, timeout=90, retries=4)
        score = risk.get("score") if isinstance(risk, dict) else None
        ok("AI risk inference", f"score={score:.4f}, level={risk.get('level')}") if isinstance(score, (int, float)) and 0 <= score <= 1 and isinstance(risk.get("level"), str) else fail("AI risk inference", repr(risk))
        if isinstance(risk, dict) and risk.get("validated") is False and "trained-weights" in str(risk.get("mode") or ""):
            fail("V33 validated-only inference policy", repr({"mode": risk.get("mode"), "validated": risk.get("validated")}))
        else:
            ok("V33 validated-only inference policy")
    except Exception as exc:
        fail("AI risk inference", str(exc))

    if isinstance(info, dict):
        dv = (info.get("detector") or {}).get("validated") is True
        rv = (info.get("riskModel") or {}).get("validated") is True
        ok("Validated AI gate") if dv and rv else warn(
            "Validated AI gate",
            "trained + held-out-validated detector/SNN weights are not present; fallback/research mode remains correctly non-safety-eligible",
        )

    print()
    print("=" * 76)
    if errors:
        print("NAVORA PRODUCTION SMOKE: FAIL")
        for e in errors:
            print(" -", e)
        if warnings:
            print("Warnings:")
            for w in warnings:
                print(" -", w)
        return 1

    print("NAVORA PRODUCTION SMOKE: PASS")
    if warnings:
        print("External validation / optional-integration notes:")
        for w in warnings:
            print(" -", w)
    print("Physical phone GPS/camera/Bluetooth/WebRTC and held-out ML validation are not fabricated by this test.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
