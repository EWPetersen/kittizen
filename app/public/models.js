import {inverseRotate} from './sphere.js';
import {RASTER_BYTES,touch,trimCache} from './render-budget.js';

export function modelFaces(mesh,rotation,yaw,pitch){
  const q=rotation||[1,0,0,0],forward=[q[0],-q[1],-q[2],-q[3]],cy=Math.cos(yaw),sy=Math.sin(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
  const points=mesh.vertices.map(v=>{const [x,y,z]=inverseRotate(forward,v);const side=x*sy+y*cy;return [x*cy-y*sy,side*sp-z*cp,side*cp+z*sp];});
  return mesh.triangles.map((face,index)=>{const p=face.map(i=>points[i]);return {points:p,material:mesh.faceMaterials?.[index],index,depth:p.reduce((s,v)=>s+v[2],0)/3};}).sort((a,b)=>a.depth-b.depth);
}

function validMesh(mesh){
  return Array.isArray(mesh.vertices)&&mesh.vertices.length>0&&mesh.vertices.length<=20000&&mesh.vertices.every(v=>v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1.001))&&Array.isArray(mesh.triangles)&&mesh.triangles.length>0&&mesh.triangles.length<=10000&&mesh.triangles.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.vertices.length));
}

export class MapModels {
  constructor(invalidate,load=url=>fetch(url).then(r=>{if(!r.ok)throw Error('Map model unavailable');return r.json();})){
    this.invalidate=invalidate;this.load=load;this.sources=new Map();this.cache=new Map();this.failures=new Set();
  }
  get(body,yaw,pitch,size=160){
    if(!body.model)return null;
    if(!this.sources.has(body.model)){
      this.sources.set(body.model,null);
      this.load(body.model).then(mesh=>{if(!validMesh(mesh))throw Error('Invalid map model');this.sources.set(body.model,mesh);trimCache(this.sources,12*1024*1024,v=>v?(v.vertices.length+v.triangles.length)*80:0);this.invalidate();}).catch(()=>{this.failures.add(body.model);this.invalidate();});
    }
    const mesh=touch(this.sources,body.model);if(!mesh)return null;
    size=Math.max(64,Math.min(1024,Math.round(size)));
    const key=[body.model,body.modelStyle||'',...(body.rotation||[1,0,0,0]),yaw.toFixed(2),pitch.toFixed(2),size].join(':');
    if(this.cache.has(key))return touch(this.cache,key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');
    c.translate(size/2,size/2);c.scale(size*.4375,size*.4375);c.lineWidth=.004;
    let extent=0,axisExtent=0;
    for(const face of modelFaces(mesh,body.rotation,yaw,pitch)){
      for(const point of face.points){extent=Math.max(extent,Math.hypot(point[0],point[1]));axisExtent=Math.max(axisExtent,Math.abs(point[0]),Math.abs(point[1]));}
      const [a,b,d]=face.points;const area=Math.abs((b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]));
      if(area<1e-8)continue;
      const light=Math.round(115+Math.min(1,area*80)*65+Math.max(0,face.depth)*35);
      c.fillStyle=`rgb(${Math.round(light*.64)},${Math.round(light*.89)},${light})`;c.strokeStyle='#b9e6ef65';
      if(body.modelStyle==='prison'){c.fillStyle=`rgb(${Math.round(light*.88)},${Math.round(light*.85)},${Math.round(light*.59)})`;c.strokeStyle='#e5e3aa65';}
      if(body.modelStyle==='asteroid'){
        const u=b.map((v,i)=>v-a[i]),v=d.map((n,i)=>n-a[i]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal)||1;
        const shade=55+90*Math.abs((normal[0]*-.4+normal[1]*-.5+normal[2]*.75)/length)+(Math.sin(face.index*17.3)*.5+.5)*16;
        c.fillStyle=face.material==='structure'?`rgb(${Math.round(shade*.8)},${Math.round(shade*1.2)},${Math.round(shade*1.3)})`:`rgb(${Math.round(shade*.68)},${Math.round(shade*.83)},${Math.round(shade*.91)})`;
        c.strokeStyle=face.material==='structure'?'#a6edf59c':'#91c4cf25';
      }
      c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(d[0],d[1]);c.closePath();c.fill();if(size>=256)c.stroke();
    }
    canvas.meshRadius=extent*.875;canvas.meshExtent=axisExtent*.875;this.cache.set(key,canvas);trimCache(this.cache,RASTER_BYTES,v=>v.width*v.height*4);return canvas;
  }
}
