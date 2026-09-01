from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def text(path):
    return (ROOT/path).read_text(encoding='utf-8')


def require(condition,message):
    if not condition:
        raise AssertionError(message)


def main():
    helper=text(Path('ai-service/app/model_validation.py'))
    risk=text(Path('ai-service/app/services/risk_service.py'))
    routes=text(Path('ai-service/app/api/routes.py'))
    gate=text(Path('scripts/model_data_gate.py'))
    det_eval=text(Path('scripts/evaluate_detector.py'))
    snn_eval=text(Path('scripts/evaluate_snn.py'))
    evidence=text(Path('scripts/validation_evidence.py'))
    readiness=text(Path('scripts/model_readiness.py'))

    for source,name in [
        (helper,'model_validation.py'),(risk,'risk_service.py'),
        (routes,'routes.py'),(gate,'model_data_gate.py'),(det_eval,'evaluate_detector.py'),
        (snn_eval,'evaluate_snn.py'),(evidence,'validation_evidence.py'),(readiness,'model_readiness.py')
    ]:
        compile(source,name,'exec')

    require('DATA_GATE_MINIMUMS' in helper,'V28+ data-gate policy floors missing')
    require('DETECTOR_EVAL_MINIMUMS' in helper,'V28+ detector policy floors missing')
    require('SNN_EVAL_MINIMUMS' in helper,'V28+ SNN policy floors missing')
    require("evidence.get('schemaVersion') != 3" in helper,'runtime must reject pre-V30 validation evidence')
    require('trained weight SHA-256 does not match validation evidence' in helper,'runtime weight hash binding missing')
    require('detectorEvaluationSha256' in helper and 'snnEvaluationSha256' in helper,'runtime report-hash binding missing')
    require('metadataSha256' in helper and 'dataGateSha256' in helper,'runtime metadata/data-gate hash binding missing')

    require("model_validation_status('risk'" in risk,'SNN does not use validation guard')
    require("self.validated=bool(validation.get('passed'))" in risk,'SNN validation is not derived from validation guard')
    require('validationIssues' in routes,'model/info must expose validation blockers')

    require('DATA_GATE_MINIMUMS' in gate and 'policyCompliant' in gate,'data gate must enforce policy floors')
    require('DETECTOR_EVAL_MINIMUMS' in det_eval and 'validationEligible' in det_eval,'detector evaluator validation policy missing')
    require('manifestSha256' in det_eval and 'evalSha256' in det_eval,'detector held-out SHA binding missing')
    require('perClass' in det_eval and 'macroF1' in det_eval,'detector class-wise diagnostics missing')
    require('SNN_EVAL_MINIMUMS' in snn_eval and 'validationEligible' in snn_eval,'SNN evaluator validation policy missing')
    require('datasetSha256' in snn_eval and 'evalSha256' in snn_eval,'SNN held-out SHA binding missing')
    require('balancedAccuracy' in snn_eval and 'negativeLogLikelihood' in snn_eval,'SNN stronger diagnostics missing')

    require("'schemaVersion':3" in evidence,'current validation evidence schema missing')
    require('detector evaluation report is not bound to the exact held-out manifest' in evidence,'detector report/dataset evidence binding missing')
    require('SNN evaluation report is not bound to the exact held-out CSV' in evidence,'SNN report/dataset evidence binding missing')
    require('detectorEvaluationSha256' in evidence and 'metadataSha256' in evidence,'evidence report hashes missing')
    require("model_validation_status('detector'" in readiness and "model_validation_status('risk'" in readiness,'readiness must reuse live validation guard')

    print('V28+ MODEL VALIDATION CONTRACTS PASS')


if __name__=='__main__':
    main()
