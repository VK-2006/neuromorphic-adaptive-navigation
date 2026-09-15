FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY trained_models ./trained_models
COPY train_snn.py ./train_snn.py
RUN python train_snn.py --epochs 25 --samples-per-class 300 --seed 42
RUN test -s trained_models/navora-risk-snn.pt \
 && test -s trained_models/navora-risk-snn-metadata.json \
 && test -s trained_models/validation-evidence.json \
 && python -c "import json; from pathlib import Path; p=Path('trained_models'); m=json.loads((p/'navora-risk-snn-metadata.json').read_text()); e=json.loads((p/'validation-evidence.json').read_text()); assert m.get('validated') is True and m.get('riskValidated') is True and e.get('passed') is True"
EXPOSE 10000
CMD ["sh","-c","exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
