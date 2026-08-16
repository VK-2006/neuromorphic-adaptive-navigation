from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def text(path): return (ROOT/path).read_text(encoding='utf-8')
def require(condition,message):
    if not condition: raise AssertionError(message)

def main():
    helper=text(Path('ai-service/app/model_validation.py'))
    detector=text(Path('ai-service/app/services/detection_service.py'))
    risk=text(Path('ai-service/app/services/risk_service.py'))
    routes=text(Path('ai-service/app/api/routes.py'))
    det_eval=text(Path('scripts/evaluate_detector.py'))
    snn_eval=text(Path('scripts/evaluate_snn.py'))
    evidence=text(Path('scripts/validation_evidence.py'))
    readiness=text(Path('scripts/model_readiness.py'))
    for source,name in [(helper,'model_validation.py'),(detector,'detection_service.py'),(risk,'risk_service.py'),(routes,'routes.py'),(det_eval,'evaluate_detector.py'),(snn_eval,'evaluate_snn.py'),(evidence,'validation_evidence.py'),(readiness,'model_readiness.py')]: compile(source,name,'exec')

    require('SNN_EVAL_MINIMUMS' in helper,'SNN policy floors missing')
    require("evidence.get('schemaVersion') != 3" in helper,'SNN runtime must reject pre-V30 evidence')
    require('trained weight SHA-256 does not match validation evidence' in helper,'SNN weight hash binding missing')
    require('snnEvaluationSha256' in helper and 'metadataSha256' in helper and 'dataGateSha256' in helper,'SNN report/evidence hash binding missing')
    require("model_validation_status('risk'" in risk,'SNN does not use validation guard')
    require("self.validated=bool(validation.get('passed'))" in risk,'SNN validation is not derived from validation guard')

    require("model_validation_status('detector'" in detector,'detector runtime readiness guard missing')
    require('self.runtime_ready=bool(readiness.get(\'passed\'))' in detector,'detector runtime readiness is not derived from artifact checks')
    require('detectorSha256' in helper and 'detectorClasses' in helper,'detector integrity/class readiness checks missing')
    require('runtimeReady' in routes,'model/info must expose detector runtime readiness')
    require('validated\':False' in routes or "'validated':False" in routes,'detector API must not claim scientific validation')

    require('SNN_EVAL_MINIMUMS' in snn_eval and 'validationEligible' in snn_eval,'SNN evaluator validation policy missing')
    require('datasetSha256' in snn_eval and 'evalSha256' in snn_eval,'SNN held-out SHA binding missing')
    require('balancedAccuracy' in snn_eval and 'negativeLogLikelihood' in snn_eval,'SNN diagnostics missing')
    require("'schemaVersion':3" in evidence,'retained SNN validation evidence schema missing')
    require('SNN evaluation report is not bound to the exact held-out CSV' in evidence,'SNN report/dataset evidence binding missing')
    require("model_validation_status('detector'" in readiness and "model_validation_status('risk'" in readiness,'readiness must report detector runtime and SNN scientific states separately')

    require('evaluate_detector.py' in text(Path('docs/model-validation.md')),'detector evaluation utility should remain available for development/debugging')
    require('independent cross-dataset detector scientific validation is outside the current project scope' in text(Path('docs/model-validation.md')).lower(),'detector scope boundary missing')
    print('V28+ MODEL CONTRACTS PASS: detector readiness retained; SNN scientific validation retained')

if __name__=='__main__': main()
