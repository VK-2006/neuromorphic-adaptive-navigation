# Spiking Neural Network

`ai-service/app/models/snn.py` defines a real snnTorch LIF network when snnTorch is installed. `RiskEngine` performs temporal rate encoding and uses spike-rate + membrane decoding with trained weights. If `trained_models/risk_snn.pt` is absent, output is explicitly `development/heuristic-fallback`; it is never represented as validated. Train using `scripts/train_snn.py` after preparing a real derived risk dataset.
