"""Train Navora's Faster R-CNN detector from BDD100K and/or RDD2022 manifests.

Supported source/class pairs are centralized in ``app.detector_taxonomy``. The model head is
built dynamically from the classes actually present in the training manifest. COCO-overlap
rows keep their pretrained classifier/regressor initialization; Navora-specific road classes
such as ``road damage`` and ``pothole`` start with fresh head rows and must be learned from
real RDD2022 samples.

Training never implies validation. The untouched held-out manifest must still pass the V28+
data/evaluation/evidence chain before detectorValidated can become true.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

import cv2
import torch
from torch.utils.data import DataLoader, Dataset
from torchvision.models.detection import (
    FasterRCNN_ResNet50_FPN_Weights,
    fasterrcnn_resnet50_fpn,
    FasterRCNN_MobileNet_V3_Large_320_FPN_Weights,
    fasterrcnn_mobilenet_v3_large_320_fpn,
)
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.transforms.functional import to_tensor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ai-service'))
from app.detector_taxonomy import ordered_classes, validate_source_class
from app.model_validation import sha256_file


class ManifestDataset(Dataset):
    def __init__(self, path, max_samples=0):
        self.path = Path(path)
        all_rows = [
            json.loads(x)
            for x in self.path.read_text(encoding='utf-8').splitlines()
            if x.strip()
        ]
        if not all_rows:
            raise ValueError(f'empty manifest: {self.path}')
        self.total_rows = len(all_rows)
        self.rows = all_rows[:max_samples] if max_samples and max_samples > 0 else all_rows

        seen_classes = set()
        self.source_counts = Counter()
        self.class_counts = Counter()
        for n, row in enumerate(self.rows, 1):
            source = str(row.get('source') or '')
            boxes = row.get('boxes')
            if not isinstance(boxes, list):
                raise ValueError(f'{self.path}:{n}: boxes must be a list')
            for ann in boxes:
                class_name = str(ann.get('class') or '')
                validate_source_class(source, class_name)
                box = ann.get('box')
                if not isinstance(box, list) or len(box) != 4:
                    raise ValueError(f'{self.path}:{n}: invalid box for {class_name!r}')
                x1, y1, x2, y2 = map(float, box)
                if x2 <= x1 or y2 <= y1:
                    raise ValueError(f'{self.path}:{n}: invalid xyxy box {box!r}')
                seen_classes.add(class_name)
                self.class_counts[class_name] += 1
            self.source_counts[source] += 1

        self.classes = ordered_classes(seen_classes)
        if not self.classes:
            raise ValueError(f'{self.path}: no supported detector classes found')
        self.c2i = {name: idx + 1 for idx, name in enumerate(self.classes)}

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
            labels.append(self.c2i[ann['class']])

        target = {
            'boxes': torch.tensor(boxes, dtype=torch.float32).reshape(-1, 4),
            'labels': torch.tensor(labels, dtype=torch.int64),
            'image_id': torch.tensor([i]),
        }
        return to_tensor(image), target


def collate(batch):
    return tuple(zip(*batch))


def _transfer_coco_predictor(model, weights, classes):
    old_predictor = model.roi_heads.box_predictor
    in_features = old_predictor.cls_score.in_features
    new_predictor = FastRCNNPredictor(in_features, len(classes) + 1)

    categories = list(weights.meta.get('categories') or [])
    if not categories:
        raise RuntimeError('TorchVision COCO category metadata is unavailable')

    mapping = []
    fresh = []
    with torch.no_grad():
        new_predictor.cls_score.weight[0].copy_(old_predictor.cls_score.weight[0])
        new_predictor.cls_score.bias[0].copy_(old_predictor.cls_score.bias[0])
        new_predictor.bbox_pred.weight[0:4].copy_(old_predictor.bbox_pred.weight[0:4])
        new_predictor.bbox_pred.bias[0:4].copy_(old_predictor.bbox_pred.bias[0:4])

        for new_idx, cls in enumerate(classes, 1):
            if cls not in categories:
                fresh.append(cls)
                continue
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
    return mapping, fresh


def build_model(classes, from_scratch=False, head_only=False, architecture='resnet50'):
    if not classes:
        raise ValueError('at least one detector class is required')
    if architecture == 'mobilenet320':
        weights = None if from_scratch else FasterRCNN_MobileNet_V3_Large_320_FPN_Weights.DEFAULT
        model = fasterrcnn_mobilenet_v3_large_320_fpn(
            weights=weights,
            weights_backbone=None if from_scratch else None,
            min_size=320,
            max_size=512,
        )
        if weights is None:
            initialization = 'from-scratch'
            mapping = []
            fresh = list(classes)
        else:
            mapping, fresh = _transfer_coco_predictor(model, weights, classes)
            initialization = 'torchvision-coco-pretrained+partial-class-head-transfer'
    elif from_scratch:
        model = fasterrcnn_resnet50_fpn(
            weights=None,
            weights_backbone=None,
            min_size=384,
            max_size=640,
        )
        in_features = model.roi_heads.box_predictor.cls_score.in_features
        model.roi_heads.box_predictor = FastRCNNPredictor(
            in_features,
            len(classes) + 1,
        )
        initialization = 'from-scratch'
        mapping = []
        fresh = list(classes)
    elif architecture == 'resnet50':
        weights = FasterRCNN_ResNet50_FPN_Weights.DEFAULT
        model = fasterrcnn_resnet50_fpn(
            weights=weights,
            min_size=384,
            max_size=640,
        )
        mapping, fresh = _transfer_coco_predictor(model, weights, classes)
        initialization = 'torchvision-coco-pretrained+partial-class-head-transfer'
    else:
        raise ValueError(f'unsupported architecture: {architecture}')

    if head_only:
        for p in model.parameters():
            p.requires_grad = False
        for p in model.roi_heads.box_predictor.parameters():
            p.requires_grad = True

    return model, initialization, mapping, fresh


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
        '--architecture',
        choices=('resnet50', 'mobilenet320'),
        default='resnet50',
        help='Detector backbone; mobilenet320 is a CPU-oriented Faster R-CNN variant.',
    )
    ap.add_argument('--seed', type=int, default=1337)
    ap.add_argument('--num-workers', type=int, default=2)
    ap.add_argument(
        '--resume',
        default=ROOT / 'ai-service/trained_models/detector-training-checkpoint.pt',
        help='Epoch checkpoint to resume when it exists.',
    )
    ap.add_argument('--no-resume', action='store_true')
    ap.add_argument(
        '--head-only',
        action='store_true',
        help='Freeze the pretrained detector and train only the dynamic box predictor.',
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
    if args.max_samples and not args.smoke:
        raise SystemExit('--max-samples is smoke/development-only; validated-capable training must consume the complete gated training manifest')
    if args.num_workers < 0:
        raise SystemExit('--num-workers must be non-negative')

    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    if args.device == 'cpu':
        torch.set_num_threads(max(1, min(torch.get_num_threads(), os.cpu_count() or 1)))

    manifest_path = Path(args.manifest)
    ds = ManifestDataset(manifest_path, args.max_samples)
    dl = DataLoader(
        ds,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate,
        num_workers=args.num_workers,
        pin_memory=args.device == 'cuda',
        persistent_workers=args.num_workers > 0,
    )

    model, initialization, mapping, fresh = build_model(
        ds.classes,
        from_scratch=args.from_scratch,
        head_only=args.head_only,
        architecture=args.architecture,
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
    scheduler = None

    out = ROOT / 'ai-service/trained_models'
    out.mkdir(parents=True, exist_ok=True)
    checkpoint_path = Path(args.resume)
    start_epoch = 0
    if not args.no_resume and checkpoint_path.exists():
        checkpoint = torch.load(checkpoint_path, map_location=args.device)
        if checkpoint.get('classes') != ds.classes:
            raise SystemExit(
                f'checkpoint classes do not match manifest: '
                f'{checkpoint.get("classes")} != {ds.classes}'
            )
        model.load_state_dict(checkpoint['model_state'])
        optimizer.load_state_dict(checkpoint['optimizer_state'])
        if scheduler is not None and checkpoint.get('scheduler_state') is not None:
            scheduler.load_state_dict(checkpoint['scheduler_state'])
        start_epoch = int(checkpoint['epoch'])
        if start_epoch >= args.epochs:
            print(f'checkpoint already completed {start_epoch} epoch(s); skipping training')

    print('initialization =', initialization)
    print('device =', args.device)
    print('images =', len(ds))
    print('sources =', dict(ds.source_counts))
    print('classes =', ds.classes)
    print('class_instances =', dict(ds.class_counts))
    print('head_only =', args.head_only)
    print('learning_rate =', args.lr)
    print('architecture =', args.architecture)
    print('seed =', args.seed)
    print('num_workers =', args.num_workers)
    print('checkpoint =', checkpoint_path)
    print(
        'internal_resize =',
        'min_size=320 max_size=512'
        if args.architecture == 'mobilenet320'
        else 'min_size=384 max_size=640',
    )
    print('trainable_parameter_tensors =', len(trainable))
    if mapping:
        print(
            'coco_head_transfer =',
            ', '.join(f'{cls}:{old_idx}->{new_idx}' for cls, old_idx, new_idx in mapping),
        )
    print('fresh_head_classes =', fresh)
    print('COCO_PARTIAL_CLASS_HEAD_TRANSFER_PASS')

    started = time.perf_counter()
    seen = 0

    for epoch in range(start_epoch, args.epochs):
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

        if scheduler is not None:
            scheduler.step()
        epoch_s = time.perf_counter() - epoch_started
        print(
            f'epoch {epoch+1}/{args.epochs} '
            f'avg_loss={total/max(1, len(dl)):.4f} '
            f'seconds={epoch_s:.2f}'
        )
        if not args.smoke:
            torch.save(
                {
                    'model_state': model.state_dict(),
                    'optimizer_state': optimizer.state_dict(),
                    'scheduler_state': scheduler.state_dict() if scheduler is not None else None,
                    'epoch': epoch + 1,
                    'classes': ds.classes,
                    'training_config': {
                        'manifest': str(manifest_path),
                        'epochs': args.epochs,
                        'batch_size': args.batch_size,
                        'learning_rate': args.lr,
                        'device': args.device,
                        'num_workers': args.num_workers,
                        'internal_resize': (
                            {'min_size': 320, 'max_size': 512}
                            if args.architecture == 'mobilenet320'
                            else {'min_size': 384, 'max_size': 640}
                        ),
                        'architecture': args.architecture,
                    },
                    'seed': args.seed,
                },
                checkpoint_path,
            )
            print('saved_epoch_checkpoint =', checkpoint_path)

    elapsed = time.perf_counter() - started
    rate = seen / max(1e-9, elapsed)
    print(f'TRAINING_SECONDS={elapsed:.2f}')
    print(f'TRAINING_IMAGES={seen}')
    print(f'TRAINING_IMAGES_PER_SEC={rate:.6f}')

    if args.smoke:
        full_epoch_s = ds.total_rows / max(rate, 1e-9)
        print('SMOKE_MODE=TRUE')
        print('WEIGHTS_WRITTEN=FALSE')
        print(f'ROUGH_FULL_EPOCH_SECONDS_AT_SMOKE_RATE={full_epoch_s:.2f}')
        print('CPU_SMOKE_TRAINING_PASS')
        return

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

    bdd_provenance_path = ROOT / 'datasets/derived-risk-data/bdd100k-hf-provenance.json'
    bdd_provenance = {}
    if bdd_provenance_path.exists():
        try:
            bdd_provenance = json.loads(bdd_provenance_path.read_text(encoding='utf-8'))
        except Exception:
            bdd_provenance = {}

    sources = sorted(ds.source_counts)
    combined = 'BDD100K' in sources and 'RDD2022' in sources
    version = (
        'bdd100k-rdd2022-fasterrcnn-resnet50-fpn-v5'
        if combined
        else 'rdd2022-fasterrcnn-resnet50-fpn-v5'
        if sources == ['RDD2022']
        else 'bdd100k-fasterrcnn-resnet50-fpn-v5'
    )
    meta.update({
        'detectorModelVersion': version,
        'detectorClasses': ds.classes,
        'detectorValidated': False,
        'trainingSources': sources,
        'trainingSourceImageCounts': dict(ds.source_counts),
        'trainingClassInstances': dict(ds.class_counts),
        'detectorTrainingProtocol': (
            'V29 source-aware BDD100K/RDD2022 training; validation requires a '
            'separate leakage-free held-out manifest through the V28 evidence chain.'
        ),
        'officialBddBenchmarkClaim': False,
        'officialRddBenchmarkClaim': False,
        'initialization': initialization,
        'cocoClassHeadTransfer': [x[0] for x in mapping],
        'freshHeadClasses': fresh,
        'headOnlyTraining': bool(args.head_only),
        'internalResize': {'minSize': 384, 'maxSize': 640},
        'trainingManifest': str(manifest_path),
        'trainingManifestSha256': sha256_file(manifest_path),
        'dataProvenance': {
            'BDD100K': bdd_provenance if 'BDD100K' in sources else None,
            'RDD2022': (
                'local upstream RDD2022 files; repository does not redistribute dataset'
                if 'RDD2022' in sources else None
            ),
        },
        'note': (
            'Training never implies validation. New road-damage/pothole head rows are '
            'learned only from supplied RDD2022 samples. Run model_data_gate.py, '
            'evaluate_detector.py and validation_evidence.py on untouched held-out data.'
        ),
    })
    meta['validated'] = bool(
        meta.get('detectorValidated', False) and meta.get('riskValidated', False)
    )
    meta_path.write_text(json.dumps(meta, indent=2), encoding='utf-8')

    print('saved', out / 'detector.pt')
    print('training manifest SHA-256 =', meta['trainingManifestSha256'])
    print('detectorValidated = FALSE')
    print('official BDD100K benchmark claim = FALSE')
    print('official RDD2022 benchmark claim = FALSE')


if __name__ == '__main__':
    main()
