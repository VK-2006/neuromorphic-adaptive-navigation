import json
from pathlib import Path

import pytest

from app.model_validation import (
    DATA_GATE_MINIMUMS,
    SNN_EVAL_MINIMUMS,
    detector_integrity_status,
    model_validation_status,
    sha256_file,
)


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2), encoding='utf-8')


def snn_per_class():
    return {
        'LOW': {'tp': 65, 'fp': 8, 'fn': 10, 'support': 75, 'precision': 0.890411, 'recall': 0.866667, 'f1': 0.878378},
        'MEDIUM': {'tp': 60, 'fp': 10, 'fn': 15, 'support': 75, 'precision': 0.857143, 'recall': 0.8, 'f1': 0.827586},
        'HIGH': {'tp': 58, 'fp': 12, 'fn': 17, 'support': 75, 'precision': 0.828571, 'recall': 0.773333, 'f1': 0.8},
        'CRITICAL': {'tp': 55, 'fp': 10, 'fn': 20, 'support': 75, 'precision': 0.846154, 'recall': 0.733333, 'f1': 0.785714},
    }


def coherent_snn_bundle(tmp_path: Path):
    snn = tmp_path / 'risk_snn.pt'
    detector = tmp_path / 'detector.pt'
    metadata = tmp_path / 'metadata.json'
    gate_path = tmp_path / 'data-gate-report.json'
    detector_eval_path = tmp_path / 'detector-evaluation.json'
    snn_eval_path = tmp_path / 'snn-evaluation.json'
    evidence_path = tmp_path / 'validation-evidence.json'

    snn.write_bytes(b'snn-weight-v36')
    detector.write_bytes(b'detector-weight-v36')

    gate = {
        'passed': True,
        'policyCompliant': True,
        'thresholds': dict(DATA_GATE_MINIMUMS),
        'detector': {
            'trainEvalImageOverlap': 0,
            'trainSha256': 'det-train-sha',
            'evalSha256': 'det-eval-sha',
            'trainClasses': ['person', 'car'],
        },
        'snn': {
            'trainEvalRowOverlap': 0,
            'trainSha256': 'snn-train-sha',
            'evalSha256': 'snn-eval-sha',
        },
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
    detector_eval = {
        'passed': False,
        'diagnosticPassed': False,
        'validationEligible': False,
        'scientificValidationInScope': False,
        'note': 'optional detector development diagnostics only',
    }
    meta = {
        'detectorValidated': False,
        'detectorScientificValidationInScope': False,
        'detectorClasses': ['person', 'car'],
        'detectorArtifactSha256': sha256_file(detector),
        'riskValidated': True,
        # Overall legacy field deliberately proves detector science is not coupled.
        'validated': False,
    }

    write_json(gate_path, gate)
    write_json(detector_eval_path, detector_eval)
    write_json(snn_eval_path, snn_eval)
    write_json(metadata, meta)

    evidence = {
        'schemaVersion': 3,
        'passed': False,
        'weights': {
            'detectorSha256': 'legacy-non-gating-value',
            'riskSnnSha256': sha256_file(snn),
        },
        'datasets': {
            'detectorTrainSha256': 'legacy-non-gating-value',
            'detectorEvalSha256': 'legacy-non-gating-value',
            'snnTrainSha256': 'snn-train-sha',
            'snnEvalSha256': 'snn-eval-sha',
        },
        'reports': {
            'dataGateSha256': sha256_file(gate_path),
            'detectorEvaluationSha256': 'legacy-non-gating-value',
            'snnEvaluationSha256': sha256_file(snn_eval_path),
            'metadataSha256': sha256_file(metadata),
        },
        'metrics': {
            'detector': {'passed': False, 'validationEligible': False},
            'snn': {
                k: snn_eval[k]
                for k in [
                    'samples', 'accuracy', 'macroF1', 'balancedAccuracy',
                    'negativeLogLikelihood', 'classPolicyPassed', 'perClass',
                    'passed', 'validationEligible'
                ]
            },
        },
    }
    write_json(evidence_path, evidence)
    return {
        'snn': snn,
        'detector': detector,
        'metadata': metadata,
        'gate': gate_path,
        'detector_eval': detector_eval_path,
        'snn_eval': snn_eval_path,
        'evidence': evidence_path,
    }


def refresh_snn_evidence(p):
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    evidence['reports']['snnEvaluationSha256'] = sha256_file(p['snn_eval'])
    evidence['metrics']['snn'] = {
        k: report[k]
        for k in [
            'samples', 'accuracy', 'macroF1', 'balancedAccuracy',
            'negativeLogLikelihood', 'classPolicyPassed', 'perClass',
            'passed', 'validationEligible'
        ]
    }
    write_json(p['evidence'], evidence)


def test_detector_integrity_is_functional_not_scientific(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    status = detector_integrity_status(p['detector'], p['metadata'])
    assert status['passed'] is True
    assert status['functionalReady'] is True
    assert status['hashBound'] is True
    assert status['scientificValidationRequired'] is False
    assert status['scientificallyValidated'] is False


def test_detector_hash_tamper_fails_normal_integrity(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    p['detector'].write_bytes(b'tampered-detector')
    status = model_validation_status('detector', p['detector'], p['metadata'])
    assert status['passed'] is False
    assert any('detector weight SHA-256' in reason for reason in status['reasons'])


def test_snn_validation_can_pass_while_detector_science_is_false(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is True
    assert status['reasons'] == []


def test_detector_diagnostic_tamper_does_not_revoke_snn_validation(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    write_json(p['detector_eval'], {'tampered': True, 'passed': False})
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is True


def test_snn_weight_tamper_still_revokes_snn_validation(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    p['snn'].write_bytes(b'tampered-snn')
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert any('weight SHA-256' in reason for reason in status['reasons'])


def test_overall_legacy_validated_false_does_not_block_valid_snn(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    meta = json.loads(p['metadata'].read_text(encoding='utf-8'))
    assert meta['validated'] is False
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is True


def test_risk_validated_flag_is_still_required(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    meta = json.loads(p['metadata'].read_text(encoding='utf-8'))
    meta['riskValidated'] = False
    write_json(p['metadata'], meta)
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    evidence['reports']['metadataSha256'] = sha256_file(p['metadata'])
    write_json(p['evidence'], evidence)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert 'riskValidated is not true' in status['reasons']


def test_snn_report_tamper_revokes_snn_validation(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    report['accuracy'] = 0.99
    write_json(p['snn_eval'], report)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert any('SNN evaluation report SHA-256' in reason for reason in status['reasons'])


def test_old_evidence_schema_is_rejected(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    evidence = json.loads(p['evidence'].read_text(encoding='utf-8'))
    evidence['schemaVersion'] = 2
    write_json(p['evidence'], evidence)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert 'validation evidence is not V30 schema version 3' in status['reasons']


def test_snn_policy_floor_cannot_be_weakened(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    report['thresholds']['minAccuracy'] = 0.1
    write_json(p['snn_eval'], report)
    refresh_snn_evidence(p)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert any('threshold minAccuracy is below policy floor' in reason for reason in status['reasons'])


def test_snn_class_policy_remains_required(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    report['perClass']['CRITICAL'].update({'recall': 0.2, 'f1': 0.3})
    report['classPolicyPassed'] = False
    report['validationEligible'] = False
    write_json(p['snn_eval'], report)
    refresh_snn_evidence(p)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert 'risk per-class validation policy did not pass' in status['reasons']


def test_unknown_model_kind_is_rejected(tmp_path):
    p = coherent_snn_bundle(tmp_path)
    with pytest.raises(ValueError):
        model_validation_status('mystery', p['detector'], p['metadata'])
