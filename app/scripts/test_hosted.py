"""Exercise the Vercel handler against an already-initialized disposable Postgres DB.
No cloud credentials are printed and no existing rows are removed.
"""
import http.cookiejar,importlib.util,json,os,secrets,sys,threading,urllib.request,urllib.error
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server

def main():
    if not os.environ.get('KITTIZEN_DATABASE_URL') or os.environ.get('KITTIZEN_TEST_POSTGRES')!=os.environ['KITTIZEN_DATABASE_URL']:
        raise SystemExit('Set KITTIZEN_TEST_POSTGRES and KITTIZEN_DATABASE_URL to the same disposable test database.')
    spec=importlib.util.spec_from_file_location('hosted',ROOT/'deployment/api/index.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    service=server.ThreadingHTTPServer(('127.0.0.1',0),module.handler)
    thread=threading.Thread(target=service.serve_forever,daemon=True);thread.start()
    base='http://127.0.0.1:'+str(service.server_port)
    def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(c,endpoint,data=None,query=''):
        req=urllib.request.Request(base+'/api/index?endpoint='+endpoint+query,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','Origin':base})
        try:
            with c.open(req) as response:return response.status,json.load(response)
        except urllib.error.HTTPError as error:return error.code,json.load(error)
    try:
        a,b=client(),client();suffix=secrets.token_hex(5)
        for c,handle in [(a,'Author_'+suffix),(b,'Verifier_'+suffix)]:
            assert request(c,'register',{'handle':handle,'password':'test-password-only'})[0]==200
        body=next(b for b in server.BODIES.values() if b['name']=='Hurston')
        status,report=request(a,'reports',{'shard':'EU-007','kind':'Pirates','location':body['id']});assert status==201
        assert request(a,'vote',{'report':report['id'],'value':1})[0]==400
        assert request(b,'vote',{'report':report['id'],'value':1})[0]==200
        assert request(b,'vote',{'report':report['id'],'value':-1})[0]==400
        rows=request(b,'reports',query='&shard=EU-007')[1];row=next(r for r in rows if r['id']==report['id']);assert row['confirmations']==1 and row['lastVerified'] and row['trust']['score']==20
        own=request(a,'profile')[1];assert own['own'] and own['stats']['reports']==1 and len(own['history'])==1
        public=request(b,'profile',query='&handle='+own['handle'])[1];assert not public['own'] and not public['history']
        renamed='Renamed_'+suffix;assert request(a,'profile',{'handle':renamed})[0]==200
        assert request(b,'profile',{'handle':renamed.upper()})[0]==409
        assert request(b,'login',{'handle':renamed.upper(),'password':'test-password-only'})[0]==200
        with patch.object(server,'GOOGLE_CLIENT_ID','test.apps.googleusercontent.com'),patch.object(server,'verify_google',return_value='subject-'+suffix):
            request(a,'auth-config');assert request(a,'google',{'credential':'mock-token'})[0]==200
            assert request(a,'google',{'credential':'mock-token'})[0]==400
            assert request(a,'profile')[1]['googleLinked']
            request(a,'logout',{});request(a,'auth-config');assert request(a,'google',{'credential':'mock-token'})[0]==200
            assert request(a,'me')[1]['user']['handle']==renamed
        # Simulate a fresh function instance: reload the entry module; database and cookies persist.
        fresh=importlib.util.module_from_spec(spec);spec.loader.exec_module(fresh)
        service.RequestHandlerClass=fresh.handler
        assert request(a,'profile')[1]['stats']['confirmations']==1
        with server.connect() as db:
            for table in ('users','sessions','reports','votes','identities','auth_challenges','routes'):
                assert db.execute("SELECT relrowsecurity FROM pg_class WHERE oid=?::regclass",('kittizen.'+table,)).fetchone()[0]
        print('Hosted handler Postgres checks passed: two pilots, reports, verification, profiles, handles, linking, nonce replay, fresh-instance persistence and RLS.')
    finally:service.shutdown();service.server_close();thread.join()
if __name__=='__main__':main()
