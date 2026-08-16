from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def text(path):
    return (ROOT/path).read_text(encoding='utf-8')


def require(condition,message):
    if not condition:
        raise AssertionError(message)


def main():
    helper=text(Path('ai-service/app/model_validation.py'))
    detector=text(Path('scripts/evaluate_detector.py'))
    snn=text(Path('scripts/evaluate_snn.py'))
    evidence=text(Path('scripts/validation_evidence.py'))

    for source,name in [(helper,'model_validation.py'),(detector,'evaluate_detector.py'),(snn,'evaluate_snn.py'),(evidence,'validation_evidence.py')]:
        compile(source,name,'exec')

    # Detector per-class metrics remain useful development diagnostics, but they no longer
    # establish runtime scientific eligibility or project-completion status.
    for marker in ['minPerClassPrecision','minPerClassRecall','minPerClassF1']:
        require(marker in helper,f'detector diagnostic policy floor missing: {marker}')
    require('class_policy_status' in detector,'detector class diagnostic evaluator missing')
    require('trained_classes' in detector and 'classPolicyPassed' in detector,'detector trained-class diagnostic binding missing')
    require('minDetectorEvalInstancesPerTrainedClass' in detector,'detector minimum diagnostic class support missing')
    require("'validationEligible':False" in detector,'detector evaluator must not mark scientific eligibility')
    require("'scientificValidationInScope':False" in detector,'detector evaluator scope marker missing')

    # SNN class-aware scientific gate remains unchanged in substance.
    require('minHighRiskRecall' in helper,'SNN V30 high-risk recall floor missing')
    require("evaluation.get('classPolicyPassed') is not True" in helper,'SNN live validation does not enforce classPolicyPassed')
    require("evidence.get('schemaVersion') != 3" in helper,'SNN live validation does not require V30 evidence schema')
    require("['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']" in helper,'SNN live validation does not require every risk class')
    require('class_policy_status' in snn,'SNN class policy evaluator missing')
    require("label in {'HIGH','CRITICAL'}" in snn,'SNN HIGH/CRITICAL recall gate missing')
    require('minHighRiskRecall' in snn and 'minPerClassF1' in snn,'SNN class quality floors missing')
    require('classPolicyPassed' in snn,'SNN class policy result missing from evaluation report')

    # Historical combined evidence utility remains auditable for old runs; the runtime SNN
    # guard consumes SNN-specific evidence and no longer requires detector scientific success.
    require("'schemaVersion':3" in evidence,'V30 evidence schema missing')
    require("'classPolicyPassed','perClass'" in evidence,'historical evidence does not bind class-level metrics')
    require('SNN per-class validation policy did not pass' in evidence,'SNN class policy evidence blocker missing')

    print('V30 CLASS-AWARE CONTRACTS PASS: detector diagnostics + independent SNN scientific gate')


if __name__=='__main__':
    main()
