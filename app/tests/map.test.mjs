globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height})}};
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StarMap,layoutLabels} from '../public/map.js';
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
test('camera origin retains local metre detail far from system origin',()=>{let {map}=fixture();map.center=[4e10,3e10,0];map.span=2e6;map.draw();let a=map.project(map.center),b=map.project([4e10+1000,3e10,0]);assert.equal(a[0],195);assert.ok(Math.abs(b[0]-a[0])>.1);});
test('zoom cannot leave supported extent',()=>{let {map}=fixture();map.zoom(1e30);assert.equal(map.span,2e4);map.zoom(1e-30);assert.equal(map.span,3e12);});
test('body selection and planet focus',()=>{let f=fixture(),p=f.map.project(f.bodies[0].position);f.map.click({clientX:p[0],clientY:p[1]});assert.equal(f.selected.id,'a');f.map.focus(f.bodies[0]);assert.deepEqual(f.map.center,f.bodies[0].position);assert.equal(f.map.span,2.8e6);});
test('route fit and tapping the middle returns halfway placement',()=>{let f=fixture();f.map.fitRoute(...f.bodies);f.map.draw();f.map.click({clientX:195,clientY:350});assert.ok(Math.abs(f.routeHit-.5)<1e-12);});
test('shift-drag pans without selecting a body',()=>{let f=fixture();f.events.pointerdown({pointerId:1,clientX:100,clientY:100});f.events.pointermove({pointerId:1,clientX:150,clientY:110,shiftKey:true});f.events.pointerup({pointerId:1,clientX:150,clientY:110});assert.notDeepEqual(f.map.center,[0,0,0]);assert.equal(f.selected,null);assert.equal(f.map.pointers.size,0);});
test('pinch zoom, cancellation, orbit pitch clamp',()=>{let f=fixture();f.events.pointerdown({pointerId:1,clientX:100,clientY:100});f.events.pointerdown({pointerId:2,clientX:200,clientY:100});let old=f.map.span;f.events.pointermove({pointerId:2,clientX:250,clientY:100});assert.ok(f.map.span<old);f.events.pointercancel({pointerId:2});f.events.pointermove({pointerId:1,clientX:110,clientY:10000,shiftKey:false});assert.equal(f.map.pitch,Math.PI/2-.01);f.events.pointercancel({pointerId:1});assert.equal(f.map.pointers.size,0);});
test('selected label renders even in crowded system view and reports draw',()=>{let f=fixture();f.map.reports=[{kind:'Pirates',created:Date.now()/1000,position:[0,0,0]}];f.map.selected='a';assert.doesNotThrow(()=>f.map.draw());assert.ok(f.map.hits.some(h=>h.report));});

test('focus animates without jumping, settles exactly and stops rendering',()=>{
 const {map,bodies}=fixture();globalThis.matchMedia=()=>({matches:false});
 const before=map.camera();map.focus(bodies[0]);assert.deepEqual(map.center,before.center);assert.equal(map.span,before.span);
 const move=map.transition;map.advanceCamera(move.time+move.duration/2);assert.ok(map.span<before.span&&map.span>2.8e6);assert.ok(map.center[0]>0&&map.center[0]<bodies[0].position[0]);
 map.advanceCamera(move.time+move.duration);assert.equal(map.transition,null);assert.deepEqual(map.center,bodies[0].position);assert.equal(map.span,2.8e6);
 map.focus(bodies[1]);map.pan(10,0);assert.equal(map.transition,null);
 globalThis.matchMedia=()=>({matches:true});map.focus(bodies[0]);assert.equal(map.transition,null);delete globalThis.matchMedia;
});
test('labels prioritize selection, stay within bounds and retain anchors during small movement',()=>{
 const candidates=Array.from({length:45},(_,i)=>({id:String(i),x:150+(i%5)*10,y:200+Math.floor(i/5)*10,r:4,width:90,priority:i===44?0:4}));
 const first=layoutLabels(candidates,390,700);assert.equal(first.placed[0].item.id,'44');
 for(const b of first.placed){assert.ok(b.x>=8&&b.y>=8&&b.x+b.w<=382&&b.y+b.h<=692);for(const a of first.placed)if(a!==b)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
 const moved=layoutLabels(candidates.map(c=>({...c,x:c.x+.2,y:c.y+.2})),390,700,first.anchors);assert.equal(moved.anchors.get('44'),first.anchors.get('44'));assert.ok(moved.placed.length<=28);
});
