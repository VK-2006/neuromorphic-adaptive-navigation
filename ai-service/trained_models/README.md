# Trained model artifacts

Generated locally, not committed by default:

- `risk_snn.pt` — snnTorch risk-model state dict.
- `detector.pt` — TorchScript detector trained/fine-tuned from BDD100K/RDD2022-derived data.
- `metadata.json` — model versions and independent validation flags.
- `snn-evaluation.json` / `detector-evaluation.json` — held-out evaluation reports.

Training scripts always leave validation false. Only the evaluation scripts may update the per-model validation gates after configured held-out thresholds pass. `validated` is true only when both `riskValidated` and `detectorValidated` are true.

Without validated weights the service explicitly reports research/development fallback and does not present the output as validated safety AI.
