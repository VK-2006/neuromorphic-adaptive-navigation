from __future__ import annotations

from collections import Counter
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ai-service'))
from app.detector_taxonomy import ordered_classes, validate_source_class
from app.model_validation import DATA_GATE_MINIMUMS


def stable_key(seed: str, row: dict) -> str:
    raw = f"{seed}|{row['source']}|{Path(row['image']).as_posix().lower()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def row_class_counts(row: dict) -> Counter:
    return Counter(str(ann['class']) for ann in row['boxes'])


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
        image_path = Path(image).expanduser()
        if not image_path.is_absolute():
            image_path = Path.cwd() / image_path
        image_path = image_path.resolve()
        if not image_path.exists():
            raise ValueError(f'{path}:{line_no}: image missing: {image_path}')
        image_key = str(image_path).lower()
        if image_key in seen_images:
            raise ValueError(f'{path}:{line_no}: duplicate image row: {image}')
        seen_images.add(image_key)
        for ann in boxes:
            class_name = str(ann.get('class') or '')
            validate_source_class(source, class_name)
            box = ann.get('box')
            if not isinstance(box, list) or len(box) != 4:
                raise ValueError(f'{path}:{line_no}: invalid box for {class_name!r}')
            values = [float(x) for x in box]
            if not all(math.isfinite(x) for x in values) or values[2] <= values[0] or values[3] <= values[1]:
                raise ValueError(f'{path}:{line_no}: invalid xyxy box {box!r}')
        rows.append(row)
    if not rows:
        raise ValueError(f'empty manifest: {path}')
    return rows


def class_instances(rows: list[dict]) -> Counter:
    counts = Counter()
    for row in rows:
        counts.update(row_class_counts(row))
    return counts


def source_images(rows: list[dict]) -> Counter:
    return Counter(str(row['source']) for row in rows)


def can_move_train_to_eval(row: dict, train: list[dict]) -> bool:
    source = str(row['source'])
    remaining_sources = source_images([x for x in train if x is not row])
    if remaining_sources.get(source, 0) <= 0:
        return False
    remaining_classes = class_instances([x for x in train if x is not row])
    return all(remaining_classes.get(class_name, 0) > 0 for class_name in row_class_counts(row))


def can_move_eval_to_train(row: dict, evaluation: list[dict]) -> bool:
    source = str(row['source'])
    remaining_sources = source_images([x for x in evaluation if x is not row])
    return remaining_sources.get(source, 0) > 0


def split_rows(rows: list[dict], eval_fraction: float, seed: str, min_eval_instances: int):
    if not 0 < eval_fraction < 0.5:
        raise ValueError('--eval-fraction must be > 0 and < 0.5')
    policy_floor = DATA_GATE_MINIMUMS['minDetectorEvalInstancesPerTrainedClass']
    if min_eval_instances < policy_floor:
        raise ValueError(
            f'--min-eval-class-instances {min_eval_instances} is below policy floor {policy_floor}'
        )

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

    all_classes = ordered_classes(class_instances(rows))

    # First guarantee every class remains learnable. A rare-class image that happened to
    # hash into held-out data is moved back to training when necessary, while preserving
    # at least one held-out image for that source.
    for class_name in all_classes:
        if class_instances(train).get(class_name, 0) > 0:
            continue
        candidates = [
            row for row in evaluation
            if row_class_counts(row).get(class_name, 0) > 0
            and can_move_eval_to_train(row, evaluation)
        ]
        if not candidates:
            raise ValueError(f'cannot preserve any training example for class {class_name!r}')
        chosen = min(candidates, key=lambda row: stable_key(seed + '|restore-train|' + class_name, row))
        evaluation.remove(chosen)
        train.append(chosen)

    # Then guarantee held-out class coverage without ever removing the final training
    # instance of any class carried by the promoted image.
    for class_name in all_classes:
        while class_instances(evaluation).get(class_name, 0) < min_eval_instances:
            candidates = [
                row for row in train
                if row_class_counts(row).get(class_name, 0) > 0
                and can_move_train_to_eval(row, train)
            ]
            if not candidates:
                current = class_instances(evaluation).get(class_name, 0)
                raise ValueError(
                    f'cannot provide {min_eval_instances} held-out instances for {class_name!r} '
                    f'without removing its final training coverage; available held-out instances={current}'
                )
            chosen = min(candidates, key=lambda row: stable_key(seed + '|promote|' + class_name, row))
            train.remove(chosen)
            evaluation.append(chosen)

    train_counts = class_instances(train)
    eval_counts = class_instances(evaluation)
    for class_name in all_classes:
        if train_counts.get(class_name, 0) <= 0:
            raise ValueError(f'training coverage vanished for class {class_name!r}')
        if eval_counts.get(class_name, 0) < min_eval_instances:
            raise ValueError(f'held-out coverage remains insufficient for class {class_name!r}')

    train_sources = source_images(train)
    eval_sources = source_images(evaluation)
    for source in by_source:
        if train_sources.get(source, 0) <= 0 or eval_sources.get(source, 0) <= 0:
            raise ValueError(f'source {source!r} must remain represented in both train and held-out data')

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
        'minEvalClassInstances': args.min_eval_class_instances,
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
