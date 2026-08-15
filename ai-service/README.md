# Navora AI Service

Separate FastAPI service for camera detections and SNN risk inference. It never presents missing/unvalidated weights as validated safety AI.

## Runtime

```bash
python -m uvicorn app.main:app --reload --port 8000
```

## Model truthfulness

- `detectorValidated` independently gates the visual detector.
- `riskValidated` independently gates the snnTorch risk model.
- global `validated` is true only when both held-out validation gates pass.
- without validated weights, the service reports research/development fallback or unvalidated trained mode.

## Training / evaluation

```bash
python scripts/train_detector.py --manifest <training-manifest.jsonl>
python scripts/evaluate_detector.py --manifest <held-out-manifest.jsonl> --mark-validation
python scripts/train_snn.py --csv <training.csv>
python scripts/evaluate_snn.py --csv <held-out.csv> --mark-validation
python scripts/model_readiness.py
```

Large BDD100K/RDD2022 datasets and generated `.pt` weights are intentionally not committed.
