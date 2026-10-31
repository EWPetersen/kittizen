"""Fail the build if files are missing, stale or outside the deployment allowlist."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def verify(root=ROOT):
    manifest=json.loads((root/'deployment-manifest.json').read_text(encoding='utf-8'))
    allowed=set(manifest)|{'deployment-manifest.json'}
    for path in root.rglob('*'):
        if not path.is_file(): continue
        name=path.relative_to(root).as_posix()
        if name.startswith(('.vercel/','.git/','.venv/','.vercel_python_packages/','__pycache__/','api/__pycache__/')): continue
        if name not in allowed: raise ValueError('Unexpected deployment file: '+name)
    for name,digest in manifest.items():
        path=root/name
        if not path.is_file(): raise ValueError('Missing deployment file: '+name)
        raw=path.read_bytes()
        if name=='vercel.json':
            config=json.loads(raw)
            raw=json.dumps({k:config[k] for k in ('$schema','framework','buildCommand','outputDirectory','functions','rewrites','headers') if k in config},sort_keys=True,separators=(',',':')).encode()
        if hashlib.sha256(raw).hexdigest()!=digest:
            raise ValueError('Missing or changed deployment file: '+name)
    catalog=json.loads((root/'public/catalog.json').read_text(encoding='utf-8'))
    for body in catalog['bodies']:
        if body.get('texture') and not (root/'public'/body['texture']).is_file():
            raise ValueError('Missing map texture')
        if body.get('model') and not (root/'public'/body['model']).is_file():
            raise ValueError('Missing map model')
    if (root/'public/v2-catalog.json').exists():
        pointer=json.loads((root/'public/v2-catalog.json').read_text())
        base=(root/'public'/pointer['base'].lstrip('/')).resolve()
        if not base.is_relative_to((root/'public/game-assets/v2').resolve()):raise ValueError('Invalid V2 asset base')
        index=json.loads((base/'index.json').read_text())
        for item in index['items']:
            if not (base/('detail-'+item['id'][:2]+'.json')).is_file():raise ValueError('Missing V2 detail bundle')
            if item.get('image') and not (base/item['image']).is_file():raise ValueError('Missing V2 image')
    return len(manifest)
if __name__=='__main__': print('Verified',verify(),'deployment files; no local database or secrets included.')
