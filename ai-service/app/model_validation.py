from __future__ import annotations

from pathlib import Path
import hashlib
import json

from app.research_lock import RESEARCH_ONLY_RISK_MODELS

DATA_GATE_MINIMUMS = {
    'minDetectorTrainImages': 400,
    'minDetectorEvalImages': 200,
    'minSnnTrainRows': 400,
    'minSnnEvalRows': 200,
    'minDetectorEvalInstancesPerTrainedClass': 5,
    'minSnnEvalSamplesPerClass': 10,
}

# Retained for the optional detector development/evaluation utilities. These are
# diagnostic policy floors, not a current project-completion or runtime gate.
DETECTOR_EVAL_MINIMUMS = {
    'minSamples': 200,
    'minPrecision': 0.65,
    'minRecall': 0.60,
    'minF1': 0.62,
    'minPerClassPrecision': 0.35,
    'minPerClassRecall': 0.40,
    'minPerClassF1': 0.40,
}

SNN_EVAL_MINIMUMS = {
    'minSamples': 200,
    'minAccuracy': 0.75,
    'minMacroF1': 0.70,
    'minPerClassF1': 0.55,
    'minHighRiskRecall': 0.65,
}

SNN_DATA_GATE_MINIMUMS = {
    'minSnnTrainRows': DATA_GATE_MINIMUMS['minSnnTrainRows'],
    'minSnnEvalRows': DATA_GATE_MINIMUMS['minSnnEvalRows'],
    'minSnnEvalSamplesPerClass': DATA_GATE_MINIMUMS['minSnnEvalSamplesPerClass'],
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def _load_json(path: Path, issues: list[str], label: str) -> dict:
    if not path.exists():
        issues.append(f'missing {label}')
        return {}
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        issues.append(f'invalid {label}: {type(exc).__name__}')
        return {}
    if not isinstance(value, dict):
        issues.append(f'invalid {label}: expected object')
        return {}
    return value


def _load_json_optional(path: Path) -> tuple[dict, str | None]:
    if not path.exists():
        return {}, None
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        return {}, f'invalid model metadata: {type(exc).__name__}'
    if not isinstance(value, dict):
        return {}, 'invalid model metadata: expected object'
    return value, None


def _thresholds_at_least(actual: dict, minimums: dict[str, float | int], issues: list[str], label: str) -> None:
    if not isinstance(actual, dict):
        issues.append(f'{label} thresholds missing')
        return
    for key, floor in minimums.items():
        value = actual.get(key)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value < floor:
            issues.append(f'{label} threshold {key} is below policy floor {floor}')


def _metric_subset_matches(source: dict, evidence: dict, keys: list[str]) -> bool:
    return all(source.get(key) == evidence.get(key) for key in keys)


def _file_hash_matches(path: Path, expected: object, issues: list[str], label: str) -> None:
    if not isinstance(expected, str) or not expected:
        issues.append(f'{label} SHA-256 is missing from validation evidence')
        return
    try:
        actual = sha256_file(path)
    except Exception as exc:
        issues.append(f'could not hash {label}: {type(exc).__name__}')
        return
    if actual != expected:
        issues.append(f'{label} SHA-256 does not match validation evidence')


def detector_integrity_status(weights_path: Path, metadata_path: Path) -> dict:
    """Return normal functional readiness for the detector artifact.

    This intentionally does not make an independent scientific-validation claim.
    Runtime readiness is limited to artifact presence, non-empty/hash integrity when
    an expected artifact hash is available, and basic taxonomy metadata sanity.
    TorchScript loadability is checked by ``detection_service.Detector`` itself.
    """
    weights_path = Path(weights_path)
    metadata_path = Path(metadata_path)
    issues: list[str] = []
    actual_sha = None

    if not weights_path.exists() or not weights_path.is_file() or weights_path.stat().st_size <= 0:
        issues.append('trained detector weight file is missing or empty')
    else:
        try:
            actual_sha = sha256_file(weights_path)
        except Exception as exc:
            issues.append(f'could not hash detector weights: {type(exc).__name__}')

    metadata, metadata_error = _load_json_optional(metadata_path)
    if metadata_error:
        issues.append(metadata_error)

    classes = metadata.get('detectorClasses') if metadata else None
    if classes is not None:
        if (
            not isinstance(classes, list)
            or not classes
            or any(not isinstance(name, str) or not name.strip() for name in classes)
            or len(set(classes)) != len(classes)
        ):
            issues.append('detector taxonomy metadata is invalid')

    expected_sha = metadata.get('detectorArtifactSha256') if metadata else None
    hash_bound = isinstance(expected_sha, str) and len(expected_sha) == 64
    if hash_bound and actual_sha != expected_sha:
        issues.append('detector weight SHA-256 does not match detectorArtifactSha256 metadata')

    unique_issues = list(dict.fromkeys(issues))
    return {
        'kind': 'detector',
        'passed': not unique_issues,
        'functionalReady': not unique_issues,
        'weightSha256': actual_sha,
        'hashBound': hash_bound,
        'scientificValidationRequired': False,
        'scientificallyValidated': False,
        'reasons': unique_issues,
    }


def _validate_snn_class_policy(evaluation: dict, issues: list[str]) -> None:
    if evaluation.get('classPolicyPassed') is not True:
        issues.append('risk per-class validation policy did not pass')
    per_class = evaluation.get('perClass')
    if not isinstance(per_class, dict) or not per_class:
        issues.append('risk per-class metrics are missing')
        return
    missing = [name for name in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] if name not in per_class]
    if missing:
        issues.append(f'SNN evaluation is missing risk classes: {", ".join(missing)}')


