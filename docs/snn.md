# Spiking Neural Network

`ai-service/app/models/snn.py` defines the real snnTorch LIF network when PyTorch/snnTorch are installed. `RiskEngine` performs normalized feature processing, temporal rate encoding and spike-rate + membrane decoding when trained weights are present.

## Validation safety gate

Training does not imply validated AI.

- `riskValidated` controls whether the risk model is validated.
- `detectorValidated` independently controls the visual detector.
- global `validated` becomes true only when both gates are true.

If weights are missing or not validated, the service reports `development/heuristic-fallback` or an unvalidated trained mode. Live journey code may display research detections but cannot let unvalidated AI automatically drive safety-critical rerouting when `LIVE_REQUIRE_VALIDATED_AI=true`.

Training:

```bash
python scripts/train_snn.py --csv <training.csv>
```

Held-out evaluation:

```bash
python scripts/evaluate_snn.py --csv <held-out.csv> --mark-validation
python scripts/model_readiness.py
```

The evaluator enforces a minimum sample count plus accuracy/macro-F1 thresholds before it can mark the SNN validation gate true.
