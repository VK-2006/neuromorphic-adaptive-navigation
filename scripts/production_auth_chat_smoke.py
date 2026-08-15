import argparse,json,urllib.request,urllib.error
def get(url):
    req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'Navora-Auth-Chat-Smoke/1.0'})
    with urllib.request.urlopen(req,timeout=45) as r:return json.loads(r.read().decode())
def d(x):return x.get('data') if isinstance(x,dict) and isinstance(x.get('data'),dict) else x
def main():
    p=argparse.ArgumentParser();p.add_argument('--backend',required=True);a=p.parse_args();b=a.backend.rstrip('/');bad=[]
    def check(name,cond,detail=''):
        print(('PASS  ' if cond else 'FAIL  ')+name+((' — '+detail) if detail else ''))
        if not cond:bad.append(name+(': '+detail if detail else ''))
    try:
        e=d(get(b+'/api/v1/auth/email/status'));check('Brevo configured',e.get('configured') is True,str(e));check('Brevo API reachable',e.get('providerReachable') is True,e.get('note',''));check('Brevo sender registered/active',e.get('senderRegistered') is True and e.get('senderActive') is True,e.get('note',''))
    except Exception as x:check('Brevo provider status',False,str(x))
    try:
        c=d(get(b+'/api/v1/chat/status'));check('World Chat REST path',c.get('available') is True and c.get('restFallback') is True,str(c));check('World Chat Socket.IO path',c.get('realtime') is True,str(c))
    except Exception as x:check('World Chat status',False,str(x))
    print('\\nNAVORA AUTH + CHAT PRODUCTION CHECK: '+('FAIL' if bad else 'PASS'))
    return 1 if bad else 0
if __name__=='__main__':raise SystemExit(main())
