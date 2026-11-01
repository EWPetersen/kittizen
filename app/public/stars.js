// The game's star material is a shader without a bitmap. Re-create emissive
// light using its extracted colour and glow; cache the surface until rotation.
export const stellarRadius=body=>Math.max(1,body.starAppearance?.radius||(body.starAppearance?.displaySize||2e8)/2);
export const stellarFocusSpan=bodies=>Math.max(1,...bodies.filter(b=>b.kind==='star').map(stellarRadius))*2.4;
function noise(x,y){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
 const a=hash(ix,iy)*(1-sx)+hash(ix+1,iy)*sx,b=hash(ix,iy+1)*(1-sx)+hash(ix+1,iy+1)*sx;
 return a*(1-sy)+b*sy;
}
export function starPixels(color,size=256,texture=null,tile=1){
 const out=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)*2/size-1,v=(y+.5)*2/size-1,r2=u*u+v*v;if(r2>1)continue;
  const depth=Math.sqrt(1-r2),warp=noise(u*6,v*6)*3;
  let grain=noise(u*29+warp,v*29)*.55+noise(u*71,v*71+warp)*.3+noise(u*151,v*151)*.15-.5;
  if(texture){const tx=Math.floor((((Math.atan2(u,depth)/(2*Math.PI)+.5)*tile)%1)*texture.width),ty=Math.floor((((Math.asin(v)/Math.PI+.5)*tile)%1)*texture.height),i=(ty*texture.width+tx)*4;grain=(texture.data[i]+texture.data[i+1]+texture.data[i+2])/765-.5;}
  const intensity=.82+.15*depth+.16*grain,white=.12+.34*depth,at=(y*size+x)*4;
  for(let k=0;k<3;k++)out[at+k]=Math.round(255*intensity*(color[k]*(1-white)+white));
  out[at+3]=Math.min(255,(1-r2)*size*150);
 }
 return out;
}
export class StarSurfaces{
 constructor(invalidate=()=>{}){this.cache=new Map();this.sources=new Map();this.invalidate=invalidate;}
 get(body,size=128){
  const a=body.starAppearance||{},color=(a.color||[1,.49,.17]).map((v,k)=>v*(a.lightColor?.[k]??1));
  if(a.texture&&!this.sources.has(a.texture)){
   this.sources.set(a.texture,null);const image=new Image();
   image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);this.sources.set(a.texture,c.getImageData(0,0,image.width,image.height));this.invalidate();};
   image.onerror=()=>this.invalidate();image.src=a.texture;
  }
  const texture=this.sources.get(a.texture),key=color.join(':')+':'+(a.texture||'')+':'+!!texture+':'+size;if(this.cache.has(key))return this.cache.get(key);
  if(!document.createElement)return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');
  c.putImageData(new ImageData(starPixels(color,size,texture,a.textureTile||1),size,size),0,0);this.cache.set(key,canvas);if(this.cache.size>12)this.cache.delete(this.cache.keys().next().value);return canvas;
 }
}
export function starColor(body,alpha,light=false){const color=(light?body?.starAppearance?.lightColor:null)||body?.starAppearance?.color||[1,.49,.17];return `rgba(${color.map(x=>Math.round(x*255)).join(',')},${alpha})`;}
export function drawStar(c,surfaces,body,x,y,r){
 const glow=c.createRadialGradient(x,y,r*.7,x,y,r*3.2),strength=.35+(body.starAppearance?.glow||0)+Math.min(.4,(body.starAppearance?.surfaceIntensity||0)/75);
 glow.addColorStop(0,starColor(body,Math.min(.8,strength)));glow.addColorStop(.34,starColor(body,.18));glow.addColorStop(1,starColor(body,0));
 c.fillStyle=glow;c.fillRect(x-r*3.2,y-r*3.2,r*6.4,r*6.4);
 const surface=surfaces.get(body,r<18?64:r<100?128:256);
 if(surface)c.drawImage(surface,x-r,y-r,r*2,r*2);
 else{c.fillStyle='#ffe2ad';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
}
export function drawOrbitalLight(c,body,x,y,r,flatten=.65){
 c.save();c.translate(x,y);c.scale(1,Math.max(.12,Math.abs(flatten)));
 const light=c.createRadialGradient(0,0,0,0,0,r);light.addColorStop(0,starColor(body,.13,true));light.addColorStop(.3,starColor(body,.045,true));light.addColorStop(1,starColor(body,0,true));
 c.fillStyle=light;c.fillRect(-r,-r,r*2,r*2);c.restore();
}
