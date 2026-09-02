# RDD2022 Colab GPU training

Run in a Colab GPU runtime from the repository root. The raw ZIP is not modified.

```bash
!pip install -r requirements.txt
!python -c "import torch; assert torch.cuda.is_available(); print(torch.cuda.get_device_name(0))"
!unzip -q /content/RDD2022/India.zip -d /content/navora/ai-service/datasets/navora-realworld/processed/rdd2022
```

The existing manifests use repository-relative paths such as `ai-service/datasets/navora-realworld/processed/rdd2022/India/...`. If the dataset is outside the repository, pass its common root using `--dataset-root`; relative manifest image paths are resolved against that root.

Verify both source-of-truth manifests:

```bash
!python scripts/colab_train_rdd2022.py --dataset-root /content/navora \
  --train-manifest /content/navora/datasets/derived-risk-data/detection-train.jsonl \
  --eval-manifest /content/navora/datasets/derived-risk-data/detection-eval.jsonl \
  --epochs 5 --batch-size 4 --num-workers 2 --amp --no-resume
```

The wrapper verifies CUDA, nine classes, 6,163/1,542 rows, and image paths, then invokes `train_detector.py`. Checkpoints are written after every epoch to `ai-service/trained_models/detector-training-checkpoint.pt`; the log is next to it as `detector-training-checkpoint.log`.

Resume after interruption:

```bash
!python scripts/colab_train_rdd2022.py --dataset-root /content/navora \
  --train-manifest /content/navora/datasets/derived-risk-data/detection-train.jsonl \
  --eval-manifest /content/navora/datasets/derived-risk-data/detection-eval.jsonl \
  --epochs 5 --batch-size 4 --num-workers 2 --amp
```

After training, evaluate only the labeled validation split:

```bash
!python scripts/evaluate_detector.py \
  --manifest datasets/derived-risk-data/detection-eval.jsonl \
  --dataset-root /content/navora \
  --weights ai-service/trained_models/detector.pt
```

The official 1,959-image test split has no authoritative local annotations; do not report test metrics.
