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
    need('objectClass' in read('backend/src/controllers/hazardMetadataController.js'),'camera objectClass pipeline missing')
    need('confidence' in read('backend/src/controllers/hazardMetadataController.js'),'camera confidence pipeline missing')
    need('detectorRuntimeReady' in metadata and 'detectorSha256' in metadata,'detector readiness/integrity metadata missing')
    need('BDD100K' in readme and 'BDD100K' in datasets,'BDD100K scope missing')
    need('Cityscapes' not in readme and 'Cityscapes' not in datasets,'Cityscapes current detector scope remains')

    # SNN scientific-validation and immutable research lock must remain intact.
    need("model_validation_status('risk'" in risk,'SNN validation runtime removed')
    need('RESEARCH_ONLY_RISK_MODELS' in lock,'SNN research-only lock removed')
    need((ROOT/'docs/snn-phase4-2025-external-validation.md').exists(),'consumed SNN 2025 evidence doc missing')

    approved='independent cross-dataset detector scientific validation is outside the current project scope'
    forbidden=['Detector Scientific Validation','independent detector validation','external detector validation','cross-dataset detector validation','Cityscapes']
    exts={'.md','.txt','.py','.js','.json','.yml','.yaml','.bat','.ps1','.html'}
    problems=[]
    for path in ROOT.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in exts or '.git' in path.parts: continue
        txt=path.read_text(encoding='utf-8',errors='ignore')
        low=txt.lower()
        if 'cityscapes' in low:
            problems.append(f'{path.relative_to(ROOT)}: Cityscapes')
        for phrase in forbidden[:-1]:
            if phrase.lower() in low and approved not in low:
                problems.append(f'{path.relative_to(ROOT)}: {phrase}')
    need(not problems,'removed detector scientific-validation scope remains: '+ '; '.join(problems[:20]))

    result=subprocess.run(['git','diff','--check','origin/main...HEAD'],cwd=ROOT,text=True,capture_output=True)
    need(result.returncode==0,'git diff --check failed: '+result.stdout+result.stderr)
    print('V36 DETECTOR SCOPE CONTRACTS PASS')


if __name__=='__main__': main()
