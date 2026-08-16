from __future__ import annotations

from collections import Counter
from pathlib import Path
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ai-service'))
from app.detector_taxonomy import ordered_classes, validate_source_class
from app.model_validation import DATA_GATE_MINIMUMS


def stable_key(seed: str, row: dict) -> str:
    raw = f"{seed}|{row['source']}|{Path(row['image']).as_posix().lower()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def load_rows(path: Path) -> list[dict]:
    rows = []
    seen_images = set()
    for line_no, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except Exception as exc:
            raise ValueError(f'{path}:{line_no}: invalid JSON: {exc}') from exc
        source = str(row.get('source') or '')
        image = str(row.get('image') or '').strip()
        boxes = row.get('boxes')
        if not image or not isinstance(boxes, list) or not boxes:
            raise ValueError(f'{path}:{line_no}: image and non-empty boxes are required')
        image_key = str(Path(image).expanduser().resolve()).lower()
        if image_key in seen_images:
            raise ValueError(f'{path}:{line_no}: duplicate image row: {image}')
        seen_images.add(image_key)
        for ann in boxes:
            validate_source_class(source, str(ann.get('class') or ''))
        rows.append(row)
    if not rows:
        raise ValueError(f'empty manifest: {path}')
    return rows


def class_instances(rows: list[dict]) -> Counter:
    counts = Counter()
    for row in rows:
        counts.update(str(ann['class']) for ann in row['boxes'])
    return counts


def source_images(rows: list[dict]) -> Counter:
    return Counter(str(row['source']) for row in rows)


def split_rows(rows: list[dict], eval_fraction: float, seed: str, min_eval_instances: int):
    if not 0 < eval_fraction < 0.5:
        raise ValueError('--eval-fraction must be > 0 and < 0.5')

    by_source = {}
    for row in rows:
        by_source.setdefault(str(row['source']), []).append(row)

    train = []
    evaluation = []
    for source, items in sorted(by_source.items()):
        ordered = sorted(items, key=lambda row: stable_key(seed, row))
        if len(ordered) < 2:
            raise ValueError(f'source {source} has fewer than 2 images and cannot be split')
        eval_count = max(1, round(len(ordered) * eval_fraction))
        eval_count = min(eval_count, len(ordered) - 1)
        evaluation.extend(ordered[:eval_count])
        train.extend(ordered[eval_count:])

    trained_classes = ordered_classes(class_instances(rows))
    eval_counts = class_instances(evaluation)

    # Deterministically promote training images into held-out data only when needed to
    # preserve minimum class coverage. The held-out set is never used for training later.
    for class_name in trained_classes:
        while eval_counts.get(class_name, 0) < min_eval_instances:
            candidates = [
                row for row in train
                if any(str(ann['class']) == class_name for ann in row['boxes'])
                and source_images([x for x in train if x is not row]).get(str(row['source']), 0) > 0
            ]
            if not candidates:
                raise ValueError(
                    f'cannot provide {min_eval_instances} held-out instances for {class_name!r}; '
                    f'available held-out instances={eval_counts.get(class_name, 0)}'
                )
            chosen = min(candidates, key=lambda row: stable_key(seed + '|promote|' + class_name, row))
            train.remove(chosen)
            evaluation.append(chosen)
            eval_counts.update(str(ann['class']) for ann in chosen['boxes'])

    return train, evaluation


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(rows, key=lambda row: (str(row['source']), stable_key('output', row)))
    path.write_text('\n'.join(json.dumps(row) for row in ordered) + '\n', encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', type=Path, required=True)
    ap.add_argument('--train-out', type=Path, default=Path('datasets/derived-risk-data/detection-train.jsonl'))
    ap.add_argument('--eval-out', type=Path, default=Path('datasets/derived-risk-data/detection-eval.jsonl'))
    ap.add_argument('--eval-fraction', type=float, default=0.20)
    ap.add_argument('--seed', default='navora-v29')
    ap.add_argument(
        '--min-eval-class-instances',
        type=int,
        default=DATA_GATE_MINIMUMS['minDetectorEvalInstancesPerTrainedClass'],
    )
    args = ap.parse_args()

    try:
        rows = load_rows(args.manifest)
        train, evaluation = split_rows(
            rows,
            args.eval_fraction,
            args.seed,
            args.min_eval_class_instances,
        )
    except Exception as exc:
        print('DETECTOR SPLIT: BLOCKED')
        print('-', exc)
        return 2

    train_images = {str(Path(row['image']).expanduser().resolve()).lower() for row in train}
    eval_images = {str(Path(row['image']).expanduser().resolve()).lower() for row in evaluation}
    overlap = train_images & eval_images
    if overlap:
        print(f'DETECTOR SPLIT: BLOCKED - {len(overlap)} image(s) overlap')
        return 2

    write_jsonl(args.train_out, train)
    write_jsonl(args.eval_out, evaluation)
    report = {
        'seed': args.seed,
        'evalFractionRequested': args.eval_fraction,
        'trainImages': len(train),
        'evalImages': len(evaluation),
        'trainSources': dict(source_images(train)),
        'evalSources': dict(source_images(evaluation)),
        'trainClassInstances': dict(class_instances(train)),
        'evalClassInstances': dict(class_instances(evaluation)),
        'overlapImages': 0,
        'trainOut': str(args.train_out),
        'evalOut': str(args.eval_out),
    }
    print(json.dumps(report, indent=2))
    print('DETECTOR SPLIT: PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
