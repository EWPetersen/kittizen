globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height})}};
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StarMap,layoutLabels,labelPriority,trackLabels} from '../public/map.js';
import {portalRim,portalRadius,animatePortal} from '../public/portals.js';
import {beltParticles} from '../public/belts.js';
globalThis.ResizeObserver=class{observe(){}};
let frames=[];globalThis.requestAnimationFrame=f=>frames.push(f);globalThis.devicePixelRatio=3;
const scaleLabel={textContent:''};globalThis.document={createElement:()=>({getContext:()=>({putImageData(){}})}),querySelector:()=>scaleLabel};
function fixture(){
 const events={};const context=new Proxy({measureText:t=>({width:t.length*6}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,p)=>p in o?o[p]:()=>{}});
 const canvas={width:0,height:0,getContext:()=>context,getBoundingClientRect:()=>({width:390,height:700,left:0,top:0}),addEventListener:(k,f)=>events[k]=f,setPointerCapture(){}};
 let selected=null,routeHit=null;const bodies=[{id:'a',name:'A',kind:'planet',radius:1000000,position:[1e10,0,0]},{id:'b',name:'B',kind:'planet',radius:1000000,position:[-1e10,0,0]}];
 const map=new StarMap(canvas,bodies,b=>selected=b,t=>routeHit=t);frames=[];map.pending=false;map.draw();return {map,canvas,events,bodies,get selected(){return selected},get routeHit(){return routeHit}};
}
test('DPR cap and no idle animation loop',()=>{let {map,canvas}=fixture();assert.equal(canvas.width,585);assert.equal(canvas.height,1050);map.invalidate();map.invalidate();assert.equal(frames.length,1);frames.shift()();assert.equal(frames.length,0);});

test('portal artwork stays bounded and changes smoothly without random texture work',()=>{
 for(const phase of [0,1,10000]){const rim=portalRim(phase);assert.equal(rim.length,97);assert.ok(rim.every(p=>p.every(Number.isFinite)&&Math.hypot(...p)>=.9&&Math.hypot(...p)<=1.1));assert.ok(Math.hypot(rim[0][0]-rim.at(-1)[0],rim[0][1]-rim.at(-1)[1])<1e-10);}
 assert.notDeepEqual(portalRim(0),portalRim(1));assert.deepEqual(portalRim(1),portalRim(1));
 assert.equal(portalRadius(1e12,390),8);assert.ok(portalRadius(20000,390)<390*.4);
});

test('portal motion runs only for a visible connected close-up and honours reduced motion',()=>{
 const active={selected:true,radius:150,visible:true,reducedMotion:false,dragging:false,connected:true};assert.equal(animatePortal(active),true);
 for(const patch of [{selected:false},{radius:8},{visible:false},{reducedMotion:true},{dragging:true},{connected:false}])assert.equal(animatePortal({...active,...patch}),false);
});

