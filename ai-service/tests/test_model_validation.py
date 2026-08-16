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


def coherent_bundle(tmp_path: Path):
    detector = tmp_path / 'detector.pt'
    snn = tmp_path / 'risk_snn.pt'
    metadata = tmp_path / 'metadata.json'
    gate_path = tmp_path / 'data-gate-report.json'
    detector_eval_path = tmp_path / 'detector-evaluation.json'
    snn_eval_path = tmp_path / 'snn-evaluation.json'
    evidence_path = tmp_path / 'validation-evidence.json'

    detector.write_bytes(b'detector-weight-v29')
    snn.write_bytes(b'snn-weight-v29')
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
    }

    write_json(gate_path, gate)
    write_json(detector_eval_path, detector_eval)
    write_json(snn_eval_path, snn_eval)
    write_json(metadata, meta)

    evidence = {
        'schemaVersion': 2,
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
                for k in ['images', 'precision', 'recall', 'f1', 'macroF1', 'passed', 'validationEligible']
            },
            'snn': {
                k: snn_eval[k]
                for k in ['samples', 'accuracy', 'macroF1', 'balancedAccuracy', 'negativeLogLikelihood', 'passed', 'validationEligible']
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


def test_coherent_v29_bundle_is_live_validation_eligible(tmp_path):
    p = coherent_bundle(tmp_path)
    detector = model_validation_status('detector', p['detector'], p['metadata'])
    risk = model_validation_status('risk', p['snn'], p['metadata'])
    assert detector['passed'] is True
    assert risk['passed'] is True
    assert detector['reasons'] == []
    assert risk['reasons'] == []


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
    evidence['schemaVersion'] = 1
    write_json(p['evidence'], evidence)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert 'validation evidence is not V28 schema version 2' in status['reasons']


def test_policy_floor_cannot_be_weakened_after_evidence(tmp_path):
    p = coherent_bundle(tmp_path)
    report = json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    report['thresholds']['minAccuracy'] = 0.1
    write_json(p['snn_eval'], report)
    status = model_validation_status('risk', p['snn'], p['metadata'])
    assert status['passed'] is False
    assert any('threshold minAccuracy is below policy floor' in reason for reason in status['reasons'])


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


def test_unknown_model_kind_is_rejected(tmp_path):
    p = coherent_bundle(tmp_path)
    with pytest.raises(ValueError):
        model_validation_status('mystery', p['detector'], p['metadata'])
