"""Extract only location artwork explicitly referenced by game navigation records."""
import hashlib,re,subprocess

def extract_location_art(archive,catalog,metadata,root):
    from star_materials import STARBREAKER_SHA
    from PIL import Image
    sources={}
    for body in catalog['bodies']:
        path=metadata.get(body.get('navigationRecord'),{}).get('locationImagePath','').lower().replace('\\','/')
        if not path:continue
        if not path.startswith('ui/frontend/assets/tif/locations/') or '..' in path:continue
        source=path.rsplit('.',1)[0]+'.dds';sources.setdefault(source,[]).append(body)
    if not sources:return []
    tool=root/'.devtools/starbreaker-v0.3.2/starbreaker.exe'
    if hashlib.sha256(tool.read_bytes()).hexdigest()!=STARBREAKER_SHA:raise ValueError('Invalid artwork extractor')
    output=root/'storage/location-art'
    pattern='(?i)(?:'+'|'.join(re.escape(s).replace('/',r'[\\/]') for s in sorted(sources))+')$'
    subprocess.run([str(tool),'p4k','extract','--p4k',str(archive.path),'-o',str(output),'--regex',pattern,'--convert','all','--max-threads','2'],check=True,capture_output=True,timeout=90)
    images={p.relative_to(output).as_posix().lower():p for p in output.rglob('*.png')};paths=[]
    for source,bodies in sources.items():
        image=images.get('data/'+source[:-4]+'.png')
        if not image:continue
        digest=hashlib.sha256(image.read_bytes()).hexdigest()[:16];relative='game-assets/locations/'+digest+'.webp'
        target=root/'public'/relative;target.parent.mkdir(parents=True,exist_ok=True)
        with Image.open(image) as im:im.thumbnail((720,405));im.save(target,'WEBP',quality=90)
        paths.append(relative)
        for body in bodies:body.update(artwork=relative,artworkSource=source)
    return paths
