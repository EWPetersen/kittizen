import {inverseRotate} from './sphere.js';

export function modelFaces(mesh,rotation,yaw,pitch){
  const q=rotation||[1,0,0,0],forward=[q[0],-q[1],-q[2],-q[3]],cy=Math.cos(yaw),sy=Math.sin(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
  const points=mesh.vertices.map(v=>{const [x,y,z]=inverseRotate(forward,v);const side=x*sy+y*cy;return [x*cy-y*sy,side*sp-z*cp,side*cp+z*sp];});
  return mesh.triangles.map(face=>{const p=face.map(i=>points[i]);return {points:p,depth:p.reduce((s,v)=>s+v[2],0)/3};}).sort((a,b)=>a.depth-b.depth);
}

function validMesh(mesh){
  return Array.isArray(mesh.vertices)&&mesh.vertices.length>0&&mesh.vertices.length<=20000&&mesh.vertices.every(v=>v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1.001))&&Array.isArray(mesh.triangles)&&mesh.triangles.length>0&&mesh.triangles.length<=10000&&mesh.triangles.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.vertices.length));
}

export class MapModels {
  constructor(invalidate,load=url=>fetch(url).then(r=>{if(!r.ok)throw Error('Map model unavailable');return r.json();})){
    this.invalidate=invalidate;this.load=load;this.sources=new Map();this.cache=new Map();this.failures=new Set();
  }
  get(body,yaw,pitch){
    if(!body.model)return null;
    if(!this.sources.has(body.model)){
      this.sources.set(body.model,null);
      this.load(body.model).then(mesh=>{if(!validMesh(mesh))throw Error('Invalid map model');this.sources.set(body.model,mesh);this.invalidate();}).catch(()=>{this.failures.add(body.model);this.invalidate();});
    }
    const mesh=this.sources.get(body.model);if(!mesh)return null;
    const key=[body.model,...(body.rotation||[1,0,0,0]),yaw.toFixed(2),pitch.toFixed(2)].join(':');
    if(this.cache.has(key))return this.cache.get(key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=160;const c=canvas.getContext('2d');
    c.translate(80,80);c.scale(70,70);c.lineWidth=.004;
    for(const face of modelFaces(mesh,body.rotation,yaw,pitch)){
      const [a,b,d]=face.points;const area=Math.abs((b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]));
      if(area<1e-8)continue;
      const light=Math.round(115+Math.min(1,area*80)*65+Math.max(0,face.depth)*35);
      c.fillStyle=`rgb(${Math.round(light*.64)},${Math.round(light*.89)},${light})`;c.strokeStyle='#b9e6ef65';
      c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.closePath();c.fill();c.stroke();
    }
    this.cache.set(key,canvas);if(this.cache.size>48)this.cache.delete(this.cache.keys().next().value);return canvas;
  }
}
