import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from star_materials import appearance,world_override

class StarMaterialTests(unittest.TestCase):
    def test_actual_material_values_and_display_size_survive(self):
        meta={'size':696000000,'starMapMaterialPath':'materials/stellar_classes/starmap/star.mtl'}
        result=appearance(meta,'<Material Diffuse="1,0.491,0.168" Glow="0.35" Shader="Hologram"/>')
        self.assertEqual(result['color'],[1,.491,.168]);self.assertEqual(result['displaySize'],696000000)
        self.assertEqual(result['source'],meta['starMapMaterialPath'])
        with self.assertRaises(ValueError):appearance(meta,'<Material Diffuse="nan,0,1"/>')

    def test_world_overrides_use_radius_and_inherit_missing_light_channels(self):
        result=world_override('<Entities><Entity EntityClass="SunLight" Material="Materials/stellar_classes/star_m4v_class"><PropertiesDataCore><SunLight radius="5.7072e8" surfaceIntensity="30"><lightColor g="219" b="195"/></SunLight></PropertiesDataCore></Entity></Entities>')
        self.assertEqual(result['radius'],570720000);self.assertEqual(result['lightColor'],[1,219/255,195/255]);self.assertTrue(result['source'].endswith('.mtl'))
        with self.assertRaises(ValueError):world_override('<Entities/>')
