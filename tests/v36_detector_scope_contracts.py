from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]


def need(condition,message):
    if not condition: raise AssertionError(message)


def read(rel): return (ROOT/rel).read_text(encoding='utf-8',errors='ignore')


def main():
    detect=read('ai-service/app/services/detection_service.py')
    routes=read('ai-service/app/api/routes.py')
    metadata=read('ai-service/trained_models/metadata.example.json')
    readme=read('README.md')
    datasets=read('datasets/README.md')
    risk=read('ai-service/app/services/risk_service.py')
    lock=read('ai-service/app/research_lock.py')

    for cls in ['person','bicycle','motorcycle','car','bus','truck']:
        need(f"'{cls}'" in detect,f'detector class missing: {cls}')
    for token in ['_torchscript','_fallback_detect','float(score)<.3','self.runtime_ready']:
        need(token in detect,f'detector runtime behavior missing: {token}')
    need("@router.post('/api/v1/detect'" in routes,'detector API missing')
    hazard=read('backend/src/controllers/hazardMetadataController.js')
    need('objectClass' in hazard and 'confidence' in hazard and 'predictRisk' in hazard,'camera detector-to-risk pipeline missing')
    need('detectorRuntimeReady' in metadata and 'detectorSha256' in metadata,'detector readiness/integrity metadata missing')
    need('BDD100K' in readme and 'BDD100K' in datasets,'BDD100K scope missing')
    removed_dataset='city'+'scapes'
    need(removed_dataset not in readme.lower() and removed_dataset not in datasets.lower(),'removed external detector dataset reference remains')

    need("model_validation_status('risk'" in risk,'SNN validation runtime removed')
    need('RESEARCH_ONLY_RISK_MODELS' in lock,'SNN research-only lock removed')
    need((ROOT/'docs/snn-phase4-2025-external-validation.md').exists(),'consumed SNN 2025 evidence doc missing')

    approved='independent cross-dataset detector scientific validation is outside the current project scope'
    forbidden=['detector scientific validation','independent detector validation','external detector validation','cross-dataset detector validation']
    exts={'.md','.txt','.py','.js','.json','.yml','.yaml','.bat','.ps1','.html'}
    problems=[]
    skip={Path(__file__).resolve(),(ROOT/'scripts/master_prompt_crosscheck.py').resolve()}
    for path in ROOT.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in exts or '.git' in path.parts or path.resolve() in skip: continue
        low=path.read_text(encoding='utf-8',errors='ignore').lower()
        if removed_dataset in low:
            problems.append(f'{path.relative_to(ROOT)}: removed external detector dataset reference')
        for phrase in forbidden:
            if phrase in low and approved not in low and 'not a current completion gate' not in low and 'not a current project requirement' not in low:
                problems.append(f'{path.relative_to(ROOT)}: detector validation requirement wording')
    need(not problems,'removed detector scope remains: '+ '; '.join(problems[:20]))

    result=subprocess.run(['git','diff','--check','origin/main...HEAD'],cwd=ROOT,text=True,capture_output=True)
    need(result.returncode==0,'git diff --check failed: '+result.stdout+result.stderr)
    print('V36 DETECTOR SCOPE CONTRACTS PASS')


if __name__=='__main__': main()
