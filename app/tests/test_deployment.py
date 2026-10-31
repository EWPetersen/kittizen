import importlib.util,json,os,sqlite3,sys,tempfile,threading,tomllib,unittest,urllib.request,urllib.error
from pathlib import Path
from unittest.mock import patch
import server,database
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from prepare_deploy import prepare

class DeploymentTests(unittest.TestCase):
    def test_hosted_runtime_dependencies_and_catalogue_are_declared(self):
        config=json.loads((ROOT/'deployment/vercel.json').read_text())
        self.assertEqual(config['functions']['api/index.py']['includeFiles'],'public/catalog.json')
        project=tomllib.loads((ROOT/'deployment/pyproject.toml').read_text())
        self.assertIn('psycopg[binary]==3.3.6',project['project']['dependencies'])
    def test_provider_metadata_allowed_but_application_config_protected(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'deploy';prepare(ROOT,target)
            spec=importlib.util.spec_from_file_location('verify_metadata',target/'verify_deploy.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            vendor=target/'.vercel_python_packages';vendor.mkdir();(vendor/'.lock').write_text('generated')
            path=target/'vercel.json';config=json.loads(path.read_text());config['providerMetadata']={'generated':True};path.write_text(json.dumps(config))
            module.verify(target)
            config['outputDirectory']='other';path.write_text(json.dumps(config))
            with self.assertRaisesRegex(ValueError,'changed'):module.verify(target)
    def test_sql_translation_and_rows(self):
        self.assertEqual(database.postgres_sql("SELECT user FROM votes WHERE user=? AND value='user?'") , "SELECT \"user\" FROM votes WHERE \"user\"=%s AND value='user?'")
        row=database.Row(a=3,b='x');self.assertEqual(row[0],3);self.assertEqual(dict(row),{'a':3,'b':'x'})
    def test_package_contains_all_textures_and_no_local_data(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'deploy';prepare(ROOT,target)
            self.assertFalse((target/'storage').exists());self.assertFalse((target/'.env').exists())
            spec=importlib.util.spec_from_file_location('verify_deploy',target/'verify_deploy.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            self.assertGreater(module.verify(target),20)
            (target/'.env').write_text('not-a-real-secret')
            with self.assertRaisesRegex(ValueError,'Unexpected'):module.verify(target)
            (target/'.env').unlink();(target/'public/catalog.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'changed'):module.verify(target)
    def test_hosted_never_falls_back_to_sqlite(self):
        with patch.dict(os.environ,{'VERCEL':'1','KITTIZEN_DATABASE_URL':''}):
            with self.assertRaisesRegex(RuntimeError,'not configured'):
                with server.connect():pass
    def test_response_is_sent_after_commit_and_failed_commit_is_not_success(self):
        events=[]
        class Fake:
            def reply(self,data,status=200,cookie=None):
                if self._defer_json:self._pending_json=(data,status,cookie)
                else:events.append(status)
        @server.committed_response
        def action(self):
            self.reply({'ok':True})
            events.append('committed')
        action(Fake());self.assertEqual(events,['committed',200]);events.clear()
        @server.committed_response
        def failure(self):
            self.reply({'ok':True});raise RuntimeError('sensitive connection details')
        failure(Fake());self.assertEqual(events,[503])
    def test_vercel_routing_query_and_cookies(self):
        spec=importlib.util.spec_from_file_location('vercel_entry',ROOT/'deployment/api/index.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp, patch.object(server,'DB',Path(temp)/'test.sqlite'):
            server.init();http=server.ThreadingHTTPServer(('127.0.0.1',0),module.handler)
            thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
            base='http://127.0.0.1:'+str(http.server_port)
            try:
                with urllib.request.urlopen(base+'/api/index?endpoint=reports&shard=EU-007') as response:
                    self.assertEqual(json.load(response),[])
                    self.assertEqual(response.headers['Cache-Control'],'no-store')
                req=urllib.request.Request(base+'/api/index?endpoint=register',data=json.dumps({'handle':'HostedPilot','password':'test-password-only'}).encode(),headers={'Content-Type':'application/json','Origin':base})
                with urllib.request.urlopen(req) as response:
                    cookie=response.headers['Set-Cookie'];self.assertIn('HttpOnly',cookie)
                with urllib.request.urlopen(urllib.request.Request(base+'/api/index?endpoint=profile',headers={'Cookie':cookie})) as response:self.assertTrue(json.load(response)['own'])
                with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(base+'/api/index?endpoint=../../server.py')
                self.assertEqual(error.exception.code,404)
            finally:http.shutdown();http.server_close();thread.join()
