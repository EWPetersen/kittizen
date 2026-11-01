import sys,unittest,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from environment_assets import placements,ring_properties,settlement_details

class EnvironmentAssetTests(unittest.TestCase):
    def test_ring_dimensions_are_read_in_metres_without_inventing_widths(self):
        p=ring_properties('<Entities><AsteroidFieldComponent innerRadiusKm="19597600" outerRadiusKm="21392800" depthKm="10000"/></Entities>')
        self.assertEqual(p,dict(innerRadius=19597600000,outerRadius=21392800000,depth=10000000,radialWidthKnown=True))
        for xml in ['<Entities/>','<AsteroidFieldComponent innerRadiusKm="nan" outerRadiusKm="4" depthKm="1"/>','<Entities><AsteroidFieldComponent innerRadiusKm="4" outerRadiusKm="2" depthKm="1"/></Entities>']:
            with self.assertRaises(ValueError):ring_properties(xml)

    def test_nested_belt_placements_inherit_game_transforms(self):
        p=placements('<ObjectContainer><ChildObjectContainers><Child name="root" pos="10,20,30" rot="0.7071067811865476,0,0,0.7071067811865476"><ChildObjectContainers><Child name="Data\\belt.socpak" pos="2,0,0"/></ChildObjectContainers></Child></ChildObjectContainers></ObjectContainer>')
        for a,b in zip(p['data/belt.socpak']['position'],[10,22,30]):self.assertAlmostEqual(a,b)

    def test_schematic_docks_remain_bounded_and_explicitly_identified(self):
        m=settlement_details(dict(vertices=[[1,0,0],[0,1,0],[0,0,1],[-1,0,0]],triangles=[[0,1,2],[1,2,3]]))
        self.assertTrue(m['schematicDetails']);self.assertIn('structure',m['faceMaterials']);self.assertEqual(len(m['triangles']),len(m['faceMaterials']))
        self.assertTrue(all(math.hypot(*v)<=1.00001 for v in m['vertices']))
