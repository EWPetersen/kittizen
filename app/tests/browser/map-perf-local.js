
import {StarMap} from './map.js';
const catalog=await fetch('catalog.json').then(r=>r.json()),map=new StarMap(document.querySelector('canvas'),catalog.bodies,()=>{},()=>{});map.systems=catalog.systems;map.belts=catalog.belts;map.setSystem('stanton');
const wait=ms=>new Promise(r=>setTimeout(r,ms));let times=[],drops=0,seen=new Set(),record=false;
const draw=map.draw.bind(map);map.draw=()=>{const t=performance.now();draw();if(record)times.push(performance.now()-t);};
const get=map.globeTextures.get.bind(map.globeTextures);map.globeTextures.get=(body,...args)=>{const value=get(body,...args);if(record&&seen.has(body.id)&&!value)drops++;if(value)seen.add(body.id);return value;};
document.querySelector('button').onclick=async()=>{
 document.querySelector('button').disabled=true;const results=[];await wait(1000);
 for(const name of ['Crusader','Seraphim Station','Levski']){
  const body=catalog.bodies.find(b=>b.name===name);map.setSystem(body.system);await wait(200);times=[];drops=0;record=true;map.focus(body,{close:true});await wait(2100);record=false;
  const sorted=[...times].sort((a,b)=>a-b);results.push({name,frames:times.length,meanMs:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(2),p95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(2),over32ms:times.filter(t=>t>32).length,textureDropouts:drops});
 }
 document.querySelector('#result').textContent=JSON.stringify(results,null,2);document.querySelector('button').disabled=false;
};