def model_validation_status(kind: str, weights_path: Path, metadata_path: Path) -> dict:
    """Return runtime model status without coupling detector science to SNN science.

    ``kind='detector'`` is a backward-compatible functional integrity query. The
    detector is not required to pass an independent cross-dataset scientific holdout.

    ``kind='risk'`` preserves Navora's SNN scientific-validation controls: held-out
    SNN data binding, policy floors, class-aware metrics, exact report/dataset/weight
    hashes, and the immutable V32 research lock. Detector evaluation/evidence is not
    a prerequisite for SNN validation or current project completion.
    """
    if kind == 'detector':
        return detector_integrity_status(weights_path, metadata_path)
    if kind != 'risk':
        raise ValueError(f'unsupported model validation kind: {kind}')

    weights_path = Path(weights_path)
    metadata_path = Path(metadata_path)
    model_dir = metadata_path.parent
    gate_path = model_dir / 'data-gate-report.json'
    snn_eval_path = model_dir / 'snn-evaluation.json'
    evidence_path = model_dir / 'validation-evidence.json'
    issues: list[str] = []

    metadata = _load_json(metadata_path, issues, 'model metadata')
    if metadata.get('riskValidated') is not True:
        issues.append('riskValidated is not true')

    gate = _load_json(gate_path, issues, 'data-gate report')
    gate_snn = gate.get('snn', {})
    if gate_snn.get('trainEvalRowOverlap') != 0:
        issues.append('SNN train/eval overlap is not zero')
    if not gate_snn.get('trainSha256') or not gate_snn.get('evalSha256'):
        issues.append('SNN data-gate fingerprints are missing')
    _thresholds_at_least(gate.get('thresholds', {}), SNN_DATA_GATE_MINIMUMS, issues, 'SNN data-gate')

    evaluation = _load_json(snn_eval_path, issues, 'risk evaluation report')
    if evaluation.get('passed') is not True:
        issues.append('risk held-out evaluation did not pass')
    if evaluation.get('policyCompliant') is not True:
        issues.append('risk evaluation is not policy-compliant')
    if evaluation.get('dataGateBound') is not True or evaluation.get('validationEligible') is not True:
        issues.append('risk evaluation is not bound to the passing SNN data gate')
    _thresholds_at_least(evaluation.get('thresholds', {}), SNN_EVAL_MINIMUMS, issues, 'risk evaluation')
    _validate_snn_class_policy(evaluation, issues)
    if evaluation.get('datasetSha256') != gate_snn.get('evalSha256'):
        issues.append('SNN evaluation dataset fingerprint does not match the data gate')

    evidence = _load_json(evidence_path, issues, 'validation evidence')
    if evidence.get('schemaVersion') != 3:
        issues.append('validation evidence is not V30 schema version 3')

    actual_sha = None
    if not weights_path.exists() or not weights_path.is_file() or weights_path.stat().st_size <= 0:
        issues.append('trained weight file is missing or empty')
    else:
        try:
            actual_sha = sha256_file(weights_path)
        except Exception as exc:
            issues.append(f'could not hash trained weights: {type(exc).__name__}')

    if actual_sha in RESEARCH_ONLY_RISK_MODELS:
        record = RESEARCH_ONLY_RISK_MODELS[actual_sha]
        issues.append(
            'risk model is permanently research-only after failed external final validation: '
            f"{record.get('candidate', 'unknown candidate')}"
        )

    expected_sha = evidence.get('weights', {}).get('riskSnnSha256')
    if not expected_sha or actual_sha != expected_sha:
        issues.append('trained weight SHA-256 does not match validation evidence')

    metric_keys = [
        'samples', 'accuracy', 'macroF1', 'balancedAccuracy', 'negativeLogLikelihood',
        'classPolicyPassed', 'perClass', 'passed', 'validationEligible'
    ]
    evidence_metrics = evidence.get('metrics', {}).get('snn', {})
    if evidence_metrics.get('passed') is not True or evidence_metrics.get('validationEligible') is not True:
        issues.append('risk evidence metrics are not validation-eligible')
    if evaluation and evidence_metrics and not _metric_subset_matches(evaluation, evidence_metrics, metric_keys):
        issues.append('risk evaluation metrics do not match validation evidence')

    datasets = evidence.get('datasets', {})
    expected_datasets = {
        'snnTrainSha256': gate_snn.get('trainSha256'),
        'snnEvalSha256': gate_snn.get('evalSha256'),
    }
    for key, expected in expected_datasets.items():
        if not expected or datasets.get(key) != expected:
            issues.append(f'validation evidence dataset binding mismatch: {key}')

    report_hashes = evidence.get('reports', {})
    for path, key, label in [
        (gate_path, 'dataGateSha256', 'data-gate report'),
        (snn_eval_path, 'snnEvaluationSha256', 'SNN evaluation report'),
        (metadata_path, 'metadataSha256', 'model metadata'),
    ]:
        if path.exists():
            _file_hash_matches(path, report_hashes.get(key), issues, label)

    unique_issues = list(dict.fromkeys(issues))
    return {
        'kind': 'risk',
        'passed': not unique_issues,
        'weightSha256': actual_sha,
        'evidenceBound': not unique_issues,
        'reasons': unique_issues,
    }
