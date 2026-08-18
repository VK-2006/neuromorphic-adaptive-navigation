"""Generate a realistic synthetic SNN risk dataset for training and evaluation.

Each risk class (LOW, MEDIUM, HIGH, CRITICAL) has a distinct feature distribution
modelled as a multivariate Gaussian with controlled per-feature variance. The
distributions are designed so that an SNN can learn meaningful decision boundaries
while retaining realistic overlap between adjacent classes.

Features (all normalized to [0,1]):
  objectPrior       - prior probability that an object category is hazardous
  confidence        - detection confidence score
  proximity         - normalized closeness (1 = very close)
  relativeSpeed     - normalized relative speed of detected object
  userSpeed         - normalized user speed
  objectPersistence - how long the object has been tracked
  trafficDensity    - local traffic density estimate
  hazardFrequency   - historical hazard frequency on this corridor
  lowVisibility     - visibility impairment level (fog, rain, night)
  weatherRisk       - weather severity index
  roadOrReports     - normalized road condition / verified report count

Output:
  datasets/derived-risk-data/risk-training.csv   (training split)
  datasets/derived-risk-data/risk-evaluation.csv (held-out evaluation split)
"""
from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FEATURES = [
    'objectPrior', 'confidence', 'proximity', 'relativeSpeed', 'userSpeed',
    'objectPersistence', 'trafficDensity', 'hazardFrequency', 'lowVisibility',
    'weatherRisk', 'roadOrReports',
]

# Class-conditioned feature means — designed to be realistic and separable.
# Each tuple is (mean, std) for the corresponding feature.
# Means are spaced ~0.25 apart between classes; std tightened to 0.05–0.08
# to keep inter-class overlap minimal while retaining realistic within-class spread.
CLASS_PROFILES: dict[str, list[tuple[float, float]]] = {
    'LOW': [
        (0.07, 0.05),  # objectPrior
        (0.72, 0.07),  # confidence
        (0.07, 0.05),  # proximity (far away)
        (0.05, 0.04),  # relativeSpeed (slow)
        (0.10, 0.06),  # userSpeed
        (0.08, 0.05),  # objectPersistence
        (0.07, 0.05),  # trafficDensity
        (0.05, 0.04),  # hazardFrequency
        (0.05, 0.04),  # lowVisibility
        (0.04, 0.03),  # weatherRisk
        (0.05, 0.04),  # roadOrReports
    ],
    'MEDIUM': [
        (0.35, 0.07),  # objectPrior
        (0.80, 0.06),  # confidence
        (0.33, 0.07),  # proximity
        (0.26, 0.06),  # relativeSpeed
        (0.32, 0.07),  # userSpeed
        (0.30, 0.07),  # objectPersistence
        (0.30, 0.07),  # trafficDensity
        (0.24, 0.06),  # hazardFrequency
        (0.22, 0.06),  # lowVisibility
        (0.18, 0.05),  # weatherRisk
        (0.25, 0.07),  # roadOrReports
    ],
    'HIGH': [
        (0.65, 0.06),  # objectPrior
        (0.88, 0.05),  # confidence
        (0.63, 0.06),  # proximity (closer, but NOT critical)
        (0.55, 0.06),  # relativeSpeed
        (0.58, 0.06),  # userSpeed
        (0.68, 0.06),  # objectPersistence
        (0.63, 0.06),  # trafficDensity
        (0.56, 0.06),  # hazardFrequency
        (0.48, 0.06),  # lowVisibility
        (0.42, 0.05),  # weatherRisk
        (0.62, 0.06),  # roadOrReports
    ],
    'CRITICAL': [
        (0.92, 0.04),  # objectPrior
        (0.96, 0.03),  # confidence
        (0.92, 0.04),  # proximity (very close — tight distribution)
        (0.82, 0.05),  # relativeSpeed (fast)
        (0.84, 0.05),  # userSpeed
        (0.94, 0.04),  # objectPersistence
        (0.88, 0.05),  # trafficDensity
        (0.80, 0.05),  # hazardFrequency
        (0.72, 0.06),  # lowVisibility
        (0.65, 0.06),  # weatherRisk
        (0.88, 0.05),  # roadOrReports
    ],
}

LABELS = list(CLASS_PROFILES.keys())


def sample_row(label: str, rng: random.Random) -> dict[str, str]:
    """Sample a single feature vector from the class-conditioned distribution."""
    profile = CLASS_PROFILES[label]
    row: dict[str, str] = {}
    for feat, (mean, std) in zip(FEATURES, profile):
        value = rng.gauss(mean, std)
        # Clamp to [0, 1] — realistic sensor/feature normalization
        value = max(0.0, min(1.0, value))
        row[feat] = f'{value:.4f}'
    row['riskLabel'] = label
    return row


def generate_split(
    n_per_class: int,
    seed: int,
    extra_noise: float = 0.0,
) -> list[dict[str, str]]:
    """Generate a balanced dataset split with n_per_class samples per label."""
    rng = random.Random(seed)
    rows: list[dict[str, str]] = []
    for label in LABELS:
        for _ in range(n_per_class):
            row = sample_row(label, rng)
            # Optional extra noise to make evaluation slightly harder
            if extra_noise > 0:
                for feat in FEATURES:
                    val = float(row[feat]) + rng.gauss(0, extra_noise)
                    row[feat] = f'{max(0.0, min(1.0, val)):.4f}'
            rows.append(row)
    rng.shuffle(rows)
    return rows


def write_csv(rows: list[dict[str, str]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FEATURES + ['riskLabel'])
        writer.writeheader()
        writer.writerows(rows)
    print(f'  wrote {len(rows)} rows -> {path}')


def main() -> None:
    ap = argparse.ArgumentParser(description='Generate synthetic SNN risk dataset')
    ap.add_argument(
        '--train-per-class', type=int, default=200,
        help='Samples per class for training split (default: 200, total = 4 * N)',
    )
    ap.add_argument(
        '--eval-per-class', type=int, default=100,
        help='Samples per class for evaluation split (default: 100, total = 4 * N)',
    )
    ap.add_argument('--train-seed', type=int, default=42)
    ap.add_argument('--eval-seed', type=int, default=2026)
    ap.add_argument(
        '--out-dir', type=Path,
        default=ROOT / 'datasets' / 'derived-risk-data',
    )
    args = ap.parse_args()

    print(f'Generating SNN risk dataset...')
    print(f'  Training: {args.train_per_class} per class x {len(LABELS)} = {args.train_per_class * len(LABELS)} rows')
    print(f'  Evaluation: {args.eval_per_class} per class x {len(LABELS)} = {args.eval_per_class * len(LABELS)} rows')

    train_rows = generate_split(args.train_per_class, args.train_seed)
    eval_rows = generate_split(args.eval_per_class, args.eval_seed, extra_noise=0.02)

    train_path = args.out_dir / 'risk-training.csv'
    eval_path = args.out_dir / 'risk-evaluation.csv'

    write_csv(train_rows, train_path)
    write_csv(eval_rows, eval_path)

    # Print class distribution summary
    from collections import Counter
    train_counts = Counter(r['riskLabel'] for r in train_rows)
    eval_counts = Counter(r['riskLabel'] for r in eval_rows)
    print(f'\nTraining distribution: {dict(sorted(train_counts.items()))}')
    print(f'Evaluation distribution: {dict(sorted(eval_counts.items()))}')
    print(f'\nDataset generation complete.')


if __name__ == '__main__':
    main()
