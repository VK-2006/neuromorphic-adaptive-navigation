# Spiking Neural Network

`ai-service/app/models/snn.py` defines the real snnTorch LIF network when PyTorch/snnTorch are installed. `RiskEngine` performs normalized feature processing, temporal rate encoding and spike-rate + membrane decoding when trained weights are present.

## SNN scientific validation safety gate

Training does not imply validated SNN AI.

- `riskValidated` controls whether the risk model is scientifically validated for the current evidence policy.
- The consumed 2025 final-holdout record and research-only lock remain unchanged.
- A failed/research-only SNN candidate cannot be promoted to validated live inference by metadata changes alone.

If SNN weights are missing or not validated, the service reports a development/fallback mode. Live journey code can continue using functional perception and other route evidence, but unvalidated SNN output cannot be presented as scientifically validated risk inference when `LIVE_REQUIRE_VALIDATED_AI=true`.

Detector scientific validation is not part of this SNN gate. The detector remains a functional BDD100K/RDD2022 perception module with runtime artifact/readiness checks; independent cross-dataset detector scientific validation is outside the current project scope.

Training:

```bash
python scripts/train_snn.py --csv <training.csv>
```

Held-out evaluation:

```bash
python scripts/evaluate_snn.py --csv <held-out.csv> --mark-validation
python scripts/model_readiness.py
```

The evaluator enforces the retained SNN sample-count, aggregate and class-aware thresholds before it can mark the SNN validation gate true.
