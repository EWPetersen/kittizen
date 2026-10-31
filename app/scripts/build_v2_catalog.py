"""Normalize the installed game's StarBreaker exports into a lazy, versioned catalogue."""
import argparse,collections,hashlib,json,math,os,re,shutil,subprocess,sys,tempfile,time
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.extractor'))
from PIL import Image

def walk(value):
    if isinstance(value,dict):
        yield value
        for child in value.values():yield from walk(child)
    elif isinstance(value,list):
        for child in value:yield from walk(child)

def normalize(records,assets,localization,destination,build):
    files=list(records.rglob('*.json'));paths={p.as_posix().split('/libs/',1)[-1].lower():p for p in files}
    def loc(value):
        if not isinstance(value,str):return ''
        result=localization.get(value.lstrip('@').lower(),value)
        return '' if result.startswith('@') else result
    def ref(value):
        if isinstance(value,dict):value=value.get('_RecordPath_','')
        if not isinstance(value,str):return {}
        key=value.replace('\\','/').split('/libs/',1)[-1].lower()
        return json.loads(paths[key].read_text())['_RecordValue_'] if key in paths else {}
    images={p.stem.lower():p for p in assets.rglob('*.png')}
    xmls={p.stem.lower():p for p in assets.rglob('*.xml')}
    summaries=[];details={};names={};counts=collections.Counter()
    for p in files:
        if '/entities/' not in p.as_posix():continue
        data=json.loads(p.read_text());v=data.get('_RecordValue_',{})
        if v.get('_Type_')!='EntityClassDefinition':continue
        parts={x.get('_Type_'):x for x in v.get('Components',[]) if isinstance(x,dict)}
        attach=parts.get('SAttachableComponentParams',{}).get('AttachDef',{})
        if not attach:continue
        vehicle=parts.get('VehicleComponentParams',{});locale=attach.get('Localization',{})
        name=loc(vehicle.get('vehicleName')) or loc(locale.get('Name'))
        if not name or name in ('None','UNINITIALIZED'):continue
        typ=attach.get('Type','');sub=attach.get('SubType','');record=data['_RecordName_'].split('.',1)[-1]
        category='Ships' if vehicle and vehicle.get('movementClass')=='Spaceship' else 'Vehicles' if vehicle else 'Weapons' if 'Weapon' in typ or 'Missile' in typ else 'Components' if '/scitem/ships/' in p.as_posix() else 'Equipment'
        # Exclude NPC/test overrides from the player-facing catalogue; retain source records on disk.
        if vehicle and re.search(r'(^|_)(AI|PU|NPC|TEST|DUMMY|TEMPLATE|DESTROYED|WRECK)(_|$)',record,re.I):continue
        key=(name,typ,sub)
        if key in names:
            old=details[names[key]]
            if len(old['record'])<=len(record):continue
            summaries.remove(next(s for s in summaries if s['id']==old['id']));del details[old['id']]
        ident=data['_RecordId_'];names[key]=ident
        manufacturer=ref(vehicle.get('manufacturer') or attach.get('Manufacturer'))
        maker=loc(manufacturer.get('Localization',{}).get('Name')) or manufacturer.get('Code','Independent')
        summary=dict(id=ident,name=name,category=category,type=typ,subtype=sub,size=attach.get('Size'),grade=attach.get('Grade'),manufacturer=maker,role=loc(vehicle.get('vehicleRole')))
        description=loc(vehicle.get('vehicleDescription')) or loc(locale.get('Description'))
        stats={};sources={}
        def metric(label,value,source,unit=''):
            if isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value):stats[label]=dict(value=value,unit=unit);sources[label]=source
        metric('Size',attach.get('Size'),'SItemDefinition.Size')
        metric('Grade',attach.get('Grade'),'SItemDefinition.Grade')
        if vehicle:
            metric('Crew',vehicle.get('crewSize'),'VehicleComponentParams.crewSize')
            for axis,label in [('x','Width'),('y','Length'),('z','Height')]:metric(label,vehicle.get('maxBoundingBoxSize',{}).get(axis),'VehicleComponentParams.maxBoundingBoxSize.'+axis,'m')
            xml=xmls.get(Path(vehicle.get('vehicleDefinition','')).stem.lower())
            if xml:
                tree=ET.parse(xml)
                metric('Base mass',sum(float(x.get('mass','0')) for x in tree.iter('Part')),'Vehicle XML Part.mass sum','kg')
        relevant=[]
        for component in parts.values():
            cname=component.get('_Type_','')
            if any(t in cname for t in ('QuantumDrive','ShieldGenerator','PowerPlant','Cooler','FuelTank','WeaponComponent','Missile')):
                relevant.append(component)
            if cname=='SCItemQuantumDriveParams':
                for key,label,unit in [('driveSpeed','Quantum speed','m/s'),('spoolUpTime','Spool time','s'),('cooldownTime','Cooldown','s'),('stageOneAccelRate','Stage 1 acceleration','m/s²'),('stageTwoAccelRate','Stage 2 acceleration','m/s²')]:metric(label,component.get('params',{}).get(key),cname+'.params.'+key,unit)
        scalars=[]
        def scalar_tree(value,path=''):
            if isinstance(value,dict):
                for k,x in value.items():
                    if k.startswith('_'):continue
                    if isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x):scalars.append(dict(path=path+'.'+k,value=x))
                    elif isinstance(x,(dict,list)):scalar_tree(x,path+'.'+k)
            elif isinstance(value,list):
                for i,x in enumerate(value):scalar_tree(x,path+f'[{i}]')
        for c in relevant:scalar_tree(c,c['_Type_'])
        loadout=[]
        def equipment(value,parent=''):
            if isinstance(value,dict):
                current=parent
                if value.get('_Type_')=='SItemPortLoadoutEntryParams':
                    current=(parent+' / ' if parent else '')+value.get('itemPortName','')
                    record_name=value.get('entityClassName')
                    reference=value.get('entityClassReference')
                    if not record_name and isinstance(reference,str):record_name=Path(reference.replace('\\','/')).stem
                    if record_name:loadout.append(dict(port=current,record=record_name))
                for child in value.values():
                    if isinstance(child,(dict,list)):equipment(child,current)
            elif isinstance(value,list):
                for child in value:equipment(child,parent)
        equipment(parts.get('SEntityComponentDefaultLoadoutParams',{}))
        ports=[]
        for x in walk(parts.get('SItemPortContainerComponentParams',{})):
            if x.get('_Type_')=='SItemPortDef':ports.append(dict(name=x.get('Name'),min=x.get('MinSize'),max=x.get('MaxSize'),types=x.get('Types',[]),flags=x.get('Flags','')))
        image=None
        if vehicle:
            candidates=[record.lower(),record.split('_',1)[-1].lower(),name.lower().replace(' ','_')]
            source=next((images[c] for c in candidates if c in images),None)
            if not source:
                display=next((x.get('displayIcon','') for x in v.get('StaticEntityClassData',[]) if x.get('_Type_')=='EntityUIDisplayParams'),'')
                source=images.get(Path(display).stem.lower())
            if source:
                image=f'images/{ident}.webp';target=destination/image;target.parent.mkdir(parents=True,exist_ok=True)
                with Image.open(source) as im:im.thumbnail((640,400));im.save(target,'WEBP',quality=82)
        summary['image']=image;summary['stats']=stats
        detail=dict(**summary,description=description,record=record,source=p.relative_to(records).as_posix(),sources=sources,loadout=loadout,ports=ports,rawStats=scalars[:160])
        summaries.append(summary);details[ident]=detail
    record_ids={d['record'].lower():d['id'] for d in details.values()}
    for d in details.values():
        for slot in d['loadout']:slot['itemId']=record_ids.get(slot['record'].lower())
    buckets=collections.defaultdict(dict)
    for ident,d in details.items():buckets[ident[:2]][ident]=d
    for prefix,items in buckets.items():(destination/f'detail-{prefix}.json').write_text(json.dumps(items,separators=(',',':'),allow_nan=False),encoding='utf-8')
    summaries.sort(key=lambda s:(s['category'],s['name']))
    index=dict(build=build,extracted=time.time(),source='Installed LIVE Data.p4k / Game2.dcb',extractor='StarBreaker v0.3.2',recordCount=len(files),items=summaries,counts=dict(collections.Counter(s['category'] for s in summaries)))
    (destination/'index.json').write_text(json.dumps(index,separators=(',',':'),allow_nan=False),encoding='utf-8')
    return index

