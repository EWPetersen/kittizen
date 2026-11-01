"""Export the Mantis device only, using the pinned DataCore reader on each patch."""
import hashlib,json,math,subprocess
from star_materials import STARBREAKER_SHA

def device_metadata(record):
    def objects(value):
        if isinstance(value,dict):
            yield value
            for v in value.values():yield from objects(v)
        elif isinstance(value,list):
            for v in value:yield from objects(v)
    if record.get('_RecordName_')!='EntityClassDefinition.QED_WETK_S03_Reynie':raise ValueError('Unexpected interdiction device')
    values=list(objects(record));pulse=[v for v in values if v.get('_Type_')=='SCItemQuantumInterdictionPulseParams'];jam=[v for v in values if v.get('_Type_')=='SCItemQuantumJammerParams']
    if len(pulse)!=1 or len(jam)!=1:raise ValueError('Ambiguous Mantis device parameters')
    result=dict(snareRadius=pulse[0]['radiusMeters'],chargeSeconds=pulse[0]['chargeTimeSecs'],activationSeconds=pulse[0]['activationPhaseDuration_seconds'],cooldownSeconds=pulse[0]['cooldownTimeSecs'],greenZoneCheckRange=pulse[0]['greenZoneCheckRange'],dampenerRadius=jam[0]['jammerRange'])
    if not all(type(v) in (int,float) and math.isfinite(v) and v>0 for v in result.values()):raise ValueError('Invalid interdiction device parameters')
    return dict(**result,ship='RSI Mantis',source='libs/foundry/records/entities/scitem/ships/quantumenforcementdevice/qed_wetk_s03_reynie',record=record['_RecordId_'])

def extract_interdiction(archive,root):
    tool=root/'.devtools/starbreaker-v0.3.2/starbreaker.exe'
    if not tool.is_file() or hashlib.sha256(tool.read_bytes()).hexdigest()!=STARBREAKER_SHA:raise ValueError('Install pinned StarBreaker for interdiction extraction')
    output=root/'storage/interdiction-source';output.mkdir(parents=True,exist_ok=True)
    process=subprocess.run([str(tool),'dcb','query','EntityClassDefinition','--p4k',str(archive.path),'--filter','*Reynie','--mem-cap','4096'],check=True,capture_output=True,timeout=180)
    text=process.stdout.decode('utf-8');start=text.find('{')
    if start<0 or len(text)>2*1024*1024:raise ValueError('Missing or oversized Mantis device record')
    record=json.loads(text[start:]);result=device_metadata(record)
    (output/'mantis-reynie.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
    return result
