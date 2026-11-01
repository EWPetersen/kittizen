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
    def test_presence_scope_deduplication_and_expiry(self):
        other=self.new_client()
        self.assertEqual(self.request('presence',{'system':'stanton','shard':'US-007'})[1],dict(total=1,count=1))
        self.assertEqual(self.request('presence',{'system':'stanton','shard':'US-007'})[1],dict(total=1,count=1))
        self.assertEqual(self.request('presence',{'system':'pyro','shard':'US-007'},other)[1],dict(total=2,count=1))
        self.assertEqual(self.request('presence',{'system':'universe','shard':''})[1],dict(total=2,count=2))
        with server.connect() as db:db.execute('UPDATE presence SET seen=?',(time.time()-46,))
        self.assertEqual(self.request('presence',{'system':'universe','shard':''})[1],dict(total=1,count=1))
        self.assertEqual(self.request('presence',{'system':'bad','shard':''})[0],400)
        self.assertEqual(self.request('presence',{'system':'stanton','shard':'bad'})[0],400)
    def test_active_shards_aggregate_regions_and_systems_without_identity(self):
        other,third,spectator=self.new_client(),self.new_client(),self.new_client()
        self.request('presence',{'system':'stanton','shard':'US-007'})
        self.request('presence',{'system':'pyro','shard':'US-007'},other)
        self.request('presence',{'system':'nyx','shard':'EU-034'},third)
        data=self.request('presence',{'system':'universe','shard':'','includeShards':True},spectator)[1]
        self.assertEqual(data['activeShardCount'],2);self.assertEqual(data['shards'],[dict(shard='US-007',count=2,system='pyro'),dict(shard='EU-034',count=1,system='nyx')])
        self.assertTrue(all(set(row)=={'shard','count','system'} for row in data['shards']))
        self.request('presence',{'system':'pyro','shard':'US-007'},other)
        self.assertEqual(self.request('presence',{'system':'universe','shard':'','includeShards':True},spectator)[1]['shards'][0]['count'],2)
    def test_active_shards_expire_and_unselected_viewers_do_not_create_a_shard(self):
        self.request('presence',{'system':'stanton','shard':'AUS-009'})
        with server.connect() as db:db.execute('UPDATE presence SET seen=?',(time.time()-46,))
        data=self.request('presence',{'system':'universe','shard':'','includeShards':True})[1]
        self.assertEqual(data['shards'],[]);self.assertEqual(data['activeShardCount'],0);self.assertEqual(data['total'],1)
    def test_active_shard_list_is_bounded_and_unknown_legacy_rows_are_excluded(self):
        with server.connect() as db:
            for i in range(60):db.execute('INSERT INTO presence VALUES(?,?,?,?)',('guest:'+str(i),'US-'+str(i).zfill(3),'universe',time.time()))
            db.execute('INSERT INTO presence VALUES(?,?,?,?)',('bad','private@example.test','unknown',time.time()))
        data=self.request('presence',{'system':'universe','shard':'','includeShards':True})[1]
        self.assertEqual(data['activeShardCount'],60);self.assertEqual(len(data['shards']),50);self.assertEqual(data['shards'][0]['shard'],'US-000');self.assertEqual(data['shards'][-1]['shard'],'US-049')
        self.assertTrue(all(row['system']=='stanton' for row in data['shards']))
    def test_universe_reports_combine_shards_and_systems(self):
        self.google()
        bodies=list(server.BODIES.values())
        for system,shard in [('stanton','US-007'),('pyro','EU-002')]:
            body=next(b for b in bodies if b['system']==system and b['kind']=='planet')
            self.assertEqual(self.request('reports',{'shard':shard,'kind':'Suspicious','location':body['id'],'notes':'QA aggregate test'})[0],201)
        rows=self.request('reports?scope=universe',client=self.new_client())[1]
        self.assertEqual({r['shard'] for r in rows},{'US-007','EU-002'})
        self.assertEqual(len(self.request('reports?shard=US-007')[1]),1)
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

    def test_google_personal_claims_never_reach_storage_or_api(self):
        import sys,types
        markers=['private-person@example.invalid','Private Real Name','https://example.invalid/private-photo','private-signed-token']
        claims=dict(sub='private-google-subject',nonce='',email=markers[0],name=markers[1],picture=markers[2])
        fake_id=types.ModuleType('google.oauth2.id_token')
        fake_id.verify_oauth2_token=lambda *args: claims
        oauth=types.ModuleType('google.oauth2');oauth.id_token=fake_id
        transport=types.ModuleType('google.auth.transport.requests');transport.Request=lambda:object()
        modules={'google':types.ModuleType('google'),'google.oauth2':oauth,'google.oauth2.id_token':fake_id,'google.auth.transport.requests':transport}
        claims['nonce']=self.request('auth-config')[1]['nonce']
        with patch.dict(sys.modules,modules):
            status,login=self.request('google',{'credential':markers[3]})
        self.assertEqual(status,200)
        own=self.request('me')[1]
        self.assertRegex(own['user']['handle'],r'^Pilot_[0-9a-f]{12}$')
        stranger=self.new_client()
        responses=[login,own,self.request('profile')[1],self.request('profile?handle='+own['user']['handle'],client=stranger)[1],self.request('me',client=stranger)[1],self.request('reports?shard=EU-007',client=stranger)[1],self.request('routes',client=stranger)[1]]
        public=json.dumps(responses)
        for marker in markers+['private-google-subject']:
            self.assertNotIn(marker,public)
        with server.connect() as db:
            dump='\n'.join(db.iterdump())
            self.assertEqual(dict(db.execute('SELECT * FROM identities').fetchone()),dict(subject=claims['sub'],user=own['user']['id']))
        for marker in markers:self.assertNotIn(marker,dump)

    def test_google_verification_errors_do_not_echo_private_claims(self):
        import sys,types
        fake_id=types.ModuleType('google.oauth2.id_token')
        fake_id.verify_oauth2_token=lambda *args: (_ for _ in ()).throw(RuntimeError('private@example.invalid secret-token'))
        oauth=types.ModuleType('google.oauth2');oauth.id_token=fake_id
        transport=types.ModuleType('google.auth.transport.requests');transport.Request=lambda:object()
        with patch.dict(sys.modules,{'google':types.ModuleType('google'),'google.oauth2':oauth,'google.oauth2.id_token':fake_id,'google.auth.transport.requests':transport}):
            self.request('auth-config')
            status,result=self.request('google',{'credential':'secret-token'})
        self.assertEqual(status,400)
        self.assertNotIn('private@',json.dumps(result));self.assertNotIn('secret-token',json.dumps(result))
