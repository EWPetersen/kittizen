import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSnare,assessPosition,trilaterate,referenceMarkers,parseCoordinates,drawSnare,destinationReference} from '../public/interdiction.js';
const leg={kind:'quantum',system:'stanton',start:[0,0,0],end:[1e9,0,0]};
test('destination reference measures to the real marker centre beyond the QT boundary',()=>{
 const p=planSnare(leg),body={id:'destination',name:'Planet',kind:'planet',system:'stanton',position:[1.001e9,0,0]},r=destinationReference(p,body);
 assert.ok(Math.abs(r.distance-p.toEnd-1e6)<1e-6);assert.equal(r.localReference,false);assert.ok(r.minimum<=r.distance&&r.distance<=r.maximum);
});
test('off-axis reference ranges use Euclidean geometry and the interior minimum',()=>{
 const p=planSnare(leg),body={id:'ref',kind:'station',system:'stanton',position:[p.position[0],3e6,4e6]},r=destinationReference(p,body);
 assert.equal(r.distance,5e6);assert.equal(r.minimum,5e6);assert.ok(r.maximum>r.minimum);assert.equal(r.moving,true);
});
test('a cross-system target uses the selected leg local reference, never galactic coordinates',()=>{
 const p=planSnare({...leg,endName:'Gate arrival boundary'}),target={id:'remote',system:'pyro',position:[1,2,3]},local={id:'gate',name:'Gate',kind:'gateway',system:'stanton',position:[1e9,0,0]};
 const r=destinationReference(p,target,[local]);assert.equal(r.body.id,'gate');assert.equal(r.localReference,true);assert.equal(r.distance,p.toEnd);
 assert.throws(()=>destinationReference(p,target,[]));
});
test('planner finds finite corridor-contained positions and preserves endpoint buffers',()=>{
 const p=planSnare(leg,{startSpread:1e6,endSpread:10000});assert.ok(p.fromStart>=1e7&&p.toEnd>=1e5);assert.ok(p.spread+p.margin<=p.radius);assert.ok(assessPosition(p,p.position).covered);
 assert.ok(!assessPosition(p,[...p.position.slice(0,1),p.radius,0]).covered);
});
test('invalid and non-quantum routes cannot produce a snare plan',()=>{
 for(const value of [null,{...leg,kind:'local'},{...leg,kind:'jump'},{...leg,end:[0,0,0]},{...leg,start:[NaN,0,0]}])assert.throws(()=>planSnare(value));
 for(const settings of [{radius:0},{margin:20000},{startSpread:NaN},{endSpread:-1},{minTravel:Infinity},{startSpread:30000,endSpread:30000}])assert.throws(()=>planSnare(leg,settings));
 assert.throws(()=>planSnare({...leg,end:[1000,0,0]}));
});
test('analytic body exclusions split intervals and exclude the snare sphere, not only its centre',()=>{
 const body={system:'stanton',radius:1e6,position:[5e8,0,0]},p=planSnare(leg,{startSpread:0,endSpread:0,bodies:[body]});
 assert.equal(p.intervals.length,2);assert.ok(Math.hypot(...p.position.map((v,i)=>v-body.position[i]))>4e6+p.radius+p.margin);
 assert.ok(!assessPosition(p,body.position).covered);
 const ignored=planSnare(leg,{bodies:[{...body,system:'pyro'}]});assert.equal(ignored.intervals.length,1);
 assert.throws(()=>planSnare(leg,{bodies:[{...body,radius:1e10}]}));
});
test('range trilateration preserves both mirror solutions and rejects degenerate markers',()=>{
 const anchors=[[0,0,0],[100000,0,0],[0,100000,0]],position=[20000,30000,10000],ranges=anchors.map(p=>Math.hypot(...p.map((v,i)=>v-position[i]))),result=trilaterate(anchors,ranges,.01);
 assert.equal(result.solutions.length,2);for(const p of result.solutions){assert.ok(Math.abs(p[0]-20000)<1e-7);assert.ok(Math.abs(p[1]-30000)<1e-7);assert.ok(Math.abs(Math.abs(p[2])-10000)<1e-7);}
 assert.ok(result.ambiguous);assert.throws(()=>trilaterate([[0,0,0],[1,0,0],[2,0,0]],[1,1,1]));assert.throws(()=>trilaterate(anchors,[1,1,1],0));assert.throws(()=>trilaterate(anchors,[Infinity,1,1]));
});
test('large game coordinates remain accurate without origin-dependent triangulation drift',()=>{
 const origin=[-1.9e10,-2.6e9,1e8],anchors=[[0,0,0],[1e7,0,0],[0,1e7,0]].map(p=>p.map((v,i)=>v+origin[i])),position=[2e6,3e6,1e5].map((v,i)=>v+origin[i]);
 const result=trilaterate(anchors,anchors.map(p=>Math.hypot(...p.map((v,i)=>v-position[i]))),.01);assert.ok(result.solutions.some(p=>Math.hypot(...p.map((v,i)=>v-position[i]))<.001));
});
test('reference selection uses distinct same-system centres and declines a collinear triangle',()=>{
 const p=planSnare(leg),bodies=[[0,0,0],[1e8,0,0],[0,1e8,0],[0,0,1e8]].map((position,i)=>({id:''+i,name:''+i,position,system:'stanton',kind:'planet'}));
 const refs=referenceMarkers(bodies,p);assert.equal(refs.length,3);assert.equal(new Set(refs.map(r=>r.body.id)).size,3);assert.throws(()=>referenceMarkers(bodies.slice(0,2),p));
});
test('coordinate verification accepts only three finite metre values, never executable input',()=>{
 assert.deepEqual(parseCoordinates('[1e10, -20, .3]'),[1e10,-20,.3]);for(const text of ['', '1,2','1,2,3,4','NaN,1,2','Infinity,0,0','alert(1),2,3'])assert.throws(()=>parseCoordinates(text));
});
test('snare overlay is screen-culled and labels subpixel fields honestly',()=>{
 const p=planSnare(leg),texts=[],c=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawSnare(c,p,()=>[-100,-100],.001,390,700);assert.equal(texts.length,0);
 drawSnare(c,p,()=>[200,300],.00001,390,700);assert.ok(texts[0].includes('zoom for scale'));
});
