"""Extract star-specific SunLight overrides, materials and referenced textures."""
import hashlib,math,re,subprocess,io,zipfile
import xml.etree.ElementTree as ET

STARBREAKER_SHA='82439e45cd5337f058f06ded63ee633bea8de8e4d75525f5a083aa7955b91a10'

def appearance(meta,xml):
    material=ET.fromstring(xml)
    color=[float(x) for x in material.attrib['Diffuse'].split(',')]
    size=float(meta['size']);glow=float(material.get('Glow','0'))
    if len(color)!=3 or not all(math.isfinite(x) and 0<=x<=1 for x in color) or not math.isfinite(size) or size<=0 or not math.isfinite(glow):
        raise ValueError('Invalid game star material')
    return dict(color=color,glow=max(0,min(1,glow)),displaySize=size,shader=material.get('Shader'),source=meta['starMapMaterialPath'])

def world_override(xml):
    root=ET.fromstring(xml);entities=root.findall(".//Entity[@EntityClass='SunLight']")
    if len(entities)!=1:raise ValueError('Expected one world SunLight entity')
    entity=entities[0];light=entity.find('.//SunLight')
    if light is None:raise ValueError('Missing world SunLight properties')
    radius=float(light.attrib['radius']);intensity=float(light.get('surfaceIntensity','1'))
    if not math.isfinite(radius) or radius<=0 or not math.isfinite(intensity) or intensity<=0:raise ValueError('Invalid world star radius/intensity')
    color=light.find('lightColor')
    channels=[int(color.get(c,'255')) if color is not None else 255 for c in 'rgb']
    if any(not 0<=c<=255 for c in channels):raise ValueError('Invalid world star light colour')
    source=entity.attrib['Material'].replace('\\','/').lower()
    if not source.endswith('.mtl'):source+='.mtl'
    if not source.startswith('materials/stellar_classes/') or '..' in source:raise ValueError('Invalid stellar material reference')
    return dict(radius=radius,surfaceIntensity=intensity,lightColor=[c/255 for c in channels],source=source)

def extract_stars(archive,catalog,metadata,root):
    stars=[(body,metadata.get(body.get('navigationRecord'),{})) for body in catalog['bodies'] if body['kind']=='star']
    tool=root/'.devtools/starbreaker-v0.3.2/starbreaker.exe'
    if not tool.is_file() or hashlib.sha256(tool.read_bytes()).hexdigest()!=STARBREAKER_SHA:raise ValueError('Install pinned extractor with scripts/setup_v2_extractor.ps1')
    output=root/'storage/star-assets'
    output.mkdir(parents=True,exist_ok=True);overrides={}
    for body,_ in stars:
        with zipfile.ZipFile(io.BytesIO(archive.read(body['source']))) as container:
            entries=[e for e in container.infolist() if e.filename.lower().endswith('.ale')]
            if len(entries)!=1 or entries[0].file_size>1024*1024:raise ValueError('Invalid star entity chunk')
            raw=container.read(entries[0]);at=raw.find(b'CryXmlB\0')
            if at<0:raise ValueError('Missing star entity CryXML')
            binary=output/(body['system']+'-world.cryxml');decoded=binary.with_suffix('.xml');binary.write_bytes(raw[at:])
            subprocess.run([str(tool),'cryxml','convert',str(binary),str(decoded)],check=True,capture_output=True,timeout=30)
            overrides[body['id']]=world_override(decoded.read_bytes())
    sources={o['source'] for o in overrides.values()}
    pattern='(?i)(?:'+ '|'.join(re.escape(s).replace('/',r'[\\/]') for s in sorted(sources))+')$'
    subprocess.run([str(tool),'p4k','extract','--p4k',str(archive.path),'-o',str(output),'--regex',pattern,'--convert','all','--max-threads','2'],check=True,timeout=90,capture_output=True)
    files={p.relative_to(output).as_posix().lower():p for p in output.rglob('*.mtl')}
    textures={}
    for body,meta in stars:
        world=overrides[body['id']];source=world['source']
        path=files.get('data/'+source)
        if not path:raise ValueError('Missing extracted star material: '+source)
        material=ET.fromstring(path.read_bytes())
        body['starAppearance']=appearance(dict(size=world['radius']*2,starMapMaterialPath=source),path.read_bytes())
        body['starAppearance'].update(world,worldSource=body['source'])
        for texture in material.findall('.//Texture'):
            source=texture.get('File','').replace('\\','/').lower()
            if not source.startswith('objects/vfx/mesheffects/particle_transparent_meshes/stars/') or '..' in source:raise ValueError('Invalid stellar texture reference')
            dds=source.rsplit('.',1)[0]+'.dds';textures.setdefault(dds,[]).append((body,texture))
    paths=[]
    if textures:
        pattern='(?i)(?:'+'|'.join(re.escape(s).replace('/',r'[\\/]') for s in sorted(textures))+')$'
        subprocess.run([str(tool),'p4k','extract','--p4k',str(archive.path),'-o',str(output),'--regex',pattern,'--convert','all','--max-threads','2'],check=True,timeout=90,capture_output=True)
        images={p.relative_to(output).as_posix().lower():p for p in output.rglob('*.png')}
        from PIL import Image
        for source,targets in textures.items():
            image=images.get('data/'+source[:-4]+'.png')
            if not image:raise ValueError('Missing stellar texture')
            digest=hashlib.sha256(image.read_bytes()).hexdigest()[:16];relative='game-assets/stars/'+digest+'.webp'
            target=root/'public'/relative;target.parent.mkdir(parents=True,exist_ok=True)
            with Image.open(image) as im:im.thumbnail((512,512));im.save(target,'WEBP',quality=88)
            paths.append(relative)
            for body,texture in targets:
                modifier=texture.find('TexMod');tile=float(modifier.get('TileU','1')) if modifier is not None else 1
                body['starAppearance'].update(texture=relative,textureSource=source,textureTile=max(1,min(16,tile)))
    return paths
