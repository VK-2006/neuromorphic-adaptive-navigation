from pathlib import Path
import os

BASE=Path(__file__).resolve().parents[1]

class Settings:
    host=os.getenv('AI_HOST','0.0.0.0')
    port=int(os.getenv('PORT') or os.getenv('AI_PORT') or '8000')
    device=os.getenv('AI_DEVICE','cpu')
    _weights_name=os.getenv('SNN_WEIGHTS_PATH','trained_models/navora-risk-snn.pt')
    _metadata_name=os.getenv('MODEL_METADATA_PATH','trained_models/navora-risk-snn-metadata.json')
    # Older Render environment values pointed at the pre-canonical artifact names.
    # Normalize only those known legacy names; arbitrary explicit paths remain supported.
    if Path(_weights_name).name == 'risk_snn.pt':
        _weights_name='trained_models/navora-risk-snn.pt'
    if Path(_metadata_name).name in {'metadata.json','risk-snn-metadata.json'}:
        _metadata_name='trained_models/navora-risk-snn-metadata.json'
    snn_weights=BASE/_weights_name
    metadata_path=BASE/_metadata_name

settings=Settings()
