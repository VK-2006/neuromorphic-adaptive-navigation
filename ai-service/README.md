# Navora AI Service

FastAPI service for camera detections and SNN risk inference. It intentionally does **not** pretend that untrained weights are validated. Install `snnTorch` and provide trained `risk_snn.pt` to activate the real temporal LIF network; otherwise the endpoint returns a clearly labelled deterministic development fallback.

Run: `python -m uvicorn app.main:app --reload --port 8000` from `ai-service`.
