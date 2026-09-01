import json
from pathlib import Path

import pytest

from app.model_validation import (
    DATA_GATE_MINIMUMS,
    DETECTOR_EVAL_MINIMUMS,
    SNN_EVAL_MINIMUMS,
    model_validation_status,
    sha256_file,
)


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2), encoding='utf-8')


def detector_per_class():
    return {
        'person': {'tp': 40, 'fp': 8, 'fn': 10, 'support': 50, 'precision': 0.833333, 'recall': 0.8, 'f1': 0.816327},
        'car': {'tp': 70, 'fp': 15, 'fn': 20, 'support': 90, 'precision': 0.823529, 'recall': 0.777778, 'f1': 0.8},
        'road damage': {'tp': 35, 'fp': 10, 'fn': 15, 'support': 50, 'precision': 0.777778, 'recall': 0.7, 'f1': 0.736842},
        'pothole': {'tp': 30, 'fp': 10, 'fn': 20, 'support': 50, 'precision': 0.75, 'recall': 0.6, 'f1': 0.666667},
    }


def snn_per_class():
    return {
        'LOW': {'tp': 65, 'fp': 8, 'fn': 10, 'support': 75, 'precision': 0.890411, 'recall': 0.866667, 'f1': 0.878378},
        'MEDIUM': {'tp': 60, 'fp': 10, 'fn': 15, 'support': 75, 'precision': 0.857143, 'recall': 0.8, 'f1': 0.827586},
        'HIGH': {'tp': 58, 'fp': 12, 'fn': 17, 'support': 75, 'precision': 0.828571, 'recall': 0.773333, 'f1': 0.8},
        'CRITICAL': {'tp': 55, 'fp': 10, 'fn': 20, 'support': 75, 'precision': 0.846154, 'recall': 0.733333, 'f1': 0.785714},
    }


