import json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'public'
class PerformanceDataTests(unittest.TestCase):
    def test_extracted_flight_weapon_and_coverage(self):
        pointer=json.loads((ROOT/'v3-data.json').read_text());data=json.loads((ROOT/pointer['url'].lstrip('/')).read_text());records=data['records']
        gladius=records['b6b59889-7226-458e-a6b0-1c9392128a3c'];panther=records['bd13235d-1261-4b71-b32f-aed1a8beb526']
        self.assertEqual(gladius['metrics']['SCM speed']['value'],226)
        self.assertEqual(gladius['metrics']['Navigation speed']['value'],1193)
        self.assertAlmostEqual(panther['metrics']['Energy burst DPS']['value'],43.65*750/60)
        self.assertEqual(panther['metrics']['Projectile travel ceiling']['value'],1480*1.3)
        self.assertEqual(gladius['coverage']['stockGunMounts'],3)
        self.assertEqual(gladius['coverage']['modeledGunMounts'],2)
        self.assertIn('partial',gladius['sources']['Resolved stock energy burst dps'])
