"""Convert only game starmap meshes to bounded, shared Canvas geometry.

Uses the pinned upstream Cryengine Converter; raw CGF/CGFM and glTF stay local.
"""
import hashlib,json,math,struct,subprocess
from pathlib import Path

CONVERTER_SHA256='75feca2813a6517cad9a8e5df28687860a3b0bab9dcbcfeef65e56850d53b0b7'

def compact_gltf(path):
    gltf=json.loads(path.read_text());vertices=[];triangles=[]
    def accessor(index):
        a=gltf['accessors'][index];view=gltf['bufferViews'][a['bufferView']]
        uri=gltf['buffers'][view['buffer']]['uri'];file=(path.parent/uri).resolve()
        if not file.is_relative_to(path.parent.resolve()):raise ValueError('Mesh buffer escapes conversion folder')
        raw=file.read_bytes();fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];n={'SCALAR':1,'VEC3':3}[a['type']]
        size=struct.calcsize('<'+fmt*n);stride=view.get('byteStride',size);start=view.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+fmt*n,raw,start+i*stride) for i in range(a['count'])]
    for node in gltf.get('nodes',[]):
        if 'mesh' not in node:continue
        if any(k in node for k in ('matrix','rotation','translation','scale')):raise ValueError('Unexpected map mesh transform; retain previous catalogue')
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode',4)!=4:raise ValueError('Unsupported map primitive')
            base=len(vertices);points=accessor(primitive['attributes']['POSITION']);vertices.extend([x,-z,y] for x,y,z in points)
            indices=[v[0] for v in accessor(primitive['indices'])]
            if len(indices)%3:raise ValueError('Incomplete mesh triangles')
            triangles.extend([[base+indices[i+j] for j in range(3)] for i in range(0,len(indices),3)])
    if not vertices or not triangles or len(vertices)>20000 or len(triangles)>10000:raise ValueError('Map mesh outside mobile geometry budget')
    if any(not all(math.isfinite(v) for v in point) for point in vertices):raise ValueError('Invalid mesh position')
    if any(i<0 or i>=len(vertices) for face in triangles for i in face):raise ValueError('Invalid mesh index')
    center=[(min(p[i] for p in vertices)+max(p[i] for p in vertices))/2 for i in range(3)]
    radius=max(math.dist(p,center) for p in vertices)
    if not radius:raise ValueError('Empty mesh bounds')
    normalized=[tuple(round((p[i]-center[i])/radius,5) for i in range(3)) for p in vertices]
    # The web renderer does not use UVs/normals. Material seams often duplicate
    # entire position buffers; weld equal positions and discard unused vertices.
    unique={};compact=[];faces=[]
    for face in triangles:
        mapped=[]
        for index in face:
            point=normalized[index]
            if point not in unique:unique[point]=len(compact);compact.append(list(point))
            mapped.append(unique[point])
        if len(set(mapped))==3:faces.append(mapped)
    if not faces:raise ValueError('Empty mesh after position compaction')
    return {'vertices':compact,'triangles':faces}

def extract_models(archive,catalog,metadata,root):
    converter=root/'.devtools/cgf-converter-v2.0.0.exe'
    if not converter.is_file() or hashlib.sha256(converter.read_bytes()).hexdigest()!=CONVERTER_SHA256:
        raise ValueError('Install the pinned map converter using scripts/setup_map_converter.ps1')
    sources={}
    for body in catalog['bodies']:
        meta=metadata.get(body.get('navigationRecord'),{});geometry=meta.get('starMapGeomPath','').lower()
        if not body.get('radius') and geometry.startswith('objects/ui/starmap/') and geometry.endswith(('.cgf','.cga')) and 'planet_sphere' not in geometry:
            sources.setdefault(geometry,[]).append((body,meta))
    paths=[]
    for source,targets in sorted(sources.items()):
        ext=Path(source).suffix;mesh_ext='.cgam' if ext=='.cga' else '.cgfm'
        stem=source[:-4];chosen=next((candidate for candidate in (stem+'_lod2',stem+'_lod1',stem) if 'data/'+candidate+ext in archive.entries and 'data/'+candidate+mesh_ext in archive.entries),None)
        if not chosen:raise ValueError('Missing starmap mesh pair: '+source)
        data=root/'storage/model-source/data';local=data/(chosen+ext);local.parent.mkdir(parents=True,exist_ok=True)
        for suffix in (ext,mesh_ext):(data/(chosen+suffix)).write_bytes(archive.read('data/'+chosen+suffix))
        converted=root/'storage/model-converted';converted.mkdir(parents=True,exist_ok=True)
        output=converted/(Path(chosen).name+'.gltf')
        output.unlink(missing_ok=True)
        result=subprocess.run([str(converter),str(local),'-objectdir',str(data),'-gltf','-notex','-out',str(converted)],capture_output=True,text=True,timeout=60)
        if result.returncode or not output.is_file():raise ValueError('Map model conversion failed: '+source)
        mesh=compact_gltf(output);mesh['source']=chosen+ext;mesh['converter']='Cryengine-Converter v2.0.0'
        raw=json.dumps(mesh,separators=(',',':'));digest=hashlib.sha256(raw.encode()).hexdigest()[:12]
        relative='game-assets/models/'+Path(stem).name+'-'+digest+'.json';target=root/'public'/relative;target.parent.mkdir(parents=True,exist_ok=True)
        temp=target.with_suffix('.tmp');temp.write_text(raw);temp.replace(target);paths.append(relative)
        for body,meta in targets:body.update(model=relative,modelSource=chosen+ext,modelSize=max(1,meta.get('size',1)),modelRole='structure' if '/stations/' in source else 'symbol')
    return paths