def coherent_bundle(tmp_path: Path):
    detector = tmp_path / 'detector.pt'
    snn = tmp_path / 'risk_snn.pt'
    metadata = tmp_path / 'metadata.json'
    gate_path = tmp_path / 'data-gate-report.json'
    detector_eval_path = tmp_path / 'detector-evaluation.json'
    snn_eval_path = tmp_path / 'snn-evaluation.json'
    evidence_path = tmp_path / 'validation-evidence.json'

    detector.write_bytes(b'detector-weight-v30')
    snn.write_bytes(b'snn-weight-v30')
    detector_classes = ['person', 'car', 'road damage', 'pothole']
    training_sources = ['BDD100K', 'RDD2022']

    gate = {
        'passed': True,
        'policyCompliant': True,
        'thresholds': dict(DATA_GATE_MINIMUMS),
        'detector': {
            'trainEvalImageOverlap': 0,
            'trainSha256': 'det-train-sha',
            'evalSha256': 'det-eval-sha',
            'trainClasses': detector_classes,
            'evalClasses': detector_classes,
            'trainSources': {'BDD100K': 400, 'RDD2022': 250},
            'evalSources': {'BDD100K': 150, 'RDD2022': 100},
        },
        'snn': {
            'trainEvalRowOverlap': 0,
            'trainSha256': 'snn-train-sha',
            'evalSha256': 'snn-eval-sha',
        },
    }
    detector_eval = {
        'images': 250,
        'precision': 0.8,
        'recall': 0.72,
        'f1': 0.758,
        'macroF1': 0.71,
        'classPolicyPassed': True,
        'perClass': detector_per_class(),
        'passed': True,
        'policyCompliant': True,
        'dataGateBound': True,
        'validationEligible': True,
        'thresholds': dict(DETECTOR_EVAL_MINIMUMS),
        'manifestSha256': 'det-eval-sha',
    }
    snn_eval = {
        'samples': 300,
        'accuracy': 0.82,
        'macroF1': 0.78,
        'balancedAccuracy': 0.8,
        'negativeLogLikelihood': 0.4,
        'classPolicyPassed': True,
        'perClass': snn_per_class(),
        'passed': True,
        'policyCompliant': True,
        'dataGateBound': True,
        'validationEligible': True,
        'thresholds': dict(SNN_EVAL_MINIMUMS),
        'datasetSha256': 'snn-eval-sha',
    }
    meta = {
        'detectorValidated': True,
        'riskValidated': True,
        'validated': True,
        'detectorClasses': detector_classes,
        'trainingSources': training_sources,
        'trainingManifestSha256': 'det-train-sha',
    }

    write_json(gate_path, gate)
    write_json(detector_eval_path, detector_eval)
    write_json(snn_eval_path, snn_eval)
    write_json(metadata, meta)

    evidence = {
        'schemaVersion': 3,
        'passed': True,
        'weights': {
            'detectorSha256': sha256_file(detector),
            'riskSnnSha256': sha256_file(snn),
        },
        'datasets': {
            'detectorTrainSha256': 'det-train-sha',
            'detectorEvalSha256': 'det-eval-sha',
            'snnTrainSha256': 'snn-train-sha',
            'snnEvalSha256': 'snn-eval-sha',
        },
        'reports': {
            'dataGateSha256': sha256_file(gate_path),
            'detectorEvaluationSha256': sha256_file(detector_eval_path),
            'snnEvaluationSha256': sha256_file(snn_eval_path),
            'metadataSha256': sha256_file(metadata),
        },
        'metrics': {
            'detector': {
                k: detector_eval[k]
                for k in ['images', 'precision', 'recall', 'f1', 'macroF1', 'classPolicyPassed', 'perClass', 'passed', 'validationEligible']
            },
            'snn': {
                k: snn_eval[k]
                for k in ['samples', 'accuracy', 'macroF1', 'balancedAccuracy', 'negativeLogLikelihood', 'classPolicyPassed', 'perClass', 'passed', 'validationEligible']
            },
        },
    }
    write_json(evidence_path, evidence)
    return {
        'detector': detector,
        'snn': snn,
        'metadata': metadata,
        'gate': gate_path,
        'detector_eval': detector_eval_path,
        'snn_eval': snn_eval_path,
        'evidence': evidence_path,
    }


def refresh_evidence_report_binding(p, kind):
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    if kind == 'detector':
        report = json.loads(p['detector_eval'].read_text(encoding='utf-8'))
        evidence['reports']['detectorEvaluationSha256'] = sha256_file(p['detector_eval'])
        evidence['metrics']['detector'] = {
            k: report[k] for k in ['images', 'precision', 'recall', 'f1', 'macroF1', 'classPolicyPassed', 'perClass', 'passed', 'validationEligible']
        }
    else:
        report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
        evidence['reports']['snnEvaluationSha256'] = sha256_file(p['snn_eval'])
        evidence['metrics']['snn'] = {
            k: report[k] for k in ['samples', 'accuracy', 'macroF1', 'balancedAccuracy', 'negativeLogLikelihood', 'classPolicyPassed', 'perClass', 'passed', 'validationEligible']
        }
    write_json(p['evidence'], evidence)


def test_coherent_v30_bundle_is_live_validation_eligible(tmp_path):
    p = coherent_bundle(tmp_path)
    detector = model_validation_status('detector', p['detector'], p['metadata'])
    risk = model_validation_status('risk', p['snn'], p['metadata'])
    assert detector['passed'] is True
    assert risk['passed'] is True
    assert detector['reasons'] == []
    assert risk['reasons'] == []


def real_world_bundle(tmp_path: Path):
    """Create a coherent bundle that represents a genuine real‑world validation case.
    It builds upon the existing ``coherent_bundle`` fixture and adds the required
    ``datasetType`` and metric fields required for Phase 16 real‑world validation.
    """
    p = coherent_bundle(tmp_path)
    # Load the existing evidence and augment it with real‑world provenance fields.
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    evidence['datasetType'] = 'real-world'
    # Include optional descriptive fields (they are not validated but provide realism).
    evidence['datasetName'] = 'test-fixture-dataset'
    evidence['datasetVersion'] = 'test'
    evidence['datasetSource'] = 'test-fixture'
    evidence['sampleCount'] = 500
    # Ensure the required real‑world metrics are present.
    evidence['metrics']['detector']['criticalRecall'] = 0.85
    evidence['metrics']['snn']['highRiskRecall'] = 0.90
    # Write back the updated evidence.
    write_json(p['evidence'], evidence)
    return p