def run(game,force=False):
    tool=ROOT/'.devtools/starbreaker-v0.3.2/starbreaker.exe'
    if not tool.exists():raise ValueError('Run scripts/setup_v2_extractor.ps1 first')
    if hashlib.sha256(tool.read_bytes()).hexdigest()!='82439e45cd5337f058f06ded63ee633bea8de8e4d75525f5a083aa7955b91a10':raise ValueError('Extractor checksum mismatch')
    signature=dict(size=(game/'Data.p4k').stat().st_size,mtime=(game/'Data.p4k').stat().st_mtime_ns,pipeline=2)
    state=ROOT/'storage/v2-state.json'
    if not force and state.exists() and json.loads(state.read_text()).get('signature')==signature:return
    with tempfile.TemporaryDirectory(prefix='kittizen-catalog-') as staging:
        raw=Path(staging)/'records';assets=Path(staging)/'assets'
        subprocess.run([str(tool),'dcb','extract','--p4k',str(game/'Data.p4k'),'--format','json','-o',str(raw),'--mem-cap','4096'],check=True,timeout=600)
        subprocess.run([str(tool),'p4k','extract','--p4k',str(game/'Data.p4k'),'-o',str(assets),'--regex',r'(?i)(scripts[\\/]entities[\\/]vehicles[\\/]implementations[\\/]xml[\\/].*\.xml$|ui[\\/](textures[\\/]ea[\\/]vehicleicons|frontend[\\/]assets[\\/]tif[\\/]ships)[\\/].*\.dds$|localization[\\/]english[\\/]global\.ini$)','--convert','all','--max-threads','4'],check=True,timeout=180)
        if (game/'Data.p4k').stat().st_mtime_ns!=signature['mtime']:raise ValueError('Game changed during extraction; previous catalogue retained')
        return publish(raw,assets,signature)