test('belt particles follow extracted radial bounds and preserve centreline-only data',()=>{
 const belt={center:[100,200,300],rotation:[1,0,0,0],innerRadius:10000,outerRadius:12000,depth:100};
 const particles=beltParticles(belt,300);assert.equal(beltParticles(belt,300),particles);
 for(const p of particles){const r=Math.hypot(p[0]-100,p[1]-200);assert.ok(r>=10000&&r<=12000);assert.ok(Math.abs(p[2]-300)<=50);}
 const line={...belt,innerRadius:15000,outerRadius:15000,depth:0};for(const p of beltParticles(line,50))assert.ok(Math.abs(Math.hypot(p[0]-100,p[1]-200)-15000)<1e-8);
});
test('camera origin retains local metre detail far from system origin',()=>{let {map}=fixture();map.center=[4e10,3e10,0];map.span=2e6;map.draw();let a=map.project(map.center),b=map.project([4e10+1000,3e10,0]);assert.equal(a[0],195);assert.ok(Math.abs(b[0]-a[0])>.1);});
test('zoom cannot leave supported extent',()=>{let {map}=fixture();map.zoom(1e30);assert.equal(map.span,500);map.zoom(1e-30);assert.equal(map.span,3e12);});
test('body selection and planet focus',()=>{let f=fixture(),p=f.map.project(f.bodies[0].position);f.map.click({clientX:p[0],clientY:p[1]});assert.equal(f.selected.id,'a');f.map.focus(f.bodies[0]);assert.deepEqual(f.map.center,f.bodies[0].position);assert.equal(f.map.span,8e6);f.map.focus(f.bodies[0]);assert.equal(f.map.span,2.8e6);});
test('route fit and tapping the middle returns halfway placement',()=>{let f=fixture();f.map.fitRoute(...f.bodies);f.map.draw();f.map.click({clientX:195,clientY:350});assert.ok(Math.abs(f.routeHit-.5)<1e-12);});
test('shift-drag pans without selecting a body',()=>{let f=fixture();f.events.pointerdown({pointerId:1,clientX:100,clientY:100});f.events.pointermove({pointerId:1,clientX:150,clientY:110,shiftKey:true});f.events.pointerup({pointerId:1,clientX:150,clientY:110});assert.notDeepEqual(f.map.center,[0,0,0]);assert.equal(f.selected,null);assert.equal(f.map.pointers.size,0);});
test('pinch zoom, cancellation, orbit pitch clamp',()=>{let f=fixture();f.events.pointerdown({pointerId:1,clientX:100,clientY:100});f.events.pointerdown({pointerId:2,clientX:200,clientY:100});let old=f.map.span;f.events.pointermove({pointerId:2,clientX:250,clientY:100});assert.ok(f.map.span<old);f.events.pointercancel({pointerId:2});f.events.pointermove({pointerId:1,clientX:110,clientY:10000,shiftKey:false});assert.equal(f.map.pitch,Math.PI/2-.01);f.events.pointercancel({pointerId:1});assert.equal(f.map.pointers.size,0);});
test('selected label renders even in crowded system view and reports draw',()=>{let f=fixture();f.map.reports=[{kind:'Pirates',created:Date.now()/1000,position:[0,0,0]}];f.map.selected='a';assert.doesNotThrow(()=>f.map.draw());assert.ok(f.map.hits.some(h=>h.report));});