def test_real_world_bundle_is_accepted(tmp_path: Path):
    """Validate that a correctly‑augmented real‑world bundle passes both generic
    validation (``passed``) and the Phase 16 real‑world gate (``realWorldValidated``).
    """
    p = real_world_bundle(tmp_path)
    detector = model_validation_status('detector', p['detector'], p['metadata'])
    risk = model_validation_status('risk', p['snn'], p['metadata'])
    assert detector['passed'] is True
    assert risk['passed'] is True
    assert detector['realWorldValidated'] is True
    assert risk['realWorldValidated'] is True

def test_missing_dataset_type_real_world_validated_is_false(tmp_path: Path):
    """When ``datasetType`` is absent, the bundle should be considered valid
    (``passed``) but not real‑world validated.
    """
    p = coherent_bundle(tmp_path)  # original bundle lacks ``datasetType``
    detector = model_validation_status('detector', p['detector'], p['metadata'])
    risk = model_validation_status('risk', p['snn'], p['metadata'])
    assert detector['passed'] is True
    assert risk['passed'] is True
    assert detector['realWorldValidated'] is False
    assert risk['realWorldValidated'] is False

def test_synthetic_dataset_type_is_rejected(tmp_path: Path):
    """A synthetic ``datasetType`` must not be treated as real‑world validated.
    The generic validation should still pass.
    """
    p = coherent_bundle(tmp_path)
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    evidence['datasetType'] = 'synthetic'
    write_json(p['evidence'], evidence)
    detector = model_validation_status('detector', p['detector'], p['metadata'])
    risk = model_validation_status('risk', p['snn'], p['metadata'])
    assert detector['passed'] is True
    assert risk['passed'] is True
    assert detector['realWorldValidated'] is False
    assert risk['realWorldValidated'] is False

def test_real_world_missing_criticalRecall_fails(tmp_path: Path):
    """If a real‑world bundle lacks the required ``criticalRecall`` metric for the
    detector, the generic validation should fail, and consequently real‑world
    validation must also be false.
    """
    p = real_world_bundle(tmp_path)
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    # Remove the required metric.
    del evidence['metrics']['detector']['criticalRecall']
    write_json(p['evidence'], evidence)
    detector = model_validation_status('detector', p['detector'], p['metadata'])
    assert detector['passed'] is False
    assert detector['realWorldValidated'] is False

def test_real_world_missing_highRiskRecall_fails(tmp_path: Path):
    """Analogous test for the SNN ``highRiskRecall`` metric.
    """
    p = real_world_bundle(tmp_path)
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    del evidence['metrics']['snn']['highRiskRecall']
    write_json(p['evidence'], evidence)
    risk = model_validation_status('risk', p['snn'], p['metadata'])
    assert risk['passed'] is False
    assert risk['realWorldValidated'] is False


def test_weight_tamper_revokes_validation(tmp_path):
    p = coherent_bundle(tmp_path)
    p['detector'].write_bytes(b'tampered-detector')
    status = model_validation_status('detector', p['detector'], p['metadata'])
    assert status['passed'] is False
    assert any('weight SHA-256' in reason for reason in status['reasons'])


def test_metadata_boolean_alone_cannot_claim_validation(tmp_path):
    p = coherent_bundle(tmp_path)
    meta = json.loads(p['metadata'].read_text(encoding='utf-8'))
    meta['validated'] = False
    write_json(p['metadata'], meta)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert 'overall validated flag is not true' in status['reasons']


