"""Create a minimal Vercel upload folder; never uploads or changes live data."""
import hashlib,importlib.util,json,shutil,tempfile
from pathlib import Path
APP=Path(__file__).resolve().parents[1]
BACKEND=('server.py','routing.py','database.py','workspace.py')
STATIC=('index.html','style.css','app.js','map.js','sphere.js','models.js','stars.js','portals.js','belts.js','interdiction.js','render-budget.js','route.js','heatmap.js','catalog.json','v2.html','v2.css','v2.js','v2-catalog.json','v3.html','v3.css','v3-tools.js','v3-math.js','v3-data.json','ship-builds.js')
TEMPLATES=('api/index.py','vercel.json','requirements.txt','pyproject.toml','.env.example','.python-version','.vercelignore','schema.sql','verify_deploy.py')

def prepare(source,destination):
    destination.mkdir(parents=True,exist_ok=False)
    for name in BACKEND:
        shutil.copy2(source/name,destination/name)
    for name in TEMPLATES:
        target=destination/name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source/'deployment'/name,target)
    public=source/'public'
    catalog=json.loads((public/'catalog.json').read_text(encoding='utf-8'))
    assets={body['texture'] for body in catalog['bodies'] if body.get('texture')}
    assets.update(body['textureDetail'] for body in catalog['bodies'] if body.get('textureDetail'))
    assets.update(body['starAppearance']['texture'] for body in catalog['bodies'] if body.get('starAppearance',{}).get('texture'))
    assets.update(body['model'] for body in catalog['bodies'] if body.get('model'))
    assets.update(body['artwork'] for body in catalog['bodies'] if body.get('artwork'))
    v2=json.loads((public/'v2-catalog.json').read_text())
    base=v2['base'].lstrip('/')
    assets.update(p.relative_to(public).as_posix() for p in (public/base).rglob('*') if p.is_file())
    v3=json.loads((public/'v3-data.json').read_text());assets.add(v3['url'].lstrip('/'))
    assets.update(p.relative_to(public).as_posix() for p in (public/v3['catalogBase'].lstrip('/')).rglob('*') if p.is_file())
    for name in set(STATIC)|assets:
        if Path(name).is_absolute() or '..' in Path(name).parts:
            raise ValueError('Invalid catalogue asset path')
        path=(public/name).resolve()
        if not path.is_relative_to(public.resolve()): raise ValueError('Catalogue asset escapes public directory')
        target=destination/'public'/name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(path,target)
    manifest={p.relative_to(destination).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in destination.rglob('*') if p.is_file()}
    manifest['vercel.json']=hashlib.sha256(json.dumps(json.loads((destination/'vercel.json').read_text()),sort_keys=True,separators=(',',':')).encode()).hexdigest()
    (destination/'deployment-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    return len(manifest)

def main():
    destination=APP/'deploy'
    if destination.exists() and (destination.is_symlink() or not (destination/'deployment-manifest.json').is_file()):
        raise SystemExit('Refusing to replace an unrecognized deploy folder.')
    with tempfile.TemporaryDirectory(prefix='kittizen-deploy-') as temp:
        staging=Path(temp)/'package'
        count=prepare(APP,staging)
        spec=importlib.util.spec_from_file_location('verify_package',staging/'verify_deploy.py')
        verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier);verifier.verify(staging)
        if destination.exists(): shutil.rmtree(destination)
        shutil.move(str(staging),str(destination))
    print('Prepared',count,'files at',destination)
    print('No deployment was made. Deploy this folder as the Vercel project root.')
if __name__=='__main__': main()
