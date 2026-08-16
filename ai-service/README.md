# Navora AI Service

Separate FastAPI service for camera detections and SNN risk inference. It never presents missing, stale, tampered, or merely metadata-flagged weights as validated safety AI.

## Runtime

```bash
python -m uvicorn app.main:app --reload --port 8000
```

## V28 model truthfulness

A live model is validated only when all of these agree:

- overall `validated=true` and the model-specific validation flag;
- non-weakened data-gate policy floors;
- zero train/evaluation leakage;
- a passing held-out evaluation bound to the gated evaluation dataset SHA-256;
- V28 validation evidence bound to the exact gate/evaluation/metadata report hashes;
- the SHA-256 of the exact `.pt` weight file loaded by the service.

If any link is missing or changes, the service reports an unvalidated trained mode or development fallback. `/model/info` exposes `validationIssues` so deployment problems are visible without claiming safety validation.

## Training / evaluation

Run the data gate first, then training, evaluation, evidence generation and readiness checks:

```bash
python scripts/model_data_gate.py --det-train <det-train.jsonl> --det-eval <det-eval.jsonl> --snn-train <snn-train.csv> --snn-eval <snn-eval.csv>
python scripts/train_detector.py --manifest <det-train.jsonl>
python scripts/evaluate_detector.py --manifest <det-eval.jsonl> --mark-validation
python scripts/train_snn.py --csv <snn-train.csv>
python scripts/evaluate_snn.py --csv <snn-eval.csv> --mark-validation
python scripts/validation_evidence.py --det-train <det-train.jsonl> --det-eval <det-eval.jsonl> --snn-train <snn-train.csv> --snn-eval <snn-eval.csv>
python scripts/model_readiness.py
```

The current validatable detector trainer is BDD100K-only for `person`, `bicycle`, `motorcycle`, `car`, `bus`, and `truck`. RDD2022 preparation exists, but pothole/road-damage classes are not yet part of the validated V4 detector trainer.

Large upstream datasets, generated `.pt` weights, evaluation reports, metadata and evidence are intentionally not committed.
