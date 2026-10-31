"""Profiles and Google callback boundaries use an isolated database and HTTP server."""
import http.cookiejar, json, tempfile, threading, time, unittest, urllib.request, urllib.error
from pathlib import Path
from unittest.mock import patch
import server

class ProfileAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.old_db,self.old_client=server.DB,server.GOOGLE_CLIENT_ID
        server.DB=Path(self.temp.name)/'test.sqlite';server.GOOGLE_CLIENT_ID='test.apps.googleusercontent.com';server.init()
        self.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True);self.thread.start()
        self.base='http://127.0.0.1:'+str(self.http.server_port)
        self.client=self.new_client()
    def tearDown(self):
        self.http.shutdown();self.http.server_close();self.thread.join()
        server.DB,server.GOOGLE_CLIENT_ID=self.old_db,self.old_client;self.temp.cleanup()
    def new_client(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(self,path,data=None,client=None):
        req=urllib.request.Request(self.base+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','Origin':self.base})
        try:
            with (client or self.client).open(req) as response:return response.status,json.load(response)
        except urllib.error.HTTPError as error:return error.code,json.load(error)
    def google(self,subject='google-subject',client=None):
        self.request('auth-config',client=client)
        with patch.object(server,'verify_google',return_value=subject):return self.request('google',{'credential':'signed-token'},client)
    def test_google_login_returns_to_same_pilot_and_rejects_replay(self):
        self.assertEqual(self.google()[0],200)
        first=self.request('me')[1]['user']
        self.assertEqual(self.request('google',{'credential':'signed-token'})[0],400)
        self.request('logout',{})
        self.assertEqual(self.google()[0],200)
        self.assertEqual(self.request('me')[1]['user'],first)
    def test_link_preserves_existing_pilot_and_blocks_account_collision(self):
        self.request('register',{'handle':'ExistingPilot','password':'test-password-only'})
        original=self.request('me')[1]['user']
        self.assertEqual(self.google()[0],200)
        self.assertEqual(self.request('me')[1]['user'],original)
        second=self.new_client();self.request('register',{'handle':'OtherPilot','password':'test-password-only'},second)
        self.assertEqual(self.google(client=second)[0],400)
        self.assertEqual(self.request('profile')[1]['googleLinked'],True)
    def test_invalid_google_token_creates_no_user(self):
        self.request('auth-config')
        with patch.object(server,'verify_google',side_effect=ValueError('Invalid Google token')):
            self.assertEqual(self.request('google',{'credential':'forged'})[0],400)
        self.assertIsNone(self.request('me')[1]['user'])
        with server.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM users').fetchone()[0],0)
    def test_disabled_google_returns_clear_error(self):
        server.GOOGLE_CLIENT_ID=''
        self.assertEqual(self.request('auth-config')[1]['googleClientId'],'')
        self.assertEqual(self.request('google',{'credential':'anything'})[0],400)
    def test_profile_totals_history_privacy_and_missing_pilot(self):
        self.google();user=self.request('me')[1]['user'];now=time.time()
        with server.connect() as db:
            db.execute('INSERT INTO reports(id,user,shard,kind,location,created) VALUES(?,?,?,?,?,?)',('report',user['id'],'EU-007','Pirates','Hurston',now-7201))
            db.execute('INSERT INTO users VALUES(?,?,?,?,?)',('verifier','Verifier','','',now))
            db.execute('INSERT INTO votes VALUES(?,?,?,?)',('report','verifier',1,now))
        own=self.request('profile')[1]
        self.assertEqual(own['stats'],dict(reports=1,active=0,confirmations=1,disputes=0,verificationsGiven=0))
        self.assertEqual(own['trust']['score'],20)
        self.assertEqual(len(own['history']),1);self.assertFalse(own['history'][0]['active'])
        public=self.request('profile?handle='+user['handle'],client=self.new_client())[1]
        self.assertFalse(public['own']);self.assertEqual(public['history'],[])
        self.assertNotIn('password',public);self.assertNotIn('subject',public)
        self.assertEqual(self.request('profile?handle=MissingPilot')[0],404)
        self.assertEqual(self.request('profile',{'handle':'RenamedPilot'})[0],200)
        self.assertEqual(self.request('profile')[1]['stats']['reports'],1)
        self.assertEqual(self.request('profile',{'handle':'Verifier'})[0],409)
        self.assertEqual(self.request('profile',{'handle':'bad name'})[0],400)
        self.assertEqual(self.request('profile',{'handle':'Takeover'},client=self.new_client())[0],401)
    def test_google_claim_verifier_checks_nonce_and_audience(self):
        import sys,types
        fake_id=types.ModuleType('google.oauth2.id_token')
        fake_id.verify_oauth2_token=lambda token,request,audience: {'sub':'subject','nonce':'expected'} if audience==server.GOOGLE_CLIENT_ID else {}
        google=types.ModuleType('google');oauth=types.ModuleType('google.oauth2');oauth.id_token=fake_id
        transport=types.ModuleType('google.auth.transport.requests');transport.Request=lambda:object()
        with patch.dict(sys.modules,{'google':google,'google.oauth2':oauth,'google.oauth2.id_token':fake_id,'google.auth.transport.requests':transport}):
            self.assertEqual(server.verify_google('token','expected'),'subject')
            with self.assertRaises(ValueError):server.verify_google('token','wrong')
