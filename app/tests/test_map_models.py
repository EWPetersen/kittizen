import json,struct,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from map_models import compact_gltf

class MapModelTests(unittest.TestCase):
    def fixture(self,root,indices=(0,1,2)):
        vertices=[(0.,0.,0.),(2.,0.,0.),(0.,2.,0.)]
        raw=b''.join(struct.pack('<3f',*v) for v in vertices)+struct.pack('<3I',*indices)
        (root/'mesh.bin').write_bytes(raw)
        g={'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1}]}],'buffers':[{'uri':'mesh.bin'}],'bufferViews':[{'buffer':0,'byteOffset':0},{'buffer':0,'byteOffset':36}],'accessors':[{'bufferView':0,'componentType':5126,'type':'VEC3','count':3},{'bufferView':1,'componentType':5125,'type':'SCALAR','count':3}]}
        p=root/'mesh.gltf';p.write_text(json.dumps(g));return p,g
    def test_conversion_normalizes_and_preserves_triangles(self):
        with tempfile.TemporaryDirectory() as temp:
            p,_=self.fixture(Path(temp));m=compact_gltf(p);self.assertEqual(m['triangles'],[[0,1,2]]);self.assertTrue(all(abs(v)<=1 for point in m['vertices'] for v in point))
    def test_bad_indices_and_unexpected_transforms_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            p,g=self.fixture(Path(temp),(0,1,99))
            with self.assertRaisesRegex(ValueError,'index'):compact_gltf(p)
            p,g=self.fixture(Path(temp));g['nodes'][0]['translation']=[1,0,0];p.write_text(json.dumps(g))
            with self.assertRaisesRegex(ValueError,'transform'):compact_gltf(p)