def publish(raw,assets,signature):
    localization={}
    localization_file=next(assets.rglob('global.ini'),ROOT/'storage/audit/global.ini')
    for line in localization_file.read_text(encoding='utf-8-sig').splitlines():
        if '=' in line:
            k,v=line.split('=',1);key=k.split(',',1)[0].lower()
            if key not in localization or ',' not in k:localization[key]=v
    build=json.loads((ROOT/'public/catalog.json').read_text())['build']
    stamp=hashlib.sha256(json.dumps(signature,sort_keys=True).encode()).hexdigest()[:16]
    destination=ROOT/'public/game-assets/v2'/stamp;destination.mkdir(parents=True,exist_ok=True)
    index=normalize(raw,assets,localization,destination,build)
    if len(index['items'])<500:raise ValueError('Catalogue incomplete; previous V2 retained')
    pointer=ROOT/'public/v2-catalog.json';temp=pointer.with_suffix('.tmp');temp.write_text(json.dumps(dict(base=f'/game-assets/v2/{stamp}/',build=build,counts=index['counts'])));temp.replace(pointer)
    (ROOT/'storage/v2-state.json').write_text(json.dumps(dict(signature=signature,counts=index['counts'])))
    print('Published V2:',index['counts'])
    return index

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--game',type=Path,default=Path(r'D:\Games\Roberts Space Industries\StarCitizen\LIVE'));parser.add_argument('--force',action='store_true');parser.add_argument('--from-export',action='store_true');args=parser.parse_args()
    if args.from_export:publish(ROOT/'storage/v2-records',ROOT/'storage/v2-assets',dict(source='initial-installed-export',pipeline=1))
    else:run(args.game,args.force)
