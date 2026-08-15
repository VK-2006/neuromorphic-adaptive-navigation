from pathlib import Path
import os
BASE=Path(__file__).resolve().parents[1]
class Settings:
    host=os.getenv('AI_HOST','0.0.0.0'); port=int(os.getenv('AI_PORT','8000')); device=os.getenv('AI_DEVICE','cpu')
    snn_weights=BASE/os.getenv('SNN_WEIGHTS_PATH','trained_models/risk_snn.pt')
    detector_weights=BASE/os.getenv('DETECTOR_WEIGHTS_PATH','trained_models/detector.pt')
    metadata_path=BASE/os.getenv('MODEL_METADATA_PATH','trained_models/metadata.json')
    max_image_bytes=int(os.getenv('AI_MAX_IMAGE_BYTES','2000000'))
settings=Settings()
