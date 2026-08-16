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

    for marker in ['minPerClassPrecision','minPerClassRecall','minPerClassF1']:
        require(marker in helper,f'detector V30 policy floor missing: {marker}')
    require('minHighRiskRecall' in helper,'SNN V30 high-risk recall floor missing')
    require("evaluation.get('classPolicyPassed') is not True" in helper,'live validation does not enforce classPolicyPassed')
    require("evidence.get('schemaVersion') != 3" in helper,'live validation does not require V30 evidence schema')
    require("['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']" in helper,'SNN live validation does not require every risk class')

    require('class_policy_status' in detector,'detector class policy evaluator missing')
    require("trained_classes" in detector and "classPolicyPassed" in detector,'detector trained-class validation binding missing')
    require("minDetectorEvalInstancesPerTrainedClass" in detector,'detector minimum per-class support is not enforced')
    require("minPerClassPrecision" in detector and "minPerClassRecall" in detector and "minPerClassF1" in detector,'detector per-class quality floors missing')

    require('class_policy_status' in snn,'SNN class policy evaluator missing')
    require("label in {'HIGH','CRITICAL'}" in snn,'SNN HIGH/CRITICAL recall gate missing')
    require("minHighRiskRecall" in snn and "minPerClassF1" in snn,'SNN class quality floors missing')
    require("classPolicyPassed" in snn,'SNN class policy result missing from evaluation report')

    require("'schemaVersion':3" in evidence,'V30 evidence schema missing')
    require("'classPolicyPassed','perClass'" in evidence,'V30 evidence does not bind class-level metrics')
    require('detector per-class validation policy did not pass' in evidence,'detector class policy evidence blocker missing')
    require('SNN per-class validation policy did not pass' in evidence,'SNN class policy evidence blocker missing')

    print('V30 CLASS-AWARE MODEL VALIDATION CONTRACTS PASS')


if __name__=='__main__':
    main()
