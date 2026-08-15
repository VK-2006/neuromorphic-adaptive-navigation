# Detector + SNN Validation Workflow

Navora separates **training**, **evaluation**, and **live safety eligibility**.

1. Prepare/download upstream datasets under their licenses.
2. Build a training manifest with `scripts/prepare_detection_data.py`.
3. Keep a genuinely held-out detection split and a held-out risk CSV that were not used for training/tuning.
4. Train detector and SNN. Training scripts always leave validation false.
5. Evaluate with `scripts/evaluate_detector.py` and `scripts/evaluate_snn.py`.
6. Only `--mark-validation` after configured minimum sample/metric thresholds pass.
7. Run `scripts/model_readiness.py`.

`validated=true` is derived from both independent gates:

```text
detectorValidated == true
AND
riskValidated == true
```

Do not set these flags manually merely because training completed. The default demo/derived fixtures in the repository are intentionally too small to count as real-world validation.
