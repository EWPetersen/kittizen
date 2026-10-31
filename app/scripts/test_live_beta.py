"""Explicit beta smoke test. Creates two QA pilots and one expiring report; deletes nothing.
State (test-only passwords/cookies) stays in ignored .host-tests for redeploy verification.
"""
import argparse,http.cookiejar,json,secrets,urllib.request,urllib.error
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--resume',action='store_true');a=p.parse_args()
    base=a.base.rstrip('/');state=Path(__file__).resolve().parents[1]/'.host-tests/live-beta-state.json'
    if not base.startswith('https://'):raise SystemExit('HTTPS beta URL required')
    data=json.loads(state.read_text()) if a.resume else {'base':base,'suffix':secrets.token_hex(4),'password':secrets.token_urlsafe(24)}
    assert data['base']==base
    def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def req(c,path,body=None,expected=200):
        r=urllib.request.Request(base+'/api/'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Origin':base})
        try:
            with c.open(r,timeout=30) as response:code,value=response.status,json.load(response)
        except urllib.error.HTTPError as e:code,value=e.code,json.load(e)
        assert code==expected,(path,code,value)
        return value
    author,guest=client(),client()
    cookies=http.cookiejar.MozillaCookieJar(str(state.with_suffix('.cookies')))
    verifier=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    req(guest,'status');assert req(guest,'me')['user'] is None
    if a.resume:
        req(author,'login',{'handle':'QA_A_'+data['suffix'],'password':data['password']})
        if Path(cookies.filename).exists():
            cookies.load(ignore_discard=True);assert req(verifier,'me')['user']['handle']=='QA_V_'+data['suffix']
        else:req(verifier,'login',{'handle':'QA_V_'+data['suffix'],'password':data['password']})
    else:
        for c,prefix in [(author,'QA_A_'),(verifier,'QA_V_')]:req(c,'register',{'handle':prefix+data['suffix'],'password':data['password']})
        catalog=json.load(urllib.request.urlopen(base+'/catalog.json'));bodies={b['name']:b['id'] for b in catalog['bodies']}
        data['origin'],data['destination']=bodies['New Babbage'],bodies['Lorville']
        report=req(author,'reports',{'shard':'US-999','kind':'Interdiction','location':bodies['Hurston'],'notes':'Automated beta verification; expires after two hours.'},201)
        data['report']=report['id']
        req(author,'vote',{'report':report['id'],'value':1},400)
        req(verifier,'vote',{'report':report['id'],'value':1})
        req(verifier,'vote',{'report':report['id'],'value':-1},400)
        req(author,'routes',{'name':'QA persistence check','origin':data['origin'],'destination':data['destination']},201)
        state.write_text(json.dumps(data))
    rows=req(verifier,'reports?shard=US-999');row=next(r for r in rows if r['id']==data['report']);assert row['confirmations']==1 and row['lastVerified']
    assert not any(r['id']==data['report'] for r in req(guest,'reports?shard=EU-999'))
    profile=req(author,'profile');assert profile['own'] and profile['stats']['confirmations']==1 and profile['history']
    public=req(verifier,'profile?handle=QA_A_'+data['suffix']);assert not public['own'] and not public['history']
    assert req(author,'routes') and not req(verifier,'routes')
    plan=req(guest,'plan',{'origin':data['origin'],'destination':data['destination']});assert plan['legs'] and plan['totalDistance']>0
    req(guest,'reports?shard=bad',expected=400);req(guest,'reports',{},401)
    cookies.save(ignore_discard=True)
    req(author,'logout',{});assert req(author,'me')['user'] is None
    print('PASS: hosted database, two pilots, reports, verification, shard isolation, profile privacy, saved-route ownership, POI route, invalid input and logout'+(' after redeploy' if a.resume else ''))
if __name__=='__main__':main()
