import {inverseRotate} from './sphere.js';
const cache=new WeakMap();
const labelPoints=new WeakMap();
export function beltParticles(belt,count=1100){
  if(cache.has(belt)&&cache.get(belt).length===count)return cache.get(belt);
  const points=[],q=belt.rotation||[1,0,0,0],forward=[q[0],-q[1],-q[2],-q[3]];
  for(let i=0;i<count;i++){
    const hash=n=>{const v=Math.sin(n*127.1+17.13)*43758.5453;return v-Math.floor(v);};
    const a=(i+hash(i)) / count * Math.PI*2,r=belt.innerRadius+(belt.outerRadius-belt.innerRadius)*hash(i+count);
    const local=[Math.cos(a)*r,Math.sin(a)*r,(hash(i+count*2)-.5)*(belt.depth||0)],world=inverseRotate(forward,local);
    points.push(world.map((v,k)=>v+belt.center[k]));
  }
  cache.set(belt,points);return points;
}
export function drawBelts(c,belts,system,project,center,span,width,height,{local=false,occluded=()=>false}={}){
  const labels=[];
  for(const belt of belts||[]){
    if(belt.system!==system)continue;
    if(!!belt.parent!==local)continue;
    if(belt.parent&&belt.outerRadius*Math.min(width,height)/span<18)continue;
    const delta=inverseRotate(belt.rotation||[1,0,0,0],center.map((v,i)=>v-belt.center[i])),radius=Math.hypot(delta[0],delta[1]);
    if(span<1e9&&(radius<belt.innerRadius-span*2||radius>belt.outerRadius+span*2))continue;
    const points=beltParticles(belt,belt.parent?1800:1100);c.save();
    c.fillStyle=belt.radialWidthKnown?'#91aaa94a':'#90b6c44a';
    const stride=belt.radialWidthKnown?1:Math.max(1,Math.ceil(points.length/(Math.PI*2*belt.outerRadius*Math.min(width,height)/span*.45)));
    for(let i=0;i<points.length;i+=stride){
      if(belt.parent&&occluded(points[i],belt))continue;
      const [x,y]=project(points[i]);if(x<-4||x>width+4||y<-4||y>height+4)continue;
      const size=i%13===0?1.7:.75;
      // Unknown physical Nyx ring width stays a centreline. Pixel scatter is
      // illustrative map artwork, never exported as a game distance.
      const n=Math.sin(i*78.233)*43758.5453,jitter=belt.radialWidthKnown?0:((n-Math.floor(n))-.5)*3;
      c.fillRect(x+jitter,y-jitter,size,size);
    }
    c.restore();
    const visible=p=>{const [x,y]=project(p);return x>45&&x<width-45&&y>60&&y<height-90;};
    let at=labelPoints.get(belt);
    if(!at||!visible(at)){
      const candidates=points.filter((p,i)=>i%5===0&&visible(p));
      at=candidates.reduce((best,p)=>{const score=p=>{const [x,y]=project(p);return Math.hypot(x-width*.32,y-height*.65);};return !best||score(p)<score(best)?p:best;},null);
      if(at)labelPoints.set(belt,at);
    }
    if(at&&visible(at)){const [x,y]=project(at);labels.push({id:'belt:'+belt.id,x,y,r:3,text:belt.name,width:belt.name.length*6,priority:belt.parent?10:6,important:!belt.parent});}
  }
  return labels;
}
