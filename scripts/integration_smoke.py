from __future__ import annotations
import argparse, json, urllib.request

def call(method,url,payload=None,timeout=60):
    data=None
    headers={'accept':'application/json','user-agent':'Navora-V11.5-Integration-Smoke/1.0'}
    if payload is not None:
        data=json.dumps(payload).encode()
        headers['content-type']='application/json'
    req=urllib.request.Request(url,data=data,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.status,json.loads(r.read().decode('utf-8',errors='replace'))

def unwrap(obj):
    if isinstance(obj,dict) and isinstance(obj.get('data'),dict):
        return obj['data']
    return obj

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--backend',required=True)
    ap.add_argument('--ai',required=True)
    ap.add_argument('--expected-commit',required=True)
    args=ap.parse_args()
    backend=args.backend.rstrip('/')
    ai=args.ai.rstrip('/')
    failures=[]
    pending=[]

    def PASS(name,detail=''):
        print(f"PASS  {name}"+(f" — {detail}" if detail else ''))
    def FAIL(name,detail):
        failures.append(f'{name}: {detail}')
        print(f'FAIL  {name} — {detail}')
    def PENDING(name,detail):
        pending.append(f'{name}: {detail}')
        print(f'PENDING {name} — {detail}')

    try:
        _,h=call('GET',backend+'/health')
        if h.get('status')=='ok' and h.get('commit')==args.expected_commit:
            PASS('Backend exact commit',h.get('commit','')[:12])
        else:
            FAIL('Backend exact commit',repr(h))
    except Exception as e:
        FAIL('Backend health',str(e))

    try:
        _,h=call('GET',ai+'/health',timeout=90)
        if h.get('status')=='ok' and h.get('commit')==args.expected_commit:
            PASS('AI exact commit',h.get('commit','')[:12])
        else:
            FAIL('AI exact commit',repr(h))
    except Exception as e:
        FAIL('AI health',str(e))

    try:
        _,obj=call('GET',backend+'/api/v1/weather/status')
        d=unwrap(obj)
        if d.get('configured') is True:
            PASS('OpenWeather configuration')
            try:
                _,wx=call('GET',backend+'/api/v1/weather/current?lat=17.3850&lng=78.4867',timeout=45)
                w=unwrap(wx)
                score=w.get('weatherRisk')
                if isinstance(score,(int,float)) and 0<=score<=1 and w.get('provider')=='openweathermap':
                    PASS('OpenWeather live observation',f"risk={score:.3f}, condition={w.get('condition')}")
                else:
                    FAIL('OpenWeather live observation',repr(w))
            except Exception as e:
                PENDING('OpenWeather live observation',str(e))
        else:
            PENDING('OpenWeather configuration','OPENWEATHER_API_KEY/provider not active')
    except Exception as e:
        PENDING('OpenWeather status',str(e))

    try:
        _,obj=call('GET',backend+'/api/v1/roboflow/status')
        d=unwrap(obj)
        if d.get('configured') is True and d.get('workspace') and d.get('workflowId'):
            PASS('Roboflow configuration',f"{d.get('workspace')}/{d.get('workflowId')}")
        else:
            PENDING('Roboflow configuration',repr(d))
    except Exception as e:
        PENDING('Roboflow status',str(e))

    payload={'features':{
        'objectClass':'road debris','confidence':.85,'estimatedDistance':6,
        'relativeSpeed':1,'userSpeed':8,'objectPersistence':.7,
        'trafficDensity':.5,'hazardFrequency':.4,'visibility':.75,
        'weatherRisk':.3,'roadCondition':.8,'verifiedReports':1
    }}
    try:
        _,risk=call('POST',ai+'/api/v1/risk/predict',payload,timeout=90)
        score=risk.get('score')
        canonical=(risk.get('explanation') or {}).get('canonicalObjectClass')
        if isinstance(score,(int,float)) and 0<=score<=1 and canonical=='road blockage':
            PASS('AI custom-class normalization',f"road debris -> {canonical}, score={score:.3f}")
        else:
            FAIL('AI custom-class normalization',repr(risk))
    except Exception as e:
        FAIL('AI custom-class normalization',str(e))

    print('='*72)
    if failures:
        print('NAVORA V11.5 FOCUSED PRODUCTION SMOKE: FAIL')
        for x in failures:
            print(' -',x)
        return 1
    if pending:
        print('NAVORA V11.5 FOCUSED PRODUCTION SMOKE: CODE PASS / EXTERNAL PENDING')
        for x in pending:
            print(' -',x)
        return 2
    print('NAVORA V11.5 FOCUSED PRODUCTION SMOKE: PASS')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
