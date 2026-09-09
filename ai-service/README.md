# Navora AI Service

Separate FastAPI service for camera detections and SNN risk inference. It never presents missing, stale, tampered, or merely metadata-flagged weights as validated safety AI.

## Runtime

```bash
python -m uvicorn app.main:app --reload --port 8000
```

## V28+ model truthfulness

A live model is validated only when all of these agree:

- overall `validated=true` and the model-specific validation flag;
- non-weakened data-gate policy floors;
- zero train/evaluation leakage;
- a passing held-out evaluation bound to the gated evaluation dataset SHA-256;
- validation evidence bound to the exact gate/evaluation/metadata report hashes;
- the SHA-256 of the exact `.pt` weight file loaded by the service;
- for the detector, metadata class order, training sources and training-manifest SHA-256 must also match the V29 source-aware data gate.

If any link is missing or changes, the service reports an unvalidated trained mode or development fallback. `/model/info` exposes `validationIssues` so deployment problems are visible without claiming safety validation.

## Detector training / evaluation

Create a local RDD2022 manifest, then produce an internal leakage-free split:

```bash
python scripts/prepare_detection_data.py --rdd-root <rdd-root> --out datasets/derived-risk-data/detection-manifest.jsonl
python scripts/split_detection_manifest.py --manifest datasets/derived-risk-data/detection-manifest.jsonl
```

V29 supports RDD2022's nine canonical classes: `D00`, `D01`, `D10`, `D11`, `D20`, `D40`, `D43`, `D44`, `D50`.

The Faster R-CNN head is created dynamically from the canonical classes present in the training manifest.

Then run the data gate, training and detector held-out evaluation:

```bash
python scripts/model_data_gate.py --det-train datasets/derived-risk-data/detection-train.jsonl --det-eval datasets/derived-risk-data/detection-eval.jsonl --snn-train <snn-train.csv> --snn-eval <snn-eval.csv>
python scripts/train_detector.py --manifest datasets/derived-risk-data/detection-train.jsonl
python scripts/evaluate_detector.py --manifest datasets/derived-risk-data/detection-eval.jsonl --mark-validation
```

## SNN training / final evidence

```bash
python scripts/train_snn.py --csv <snn-train.csv>
python scripts/evaluate_snn.py --csv <snn-eval.csv> --mark-validation
python scripts/validation_evidence.py --det-train datasets/derived-risk-data/detection-train.jsonl --det-eval datasets/derived-risk-data/detection-eval.jsonl --snn-train <snn-train.csv> --snn-eval <snn-eval.csv>
python scripts/model_readiness.py
```

The repository does **not** ship a real validated RDD2022 detector merely because V29 can train one. Large upstream datasets, generated `.pt` weights, evaluation reports, metadata and evidence are intentionally not committed. The generated split is an internal development/validation split, not an official upstream benchmark.
