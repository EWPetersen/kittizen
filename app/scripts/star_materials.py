"""Read the navigation record's real star material; no invented sun textures."""
import hashlib,math,re,subprocess
import xml.etree.ElementTree as ET

STARBREAKER_SHA='82439e45cd5337f058f06ded63ee633bea8de8e4d75525f5a083aa7955b91a10'

def appearance(meta,xml):
    material=ET.fromstring(xml)
    color=[float(x) for x in material.attrib['Diffuse'].split(',')]
    size=float(meta['size']);glow=float(material.get('Glow','0'))
    if len(color)!=3 or not all(math.isfinite(x) and 0<=x<=1 for x in color) or not math.isfinite(size) or size<=0 or not math.isfinite(glow):
        raise ValueError('Invalid game star material')
    return dict(color=color,glow=max(0,min(1,glow)),displaySize=size,shader=material.get('Shader'),source=meta['starMapMaterialPath'])

def extract_stars(archive,catalog,metadata,root):
    stars=[(body,metadata.get(body.get('navigationRecord'),{})) for body in catalog['bodies'] if body['kind']=='star']
    sources={meta['starMapMaterialPath'].lower().replace('\\','/') for _,meta in stars}
    if any(not s.startswith('materials/stellar_classes/') or not s.endswith('.mtl') or '..' in s for s in sources):
        raise ValueError('Invalid stellar material reference')
    tool=root/'.devtools/starbreaker-v0.3.2/starbreaker.exe'
    if not tool.is_file() or hashlib.sha256(tool.read_bytes()).hexdigest()!=STARBREAKER_SHA:raise ValueError('Install pinned extractor with scripts/setup_v2_extractor.ps1')
    output=root/'storage/star-assets'
    pattern='(?i)(?:'+ '|'.join(re.escape(s).replace('/',r'[\\/]') for s in sorted(sources))+')$'
    subprocess.run([str(tool),'p4k','extract','--p4k',str(archive.path),'-o',str(output),'--regex',pattern,'--convert','all','--max-threads','2'],check=True,timeout=90,capture_output=True)
    files={p.relative_to(output).as_posix().lower():p for p in output.rglob('*.mtl')}
    for body,meta in stars:
        source=meta['starMapMaterialPath'].lower().replace('\\','/')
        path=files.get('data/'+source)
        if not path:raise ValueError('Missing extracted star material: '+source)
        body['starAppearance']=appearance(meta,path.read_bytes())
