import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from star_materials import appearance

class StarMaterialTests(unittest.TestCase):
    def test_actual_material_values_and_display_size_survive(self):
        meta={'size':696000000,'starMapMaterialPath':'materials/stellar_classes/starmap/star.mtl'}
        result=appearance(meta,'<Material Diffuse="1,0.491,0.168" Glow="0.35" Shader="Hologram"/>')
        self.assertEqual(result['color'],[1,.491,.168]);self.assertEqual(result['displaySize'],696000000)
        self.assertEqual(result['source'],meta['starMapMaterialPath'])
        with self.assertRaises(ValueError):appearance(meta,'<Material Diffuse="nan,0,1"/>')
