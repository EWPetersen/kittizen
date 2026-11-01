import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from interdiction_assets import device_metadata

class InterdictionAssetTests(unittest.TestCase):
    def test_device_values_are_validated_without_silent_defaults(self):
        pulse=dict(_Type_='SCItemQuantumInterdictionPulseParams',radiusMeters=20000,chargeTimeSecs=90,activationPhaseDuration_seconds=3,cooldownTimeSecs=1,greenZoneCheckRange=30000)
        jammer=dict(_Type_='SCItemQuantumJammerParams',jammerRange=12000)
        record=dict(_RecordName_='EntityClassDefinition.QED_WETK_S03_Reynie',_RecordId_='device',components=[pulse,jammer])
        result=device_metadata(record);self.assertEqual(result['snareRadius'],20000);self.assertEqual(result['chargeSeconds'],90)
        with self.assertRaises(ValueError):device_metadata(dict(record,_RecordName_='wrong'))
        with self.assertRaises(ValueError):device_metadata(dict(record,components=[pulse,pulse,jammer]))
        pulse['radiusMeters']=float('nan')
        with self.assertRaises(ValueError):device_metadata(record)
