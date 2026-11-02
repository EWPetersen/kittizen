import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StarMap,LOCATION_FOCUS_PULLBACK,secondaryLandmark,labelPriority} from '../public/map.js';
import {globePixels,inverseRotate} from '../public/sphere.js';
import {positionOnRoute} from '../public/route.js';
import {modelFaces,MapModels} from '../public/models.js';
import {stellarRadius,stellarFocusSpan,starPixels} from '../public/stars.js';
import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url),'utf8'));
globalThis.ResizeObserver=class{observe(){}};globalThis.requestAnimationFrame=()=>{};globalThis.devicePixelRatio=1;
globalThis.Image=class{};
globalThis.document={querySelector:()=>({textContent:''})};
function fixture(){const events={},ctx=new Proxy({measureText:t=>({width:t.length*6}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({width:900,height:800,left:0,top:0}),addEventListener:(k,v)=>events[k]=v,setPointerCapture(){}};const map=new StarMap(canvas,catalog.bodies,()=>{},()=>{});map.systems=catalog.systems;map.setSystem('stanton');map.draw();return {map,events};}
test('Stanton default puts microTech upper right and restores after orbit',()=>{const {map}=fixture(),mt=catalog.bodies.find(b=>b.name==='microTech');let p=map.project(mt.position);assert.ok(p[0]>map.w/2);assert.ok(p[1]<map.h/2);map.yaw=2;map.pitch=1;map.home();map.draw();p=map.project(mt.position);assert.ok(p[0]>map.w/2&&p[1]<map.h/2);});
test('each system renders only its own physical bodies',()=>{const {map}=fixture();for(const id of ['stanton','pyro','nyx']){map.setSystem(id);map.draw();assert.ok(map.hits.length);assert.ok(map.hits.every(h=>!h.body||h.body.system===id));}});
test('universe has three distinct system discs and no physical-body mixture',()=>{const {map}=fixture();map.setSystem('universe');map.draw();assert.equal(map.hits.length,3);assert.deepEqual(new Set(map.hits.map(h=>h.body.id)),new Set(['stanton','pyro','nyx']));assert.ok(map.hits.every(h=>h.body.kind==='system'));assert.equal(new Set(map.hits.map(h=>h.x+':'+h.y)).size,3);});
test('default universe places Stanton in the lower right without flipping the local system map',()=>{const {map}=fixture();map.setSystem('universe');map.draw();const stanton=map.hits.find(h=>h.body.id==='stanton');assert.ok(stanton.x>map.w/2&&stanton.y>map.h/2);map.setSystem('stanton');const mt=map.byId.get(catalog.bodies.find(b=>b.name==='microTech').id),p=map.project(mt.position);assert.ok(p[0]>map.w/2&&p[1]<map.h/2);});

test('short landscape universe keeps system discs separate and above the touch toolbar',()=>{
 const {map}=fixture();map.canvas.getBoundingClientRect=()=>({width:844,height:278,left:0,top:0});map.setSystem('universe');map.draw();
 for(const hit of map.hits){assert.ok(hit.y+(hit.r-15)*.7+47<278-82);for(const other of map.hits)if(other!==hit)assert.ok(Math.hypot(hit.x-other.x,hit.y-other.y)>hit.r+other.r);}
});
test('zooming out returns to universe',()=>{const {map}=fixture();map.zoom(.1);assert.equal(map.system,'universe');});
test('double-click an available gate travels to its destination',()=>{const {map,events}=fixture();const gate=catalog.bodies.find(b=>b.kind==='gateway'&&b.system==='stanton'&&b.destinationSystem==='pyro');map.center=[...gate.position];map.span=1e6;map.draw();const hit=map.hits.find(h=>h.body?.id===gate.id);assert.ok(hit);events.dblclick({clientX:hit.x,clientY:hit.y});assert.equal(map.system,'pyro');});
test('globe inverse rotation preserves game quaternion orientation',()=>{const p=inverseRotate([0,0,0,1],[1,2,3]);assert.deepEqual(p,[-1,-2,3]);});
test('jump gate delegates to transition handler without changing system prematurely',()=>{
 const {map,events}=fixture();const gate=catalog.bodies.find(b=>b.kind==='gateway'&&b.system==='stanton'&&b.destinationSystem==='pyro');
 map.center=[...gate.position];map.span=1e6;map.draw();const hit=map.hits.find(h=>h.body?.id===gate.id);let destination;
 map.onJump=id=>destination=id;events.dblclick({clientX:hit.x,clientY:hit.y});assert.equal(destination,'pyro');assert.equal(map.system,'stanton');
});

test('every jump portal focuses its actual game coordinate without loading the generic marker mesh',()=>{
 const {map}=fixture();map.mapModels.get=b=>{assert.notEqual(b.kind,'gateway');return null;};
 for(const gate of catalog.bodies.filter(b=>b.kind==='gateway')){
  map.setSystem(gate.system);map.focus(gate);map.draw();assert.deepEqual(map.center,gate.position);assert.equal(map.span,20000);
  const hit=map.hits.find(h=>!h.box&&h.body?.id===gate.id);assert.ok(hit,gate.name);assert.equal(hit.x,map.w/2);assert.equal(hit.y,map.h/2);
  assert.ok(hit.r>Math.min(map.w,map.h)*.35&&hit.r<Math.min(map.w,map.h)*.4);
 }
});
test('actual station models are bounded, shared and rotate with the map camera',()=>{
 const bodies=catalog.bodies.filter(b=>b.model);assert.ok(bodies.some(b=>b.kind==='comm'));assert.ok(bodies.some(b=>b.name==='Port Tressler'));
 const paths=new Set(bodies.map(b=>b.model));assert.ok(paths.size<bodies.length);
 for(const path of paths){const mesh=JSON.parse(fs.readFileSync(new URL('../public/'+path,import.meta.url),'utf8'));assert.ok(mesh.triangles.length>0&&mesh.triangles.length<10000);const a=modelFaces(mesh,[1,0,0,0],0,-.7),b=modelFaces(mesh,[1,0,0,0],1,-.7);assert.notDeepEqual(a[0].points,b[0].points);assert.ok(a.every(f=>Number.isFinite(f.depth)&&f.points.every(p=>p.every(Number.isFinite))));}
});
test('model requests are shared and a failed model keeps the fallback without retry loops',async()=>{
 let requests=0,invalidations=0;const models=new MapModels(()=>invalidations++,async()=>{requests++;throw Error('offline');});
 const body={model:'shared.json'};assert.equal(models.get(body,0,0),null);assert.equal(models.get(body,1,0),null);await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);assert.equal(invalidations,1);assert.ok(models.failures.has('shared.json'));assert.equal(models.get(body,0,0),null);assert.equal(requests,1);
});
test('globe preserves the original texture colours and round mask',()=>{const texture={width:8,height:4,data:new Uint8ClampedArray(8*4*4)};for(let i=0;i<32;i++){texture.data[i*4]=255;texture.data[i*4+3]=255;}const image=globePixels(texture,[1,0,0,0],0,0,16);assert.equal(image[3],0);const at=(8*16+8)*4;assert.ok(image[at]>0);assert.equal(image[at+1],0);assert.equal(image[at+2],0);assert.equal(image[at+3],255);});
test('route fraction never interpolates between different coordinate frames',()=>{const plan={totalDistance:20,legs:[{kind:'quantum',system:'stanton',offset:0,distance:10,start:[0,0,0],end:[10,0,0]},{kind:'jump',system:'stanton',toSystem:'pyro',offset:10,distance:0,start:[10,0,0],end:[10000,0,0]},{kind:'quantum',system:'pyro',offset:10,distance:10,start:[0,0,0],end:[0,10,0]}]};assert.deepEqual(positionOnRoute(plan,.75).position,[0,5,0]);assert.equal(positionOnRoute(plan,.75).system,'pyro');assert.equal(positionOnRoute(plan,NaN),null);});
test('ordinary drag rotates the globe instead of translating its center',()=>{const {map,events}=fixture();map.focus(catalog.bodies.find(b=>b.name==='microTech'));const center=[...map.center],yaw=map.yaw;events.pointerdown({pointerId:1,button:0,clientX:300,clientY:300});events.pointermove({pointerId:1,clientX:380,clientY:320});events.pointerup({pointerId:1,button:0,clientX:380,clientY:320});assert.notEqual(map.yaw,yaw);assert.deepEqual(map.center,center);});
test('wheel can enter a system from universe and focus a planet',()=>{const {map,events}=fixture();map.setSystem('universe');map.draw();let hit=map.hits.find(h=>h.body.id==='stanton');events.wheel({deltaY:-1000,clientX:hit.x,clientY:hit.y,preventDefault(){}});assert.equal(map.system,'stanton');map.draw();hit=map.hits.find(h=>h.body?.name==='microTech');events.wheel({deltaY:-300,clientX:hit.x,clientY:hit.y,preventDefault(){}});assert.ok(map.span<map.systemSpan);assert.equal(map.view.level,'orbits');assert.equal(map.selected,hit.body.id);});
test('double right-click steps out one level and preserves the route',()=>{
 const {map,events}=fixture(),station=catalog.bodies.find(b=>b.name==='Seraphim Station'),route={legs:[],systems:['stanton']};map.routePlan=route;map.focus(station);
 let time=100;const back=()=>{for(const stamp of [time,time+180]){events.pointerdown({pointerId:1,button:2,clientX:100,clientY:100});events.pointerup({pointerId:1,button:2,timeStamp:stamp,clientX:100,clientY:100});}time+=800;};
 for(const expected of ['body','orbits','system','universe']){back();assert.equal(map.view.level,expected);assert.equal(map.routePlan,route);}
 back();assert.equal(map.view.level,'universe');
});

test('right-drag does not accidentally trigger a reset',()=>{const {map,events}=fixture();const before=[...map.center];for(const time of [100,300]){events.pointerdown({pointerId:1,button:2,clientX:100,clientY:100});events.pointermove({pointerId:1,clientX:160,clientY:130});events.pointerup({pointerId:1,button:2,timeStamp:time,clientX:160,clientY:130});}assert.notDeepEqual(map.center,before);assert.equal(map.rightTap,null);});
test('focusing a POI faces the actual location and hides the opposite hemisphere',()=>{const {map}=fixture();const poi=catalog.bodies.find(b=>b.name==='New Babbage'),parent=catalog.bodies.find(b=>b.id===poi.parent);map.focus(poi);map.draw();const p=map.project(poi.position);assert.ok(Math.abs(p[0]-map.w/2)<.01&&Math.abs(p[1]-map.h/2)<.01);assert.equal(map.occluded(poi.position,parent),false);const opposite=poi.position.map((v,i)=>parent.position[i]*2-v);assert.equal(map.occluded(opposite,parent),true);});
test('activity overlay allows right-drag panning in 2D and 3D',()=>{for(const pitch of [-.72,-Math.PI/2]){const {map,events}=fixture();map.pitch=pitch;map.draw();const point=[...map.center],before=map.project(point),yaw=map.yaw;events.pointerdown({pointerId:1,button:2,clientX:100,clientY:100});events.pointermove({pointerId:1,buttons:2,clientX:150,clientY:120});events.pointerup({pointerId:1,button:2,clientX:150,clientY:120});const after=map.project(point);assert.ok(Math.abs(after[0]-before[0]-50)<.001);assert.ok(Math.abs(after[1]-before[1]-20)<.001);assert.equal(map.yaw,yaw);assert.equal(map.pitch,pitch);assert.equal(map.rightTap,null);}});

test('every planet and moon has six selectable, focusable OM markers',()=>{
 const {map}=fixture();for(const parent of catalog.bodies.filter(b=>['planet','moon'].includes(b.kind))){
  const markers=catalog.bodies.filter(b=>b.kind==='om'&&b.parent===parent.id);assert.equal(markers.length,6,parent.name);
  for(const marker of markers){map.setSystem(parent.system);map.focus(marker);map.draw();assert.deepEqual(map.center,marker.position);assert.ok(map.hits.some(h=>h.body?.id===marker.id),marker.name);}
 }
});
test('focusing a moon centers the moon rather than its planet',()=>{
 const {map}=fixture();for(const body of catalog.bodies.filter(b=>b.kind==='moon')){map.setSystem(body.system);map.focus(body);assert.deepEqual(map.center,body.position);assert.equal(map.span,body.radius*2.8);}
});
test('labels remain bounded and non-overlapping over zoom and rotation sweeps',()=>{
 const {map}=fixture();for(const system of ['stanton','pyro','nyx']){
  map.setSystem(system);const planet=catalog.bodies.find(b=>b.system===system&&b.kind==='planet');map.center=[...planet.position];
  for(const span of [map.systemSpan,planet.radius*30,planet.radius*8,planet.radius*2.8])for(let i=0;i<12;i++){
   map.span=span;map.yaw=i*Math.PI/6;map.pitch=-1.3+i*.2;map.draw();const boxes=map.hits.filter(h=>h.box).map(h=>h.box);
   for(const a of boxes){assert.ok(a.x>=8&&a.y>=8&&a.x+a.w<=map.w-8&&a.y+a.h<=map.h-8);for(const b of boxes)if(a!==b)assert.ok(a.x+a.w<=b.x||a.x>=b.x+b.w||a.y+a.h<=b.y||a.y>=b.y+b.h);}
   assert.ok(boxes.some(b=>b.item.id===planet.id),system+' planet label must survive POI density');
  }
 }
});
test('surface activity focuses the POI hemisphere and its exact marker',()=>{
 const {map}=fixture();for(const name of ['New Babbage','Lorville','Jumptown']){
  const poi=catalog.bodies.find(b=>b.name===name);const report={locationId:poi.id,position:poi.position,system:poi.system};map.setSystem('universe');assert.ok(map.focusReport(report));map.draw();assert.equal(map.system,poi.system);assert.equal(map.selected,poi.id);assert.deepEqual(map.marker,poi.position);const [x,y]=map.project(poi.position);assert.ok(Math.abs(x-map.w/2)<.01&&Math.abs(y-map.h/2)<.01);assert.ok(!map.occluded(poi.position,map.surfaceParent(poi)));
 }
 assert.equal(map.focusReport({position:[NaN,0,0]}),false);
});

test('system overviews keep celestial bodies and gates ahead of station detail',()=>{
 const {map}=fixture();for(const system of ['stanton','pyro','nyx']){
  map.setSystem(system);map.draw();const markers=map.hits.filter(h=>h.body&&!h.box);
  assert.ok(markers.some(h=>h.body.kind==='planet'));
  if(system==='pyro'){assert.ok(markers.some(h=>h.body.name==='Pyro V'));assert.ok(!markers.some(h=>h.body.name==='Pyro IV'),'overlapping child planet is grouped under Pyro V');assert.equal(catalog.bodies.find(b=>b.name==='Pyro IV').kind,'planet');}
  assert.ok(markers.every(h=>h.body.mapImportance==='primary'||secondaryLandmark(h.body)||['planet','star','gateway','body','lagrange'].includes(h.body.kind)),system);
 }
});

test('Stanton overview labels reserve space for planets and gates, then Lagrange points',()=>{
 const {map}=fixture();map.draw();const labels=map.hits.filter(h=>h.box).map(h=>h.body);
 for(const body of catalog.bodies.filter(b=>b.system==='stanton'&&['planet','gateway'].includes(b.kind)))assert.ok(labels.some(b=>b.id===body.id),body.name);
 assert.ok(labels.some(b=>b.kind==='lagrange'),'free space contains Lagrange labels: '+map.hits.filter(h=>!h.box).map(h=>h.body.name).join(', '));
 assert.ok(!labels.some(b=>b.name==='Orison'||b.name==='Seraphim Station'),'planet-local hubs wait for a local view');
 const order=map.hits.filter(h=>h.box).map(h=>h.box.item.priority);assert.deepEqual(order,[...order].sort((a,b)=>a-b));
});

test('Crusader reveals its landing zone and orbital station before other POIs',()=>{
 const {map}=fixture(),crusader=catalog.bodies.find(b=>b.name==='Crusader'),orison=catalog.bodies.find(b=>b.name==='Orison');
 map.focus(orison);map.span=crusader.radius*12;map.draw();
 const labels=map.hits.filter(h=>h.box).map(h=>h.box.item);
 for(const name of ['Crusader','Orison','Seraphim Station'])assert.ok(labels.some(b=>b.body.name===name),name);
 const hubs=labels.filter(b=>['Orison','Seraphim Station'].includes(b.body.name));
 for(const poi of labels.filter(b=>b.body.kind==='poi'&&b.body.mapImportance!=='primary'))assert.ok(hubs.every(h=>h.priority<poi.priority));
});

test('entering Crusader initially faces Orison and keeps Seraphim labelled',()=>{
 const {map}=fixture(),crusader=catalog.bodies.find(b=>b.name==='Crusader');map.focus(crusader);map.draw();
 const labels=map.hits.filter(h=>h.box).map(h=>h.body.name);
 for(const name of ['Crusader','Orison','Seraphim Station'])assert.ok(labels.includes(name),name);
});

test('Pyro and Nyx place primary hubs after planets and gates and before secondary labels',()=>{
 const {map}=fixture();for(const system of ['pyro','nyx']){
  map.setSystem(system);map.draw();const labels=map.hits.filter(h=>h.box).map(h=>h.box.item);
  for(const hub of catalog.bodies.filter(b=>b.system===system&&b.mapImportance==='primary'))assert.ok(labels.some(b=>b.id===hub.id),hub.name);
  const main=labels.filter(b=>b.body.kind==='planet'||b.body.kind==='gateway');const hubs=labels.filter(b=>b.body.mapImportance==='primary');
  assert.ok(main.every(a=>hubs.every(b=>a.priority<b.priority)));
  assert.ok(labels.filter(b=>b.body.kind==='lagrange').every(a=>hubs.every(b=>b.priority<a.priority)));
 }
});

test('phone system framing includes distant Nyx service stations and keeps core labels',()=>{
 const {map}=fixture();map.canvas.getBoundingClientRect=()=>({width:390,height:680,left:0,top:0});
 for(const system of ['stanton','pyro','nyx']){
  map.setSystem(system);map.draw();const labels=map.hits.filter(h=>h.box).map(h=>h.body.id);
  for(const body of catalog.bodies.filter(b=>b.system===system&&(['planet','gateway'].includes(b.kind)&&map.byId.get(b.parent)?.kind!=='planet'||system!=='stanton'&&b.mapImportance==='primary'))){
   const [x,y]=map.project(body.position);assert.ok(x>=0&&x<=map.w&&y>=0&&y<=map.h,body.name+' in phone frame');
   assert.ok(labels.includes(body.id),body.name+' phone label');
  }
 }
});

test('the Pyro IV/V system target opens Pyro V local orbits, where IV is selectable',()=>{
 const {map}=fixture(),parent=catalog.bodies.find(b=>b.name==='Pyro V'),child=catalog.bodies.find(b=>b.name==='Pyro IV');map.setSystem('pyro');map.draw();map.onSelect=b=>map.focus(b);
 const [x,y]=map.project(child.position);map.click({clientX:x,clientY:y});assert.equal(map.view.level,'orbits');assert.equal(map.view.bodyId,parent.id);map.draw();
 const boxes=map.hits.filter(h=>h.box).map(h=>h.body.id);assert.ok(boxes.indexOf(parent.id)>=0&&boxes.indexOf(parent.id)<boxes.indexOf(child.id));
 const hit=map.hits.find(h=>!h.box&&h.body?.id===child.id);assert.ok(hit);map.click({clientX:hit.x,clientY:hit.y});assert.equal(map.view.level,'body');assert.equal(map.view.bodyId,child.id);
 map.stepOut();assert.equal(map.view.level,'orbits');assert.equal(map.view.bodyId,parent.id);
});

test('wheel focus does not skip local orbits when reduced motion makes focus immediate',()=>{
 const {map,events}=fixture();globalThis.matchMedia=()=>({matches:true});map.onSelect=(b,focus=true)=>{if(focus)map.focus(b);};
 try{map.draw();const hit=map.hits.find(h=>!h.box&&h.body?.name==='microTech');events.wheel({deltaY:-300,clientX:hit.x,clientY:hit.y,preventDefault(){}});assert.equal(map.view.level,'orbits');assert.equal(map.byId.get(map.selected).name,'microTech');}finally{delete globalThis.matchMedia;}
});

test('planet selection opens local moons before a fitted body close-up',()=>{
 const {map}=fixture();for(const planet of catalog.bodies.filter(b=>b.kind==='planet')){
  map.setSystem(planet.system);map.focus(planet);map.draw();assert.equal(map.view.level,'orbits',planet.name);
  for(const moon of catalog.bodies.filter(b=>b.parent===planet.id&&b.kind==='moon')){
   const [x,y]=map.project(moon.position);assert.ok(x>0&&x<map.w&&y>0&&y<map.h,moon.name+' in orbital frame');assert.ok(map.hits.some(h=>h.body?.id===moon.id),moon.name+' marker');
  }
  map.focus(planet);map.draw();assert.equal(map.view.level,'body');assert.ok(planet.radius*map.scale*2<Math.min(map.w,map.h)*.8);
 }
});

test('Klescher uses a compact native surface component anchored to Aberdeen',()=>{
 const b=catalog.bodies.find(b=>b.name==='Klescher Rehabilitation Facility'),{map}=fixture();assert.equal(map.byId.get(b.parent).name,'Aberdeen');assert.equal(b.modelRole,'surface');assert.equal(b.modelStyle,'prison');assert.ok(b.modelSource.includes('prison_structure_hole_a'));
 const mesh=JSON.parse(fs.readFileSync(new URL('../public/'+b.model,import.meta.url),'utf8'));assert.ok(mesh.vertices.length<2000&&mesh.triangles.length<1500);
 map.focus(b);map.draw();assert.deepEqual(map.center,b.position);assert.ok(map.hits.some(h=>h.body?.id===b.id));
 map.stepOut();assert.equal(map.view.level,'body');assert.equal(map.selected,b.parent);map.stepOut();assert.equal(map.view.level,'orbits');assert.equal(map.byId.get(map.selected).name,'Hurston');
});

test('animated globe draws use motion resolution and refine after settling',()=>{
 const {map}=fixture(),body=catalog.bodies.find(b=>b.name==='Crusader');globalThis.matchMedia=()=>({matches:false});const sizes=[];map.globeTextures.get=(b,y,p,size)=>{sizes.push(size);return null;};
 try{map.focus(body,{close:true});const move=map.transition;map.advanceCamera(move.time+move.duration*.9);map.draw();assert.ok(sizes.every(size=>size<=144));sizes.length=0;map.advanceCamera(move.time+move.duration);map.draw();assert.ok(sizes.includes(512));}finally{delete globalThis.matchMedia;}
});

test('searching another planet from a close POI starts with its local orbits',()=>{
 const {map}=fixture();map.focus(catalog.bodies.find(b=>b.name==='Klescher Rehabilitation Facility'));map.focus(catalog.bodies.find(b=>b.name==='microTech'));assert.equal(map.view.level,'orbits');
});

test('local orbits keep city/station labels without facility art covering the planet',()=>{
 const {map}=fixture(),planet=catalog.bodies.find(b=>b.name==='microTech'),facilities=['New Babbage','Port Tressler'].map(name=>catalog.bodies.find(b=>b.name===name)),requested=[];
 map.mapModels.get=b=>{requested.push(b.id);return null;};map.focus(planet);map.draw();
 for(const b of facilities){assert.ok(map.hits.some(h=>h.box&&h.body?.id===b.id),b.name+' label');assert.ok(!map.hits.some(h=>!h.box&&h.body?.id===b.id),b.name+' has no invisible glyph target');assert.ok(!requested.includes(b.id),b.name+' art deferred');}
 map.focus(planet);map.draw();assert.ok(facilities.some(b=>requested.includes(b.id)),'facility art becomes available in the body view');
});

test('rapid Back during a focus animation cannot restore the abandoned close-up',()=>{
 const {map}=fixture(),station=catalog.bodies.find(b=>b.name==='Seraphim Station');globalThis.matchMedia=()=>({matches:false});
 try{map.focus(station);map.stepOut();map.stepOut();const move=map.transition;map.advanceCamera(move.time+move.duration);assert.equal(map.view.level,'orbits');assert.equal(map.byId.get(map.selected).name,'Crusader');assert.equal(map.span,map.localSpan(map.byId.get(map.selected)));}finally{delete globalThis.matchMedia;}
});

test('a searched station remains visible at overview scale and local detail is spaced',()=>{
 const {map}=fixture();map.setSystem('pyro');
 const station=catalog.bodies.find(b=>b.system==='pyro'&&b.kind==='station'&&catalog.bodies.find(p=>p.id===b.parent)?.kind==='lagrange');
 map.selected=station.id;map.center=[...station.position];map.draw();assert.ok(map.hits.some(h=>h.body?.id===station.id));
 map.focus(catalog.bodies.find(b=>b.name==='microTech'));map.draw();
 const secondary=map.hits.filter(h=>h.body&&!h.box&&!['planet','moon','star','body','gateway'].includes(h.body.kind)&&h.body.id!==map.selected);
 for(let i=0;i<secondary.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(secondary[i].x-secondary[j].x,secondary[i].y-secondary[j].y)>=30);
 const labels=map.hits.filter(h=>h.box&&!h.box.item.major&&!h.box.item.selected&&!h.box.item.important);assert.ok(labels.length<=6);
});

test('a game navigation symbol does not turn a surface POI into a station close-up',()=>{
 const {map}=fixture();const poi=catalog.bodies.find(b=>b.modelRole==='symbol'&&map.surfaceParent(b));
 assert.ok(poi);const parent=map.surfaceParent(poi);map.setSystem(poi.system);map.focus(poi);
 assert.equal(map.span,Math.max(25000,Math.min(2.5e6,parent.radius*.1))*LOCATION_FOCUS_PULLBACK);assert.deepEqual(map.center,poi.position);
});

test('all extracted stars focus to a close-up while retaining their game material',()=>{
 const {map}=fixture();for(const star of catalog.bodies.filter(b=>b.kind==='star')){
  assert.ok(star.starAppearance.source.startsWith('materials/stellar_classes/'));
  map.setSystem(star.system);map.focus(star);map.draw();assert.equal(map.span,stellarFocusSpan(catalog.bodies));
  assert.deepEqual(map.center,star.position);const hit=map.hits.find(h=>h.body?.id===star.id&&!h.box);
  assert.ok(Math.abs(hit.r-6-Math.min(map.w,map.h)*stellarRadius(star)/stellarFocusSpan(catalog.bodies))<.01);assert.ok(map.hits.some(h=>h.body?.id===star.id&&h.box));
 }
 const pixels=starPixels([1,.49,.17],32),at=(16*32+16)*4;
 assert.equal(pixels[3],0);assert.equal(pixels[at+3],255);assert.ok(pixels[at]>pixels[at+1]);
 assert.ok(pixels[at+2]>80,'self-lit surface must not receive a dark planet terminator');
});

test('star rendering uses distinct world radii and colours, with a shared comparison zoom',()=>{
 const stars=catalog.bodies.filter(b=>b.kind==='star');
 assert.equal(new Set(stars.map(b=>b.starAppearance.source)).size,3);
 assert.equal(new Set(stars.map(b=>stellarRadius(b))).size,3);
 const nyx=stars.find(b=>b.system==='nyx'),pyro=stars.find(b=>b.system==='pyro'),stanton=stars.find(b=>b.system==='stanton');
 assert.equal(stellarRadius(pyro),570720000);assert.equal(stellarRadius(stanton),696000000);assert.equal(stellarRadius(nyx),765600000);
 assert.ok(nyx.starAppearance.texture);assert.ok(fs.existsSync(new URL('../public/'+nyx.starAppearance.texture,import.meta.url)));
 const colors=stars.map(b=>{const p=starPixels(b.starAppearance.color,32);return [...p.slice((16*32+16)*4,(16*32+16)*4+3)].join(':');});assert.equal(new Set(colors).size,3);
});

test('orbital station focus retains its planet and manual close-ups never hide it',()=>{
 const {map}=fixture();map.mapModels.get=()=>({});for(const name of ['Seraphim Station','Port Tressler','Everus Harbor','Baijini Point']){
  const station=catalog.bodies.find(b=>b.name===name),parent=map.surfaceParent(station);
  map.setSystem(station.system);map.focus(station);map.draw();
  assert.equal(map.span,30000,name);assert.deepEqual(map.center,station.position);assert.ok(map.hits.some(h=>h.body?.id===parent.id&&!h.box),name+' parent');
  assert.ok(map.hits.find(h=>h.body?.id===station.id&&!h.box).r>=14,name+' selectable model with wider context');
  assert.ok(map.hits.some(h=>h.body?.id===station.id&&!h.box),name+' station');
  assert.ok(!map.occluded(station.position,parent),name+' near side');
  map.center=[...station.position];map.span=20000;map.draw();
  assert.ok(map.hits.some(h=>h.body?.id===parent.id&&!h.box),name+' close-up parent');
 }
});

test('Yela ring contains Grim HEX at game-derived bounds and remains locally framed',()=>{
 const {map}=fixture(),ring=catalog.belts.find(b=>b.parent),yela=catalog.bodies.find(b=>b.name==='Yela'),grim=catalog.bodies.find(b=>b.name==='Grim HEX');
 assert.equal(ring.parent,yela.id);assert.deepEqual(ring.center,yela.position);
 assert.deepEqual([ring.innerRadius,ring.outerRadius,ring.depth],[482000,782000,20000]);
 const radial=Math.hypot(grim.position[0]-ring.center[0],grim.position[1]-ring.center[1]);
 assert.ok(radial>ring.innerRadius&&radial<ring.outerRadius);assert.ok(Math.abs(grim.position[2]-ring.center[2])<ring.depth/2);
 map.belts=catalog.belts;map.setSystem('stanton');map.focusSystem(yela);map.draw();
 assert.ok(map.span>ring.outerRadius*2);assert.ok(map.span<ring.outerRadius*5);
});

test('station focus leaves more surrounding context on desktop and phone without losing the model',()=>{
 const {map}=fixture();
 for(const [width,height] of [[1280,642],[390,680]])for(const name of ['Seraphim Station','Port Tressler','Everus Harbor','Baijini Point']){
  map.canvas.getBoundingClientRect=()=>({width,height,left:0,top:0});const station=catalog.bodies.find(b=>b.name===name);
  map.setSystem(station.system);map.focus(station);
  const mesh=JSON.parse(fs.readFileSync(new URL('../public/'+station.model,import.meta.url),'utf8'));
  const points=modelFaces(mesh,station.rotation,map.yaw,map.pitch).flatMap(f=>f.points);
  const radius=Math.max(...points.map(p=>Math.hypot(p[0],p[1])))*.875,extent=Math.max(...points.flatMap(p=>[Math.abs(p[0]),Math.abs(p[1])]))*.875;
  map.mapModels.get=()=>({meshRadius:radius,meshExtent:extent});map.draw();
  const hit=map.hits.find(h=>!h.box&&h.body?.id===station.id),spriteR=(hit.r-6)/radius,fill=spriteR*extent*2/Math.min(width,height);
  assert.equal(map.span,30000);assert.ok(fill>0&&fill<=.6,name+' widened framing at '+fill);
 }
});

test('viewport globe rendering keeps an enormous parent opaque just inside its limb',()=>{
 const texture={width:2,height:1,data:new Uint8ClampedArray([255,100,50,255,255,100,50,255])};
 const pixels=globePixels(texture,[1,0,0,0],0,0,32,{width:32,height:32,x:16,y:1000016,radius:1000000});
 assert.equal(pixels[(10*32+16)*4+3],0);assert.equal(pixels[(20*32+16)*4+3],255);
});

test('landing zones and gateways retain game references and Levski uses native asteroid geometry',()=>{
 for(const name of ['New Babbage','Lorville','Area18','Orison']){
  const b=catalog.bodies.find(b=>b.name===name);assert.equal(b.modelRole,'symbol');assert.ok(b.modelSource.endsWith('.cga'));assert.ok(b.artwork);assert.ok(fs.existsSync(new URL('../public/'+b.artwork,import.meta.url)));
 }
 for(const b of catalog.bodies.filter(b=>b.kind==='gateway')){assert.equal(b.modelRole,'symbol');assert.ok(b.modelSource.includes('general_icon_1_b'));}
 const levski=catalog.bodies.find(b=>b.name==='Levski'),grim=catalog.bodies.find(b=>b.name==='Grim HEX');
 assert.equal(levski.modelRole,'structure');assert.equal(levski.modelStyle,'asteroid');assert.ok(levski.modelSource.includes('angular_smooth_01_03400'));
 assert.ok(levski.modelNote.includes('schematic'));assert.equal(grim.modelStyle,'asteroid');assert.ok(grim.modelSource.includes('smap_station_grimhex'));
});

test('belt catalogue uses current game radii and renders as background without changing jump targets',()=>{
 const belts=catalog.belts;assert.equal(belts.length,4);const a=belts.find(b=>b.name==='Aaron Halo');
 assert.equal(a.innerRadius,19597600000);assert.equal(a.outerRadius,21392800000);assert.equal(a.depth,10000000);
 for(const [name,radius] of [['Keeger Belt',48000000000],['Glaciem Ring',15000001000]]){const b=belts.find(b=>b.name===name);assert.equal(b.innerRadius,radius);assert.equal(b.outerRadius,radius);assert.equal(b.radialWidthKnown,false);}
 const {map}=fixture();map.belts=belts;
 for(const id of ['stanton','nyx']){map.setSystem(id);map.draw();assert.ok(map.hits.filter(h=>h.body?.kind==='gateway').length);assert.ok(map.hits.every(h=>!h.body||h.body.kind!=='belt'));}
});

test('Pyro named station hubs survive system overview while asteroid bases stay local',()=>{
 const {map}=fixture();map.setSystem('pyro');map.draw();
 const hubs=catalog.bodies.filter(b=>b.system==='pyro'&&b.mapImportance==='primary');
 assert.deepEqual(new Set(hubs.map(b=>b.name)),new Set(['Ruin Station','Orbituary','Checkmate']));
 for(const name of ['Ruin Station','Orbituary','Checkmate']){
  const station=hubs.find(b=>b.name===name);assert.ok(station,name+' primary classification');
  assert.ok(map.hits.some(h=>h.body?.id===station.id&&!h.box),name+' overview marker');
 }
 assert.ok(hubs.every(b=>b.kind==='station'&&!/^(RAB-|RMB-|Cluster|PYAM-)/.test(b.name)));
 for(const station of hubs){map.focus(station);map.draw();assert.ok(map.hits.some(h=>h.body?.id===station.id),station.name+' focus');}
});

test('Nyx spawn destinations are primary while breaker stations remain secondary',()=>{
 const {map}=fixture();map.setSystem('nyx');map.draw();
 const primary=catalog.bodies.filter(b=>b.system==='nyx'&&b.mapImportance==='primary');
 assert.deepEqual(new Set(primary.map(b=>b.name)),new Set(['Levski',"People's Service Station Alpha","People's Service Station Delta","People's Service Station Theta","People's Service Station Lambda"]));
 for(const b of primary)assert.ok(map.hits.some(h=>h.body?.id===b.id&&!h.box),b.name+' overview marker');
 const secondary=catalog.bodies.filter(secondaryLandmark);assert.equal(secondary.length,8);
 for(const b of secondary){assert.ok(map.hits.some(h=>h.body?.id===b.id&&!h.box),b.name+' overview marker');assert.ok(labelPriority(b)>labelPriority(primary[0]));}
});
