"""Targeted belt metadata and lightweight asteroid-base exterior extraction."""
import hashlib,io,json,math,subprocess,zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
from build_catalog import rotate,mul
from map_models import compact_gltf,CONVERTER_SHA256
from star_materials import STARBREAKER_SHA

ROCK='objects/space/3d/asteroid/angular_smooth_01/angular_smooth_01_03400_01_lp_lod4'

def placements(xml):
    out={}
    def walk(node,position=(0,0,0),rotation=(1,0,0,0)):
        for child in node.findall('./ChildObjectContainers/Child'):
            local=tuple(float(x) for x in child.get('pos','0,0,0').split(','));q=tuple(float(x) for x in child.get('rot','1,0,0,0').split(','))
            p=tuple(a+b for a,b in zip(position,rotate(rotation,local)));r=mul(rotation,q)
            out[child.get('name','').replace('\\','/').lower()]={'position':p,'rotation':r}
            walk(child,p,r)
    walk(ET.fromstring(xml));return out

def ring_properties(xml):
    root=ET.fromstring(xml);p=root.find('.//AsteroidFieldComponent[@innerRadiusKm]')
    if p is None:raise ValueError('Missing asteroid ring radii')
    values=[float(p.attrib[n])*1000 for n in ['innerRadiusKm','outerRadiusKm','depthKm']]
    if not all(math.isfinite(x) and x>0 for x in values) or values[0]>=values[1]:raise ValueError('Invalid asteroid ring dimensions')
    return dict(innerRadius=values[0],outerRadius=values[1],depth=values[2],radialWidthKnown=True)

def decoded_entities(archive,source,suffix,output,tool):
    with zipfile.ZipFile(io.BytesIO(archive.read(source))) as z:
        stem=Path(source).stem;entry=next((e for e in z.infolist() if e.filename.lower()==stem+suffix),None)
        if entry is None or entry.file_size>32*1024*1024:raise ValueError('Invalid environment entity chunk: '+source)
        raw=z.read(entry)
    at=raw.find(b'CryXmlB\0')
    if at<0:raise ValueError('Missing environment CryXML: '+source)
    binary=output/(stem+suffix+'.cryxml');decoded=binary.with_suffix('.xml');binary.write_bytes(raw[at:])
    subprocess.run([str(tool),'cryxml','convert',str(binary),str(decoded)],check=True,capture_output=True,timeout=30)
    return decoded.read_bytes()

def local_ring(xml,body):
    entities=ET.fromstring(xml).findall(".//Entity[@Name='Yela_AsteroidRing']")
    if len(entities)!=1:raise ValueError('Missing or ambiguous Yela asteroid ring')
    entity=entities[0]
    def vector(value,size):
        values=tuple(float(x) for x in value.split(','))
        if len(values)!=size or not all(math.isfinite(x) for x in values):raise ValueError('Invalid ring transform')
        return values
    position=vector(entity.get('Pos','0,0,0'),3)
    rotation=vector(entity.get('Rotate',entity.get('Rotation','1,0,0,0')),4)
    if abs(sum(x*x for x in rotation)-1)>.001:raise ValueError('Invalid ring rotation')
    center=[a+b for a,b in zip(body['position'],rotate(body['rotation'],position))]
    return dict(id='stanton:yela-ring',name='Yela asteroid ring',system=body['system'],parent=body['id'],center=center,rotation=mul(body['rotation'],rotation),source=body['source'],**ring_properties(ET.tostring(entity)))

