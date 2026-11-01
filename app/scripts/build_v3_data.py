"""Extract traceable performance metrics; unsupported firing sequences remain unknown."""
import hashlib,json,math,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def nodes(o):
    if isinstance(o,dict):
        yield o
        for x in o.values():yield from nodes(x)
    elif isinstance(o,list):
        for x in o:yield from nodes(x)
def build(records,base):
    index=json.loads((base/'index.json').read_text());items=index['items'];rawpaths={p.as_posix().split('/libs/',1)[-1].lower():p for p in records.rglob('*.json')}
    cache={}
    def read(path):
        key=str(path)
        if key not in cache:cache[key]=json.loads(Path(path).read_text())['_RecordValue_']
        return cache[key]
    def reference(value):
        if isinstance(value,dict):value=value.get('_RecordPath_','')
        key=value.replace('\\','/').split('/libs/',1)[-1].lower() if isinstance(value,str) else ''
        return read(rawpaths[key]) if key in rawpaths else {}
    bundles={};details={}
    for i in items:
        prefix=i['id'][:2]
        if prefix not in bundles:bundles[prefix]=json.loads((base/f'detail-{prefix}.json').read_text())
        details[i['id']]=bundles[prefix][i['id']]
    result={};by_id={i['id']:i for i in items}
    for i in items:
        d=details[i['id']];raw=read(records/d['source']);components=[c for c in raw.get('Components',[]) if isinstance(c,dict)];metrics={};sources={}
        def metric(label,value,unit,source):
            if isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) and value>=0:metrics[label]=dict(value=value,unit=unit);sources[label]=source
        for c in components:
            if c.get('_Type_')=='SCItemShieldGeneratorParams':
                for field,label,unit in [('MaxShieldHealth','Shield capacity','HP'),('MaxShieldRegen','Shield regeneration','HP/s'),('DownedRegenDelay','Downed regen delay','s'),('DamagedRegenDelay','Damaged regen delay','s')]:metric(label,c.get(field),unit,d['source']+'#'+field)
        weapon=next((c for c in components if c.get('_Type_')=='SCItemWeaponComponentParams'),None)
        ammo=next((c for c in components if c.get('_Type_')=='SAmmoContainerComponentParams'),{})
        if weapon:
            a=reference(ammo.get('ammoParamsRecord'));projectile=a.get('projectileParams',{});damage=projectile.get('damage',{}) if isinstance(projectile,dict) else {}
            actions=weapon.get('fireActions',[])
            # Only a simple one-entry looping fire sequence is modeled. Burst/beam/salvage are not guessed.
            mode=actions[0] if len(actions)==1 else {}
            entries=mode.get('sequenceEntries',[])
            action=entries[0].get('weaponAction',{}) if entries else {}
            simple=bool(entries) and all(e.get('unit')=='RPM' and e.get('delay')==action.get('fireRate') and e.get('weaponAction',{}).get('_Type_')=='SWeaponActionFireSingleParams' and e.get('weaponAction',{}).get('fireRate')==action.get('fireRate') and {k:e.get('weaponAction',{}).get('launchParams',{}).get(k) for k in ('pelletCount','damageMultiplier','projectileType')}=={k:action.get('launchParams',{}).get(k) for k in ('pelletCount','damageMultiplier','projectileType')} for e in entries)
            if mode.get('mode')=='Looping' and simple and action.get('fireRate',0)>0:
                launch=action.get('launchParams',{});rate=action['fireRate'];sequence_rate=entries[0].get('delay')
                if sequence_rate==rate and launch.get('projectileType')=='Primary':
                    pellets=launch.get('pelletCount',1);mult=launch.get('damageMultiplier',1)
                    physical=damage.get('DamagePhysical',0)*pellets*mult;energy=damage.get('DamageEnergy',0)*pellets*mult;distortion=damage.get('DamageDistortion',0)*pellets*mult
                    metric('Physical burst DPS',physical*rate/60,'HP/s',d['source']+'#fireActions[0] + '+str(ammo.get('ammoParamsRecord')))
                    metric('Energy burst DPS',energy*rate/60,'HP/s',d['source']+'#fireActions[0] + ammo.damage')
                    metric('Distortion burst DPS',distortion*rate/60,'units/s',d['source']+'#fireActions[0] + ammo.damage')
                    metric('Fire rate',rate,'RPM',d['source']+'#fireActions[0].sequenceEntries[0].weaponAction.fireRate')
                    metric('Projectile speed',a.get('speed'),'m/s',str(ammo.get('ammoParamsRecord'))+'#speed')
                    if a.get('speed',0)>0 and a.get('lifetime',0)>0:metric('Projectile travel ceiling',a['speed']*a['lifetime'],'m',str(ammo.get('ammoParamsRecord'))+'#speed × lifetime')
        if i['category'] in ('Ships','Vehicles'):
            for slot in d['loadout']:
                refid=slot.get('itemId')
                target=details.get(refid)
                if not target:continue
                r=read(records/target['source'])
                for n in nodes(r.get('Components',[])):
                    if n.get('_Type_')=='IFCSParams':
                        for field,label in [('scmSpeed','SCM speed'),('boostSpeedForward','Forward boost speed'),('boostSpeedBackward','Reverse boost speed'),('maxSpeed','Navigation speed')]:metric(label,n.get(field),'m/s',target['source']+'#IFCSParams.'+field)
        if metrics:result[i['id']]=dict(metrics=metrics,sources=sources)
    # Stock totals are unmodified installed-component totals, not sustained combat performance.
    for i in items:
        if i['category'] not in ('Ships','Vehicles'):continue
        row=result.setdefault(i['id'],dict(metrics={},sources={}))
        slots=details[i['id']]['loadout']
        guns=[s for s in slots if by_id.get(s.get('itemId'),{}).get('type')=='WeaponGun']
        row['coverage']=dict(stockGunMounts=len(guns),modeledGunMounts=sum('Fire rate' in result.get(s['itemId'],{}).get('metrics',{}) for s in guns))
        for source,target,unit in [('Physical burst DPS','Stock physical burst DPS','HP/s'),('Energy burst DPS','Stock energy burst DPS','HP/s'),('Shield capacity','Stock shield capacity','HP')]:
            values=[result[s['itemId']]['metrics'][source]['value'] for s in slots if s.get('itemId') in result and source in result[s['itemId']]['metrics']]
            target='Resolved '+target.lower()
            if values:row['metrics'][target]=dict(value=sum(values),unit=unit);row['sources'][target]='Sum of supported, resolved stock component metrics; may be partial. Includes all resolved mounts, not pilot-only damage.'
    stamp=hashlib.sha256((str(index['build'])+str(base)+json.dumps(result,sort_keys=True)).encode()).hexdigest()[:16]
    dest=ROOT/'public/game-assets/v3'/stamp;dest.mkdir(parents=True,exist_ok=True)
    payload=dict(build=index['build'],catalogBase='/'+base.relative_to(ROOT/'public').as_posix()+'/',extracted=time.time(),schema=1,records=result)
    (dest/'performance.json').write_text(json.dumps(payload,separators=(',',':'),allow_nan=False))
    pointer=ROOT/'public/v3-data.json';temp=pointer.with_suffix('.tmp');temp.write_text(json.dumps(dict(url=f'/game-assets/v3/{stamp}/performance.json',build=index['build'],catalogBase=payload['catalogBase'])));temp.replace(pointer)
    print('Published V3 performance records:',len(result));return payload
if __name__=='__main__':
    pointer=json.loads((ROOT/'public/v2-catalog.json').read_text());build(ROOT/'storage/v2-records',ROOT/'public'/pointer['base'].lstrip('/'))
