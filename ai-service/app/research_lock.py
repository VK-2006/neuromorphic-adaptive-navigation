from __future__ import annotations

from pathlib import Path
import hashlib

# V32 Phase-5 post-final registry.
#
# These fingerprints come from the locked one-time 2025 external evaluation protocol.
# They are intentionally immutable scientific safety records: a failed candidate must not
# become live-safety validated later through metadata/evidence changes, and a consumed final
# set must never be recycled into training, tuning, model selection, or another validation.

RESEARCH_ONLY_RISK_MODELS = {
    '8a1aadd1950a87fcf60192976605f514367024d66790365c24ede04281d1d1ae': {
        'candidate': 'HIER_B Phase 3B hierarchical SNN',
        'disposition': 'RESEARCH_ONLY',
        'externalFinal': '2025',
        'decision': 'FINAL_2025_EXTERNAL_VALIDATION_FAIL',
    },
}

CONSUMED_SNN_FINAL_DATASETS = {
    '633249567e95479a1c30b3f10b0a6271ced11684fb338d0b8b4054ca94b80aa6': {
        'name': 'locked 2025 external final set',
        'consumed': True,
        'consumptionProtocol': 'NAVORA SNN Phase 4 one-time external final evaluation',
    },
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def research_only_risk_model_status(weights_path: Path) -> dict | None:
    path = Path(weights_path)
    if not path.exists() or not path.is_file() or path.stat().st_size <= 0:
        return None
    digest = sha256_file(path)
    record = RESEARCH_ONLY_RISK_MODELS.get(digest)
    if record is None:
        return None
    return {'sha256': digest, **record}


def consumed_snn_final_status(dataset_path: Path) -> dict | None:
    path = Path(dataset_path)
    if not path.exists() or not path.is_file() or path.stat().st_size <= 0:
        return None
    digest = sha256_file(path)
    record = CONSUMED_SNN_FINAL_DATASETS.get(digest)
    if record is None:
        return None
    return {'sha256': digest, **record}


def assert_not_consumed_snn_final(dataset_path: Path, purpose: str) -> None:
    status = consumed_snn_final_status(dataset_path)
    if status is None:
        return
    raise ValueError(
        f"SNN dataset is permanently consumed and cannot be used for {purpose}: "
        f"{status['name']} sha256={status['sha256']}"
    )
