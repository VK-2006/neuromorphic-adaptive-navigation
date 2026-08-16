from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.split_detection_manifest import class_instances, source_images, split_rows


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def synthetic_rows():
    rows = []
    for i in range(30):
        rows.append({
            'image': f'/synthetic/bdd-{i:03d}.jpg',
            'source': 'BDD100K',
            'boxes': [
                {'class': 'person', 'box': [1, 1, 20, 30]},
                {'class': 'car', 'box': [25, 5, 60, 35]},
            ],
        })
    for i in range(30):
        rows.append({
            'image': f'/synthetic/rdd-{i:03d}.jpg',
            'source': 'RDD2022',
            'boxes': [
                {'class': 'road damage', 'box': [2, 2, 30, 20]},
                {'class': 'pothole', 'box': [35, 10, 55, 28]},
            ],
        })
    return rows


def exercise_splitter():
    rows = synthetic_rows()
    train_a, eval_a = split_rows(rows, 0.20, 'navora-v29-contract', 5)
    train_b, eval_b = split_rows(rows, 0.20, 'navora-v29-contract', 5)

    signature = lambda items: sorted((row['source'], row['image']) for row in items)
    require(signature(train_a) == signature(train_b), 'splitter train result is not deterministic')
    require(signature(eval_a) == signature(eval_b), 'splitter eval result is not deterministic')
    require(not ({row['image'] for row in train_a} & {row['image'] for row in eval_a}), 'splitter leaked an image across train/eval')

    train_sources = source_images(train_a)
    eval_sources = source_images(eval_a)
    for source in ['BDD100K', 'RDD2022']:
        require(train_sources[source] > 0, f'{source} disappeared from training split')
        require(eval_sources[source] > 0, f'{source} disappeared from held-out split')

    train_classes = class_instances(train_a)
    eval_classes = class_instances(eval_a)
    for class_name in ['person', 'car', 'road damage', 'pothole']:
        require(train_classes[class_name] > 0, f'{class_name} disappeared from training split')
        require(eval_classes[class_name] >= 5, f'{class_name} held-out coverage below policy')

    try:
        split_rows(rows, 0.20, 'navora-v29-contract', 4)
    except ValueError as exc:
        require('below policy floor' in str(exc), 'weak split threshold rejected for wrong reason')
    else:
        raise AssertionError('splitter accepted a held-out class threshold below policy floor')


def main():
    taxonomy = read(Path('ai-service/app/detector_taxonomy.py'))
    trainer = read(Path('scripts/train_detector.py'))
    splitter = read(Path('scripts/split_detection_manifest.py'))
    gate = read(Path('scripts/model_data_gate.py'))
    validation = read(Path('ai-service/app/model_validation.py'))
    evidence = read(Path('scripts/validation_evidence.py'))

    for source, name in [
        (taxonomy, 'detector_taxonomy.py'),
        (trainer, 'train_detector.py'),
        (splitter, 'split_detection_manifest.py'),
        (gate, 'model_data_gate.py'),
        (validation, 'model_validation.py'),
        (evidence, 'validation_evidence.py'),
    ]:
        compile(source, name, 'exec')

    for class_name in [
        'person', 'bicycle', 'motorcycle', 'car', 'bus', 'truck',
        'traffic cone', 'barrier', 'road damage', 'pothole'
    ]:
        require(repr(class_name) in taxonomy, f'taxonomy missing {class_name}')
    require("'RDD2022': {'road damage', 'pothole'}" in taxonomy, 'RDD source taxonomy missing')
    require("'BDD100K'" in taxonomy and "'traffic cone'" in taxonomy and "'barrier'" in taxonomy, 'BDD expanded taxonomy missing')

    require('ordered_classes' in trainer and 'validate_source_class' in trainer, 'trainer must use shared taxonomy')
    require('len(classes) + 1' in trainer, 'trainer head must be dynamic')
    require("fresh.append(cls)" in trainer, 'non-COCO classes must remain fresh head rows')
    require("'freshHeadClasses': fresh" in trainer, 'trainer metadata must expose fresh head classes')
    require("'trainingSources': sources" in trainer, 'trainer metadata must expose training sources')
    require("'trainingManifestSha256': sha256_file(manifest_path)" in trainer, 'trainer must fingerprint exact training manifest')
    require("args.max_samples and not args.smoke" in trainer, 'partial sample training must not create validation-capable weights')
    require("'officialRddBenchmarkClaim': False" in trainer, 'trainer must not claim official RDD benchmark')

    require('stable_key' in splitter and 'sha256' in splitter.lower(), 'splitter must be deterministic')
    require('overlap = train_images & eval_images' in splitter, 'splitter must check train/eval overlap')
    require('minDetectorEvalInstancesPerTrainedClass' in splitter, 'splitter must preserve minimum held-out class coverage')
    require("source = str(row.get('source')" in splitter and 'validate_source_class' in splitter, 'splitter must preserve source taxonomy')

    require('trainClasses' in gate and 'evalClasses' in gate, 'data gate must report detector class spaces')
    require('trainSources' in gate and 'evalSources' in gate, 'data gate must report detector source coverage')
    require('held-out manifest contains classes absent from training' in gate, 'gate must reject eval-only classes')
    require('trained sources missing from held-out data' in gate, 'gate must require held-out coverage for trained sources')
    require('validate_source_class' in gate, 'gate must validate source/class pairs')

    require('detector metadata class order does not match the V29 data gate' in validation, 'runtime class-order binding missing')
    require('detector metadata training sources do not match the V29 data gate' in validation, 'runtime source binding missing')
    require('detector metadata training manifest fingerprint does not match the V29 data gate' in validation, 'runtime training-manifest binding missing')

    require('detector metadata class order does not match V29 data gate' in evidence, 'evidence class-order binding missing')
    require('detector metadata training sources do not match V29 data gate' in evidence, 'evidence source binding missing')
    require('detector metadata training manifest fingerprint does not match V29 data gate' in evidence, 'evidence training-manifest binding missing')
    require("'detectorContract'" in evidence, 'evidence must record V29 detector contract')

    exercise_splitter()
    print('V29 RDD DETECTOR TRAINING CONTRACTS PASS')


if __name__ == '__main__':
    main()
