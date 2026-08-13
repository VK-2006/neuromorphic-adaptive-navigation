# Trained model artifacts

Place validated artifacts here:
- `risk_snn.pt` — snnTorch state_dict trained on the custom risk dataset.
- `detector.pt` — TorchScript detector fine-tuned using BDD100K/RDD2022-derived classes.
- `metadata.json` — version/validation metadata.

No fabricated trained weights are shipped. Without weights the service explicitly reports `development/heuristic-fallback`.
