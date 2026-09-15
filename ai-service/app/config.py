from pathlib import Path
import os

BASE=Path(__file__).resolve().parents[1]

class Settings:
    host=os.getenv('AI_HOST','0.0.0.0')
    port=int(os.getenv('PORT') or os.getenv('AI_PORT') or '8000')
    device=os.getenv('AI_DEVICE','cpu')
    snn_weights=BASE/os.getenv('SNN_WEIGHTS_PATH','trained_models/navora-risk-snn.pt')
    metadata_path=BASE/os.getenv('MODEL_METADATA_PATH','trained_models/navora-risk-snn-metadata.json')

settings=Settings()
