import json
from pathlib import Path

import pytest

from app.model_validation import DATA_GATE_MINIMUMS, SNN_EVAL_MINIMUMS, model_validation_status, sha256_file


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
    detector = tmp_path / 'detector.pt'
    snn = tmp_path / 'risk_snn.pt'
    metadata = tmp_path / 'metadata.json'
    gate_path = tmp_path / 'data-gate-report.json'
    snn_eval_path = tmp_path / 'snn-evaluation.json'
    evidence_path = tmp_path / 'validation-evidence.json'
    detector.write_bytes(b'detector-functional-weight')
    snn.write_bytes(b'snn-weight-v30')
    detector_classes = ['person', 'car', 'road damage', 'pothole']
    gate = {
        'passed': True,
        'policyCompliant': True,
        'thresholds': dict(DATA_GATE_MINIMUMS),
        'detector': {'trainClasses': detector_classes},
        'snn': {'trainEvalRowOverlap': 0, 'trainSha256': 'snn-train-sha', 'evalSha256': 'snn-eval-sha'},
    }
    snn_eval = {
        'samples': 300, 'accuracy': 0.82, 'macroF1': 0.78, 'balancedAccuracy': 0.8,
        'negativeLogLikelihood': 0.4, 'classPolicyPassed': True, 'perClass': snn_per_class(),
        'passed': True, 'policyCompliant': True, 'dataGateBound': True, 'validationEligible': True,
        'thresholds': dict(SNN_EVAL_MINIMUMS), 'datasetSha256': 'snn-eval-sha',
    }
    meta = {
        'riskValidated': True,
        'validated': True,
        'detectorClasses': detector_classes,
        'detectorSha256': sha256_file(detector),
        'detectorRuntimeReady': True,
        'detectorScientificValidationRequired': False,
    }
    write_json(gate_path, gate); write_json(snn_eval_path, snn_eval); write_json(metadata, meta)
    evidence = {
        'schemaVersion': 3, 'passed': True,
        'weights': {'riskSnnSha256': sha256_file(snn)},
        'datasets': {'snnTrainSha256': 'snn-train-sha', 'snnEvalSha256': 'snn-eval-sha'},
        'reports': {
            'dataGateSha256': sha256_file(gate_path),
            'snnEvaluationSha256': sha256_file(snn_eval_path),
            'metadataSha256': sha256_file(metadata),
        },
        'metrics': {'snn': {k: snn_eval[k] for k in ['samples','accuracy','macroF1','balancedAccuracy','negativeLogLikelihood','classPolicyPassed','perClass','passed','validationEligible']}},
    }
    write_json(evidence_path, evidence)
    return {'detector':detector,'snn':snn,'metadata':metadata,'gate':gate_path,'snn_eval':snn_eval_path,'evidence':evidence_path}


def refresh_snn_evidence(p):
    report=json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    evidence=json.loads(p['evidence'].read_text(encoding='utf-8'))
    evidence['reports']['snnEvaluationSha256']=sha256_file(p['snn_eval'])
    evidence['metrics']['snn']={k:report[k] for k in ['samples','accuracy','macroF1','balancedAccuracy','negativeLogLikelihood','classPolicyPassed','perClass','passed','validationEligible']}
    write_json(p['evidence'],evidence)


def test_functional_detector_runtime_readiness_passes_without_scientific_evidence(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    status=model_validation_status('detector',p['detector'],p['metadata'])
    assert status['passed'] is True
    assert status['runtimeReady'] is True
    assert status['scientificValidationRequired'] is False
    assert status['evidenceBound'] is False


def test_detector_artifact_hash_mismatch_blocks_runtime_readiness(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    p['detector'].write_bytes(b'tampered-detector')
    status=model_validation_status('detector',p['detector'],p['metadata'])
    assert status['passed'] is False
    assert any('SHA-256' in reason for reason in status['reasons'])


def test_detector_missing_classes_blocks_runtime_readiness(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    meta=json.loads(p['metadata'].read_text(encoding='utf-8')); meta['detectorClasses']=[]; write_json(p['metadata'],meta)
    status=model_validation_status('detector',p['detector'],p['metadata'])
    assert status['passed'] is False
    assert any('detectorClasses' in reason for reason in status['reasons'])


def test_coherent_snn_bundle_remains_scientifically_validation_eligible(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    status=model_validation_status('risk',p['snn'],p['metadata'])
    assert status['passed'] is True
    assert status['reasons']==[]


def test_snn_metadata_boolean_alone_cannot_claim_validation(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    meta=json.loads(p['metadata'].read_text(encoding='utf-8')); meta['riskValidated']=False; write_json(p['metadata'],meta)
    status=model_validation_status('risk',p['snn'],p['metadata'])
    assert status['passed'] is False
    assert 'riskValidated is not true' in status['reasons']


def test_snn_old_evidence_schema_is_rejected(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    evidence=json.loads(p['evidence'].read_text(encoding='utf-8')); evidence['schemaVersion']=2; write_json(p['evidence'],evidence)
    status=model_validation_status('risk',p['snn'],p['metadata'])
    assert status['passed'] is False
    assert 'validation evidence is not V30 schema version 3' in status['reasons']


def test_snn_policy_floor_cannot_be_weakened(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    report=json.loads(p['snn_eval'].read_text(encoding='utf-8')); report['thresholds']['minAccuracy']=0.1; write_json(p['snn_eval'],report)
    status=model_validation_status('risk',p['snn'],p['metadata'])
    assert status['passed'] is False
    assert any('threshold minAccuracy is below policy floor' in reason for reason in status['reasons'])


def test_snn_aggregate_metrics_cannot_hide_weak_critical_recall(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    report=json.loads(p['snn_eval'].read_text(encoding='utf-8'))
    report['perClass']['CRITICAL'].update({'recall':0.2,'f1':0.3}); report['classPolicyPassed']=False; report['validationEligible']=False
    write_json(p['snn_eval'],report); refresh_snn_evidence(p)
    status=model_validation_status('risk',p['snn'],p['metadata'])
    assert status['passed'] is False
    assert 'risk per-class validation policy did not pass' in status['reasons']


def test_snn_weight_tamper_revokes_validation(tmp_path):
    p=coherent_snn_bundle(tmp_path); p['snn'].write_bytes(b'tampered-snn')
    status=model_validation_status('risk',p['snn'],p['metadata'])
    assert status['passed'] is False
    assert any('trained weight SHA-256' in reason for reason in status['reasons'])


def test_unknown_model_kind_is_rejected(tmp_path):
    p=coherent_snn_bundle(tmp_path)
    with pytest.raises(ValueError): model_validation_status('mystery',p['detector'],p['metadata'])
