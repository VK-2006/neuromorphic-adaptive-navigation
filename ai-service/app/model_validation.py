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


def _validate_class_policy(kind: str, evaluation: dict, gate_detector: dict, issues: list[str]) -> None:
    if evaluation.get('classPolicyPassed') is not True:
        issues.append(f'{kind} per-class validation policy did not pass')
    per_class = evaluation.get('perClass')
    if not isinstance(per_class, dict) or not per_class:
        issues.append(f'{kind} per-class metrics are missing')
        return
    if kind == 'detector':
        trained = gate_detector.get('trainClasses')
        if not isinstance(trained, list) or not trained:
            issues.append('detector trained-class contract is missing from data gate')
            return
        missing = [name for name in trained if name not in per_class]
        if missing:
            issues.append(f'detector evaluation is missing trained classes: {", ".join(missing)}')
    else:
        missing = [name for name in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] if name not in per_class]
        if missing:
            issues.append(f'SNN evaluation is missing risk classes: {", ".join(missing)}')


def model_validation_status(kind: str, weights_path: Path, metadata_path: Path) -> dict:
    """Return the conservative live-safety validation status for one model.

    A metadata boolean alone is never sufficient. Live validation requires the overall
    two-model gate, non-weakened policy floors, passing held-out reports, V30 evidence,
    exact report/dataset fingerprints, per-class quality gates, and the SHA-256 of the
    weight file being loaded. V32 additionally permanently rejects any risk-model weight
    fingerprint that has already failed an immutable external final validation.
    """
    if kind not in {'detector', 'risk'}:
        raise ValueError(f'unsupported model validation kind: {kind}')

    weights_path = Path(weights_path)
    metadata_path = Path(metadata_path)
    model_dir = metadata_path.parent
    gate_path = model_dir / 'data-gate-report.json'
    detector_eval_path = model_dir / 'detector-evaluation.json'
    snn_eval_path = model_dir / 'snn-evaluation.json'
    eval_path = detector_eval_path if kind == 'detector' else snn_eval_path
    evidence_path = model_dir / 'validation-evidence.json'
    issues: list[str] = []

    flag = 'detectorValidated' if kind == 'detector' else 'riskValidated'
    evidence_key = 'detector' if kind == 'detector' else 'snn'
    weight_key = 'detectorSha256' if kind == 'detector' else 'riskSnnSha256'
    eval_minimums = DETECTOR_EVAL_MINIMUMS if kind == 'detector' else SNN_EVAL_MINIMUMS
    metric_keys = (
        ['images', 'precision', 'recall', 'f1', 'macroF1', 'classPolicyPassed', 'perClass', 'passed', 'validationEligible']
        if kind == 'detector'
        else ['samples', 'accuracy', 'macroF1', 'balancedAccuracy', 'negativeLogLikelihood', 'classPolicyPassed', 'perClass', 'passed', 'validationEligible']
    )

    metadata = _load_json(metadata_path, issues, 'model metadata')
    if metadata.get('validated') is not True:
        issues.append('overall validated flag is not true')
    if metadata.get(flag) is not True:
        issues.append(f'{flag} is not true')

    gate = _load_json(gate_path, issues, 'data-gate report')
    gate_detector = gate.get('detector', {})
    gate_snn = gate.get('snn', {})
    if gate.get('passed') is not True:
        issues.append('data-gate report did not pass')
    if gate.get('policyCompliant') is not True:
        issues.append('data-gate report is not policy-compliant')
    if gate_detector.get('trainEvalImageOverlap') != 0:
        issues.append('detector train/eval overlap is not zero')
    if gate_snn.get('trainEvalRowOverlap') != 0:
        issues.append('SNN train/eval overlap is not zero')
    _thresholds_at_least(gate.get('thresholds', {}), DATA_GATE_MINIMUMS, issues, 'data-gate')

    if kind == 'detector':
        metadata_classes = metadata.get('detectorClasses')
        gate_classes = gate_detector.get('trainClasses')
        if not isinstance(metadata_classes, list) or not isinstance(gate_classes, list) or metadata_classes != gate_classes:
            issues.append('detector metadata class order does not match the V29 data gate')
        metadata_sources = metadata.get('trainingSources')
        gate_sources = sorted((gate_detector.get('trainSources') or {}).keys())
        if not isinstance(metadata_sources, list) or sorted(metadata_sources) != gate_sources:
            issues.append('detector metadata training sources do not match the V29 data gate')
        if metadata.get('trainingManifestSha256') != gate_detector.get('trainSha256'):
            issues.append('detector metadata training manifest fingerprint does not match the V29 data gate')

    evaluation = _load_json(eval_path, issues, f'{kind} evaluation report')
    if evaluation.get('passed') is not True:
        issues.append(f'{kind} held-out evaluation did not pass')
    if evaluation.get('policyCompliant') is not True:
        issues.append(f'{kind} evaluation is not policy-compliant')
    if evaluation.get('dataGateBound') is not True or evaluation.get('validationEligible') is not True:
        issues.append(f'{kind} evaluation is not bound to the passing data gate')
    _thresholds_at_least(evaluation.get('thresholds', {}), eval_minimums, issues, f'{kind} evaluation')
    _validate_class_policy(kind, evaluation, gate_detector, issues)

    if kind == 'detector' and evaluation.get('manifestSha256') != gate_detector.get('evalSha256'):
        issues.append('detector evaluation dataset fingerprint does not match the data gate')
    if kind == 'risk' and evaluation.get('datasetSha256') != gate_snn.get('evalSha256'):
        issues.append('SNN evaluation dataset fingerprint does not match the data gate')

    evidence = _load_json(evidence_path, issues, 'validation evidence')
    if evidence.get('schemaVersion') != 3:
        issues.append('validation evidence is not V30 schema version 3')
    if evidence.get('passed') is not True:
        issues.append('validation evidence did not pass')

    actual_sha = None
    if not weights_path.exists() or not weights_path.is_file() or weights_path.stat().st_size <= 0:
        issues.append('trained weight file is missing or empty')
    else:
        try:
            actual_sha = sha256_file(weights_path)
        except Exception as exc:
            issues.append(f'could not hash trained weights: {type(exc).__name__}')

    if kind == 'risk' and actual_sha in RESEARCH_ONLY_RISK_MODELS:
        record = RESEARCH_ONLY_RISK_MODELS[actual_sha]
        issues.append(
            'risk model is permanently research-only after failed external final validation: '
            f"{record.get('candidate', 'unknown candidate')}"
        )

    expected_sha = evidence.get('weights', {}).get(weight_key)
    if not expected_sha or actual_sha != expected_sha:
        issues.append('trained weight SHA-256 does not match validation evidence')

    evidence_metrics = evidence.get('metrics', {}).get(evidence_key, {})
    if evidence_metrics.get('passed') is not True or evidence_metrics.get('validationEligible') is not True:
        issues.append(f'{kind} evidence metrics are not validation-eligible')
    # Verify evaluation metrics match evidence
    if evaluation and evidence_metrics and not _metric_subset_matches(evaluation, evidence_metrics, metric_keys):
        issues.append(f'{kind} evaluation metrics do not match validation evidence')

    # Real‑world dataset provenance check — only enforce for real‑world validation
    is_real_world = evidence.get('datasetType') == 'real-world'
    if is_real_world:
        # Ensure required metrics are present for real‑world validation
        if kind == 'detector':
            if not isinstance(evidence_metrics.get('criticalRecall'), (int, float)):
                issues.append('detector evidence missing criticalRecall')
        elif kind == 'risk':
            if not isinstance(evidence_metrics.get('highRiskRecall'), (int, float)):
                issues.append('risk evidence missing highRiskRecall')

    datasets = evidence.get('datasets', {})
    expected_datasets = {
        'detectorTrainSha256': gate_detector.get('trainSha256'),
        'detectorEvalSha256': gate_detector.get('evalSha256'),
        'snnTrainSha256': gate_snn.get('trainSha256'),
        'snnEvalSha256': gate_snn.get('evalSha256'),
    }
    for key, expected in expected_datasets.items():
        if not expected or datasets.get(key) != expected:
            issues.append(f'validation evidence dataset binding mismatch: {key}')

    report_hashes = evidence.get('reports', {})
    for path, key, label in [
        (gate_path, 'dataGateSha256', 'data-gate report'),
        (detector_eval_path, 'detectorEvaluationSha256', 'detector evaluation report'),
        (snn_eval_path, 'snnEvaluationSha256', 'SNN evaluation report'),
        (metadata_path, 'metadataSha256', 'model metadata'),
    ]:
        if path.exists():
            _file_hash_matches(path, report_hashes.get(key), issues, label)

    unique_issues = list(dict.fromkeys(issues))
    real_world_validated = is_real_world and (not unique_issues)
    return {
        'kind': kind,
        'passed': not unique_issues,
        'realWorldValidated': real_world_validated,
        'weightSha256': actual_sha,
        'evidenceBound': not unique_issues,
        'reasons': unique_issues,
    }
