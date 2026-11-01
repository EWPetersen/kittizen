import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GlobeTextures} from '../public/sphere.js';
import {MapModels} from '../public/models.js';
import {SOURCE_BYTES,RASTER_BYTES,touch,trimCache,globeResolution,modelResolution} from '../public/render-budget.js';

function environment(){
 const old={Image:globalThis.Image,ImageData:globalThis.ImageData,document:globalThis.document},images=[];
 globalThis.Image=class{constructor(){this.width=8;this.height=4;images.push(this);}set src(value){this.url=value;}};
 globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
 globalThis.document={createElement:()=>{const canvas={width:0,height:0};canvas.getContext=()=>new Proxy({getImageData:()=>({width:8,height:4,data:new Uint8ClampedArray(128).fill(180)})},{get:(o,k)=>k in o?o[k]:()=>{}});return canvas;}};
 return {images,restore(){Object.assign(globalThis,old);}};
}
test('detail texture loading and failure never replace a ready base globe with null',()=>{
 const env=environment();try{
  const textures=new GlobeTextures(()=>{}),body={id:'planet',name:'Planet',texture:'base.png',textureDetail:'detail.png'};
  assert.equal(textures.get(body,0,0,96),null);assert.equal(env.images.length,1);env.images[0].onload();
  assert.ok(textures.get(body,0,0,96));assert.ok(textures.get(body,0,0,512));assert.equal(env.images[1].url,'detail.png');
  assert.ok(textures.cache.get(body.id).key.startsWith('base.png:'));
  env.images[1].onerror();for(let i=0;i<3;i++)assert.ok(textures.get(body,i*.1,0,512));assert.equal(env.images.length,2);
 }finally{env.restore();}
});
test('motion defers detailed downloads and reuses loaded detail without mip thrashing',()=>{
 const env=environment();try{
  const textures=new GlobeTextures(()=>{}),body={id:'planet',texture:'base',textureDetail:'detail'};
  textures.get(body,0,0,144,null,{moving:true});env.images[0].onload();textures.get(body,1,0,144,null,{moving:true});assert.equal(env.images.length,1);
  textures.get(body,1,0,512);env.images[1].onload();assert.ok(textures.get(body,2,0,144,null,{moving:true}));assert.ok(textures.cache.get(body.id).key.startsWith('detail:'));assert.equal(env.images.length,2);
 }finally{env.restore();}
});
test('a tiny retained mip avoids blank globes when full decoded textures are evicted',()=>{
 const env=environment();try{
  const textures=new GlobeTextures(()=>{}),body={id:'planet',texture:'base'};textures.get(body,0,0,96);env.images[0].onload();assert.ok(textures.get(body,0,0,96));
  textures.sources.clear();textures.cache.clear();assert.ok(textures.get(body,1,0,144,null,{moving:true}));assert.equal(env.images.length,2);
  assert.ok(textures.get(body,1,0,112,{width:500,height:400,x:250,y:200,radius:20000},{moving:true}));
 }finally{env.restore();}
});
test('texture decoder concurrency is bounded to two active images',()=>{
 const env=environment();try{
  const textures=new GlobeTextures(()=>{});for(let i=0;i<5;i++)textures.get({id:String(i),texture:String(i)},0,0,48);
  assert.equal(env.images.length,2);assert.equal(textures.loading,2);env.images[0].onload();assert.equal(env.images.length,3);assert.equal(textures.loading,2);
 }finally{env.restore();}
});
test('decoded textures and model rasters have byte budgets with least-recent eviction',()=>{
 const cache=new Map([['a',{bytes:8}],['pending',null],['b',{bytes:8}],['c',{bytes:8}]]);touch(cache,'a');assert.equal(trimCache(cache,16,v=>v?.bytes||0),16);assert.ok(cache.has('a'));assert.ok(!cache.has('b'));assert.ok(cache.has('pending'));assert.equal(SOURCE_BYTES,24*1024*1024);
 const env=environment();try{
  const models=new MapModels(()=>{});models.sources.set('tiny',{vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[[0,1,2]]});
  for(let i=0;i<10;i++)models.get({model:'tiny'},i*.1,0,768);
  assert.ok([...models.cache.values()].reduce((n,c)=>n+c.width*c.height*4,0)<=RASTER_BYTES);assert.ok(models.cache.size<8);
 }finally{env.restore();}
});
test('moving and overview assets stay small while idle close-ups retain detail',()=>{
 assert.ok(globeResolution(800,true,900)<=144);assert.ok(globeResolution(800,true,900,true)<=144);assert.ok(globeResolution(13,false,900)<=64);
 assert.ok(globeResolution(800,false,900)>=384);assert.ok(modelResolution(800,true,900)<=192);assert.ok(modelResolution(800,false,900)>=512);
 assert.ok(modelResolution(100,false,900)<=256,'small models do not allocate large close-up rasters');
});
