import {SOURCE_BYTES,RASTER_BYTES,touch,trimCache} from './render-budget.js';
// Map the game's equirectangular starmap texture onto an orthographic globe.
// Work happens only after a texture arrives or the camera rotates. Zoom/pan
// reuse the cached 256px image; there is no idle animation or GPU dependency.
export function inverseRotate(q, v) {
  let [w, x, y, z] = q || [1, 0, 0, 0];
  const length = Math.hypot(w, x, y, z);
  w /= length;
  x /= -length;
  y /= -length;
  z /= -length;
  const [a, b, c] = v, tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx];
}

export function globePixels(texture, rotation, yaw, pitch, size = 256,viewport=null) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    sp = Math.sin(pitch),
    cp = Math.cos(pitch);
  const right = inverseRotate(rotation, [cy, -sy, 0]);
  const down = inverseRotate(rotation, [sy * sp, cy * sp, -cp]);
  const front = inverseRotate(rotation, [sy * cp, cy * cp, sp]);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = viewport?((x+.5)/size*viewport.width-viewport.x)/viewport.radius:(x + .5) * 2 / size - 1,
        v = viewport?((y+.5)/size*viewport.height-viewport.y)/viewport.radius:(y + .5) * 2 / size - 1,
        r2 = u * u + v * v;
      if (r2 > 1) continue;
      const depth = Math.sqrt(1 - r2);
      const lx=u*right[0]+v*down[0]+depth*front[0],ly=u*right[1]+v*down[1]+depth*front[1],lz=u*right[2]+v*down[2]+depth*front[2];
      const sx=((Math.atan2(ly,lx) / (Math.PI * 2) + .5) % 1 + 1) % 1 * texture.width,sy=Math.max(0,Math.min(texture.height-1,(.5-Math.asin(Math.max(-1,Math.min(1,lz)))/Math.PI)*texture.height));
      const tx = Math.min(texture.width - 1, Math.floor(sx));
      const ty = Math.floor(sy);
      const source = (ty * texture.width + tx) * 4,
        target = (y * size + x) * 4;
      const light = .57 + .43 * Math.max(0, -u * .28 - v * .32 + depth * .82);
      for (let channel = 0; channel < 3; channel++){
        let value=texture.data[source+channel];
        if(viewport){const fx=sx-tx,fy=sy-ty,x1=(tx+1)%texture.width,y1=Math.min(ty+1,texture.height-1);value=(value*(1-fx)+texture.data[(ty*texture.width+x1)*4+channel]*fx)*(1-fy)+(texture.data[(y1*texture.width+tx)*4+channel]*(1-fx)+texture.data[(y1*texture.width+x1)*4+channel]*fx)*fy;}
        pixels[target+channel]=value*light;
      }
      pixels[target + 3] = Math.min(255, (1 - r2) * (viewport?.radius||size) * 150);
    }
  return pixels;
}

export class GlobeTextures {
  constructor(invalidate) {
    this.invalidate = invalidate;
    this.sources = new Map();
    this.fallbacks=new Map();
    this.cache = new Map();
    this.failures = [];
    this.failedSources=new Set();this.queue=[];this.loading=0;
  }
  request(path,name){
    if(!path||this.sources.has(path)||this.failedSources.has(path))return;
    this.sources.set(path,null);this.queue.push({path,name});this.drain();
  }
  drain(){
    while(this.loading<2&&this.queue.length){
      const {path,name}=this.queue.shift(),image=new Image();this.loading++;
      const done=failed=>{image.onload=image.onerror=null;this.loading--;if(failed){this.sources.delete(path);this.failedSources.add(path);this.failures.push(name);}this.invalidate();this.drain();};
      image.onload=()=>{
        try{
          if(!image.width||!image.height||image.width*image.height>2048*2048)throw Error('Texture exceeds render budget');
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.drawImage(image,0,0);this.sources.set(path,ctx.getImageData(0,0,image.width,image.height));
          const tiny=document.createElement('canvas'),scale=Math.min(1,128/image.width,64/image.height);tiny.width=Math.max(1,Math.round(image.width*scale));tiny.height=Math.max(1,Math.round(image.height*scale));
          const preview=tiny.getContext('2d',{willReadFrequently:true});preview.drawImage(image,0,0,tiny.width,tiny.height);this.fallbacks.set(path,preview.getImageData(0,0,tiny.width,tiny.height));
          trimCache(this.fallbacks,2*1024*1024,v=>v.data.byteLength);
          trimCache(this.sources,SOURCE_BYTES,v=>v?.data?.byteLength||0);done(false);
        }catch{done(true);}
      };
      image.onerror=()=>done(true);image.src=path;
    }
  }
  get(body, yaw, pitch, size = 256,viewport=null,{moving=false}={}) {
    if (!body.texture) return null;
    const detail=body.textureDetail&&touch(this.sources,body.textureDetail);
    if(!detail)this.request(body.texture,body.name);
    if(!moving&&size>=384&&!detail)this.request(body.textureDetail,body.name);
    // Keep the base surface while its detailed mip loads (or fails). Once
    // loaded, reuse detail during motion too; never swap back to a blank globe.
    const base=touch(this.sources,body.texture),fallbackDetail=body.textureDetail&&touch(this.fallbacks,body.textureDetail);
    const path=detail||!base&&fallbackDetail?body.textureDetail:body.texture,source=detail||base||fallbackDetail||touch(this.fallbacks,body.texture);
    if (!source) return null;
    const key = path + ':'+source.width+'x'+source.height+':' + yaw.toFixed(2) + ':' + pitch.toFixed(2) + ':' + size+':'+JSON.stringify(viewport),
      old = touch(this.cache,body.id);
    if (old?.key === key) return old.canvas;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').putImageData(new ImageData(globePixels(source, body.rotation, yaw, pitch, size,viewport), size, size), 0, 0);
    this.cache.set(body.id, {
      key,
      canvas
    });
    trimCache(this.cache,RASTER_BYTES,v=>v.canvas.width*v.canvas.height*4);
    return canvas;
  }
}