test('focus animates without jumping, settles exactly and stops rendering',()=>{
 const {map,bodies}=fixture();globalThis.matchMedia=()=>({matches:false});
 const before=map.camera();map.focus(bodies[0],{close:true});assert.deepEqual(map.center,before.center);assert.equal(map.span,before.span);
 const move=map.transition;map.advanceCamera(move.time+move.duration/2);assert.ok(map.span<before.span&&map.span>2.8e6);assert.ok(map.center[0]>0&&map.center[0]<bodies[0].position[0]);
 map.advanceCamera(move.time+move.duration);assert.equal(map.transition,null);assert.deepEqual(map.center,bodies[0].position);assert.equal(map.span,2.8e6);
 map.focus(bodies[1]);map.pan(10,0);assert.equal(map.transition,null);
 globalThis.matchMedia=()=>({matches:true});map.focus(bodies[0],{close:true});assert.equal(map.transition,null);delete globalThis.matchMedia;
});
test('labels prioritize selection, stay within bounds and retain anchors during small movement',()=>{
 const candidates=Array.from({length:45},(_,i)=>({id:String(i),x:150+(i%5)*10,y:200+Math.floor(i/5)*10,r:4,width:90,priority:i===44?0:4}));
 const first=layoutLabels(candidates,390,700);assert.equal(first.placed[0].item.id,'44');
 for(const b of first.placed){assert.ok(b.x>=8&&b.y>=8&&b.x+b.w<=382&&b.y+b.h<=692);for(const a of first.placed)if(a!==b)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
 const moved=layoutLabels(candidates.map(c=>({...c,x:c.x+.2,y:c.y+.2})),390,700,first.anchors);assert.equal(moved.anchors.get('44'),first.anchors.get('44'));assert.ok(moved.placed.length<=28);
});
test('planets and moons precede selected POIs and route labels avoid overlay obstacles',()=>{
 assert.ok(labelPriority({kind:'planet'})<labelPriority({kind:'moon'}));assert.ok(labelPriority({kind:'moon'})<labelPriority({kind:'poi'},true));
 const labels=[{id:'poi',x:170,y:200,r:4,width:110,priority:labelPriority({kind:'poi'},true)},{id:'planet',x:180,y:200,r:30,width:80,major:true,priority:labelPriority({kind:'planet'})}];
 const blocks=[{x:0,y:0,w:390,h:100},{x:300,y:100,w:90,h:150}];const result=layoutLabels(labels,390,700,new Map(),blocks);assert.equal(result.placed[0].item.id,'planet');
 for(const a of result.placed)for(const b of blocks)assert.ok(a.x+a.w<=b.x||a.x>=b.x+b.w||a.y+a.h<=b.y||a.y>=b.y+b.h);
});
test('a selected POI label clears its activity marker rather than disappearing',()=>{
 const item={id:'poi',x:195,y:350,r:4,width:90,priority:3,selected:true};const result=layoutLabels([item],390,700,new Map(),[{x:178,y:333,w:34,h:34}]);assert.equal(result.placed.length,1);assert.equal(result.placed[0].item.id,'poi');
});
test('zoom focus converges without throwing the target around and repeated focus keeps its timing',()=>{
 const {map,bodies}=fixture();globalThis.matchMedia=()=>({matches:false});map.focus(bodies[0],{close:true});const move=map.transition;let last=Infinity;
 for(const fraction of [0,.1,.25,.5,.75,.9]){map.advanceCamera(move.time+move.duration*fraction);map.draw();const point=map.project(bodies[0].position);const distance=Math.hypot(point[0]-map.w/2,point[1]-map.h/2);assert.ok(distance<=last+.0001);last=distance;}
 map.focus(bodies[0],{close:true});assert.equal(map.transition,move);delete globalThis.matchMedia;
});
test('double click keeps a focus animation for each celestial object type',()=>{
 for(const kind of ['planet','moon','star','gateway','om']){
  const f=fixture(),body={...f.bodies[0],kind};f.map.setBodies([body]);f.map.hits=[{body,x:120,y:180,r:20}];f.map.onSelect=b=>f.map.focus(b);globalThis.matchMedia=()=>({matches:false});
  f.map.click({clientX:120,clientY:180,timeStamp:100});const move=f.map.transition;f.map.advanceCamera(move.time+100);f.map.hits=[];
  f.events.dblclick({clientX:120,clientY:180,timeStamp:250});assert.equal(f.map.transition,move,kind);delete globalThis.matchMedia;
 }
});

test('focus is gently timed and selected planets have no rectangular outline',()=>{
 const f=fixture();let boxes=0;f.canvas.getContext().strokeRect=()=>boxes++;
 globalThis.matchMedia=()=>({matches:false});
 try{f.map.selected=f.bodies[0].id;f.map.focus(f.bodies[0]);const move=f.map.transition;assert.ok(move.duration>=850&&move.duration<=1750);f.map.advanceCamera(move.time+move.duration);f.map.draw();assert.equal(boxes,0);assert.equal(f.map.transition,null);}finally{delete globalThis.matchMedia;}
});

test('primary station labels follow planets and can share an anchor beside map chrome',()=>{
 const planet={id:'planet',x:242,y:173,r:13,text:'Terminus',width:48,major:true,priority:0,body:{radius:1000000}};
 const hub={id:'hub',x:242,y:173,r:12,text:'Ruin Station',width:72,major:true,priority:labelPriority({kind:'station',mapImportance:'primary'})};
 assert.ok(hub.priority>planet.priority);
 const layout=layoutLabels([hub,planet],690,642,new Map(),[{x:28,y:27,w:395,h:138}]);
 assert.ok(layout.placed.some(b=>b.item.id==='planet'));assert.ok(layout.placed.some(b=>b.item.id==='hub'));
});

test('label tracking follows body movement immediately and eases anchor changes to rest',()=>{
 const item={id:'planet',x:100,y:200,major:true},box={x:130,y:190,w:70,h:20,item};
 let result=trackLabels([box],new Map(),16,690,642);assert.equal(result.moving,false);
 const moved={...box,x:170,item:{...item,x:140}};result=trackLabels([moved],result.history,16,690,642);assert.equal(result.placed[0].x,170);
 const flipped={...moved,x:40};result=trackLabels([flipped],result.history,16,690,642);assert.ok(result.placed[0].x>40&&result.placed[0].x<170);
 for(let i=0;i<60;i++)result=trackLabels([flipped],result.history,16,690,642);
 assert.equal(result.moving,false);assert.equal(result.placed[0].x,40);
});