def test_report_tamper_revokes_both_live_validation_paths(tmp_path):
    p = coherent_bundle(tmp_path)
    report = json.loads(p['detector_eval'].read_text(encoding='utf-8'))
    report['precision'] = 0.99
    write_json(p['detector_eval'], report)
    detector = model_validation_status('detector', p['detector'], p['metadata'])
    risk = model_validation_status('risk', p['snn'], p['metadata'])
    assert detector['passed'] is False
    assert risk['passed'] is False
    assert any('detector evaluation report SHA-256' in reason for reason in detector['reasons'])


def test_old_evidence_schema_is_rejected(tmp_path):
    p = coherent_bundle(tmp_path)
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    evidence['schemaVersion'] = 2
    write_json(p['evidence'], evidence)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert 'validation evidence is not V30 schema version 3' in status['reasons']


def test_policy_floor_cannot_be_weakened_after_evidence(tmp_path):
    p = coherent_bundle(tmp_path)
    report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    report['thresholds']['minAccuracy'] = 0.1
    write_json(p['snn_eval'], report)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert any('threshold minAccuracy is below policy floor' in reason for reason in status['reasons'])


def test_aggregate_detector_metrics_cannot_hide_weak_pothole_class(tmp_path):
    p = coherent_bundle(tmp_path)
    report = json.loads(p['detector_eval'].read_text(encoding='utf-8'))
    report['perClass']['pothole'].update({'precision': 0.2, 'recall': 0.1, 'f1': 0.133333})
    report['classPolicyPassed'] = False
    report['validationEligible'] = False
    write_json(p['detector_eval'], report)
    refresh_evidence_report_binding(p, 'detector')
    status = model_validation_status('detector', p['detector'], p['metadata'])
    assert status['passed'] is False
    assert 'detector per-class validation policy did not pass' in status['reasons']


def test_aggregate_snn_metrics_cannot_hide_weak_critical_recall(tmp_path):
    p = coherent_bundle(tmp_path)
    report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    report['perClass']['CRITICAL'].update({'recall': 0.2, 'f1': 0.3})
    report['classPolicyPassed'] = False
    report['validationEligible'] = False
    write_json(p['snn_eval'], report)
    refresh_evidence_report_binding(p, 'risk')
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert 'risk per-class validation policy did not pass' in status['reasons']


def test_detector_class_order_mismatch_revokes_validation(tmp_path):
    p = coherent_bundle(tmp_path)
    meta = json.loads(p['metadata'].read_text(encoding='utf-8'))
    meta['detectorClasses'] = list(reversed(meta['detectorClasses']))
    write_json(p['metadata'], meta)
    status = model_validation_status('detector', p['detector'], p['metadata'])
    assert status['passed'] is False
    assert 'detector metadata class order does not match the V29 data gate' in status['reasons']


def test_detector_training_source_mismatch_revokes_validation(tmp_path):
    p = coherent_bundle(tmp_path)
    meta = json.loads(p['metadata'].read_text(encoding='utf-8'))
    meta['trainingSources'] = ['BDD100K']
    write_json(p['metadata'], meta)
    status = model_validation_status('detector', p['detector'], p['metadata'])
    assert status['passed'] is False
    assert 'detector metadata training sources do not match the V29 data gate' in status['reasons']


def test_detector_training_manifest_mismatch_revokes_validation(tmp_path):
    p = coherent_bundle(tmp_path)
    meta = json.loads(p['metadata'].read_text(encoding='utf-8'))
    meta['trainingManifestSha256'] = 'different-training-data'
    write_json(p['metadata'], meta)
    status = model_validation_status('detector', p['detector'], p['metadata'])
    assert status['passed'] is False
    assert 'detector metadata training manifest fingerprint does not match the V29 data gate' in status['reasons']


def test_unknown_model_kind_is_rejected(tmp_path):
    p = coherent_bundle(tmp_path)
    with pytest.raises(ValueError):
        model_validation_status('mystery', p['detector'], p['metadata'])
