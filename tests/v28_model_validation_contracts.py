from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def text(path):
    return (ROOT/path).read_text(encoding='utf-8')


def require(condition,message):
    if not condition:
        raise AssertionError(message)


def main():
    helper=text(Path('ai-service/app/model_validation.py'))
    detector=text(Path('ai-service/app/services/detection_service.py'))
    risk=text(Path('ai-service/app/services/risk_service.py'))
    routes=text(Path('ai-service/app/api/routes.py'))
    gate=text(Path('scripts/model_data_gate.py'))
    det_eval=text(Path('scripts/evaluate_detector.py'))
    snn_eval=text(Path('scripts/evaluate_snn.py'))
    evidence=text(Path('scripts/validation_evidence.py'))
    readiness=text(Path('scripts/model_readiness.py'))

    for source,name in [
        (helper,'model_validation.py'),(detector,'detection_service.py'),(risk,'risk_service.py'),
        (routes,'routes.py'),(gate,'model_data_gate.py'),(det_eval,'evaluate_detector.py'),
        (snn_eval,'evaluate_snn.py'),(evidence,'validation_evidence.py'),(readiness,'model_readiness.py')
    ]:
        compile(source,name,'exec')

    require('DATA_GATE_MINIMUMS' in helper,'data-gate policy floors missing')
    require('DETECTOR_EVAL_MINIMUMS' in helper,'detector development diagnostic floors missing')
    require('SNN_EVAL_MINIMUMS' in helper,'SNN scientific policy floors missing')
    require("evidence.get('schemaVersion') != 3" in helper,'SNN runtime must reject pre-V30 evidence')
    require('trained weight SHA-256 does not match validation evidence' in helper,'SNN runtime weight hash binding missing')
    require('snnEvaluationSha256' in helper,'SNN runtime report-hash binding missing')
    require('metadataSha256' in helper and 'dataGateSha256' in helper,'SNN runtime metadata/data-gate hash binding missing')

    require('detector_integrity_status' in detector,'detector does not use functional artifact integrity guard')
    require("model_validation_status('detector'" not in detector,'detector runtime must not depend on scientific-validation guard')
    require("model_validation_status('risk'" in risk,'SNN does not use validation guard')
    require('self.integrity_ready' in detector and 'self.trained_weights_active' in detector,'detector functional readiness state missing')
    require("self.validated=bool(validation.get('passed'))" in risk,'SNN validation is not derived from validation guard')
    require('scientificValidationRequired' in routes and "'validated':False" in routes,'detector API truthfulness fields missing')
    require('validationIssues' in routes,'model/info must expose SNN validation blockers')

    require('DATA_GATE_MINIMUMS' in gate and 'policyCompliant' in gate,'data gate must retain policy floors')
    require('DETECTOR_EVAL_MINIMUMS' in det_eval and 'diagnosticPassed' in det_eval,'detector internal evaluation diagnostics missing')
    require('manifestSha256' in det_eval and 'evalSha256' in det_eval,'detector development split SHA binding missing')
    require('perClass' in det_eval and 'macroF1' in det_eval,'detector class-wise diagnostics missing')
    require('scientificValidationInScope' in det_eval and "'validationEligible':False" in det_eval,'detector evaluator must not establish scientific validation')
    require('SNN_EVAL_MINIMUMS' in snn_eval and 'validationEligible' in snn_eval,'SNN evaluator validation policy missing')
    require('datasetSha256' in snn_eval and 'evalSha256' in snn_eval,'SNN held-out SHA binding missing')
    require('balancedAccuracy' in snn_eval and 'negativeLogLikelihood' in snn_eval,'SNN stronger diagnostics missing')

    # Historical combined evidence utility remains for reproducibility; SNN runtime now
    # consumes only SNN-specific bindings and does not require detector evidence hashes.
    require("'schemaVersion':3" in evidence,'historical validation evidence schema missing')
    require('SNN evaluation report is not bound to the exact held-out CSV' in evidence,'SNN report/dataset evidence binding missing')
    require("model_validation_status('risk'" in readiness,'readiness must reuse SNN scientific validation guard')
    require('detector_integrity_status' in readiness,'readiness must use detector functional integrity guard')

    print('V28+ MODEL CONTRACTS PASS: detector functional integrity + independent SNN scientific guard')


if __name__=='__main__':
    main()