def settlement_details(mesh):
    """Small authored dock silhouettes on the native rock; not a world reconstruction."""
    mesh['faceMaterials']=['rock']*len(mesh['triangles'])
    candidates=sorted(mesh['vertices'],key=lambda p:p[2],reverse=True);chosen=[]
    for p in candidates:
        if all(math.dist(p,q)>.16 for q in chosen):chosen.append(p)
        if len(chosen)==12:break
    faces=[[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[1,5,6],[1,6,2],[2,6,7],[2,7,3],[3,7,4],[3,4,0]]
    for i,(x,y,z) in enumerate(chosen):
        base=len(mesh['vertices']);w=.035+(i%3)*.012;h=.035+(i%4)*.015
        mesh['vertices'].extend([[x+dx*w,y+dy*w*1.7,z+dz*h] for dx,dy,dz in [(-1,-1,0),(1,-1,0),(1,1,0),(-1,1,0),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
        mesh['triangles'].extend([[base+j for j in face] for face in faces]);mesh['faceMaterials'].extend(['structure']*len(faces))
    radius=max(math.hypot(*p) for p in mesh['vertices'])
    mesh['vertices']=[[round(v/radius,5) for v in p] for p in mesh['vertices']]
    mesh['schematicDetails']=True;return mesh

def extract_environment(archive,catalog,root):
    output=root/'storage/environment-source';output.mkdir(parents=True,exist_ok=True)
    tool=root/'.devtools/starbreaker-v0.3.2/starbreaker.exe';converter=root/'.devtools/cgf-converter-v2.0.0.exe'
    for path,digest in [(tool,STARBREAKER_SHA),(converter,CONVERTER_SHA256)]:
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise ValueError('Install pinned environment conversion tools')
    belts=[]
    for system,name,relative,suffix in [('stanton','Aaron Halo','aaronhalo','.soc'),('nyx','Keeger Belt','keegerbelt/keegerbelt_bg','.ale'),('nyx','Glaciem Ring','glaciemring/glaciemring_bg','.ale')]:
        source=f'data/objectcontainers/pu/system/{system}/{relative}.socpak';xml=(root/'storage'/f'{system}system.xml').read_bytes();placed=placements(xml)
        if source not in placed:raise ValueError('Missing placed belt: '+source)
        data=decoded_entities(archive,source,suffix,output,tool)
        if system=='stanton':dimensions=ring_properties(data)
        else:
            entity=ET.fromstring(data).find(".//Entity[@EntityClass='AreaSphere']")
            if entity is None:raise ValueError('Missing Nyx belt reference radius')
            radius=float(entity.attrib['Radius'])
            segments=[p for path,p in placed.items() if '/'+relative.split('/')[0]+'/' in path and '_bg.' not in path]
            distances=[math.hypot(*[p['position'][i]-placed[source]['position'][i] for i in range(2)]) for p in segments]
            if not math.isfinite(radius) or radius<=0 or not distances or max(abs(r-radius) for r in distances)>radius*.001:raise ValueError('Nyx belt radius no longer agrees with placed segments')
            dimensions=dict(innerRadius=radius,outerRadius=radius,depth=0,radialWidthKnown=False)
        belts.append(dict(id=system+':'+relative,name=name,system=system,center=placed[source]['position'],rotation=placed[source]['rotation'],source=source,**dimensions))
    yela=next(b for b in catalog['bodies'] if b['name']=='Yela' and b['system']=='stanton')
    belts.append(local_ring(decoded_entities(archive,yela['source'],'.soc',output,tool),yela))
    catalog['belts']=belts
    levski=next(b for b in catalog['bodies'] if b['name']=='Levski' and b['system']=='nyx')
    # Ensure this source component is still actually used by the installed Levski.
    with zipfile.ZipFile(io.BytesIO(archive.read(levski['source']))) as z:
        static=z.getinfo('levski_all.soc')
        if static.file_size>32*1024*1024:raise ValueError('Levski exterior exceeds extraction budget')
        if ROCK.rsplit('_lod',1)[0].encode()+b'.cgf' not in z.read(static):raise ValueError('Levski asteroid component changed')
    pattern=r'(?i)objects[\\/]space[\\/]3d[\\/]asteroid[\\/]angular_smooth_01[\\/]angular_smooth_01_03400_01_lp_lod4\.(?:cgf|cgfm)$'
    subprocess.run([str(tool),'p4k','extract','--p4k',str(archive.path),'-o',str(output),'--regex',pattern,'--max-threads','2'],check=True,capture_output=True,timeout=60)
    data=output/'data';converted=output/'converted';converted.mkdir(exist_ok=True)
    subprocess.run([str(converter),str(data/(ROCK+'.cgf')),'-objectdir',str(data),'-gltf','-notex','-out',str(converted)],check=True,capture_output=True,timeout=60)
    gltf=converted/(Path(ROCK).name+'.gltf');mesh=settlement_details(compact_gltf(gltf));mesh.update(source=ROCK+'.cgf',converter='Cryengine-Converter v2.0.0')
    positions=[a for a in json.loads(gltf.read_text())['accessors'] if a.get('type')=='VEC3' and 'min' in a and 'max' in a]
    size=max(max(a['max'][i]-a['min'][i] for i in range(3)) for a in positions)
    raw=json.dumps(mesh,separators=(',',':'));digest=hashlib.sha256(raw.encode()).hexdigest()[:12];relative='game-assets/models/levski-asteroid-'+digest+'.json'
    target=root/'public'/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(raw)
    levski.update(model=relative,modelSource=ROCK+'.cgf',modelSize=size,modelRole='structure',modelStyle='asteroid',modelNote='Native Levski rock component with schematic dock details; not a full facility reconstruction.')
    for body in catalog['bodies']:
        if body['name']=='Grim HEX':body['modelStyle']='asteroid'
    paths=[relative]
    prison=next(b for b in catalog['bodies'] if b['navigationRecord']=='b9b1a547-c415-44cb-826b-6c28cbd0c0bb')
    prison_source='data/objectcontainers/pu/loc/mod/prison/auto/ext/prison_auto_ext_borehole_a.socpak'
    component='objects/buildingsets/human/lowtech/bravo/ext/prisons/auto/prison_structure_hole_a'
    with zipfile.ZipFile(io.BytesIO(archive.read(prison_source))) as z:
        info=z.getinfo('prison_auto_ext_borehole_a.soc')
        if info.file_size>8*1024*1024 or component.encode()+b'.cgf' not in z.read(info):raise ValueError('Klescher exterior component changed')
    import re
    stem=component+'_lod3';pattern='(?i)'+re.escape(stem).replace('/',r'[\\/]')+r'\.(?:cgf|cgfm)$'
    subprocess.run([str(tool),'p4k','extract','--p4k',str(archive.path),'-o',str(output),'--regex',pattern,'--max-threads','2'],check=True,capture_output=True,timeout=60)
    subprocess.run([str(converter),str(data/(stem+'.cgf')),'-objectdir',str(data),'-gltf','-notex','-out',str(converted)],check=True,capture_output=True,timeout=60)
    gltf=converted/(Path(stem).name+'.gltf');mesh=compact_gltf(gltf);mesh.update(source=stem+'.cgf',converter='Cryengine-Converter v2.0.0')
    raw=json.dumps(mesh,separators=(',',':'));digest=hashlib.sha256(raw.encode()).hexdigest()[:12];relative='game-assets/models/klescher-exterior-'+digest+'.json'
    (root/'public'/relative).write_text(raw)
    positions=[a for a in json.loads(gltf.read_text())['accessors'] if a.get('type')=='VEC3' and 'min' in a and 'max' in a]
    size=max(max(a['max'][i]-a['min'][i] for i in range(3)) for a in positions)
    prison.update(model=relative,modelSource=stem+'.cgf',modelSize=size,modelRole='surface',modelStyle='prison',modelNote='Native Klescher exterior borehole component; not the underground prison layout.')
    paths.append(relative);return paths
