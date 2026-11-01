import json,math,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'public'
class V2CatalogTests(unittest.TestCase):
    def test_actual_catalog_integrity_and_lazy_assets(self):
        pointer=json.loads((ROOT/'v2-catalog.json').read_text())
        base=(ROOT/pointer['base'].lstrip('/')).resolve()
        self.assertTrue(base.is_relative_to(ROOT.resolve()))
        index=json.loads((base/'index.json').read_text());items=index['items'];ids={i['id'] for i in items}
        self.assertEqual(len(ids),len(items));self.assertGreater(len(items),500)
        self.assertEqual(set(index['counts']),{'Ships','Vehicles','Components','Weapons','Equipment'})
        self.assertLess((base/'index.json').stat().st_size,4*1024*1024)
        detail_ids=set()
        for p in base.glob('detail-*.json'):
            data=json.loads(p.read_text())
            for ident,d in data.items():
                detail_ids.add(ident);self.assertEqual(ident,d['id'])
                self.assertTrue(d['source'].startswith('libs/'))
                for slot in d['loadout']:
                    if slot['itemId']:self.assertIn(slot['itemId'],ids)
                for v in d['stats'].values():self.assertTrue(math.isfinite(v['value']))
        self.assertEqual(ids,detail_ids)
        ships=[i for i in items if i['category']=='Ships']
        gladius=next(i for i in ships if i['name']=='Aegis Gladius')
        self.assertEqual(gladius['stats']['Crew']['value'],1)
        self.assertEqual(gladius['stats']['Length']['value'],21)
        self.assertTrue((base/gladius['image']).is_file())

    def test_game_artwork_is_referenced_shared_and_present(self):
        pointer=json.loads((ROOT/'v2-catalog.json').read_text());base=ROOT/pointer['base'].lstrip('/')
        items=json.loads((base/'index.json').read_text())['items']
        illustrated=[i for i in items if i.get('image')]
        self.assertGreater(len([i for i in illustrated if i['category']=='Weapons']),20)
        self.assertGreater(len([i for i in illustrated if i['category']=='Equipment']),20)
        self.assertLess(len({i['image'] for i in illustrated}),len(illustrated))
        for item in illustrated:
            asset=(base/item['image']).resolve();self.assertTrue(asset.is_relative_to(base.resolve()))
            self.assertTrue(asset.is_file());self.assertIn(item['imageKind'],('ship artwork','loadout icon'))
            self.assertTrue(item['imageSource'].lower().endswith('.png'))
