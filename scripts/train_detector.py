"""Train Navora's BDD100K-only Faster R-CNN detector.

The training manifest must contain only BDD100K samples and only:
person, bicycle, motorcycle, car, bus, truck.

Default initialization uses TorchVision COCO-pretrained Faster R-CNN ResNet50-FPN.
For the six overlapping COCO classes, the pretrained classifier/regressor rows are
copied into Navora's compact seven-class prediction head instead of being discarded.

Training never implies validation. The untouched held-out manifest must still pass
evaluate_detector.py before detectorValidated can become true.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import cv2
import torch
from torch.utils.data import DataLoader, Dataset
from torchvision.models.detection import (
    FasterRCNN_ResNet50_FPN_Weights,
    fasterrcnn_resnet50_fpn,
)
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.transforms.functional import to_tensor

ROOT = Path(__file__).resolve().parents[1]
CLASSES = ['__background__', 'person', 'bicycle', 'motorcycle', 'car', 'bus', 'truck']
C2I = {c: i for i, c in enumerate(CLASSES)}


class ManifestDataset(Dataset):
    def __init__(self, path, max_samples=0):
        self.path = Path(path)
        self.rows = [
            json.loads(x)
            for x in self.path.read_text(encoding='utf-8').splitlines()
            if x.strip()
        ]
        if max_samples and max_samples > 0:
            self.rows = self.rows[:max_samples]
        if not self.rows:
            raise ValueError(f'empty manifest: {self.path}')

        allowed = set(CLASSES[1:])
        for n, row in enumerate(self.rows, 1):
            if row.get('source') != 'BDD100K':
                raise ValueError(f'{self.path}:{n}: only BDD100K source is allowed')
            boxes = row.get('boxes')
            if not isinstance(boxes, list) or not boxes:
                raise ValueError(f'{self.path}:{n}: boxes must be non-empty')
            bad = sorted(
                {str(x.get('class')) for x in boxes if str(x.get('class')) not in allowed}
            )
            if bad:
                raise ValueError(
                    f'{self.path}:{n}: unsupported BDD100K-only classes: {bad}'
                )

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        row = self.rows[i]
        image = cv2.imread(row['image'])
        if image is None:
            raise FileNotFoundError(row['image'])
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        boxes = []
        labels = []
        for ann in row['boxes']:
            boxes.append(ann['box'])
            labels.append(C2I[ann['class']])

        target = {
            'boxes': torch.tensor(boxes, dtype=torch.float32),
            'labels': torch.tensor(labels, dtype=torch.int64),
            'image_id': torch.tensor([i]),
        }
        return to_tensor(image), target


def collate(batch):
    return tuple(zip(*batch))


def _transfer_coco_predictor(model, weights):
    old_predictor = model.roi_heads.box_predictor
    in_features = old_predictor.cls_score.in_features
    new_predictor = FastRCNNPredictor(in_features, len(CLASSES))

    categories = list(weights.meta.get('categories') or [])
    if not categories:
        raise RuntimeError('TorchVision COCO category metadata is unavailable')

    mapping = []
    with torch.no_grad():
        for new_idx, cls in enumerate(CLASSES):
            if new_idx == 0:
                old_idx = 0
            else:
                if cls not in categories:
                    raise RuntimeError(f'COCO pretrained category is missing: {cls}')
                old_idx = categories.index(cls)

            new_predictor.cls_score.weight[new_idx].copy_(
                old_predictor.cls_score.weight[old_idx]
            )
            new_predictor.cls_score.bias[new_idx].copy_(
                old_predictor.cls_score.bias[old_idx]
            )

            old_box = slice(old_idx * 4, (old_idx + 1) * 4)
            new_box = slice(new_idx * 4, (new_idx + 1) * 4)
            new_predictor.bbox_pred.weight[new_box].copy_(
                old_predictor.bbox_pred.weight[old_box]
            )
            new_predictor.bbox_pred.bias[new_box].copy_(
                old_predictor.bbox_pred.bias[old_box]
            )
            mapping.append((cls, old_idx, new_idx))

    model.roi_heads.box_predictor = new_predictor
    return mapping


def build_model(from_scratch=False, head_only=False):
    if from_scratch:
        model = fasterrcnn_resnet50_fpn(
            weights=None,
            weights_backbone=None,
            min_size=384,
            max_size=640,
        )
        in_features = model.roi_heads.box_predictor.cls_score.in_features
        model.roi_heads.box_predictor = FastRCNNPredictor(
            in_features,
            len(CLASSES),
        )
        initialization = 'from-scratch'
        mapping = []
    else:
        weights = FasterRCNN_ResNet50_FPN_Weights.DEFAULT
        model = fasterrcnn_resnet50_fpn(
            weights=weights,
            min_size=384,
            max_size=640,
        )
        mapping = _transfer_coco_predictor(model, weights)
        initialization = 'torchvision-coco-pretrained+class-head-transfer'

    if head_only:
        for p in model.parameters():
            p.requires_grad = False
        for p in model.roi_heads.box_predictor.parameters():
            p.requires_grad = True

    return model, initialization, mapping


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        '--manifest',
        default=ROOT / 'datasets/derived-risk-data/detection-train.jsonl',
    )
    ap.add_argument('--epochs', type=int, default=5)
    ap.add_argument('--batch-size', type=int, default=2)
    ap.add_argument('--device', default='cuda' if torch.cuda.is_available() else 'cpu')
    ap.add_argument('--max-samples', type=int, default=0)
    ap.add_argument('--lr', type=float, default=1e-4)
    ap.add_argument(
        '--head-only',
        action='store_true',
        help='Freeze the pretrained detector and train only the six-class box predictor.',
    )
    ap.add_argument(
        '--from-scratch',
        action='store_true',
        help='Disable COCO pretrained initialization and class-head transfer.',
    )
    ap.add_argument(
        '--smoke',
        action='store_true',
        help='Benchmark/training smoke only; never write detector weights or metadata.',
    )
    ap.add_argument('--log-every', type=int, default=20)
    args = ap.parse_args()

    if args.device == 'cuda' and not torch.cuda.is_available():
        raise SystemExit('CUDA requested but torch.cuda.is_available() is False')

    ds = ManifestDataset(args.manifest, args.max_samples)
    dl = DataLoader(
        ds,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate,
        num_workers=0,
    )

    model, initialization, mapping = build_model(
        from_scratch=args.from_scratch,
        head_only=args.head_only,
    )
    model.to(args.device)

    trainable = [p for p in model.parameters() if p.requires_grad]
    if not trainable:
        raise SystemExit('No trainable parameters remain')
    optimizer = torch.optim.AdamW(
        trainable,
        lr=args.lr,
        weight_decay=1e-4,
    )

    print('initialization =', initialization)
    print('device =', args.device)
    print('images =', len(ds))
    print('classes =', CLASSES[1:])
    print('head_only =', args.head_only)
    print('learning_rate =', args.lr)
    print('internal_resize = min_size=384 max_size=640')
    print('trainable_parameter_tensors =', len(trainable))
    if mapping:
        print(
            'coco_head_transfer =',
            ', '.join(f'{cls}:{old_idx}->{new_idx}' for cls, old_idx, new_idx in mapping),
        )
        print('COCO_CLASS_HEAD_TRANSFER_PASS')

    started = time.perf_counter()
    seen = 0

    for epoch in range(args.epochs):
        model.train()
        total = 0.0
        epoch_started = time.perf_counter()

        for step, (images, targets) in enumerate(dl, 1):
            images = [x.to(args.device) for x in images]
            targets = [
                {k: v.to(args.device) for k, v in t.items()}
                for t in targets
            ]

            losses = model(images, targets)
            loss = sum(losses.values())

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total += float(loss.detach())
            seen += len(images)

            if step == 1 or step % max(1, args.log_every) == 0 or step == len(dl):
                elapsed = max(1e-9, time.perf_counter() - started)
                rate = seen / elapsed
                print(
                    f'epoch={epoch+1}/{args.epochs} '
                    f'step={step}/{len(dl)} '
                    f'loss={float(loss.detach()):.4f} '
                    f'images_per_sec={rate:.4f}'
                )

        epoch_s = time.perf_counter() - epoch_started
        print(
            f'epoch {epoch+1}/{args.epochs} '
            f'avg_loss={total/max(1, len(dl)):.4f} '
            f'seconds={epoch_s:.2f}'
        )

    elapsed = time.perf_counter() - started
    rate = seen / max(1e-9, elapsed)
    print(f'TRAINING_SECONDS={elapsed:.2f}')
    print(f'TRAINING_IMAGES={seen}')
    print(f'TRAINING_IMAGES_PER_SEC={rate:.6f}')

    if args.smoke:
        full_epoch_s = 7929 / max(rate, 1e-9)
        print('SMOKE_MODE=TRUE')
        print('WEIGHTS_WRITTEN=FALSE')
        print(f'ROUGH_FULL_EPOCH_SECONDS_AT_SMOKE_RATE={full_epoch_s:.2f}')
        print('CPU_SMOKE_TRAINING_PASS')
        return

    out = ROOT / 'ai-service/trained_models'
    out.mkdir(parents=True, exist_ok=True)

    state = out / 'detector_state.pt'
    torch.save(model.state_dict(), state)

    model.eval().cpu()
    scripted = torch.jit.script(model)
    scripted.save(str(out / 'detector.pt'))

    meta_path = out / 'metadata.json'
    try:
        meta = (
            json.loads(meta_path.read_text(encoding='utf-8'))
            if meta_path.exists()
            else {}
        )
    except Exception:
        meta = {}

    provenance_path = ROOT / 'datasets/derived-risk-data/bdd100k-hf-provenance.json'
    provenance = {}
    if provenance_path.exists():
        try:
            provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
        except Exception:
            provenance = {}

    meta.update({
        'detectorModelVersion': 'bdd100k-fasterrcnn-resnet50-fpn-v4',
        'detectorClasses': CLASSES[1:],
        'detectorValidated': False,
        'trainingSources': ['BDD100K'],
        'detectorTrainingProtocol': (
            'BDD100K validation-mirror internal 80/20 development split'
        ),
        'officialBddBenchmarkClaim': False,
        'initialization': initialization,
        'cocoClassHeadTransfer': bool(mapping),
        'headOnlyTraining': bool(args.head_only),
        'internalResize': {'minSize': 384, 'maxSize': 640},
        'trainingManifest': str(Path(args.manifest)),
        'dataProvenance': provenance,
        'note': (
            'Training never implies validation. This is not an official BDD100K '
            'benchmark result. Run evaluate_detector.py on the untouched held-out '
            'manifest before enabling validation.'
        ),
    })
    meta['validated'] = bool(
        meta.get('detectorValidated', False) and meta.get('riskValidated', False)
    )
    meta_path.write_text(json.dumps(meta, indent=2), encoding='utf-8')

    print('saved', out / 'detector.pt')
    print('detectorValidated = FALSE')
    print('official BDD100K benchmark claim = FALSE')


if __name__ == '__main__':
    main()
