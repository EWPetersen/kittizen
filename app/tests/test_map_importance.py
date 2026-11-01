import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_catalog import primary_location

class MapImportanceTests(unittest.TestCase):
    def test_spawn_hubs_and_secondary_service_locations(self):
        for system,record in [('Pyro','RR_P6_LEO'),('Pyro','RR_P3_LEO'),('Pyro','RR_P2_L4'),('Nyx','Nyx_Levski'),('Nyx','AsteroidClusterBase_Nyx_Social_Keeger_001'),('Stanton','Stanton4_NewBabbage'),('Stanton','GrimHEX'),('Stanton','RR_HUR_LEO'),('Stanton','RR_ARC_L1')]:
            self.assertTrue(primary_location(system,record),(system,record))
        for system,record in [('Pyro','RR_P3_L3'),('Pyro','RR_P5_L2'),('Nyx','AsteroidClusterBase_Nyx_Rockcracker_Sandbox_001'),('Nyx','TransitPoint_Glaciem_Alpha'),('Stanton','CommArray_ST1_13')]:
            self.assertFalse(primary_location(system,record),(system,record))
