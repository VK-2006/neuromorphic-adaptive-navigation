"""Evaluate risk_snn.pt on a held-out normalized CSV.

Diagnostic evaluation may use stricter custom thresholds, but safety validation cannot weaken
Navora's policy floors. V30 also requires every risk class to meet a minimum F1 and requires
HIGH/CRITICAL recall to meet a stronger floor so aggregate accuracy cannot hide dangerous
high-risk misses. `--mark-validation` additionally requires a passing data gate whose held-out
SNN CSV SHA-256 matches the exact file evaluated here.
"""
from __future__ import annotations
from pathlib import Path
import argparse,csv,json,sys
import torch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'ai-service'))
from app.models.snn import RiskSNN
from app.model_validation import DATA_GATE_MINIMUMS,SNN_EVAL_MINIMUMS,sha256_file
FEATURES=['objectPrior','confidence','proximity','relativeSpeed','userSpeed','objectPersistence','trafficDensity','hazardFrequency','lowVisibility','weatherRisk','roadOrReports']
LABELS=['LOW','MEDIUM','HIGH','CRITICAL'];L2I={x:i for i,x in enumerate(LABELS)}

def load_csv(path):
    xs,ys=[],[]
    with open(path,newline='',encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r.get('riskLabel') not in L2I:continue
            xs.append([float(r[k]) for k in FEATURES]);ys.append(L2I[r['riskLabel']])
    if not xs:raise SystemExit('No evaluation rows found')
    return torch.tensor(xs,dtype=torch.float32),torch.tensor(ys)

def class_metrics(y,p):
    matrix=[[0]*4 for _ in range(4)]
    for a,b in zip(y,p):matrix[a][b]+=1
    per={};f1s=[];recalls=[]
    for c,label in enumerate(LABELS):
        tp=matrix[c][c];fp=sum(matrix[r][c] for r in range(4) if r!=c);fn=sum(matrix[c][r] for r in range(4) if r!=c)
        precision=tp/(tp+fp) if tp+fp else 0;recall=tp/(tp+fn) if tp+fn else 0
        f1=2*precision*recall/(precision+recall) if precision+recall else 0
        per[label]={'tp':tp,'fp':fp,'fn':fn,'precision':round(precision,6),'recall':round(recall,6),'f1':round(f1,6),'support':sum(matrix[c])}
        f1s.append(f1);recalls.append(recall)
    return sum(f1s)/4,sum(recalls)/4,matrix,per

def thresholds_meet(actual,minimums):
    return all(isinstance(actual.get(k),(int,float)) and not isinstance(actual.get(k),bool) and actual[k]>=v for k,v in minimums.items())

def gated_csv_status(path):
    gate_path=ROOT/'ai-service/trained_models/data-gate-report.json';problems=[]
    try:gate=json.loads(gate_path.read_text(encoding='utf-8'))
    except Exception as e:return False,[f'missing/invalid data-gate report: {type(e).__name__}']
    if gate.get('passed') is not True:problems.append('data gate did not pass')
    if gate.get('snn',{}).get('trainEvalRowOverlap')!=0:problems.append('SNN train/eval overlap is not zero')
    if not thresholds_meet(gate.get('thresholds',{}),DATA_GATE_MINIMUMS):problems.append('data-gate thresholds are below validation policy floors')
    current=sha256_file(path);expected=gate.get('snn',{}).get('evalSha256')
    if not expected or current!=expected:problems.append('held-out SNN CSV SHA-256 does not match the data gate')
    return not problems,problems

def class_policy_status(per,configured):
    problems=[]
    min_support=DATA_GATE_MINIMUMS['minSnnEvalSamplesPerClass']
    for label in LABELS:
        metrics=per.get(label)
        if not isinstance(metrics,dict):
            problems.append(f'{label}: no held-out metrics')
            continue
        support=int(metrics.get('support',0) or 0)
        if support<min_support:problems.append(f'{label}: support {support} < {min_support}')
        if float(metrics.get('f1',0))<configured['minPerClassF1']:problems.append(f"{label}: f1 {metrics.get('f1',0)} < {configured['minPerClassF1']}")
        if label in {'HIGH','CRITICAL'} and float(metrics.get('recall',0))<configured['minHighRiskRecall']:
            problems.append(f"{label}: recall {metrics.get('recall',0)} < {configured['minHighRiskRecall']}")
    return not problems,problems

def update_metadata(metadata_path,passed,report_path):
    metadata_path.parent.mkdir(parents=True,exist_ok=True)
    try:m=json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    except Exception:m={}
    m['riskValidated']=bool(passed)
    m['validated']=bool(m.get('riskValidated',False) and m.get('detectorValidated',False))
    m.setdefault('validation',{})['riskReport']=report_path.name
    metadata_path.write_text(json.dumps(m,indent=2),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--csv',type=Path,required=True,help='Held-out normalized evaluation CSV')
    ap.add_argument('--weights',type=Path,default=ROOT/'ai-service/trained_models/risk_snn.pt')
    ap.add_argument('--metadata',type=Path,default=ROOT/'ai-service/trained_models/metadata.json')
    ap.add_argument('--min-samples',type=int,default=SNN_EVAL_MINIMUMS['minSamples']);ap.add_argument('--min-accuracy',type=float,default=SNN_EVAL_MINIMUMS['minAccuracy']);ap.add_argument('--min-macro-f1',type=float,default=SNN_EVAL_MINIMUMS['minMacroF1']);ap.add_argument('--min-per-class-f1',type=float,default=SNN_EVAL_MINIMUMS['minPerClassF1']);ap.add_argument('--min-high-risk-recall',type=float,default=SNN_EVAL_MINIMUMS['minHighRiskRecall'])
    ap.add_argument('--seed',type=int,default=2026);ap.add_argument('--mark-validation',action='store_true',help='Write riskValidated only when metric + data-gate + class policy is satisfied')
    a=ap.parse_args();configured={'minSamples':a.min_samples,'minAccuracy':a.min_accuracy,'minMacroF1':a.min_macro_f1,'minPerClassF1':a.min_per_class_f1,'minHighRiskRecall':a.min_high_risk_recall}
    policy_problems=[f'configured threshold {k}={configured[k]} is below policy floor {v}' for k,v in SNN_EVAL_MINIMUMS.items() if configured[k]<v]
    x,y=load_csv(a.csv)
    if not a.weights.exists():raise SystemExit(f'Missing weights: {a.weights}')
    model=RiskSNN(input_size=len(FEATURES));model.load_state_dict(torch.load(a.weights,map_location='cpu',weights_only=True));model.eval();torch.manual_seed(a.seed)
    with torch.no_grad():
        seq=torch.stack([(torch.rand_like(x)<x.clamp(0,1)).float() for _ in range(30)]);spikes,mem=model(seq);rates=spikes.float().mean(0);logits=rates+torch.softmax(mem[-1],dim=1);prob=torch.softmax(logits,dim=1);pred=torch.argmax(logits,dim=1)
    yy=y.tolist();pp=pred.tolist();accuracy=sum(int(a==b) for a,b in zip(yy,pp))/len(yy);mf1,balanced_accuracy,matrix,per=class_metrics(yy,pp)
    true_prob=prob[torch.arange(len(y)),y];nll=float((-torch.log(true_prob.clamp_min(1e-9))).mean())
    enough=len(yy)>=a.min_samples;metric_pass=enough and accuracy>=a.min_accuracy and mf1>=a.min_macro_f1
    policy_compliant=not policy_problems;passed=metric_pass and policy_compliant
    gate_ok,gate_problems=gated_csv_status(a.csv)
    class_policy_pass,class_problems=class_policy_status(per,configured)
    validation_eligible=passed and gate_ok and class_policy_pass
    report={'samples':len(yy),'accuracy':round(accuracy,6),'macroF1':round(mf1,6),'balancedAccuracy':round(balanced_accuracy,6),'negativeLogLikelihood':round(nll,6),'thresholds':configured,'policyFloors':SNN_EVAL_MINIMUMS,'policyCompliant':policy_compliant,'metricPassed':metric_pass,'classPolicyPassed':class_policy_pass,'dataGateBound':gate_ok,'validationEligible':validation_eligible,'passed':passed,'confusionMatrix':matrix,'perClass':per,'labels':LABELS,'dataset':str(a.csv),'datasetSha256':sha256_file(a.csv),'seed':a.seed,'problems':policy_problems+gate_problems+class_problems}
    out=ROOT/'ai-service/trained_models/snn-evaluation.json';out.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
    if a.mark_validation:
        update_metadata(a.metadata,validation_eligible,out);print('metadata riskValidated =',validation_eligible)
        if not gate_ok:print('VALIDATION BLOCKED: SNN evaluation is not bound to the passing data gate.')
        if not class_policy_pass:print('VALIDATION BLOCKED: one or more risk classes are below V30 per-class policy floors.')
    if not enough:print('VALIDATION BLOCKED: evaluation set is too small to be treated as held-out real validation.')
    if policy_problems:print('VALIDATION BLOCKED: configured SNN thresholds are weaker than policy floors.')
    sys.exit(0 if (passed and (not a.mark_validation or validation_eligible)) else 2)
if __name__=='__main__':main()
