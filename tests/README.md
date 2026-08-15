# Navora Test Suite

Primary entry point:

```bash
python scripts/final_verify.py
```

Full local runtime entry point:

```bash
python scripts/final_verify.py --runtime
```

The dependency-light tests under this directory cover frontend stack/UI/DOM/static assets, feature contracts, failure paths, accessibility, live field behavior, algorithms and performance. Backend Jest lives under `backend/tests`; AI Pytest lives under `ai-service/tests`.

Optional Playwright visual checks live under `qa-screens/` and generate ignored screenshots.
