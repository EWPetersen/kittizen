// Small procedural holograms: no image downloads or continuous overview loop.
export const PORTAL_SPAN=20000;
export function portalRadius(span,viewport){return Math.max(8,Math.min(viewport*.38,7500*viewport/Math.max(1,span)));}
export function portalRim(phase=0,steps=96){
  return Array.from({length:steps+1},(_,i)=>{
    const a=i/steps*Math.PI*2,r=1+.055*Math.sin(a*3+phase*.55)+.025*Math.sin(a*7-phase*.7)+.012*Math.sin(a*17+phase*.4);
    return [Math.cos(a)*r,Math.sin(a)*r];
  });
}
export function animatePortal({selected,radius,visible,reducedMotion,dragging,connected}){
  return !!(selected&&radius>24&&visible&&!reducedMotion&&!dragging&&connected);
}
export function portalPalette(system='stanton',active=true){return !active?{rim:'177,180,172',mist:'114,130,128',core:'209,214,198'}:system==='pyro'?{rim:'255,190,128',mist:'128,176,150',core:'255,225,183'}:system==='nyx'?{rim:'92,235,211',mist:'88,149,150',core:'172,255,234'}:{rim:'137,215,247',mist:'98,163,179',core:'211,248,255'};}
function oldPortal(c,x,y,r,{phase=0,active=true,pitch=-.72,yaw=0,system='stanton'}={}){
  const small=r<22,palette=portalPalette(system,active),cyan=palette.rim,violet=palette.mist;
  c.save();c.translate(x,y);c.rotate(-.25-Math.sin(yaw)*.22);c.scale(.68+.22*Math.abs(Math.sin(pitch)),1);
  const aura=c.createRadialGradient(0,0,r*.35,0,0,r*1.38);
  aura.addColorStop(0,`rgba(${cyan},0)`);aura.addColorStop(.50,`rgba(${violet},.035)`);aura.addColorStop(.73,`rgba(${cyan},.16)`);aura.addColorStop(1,`rgba(${violet},0)`);
  c.fillStyle=aura;c.fillRect(-r*1.4,-r*1.4,r*2.8,r*2.8);
  const throat=c.createRadialGradient(-r*.12,r*.08,0,0,0,r);
  throat.addColorStop(0,`rgba(${palette.core},${active?.92:.2})`);throat.addColorStop(.22,`rgba(${cyan},${active?.85:.15})`);throat.addColorStop(.36,'#0b2027');throat.addColorStop(.70,'#08151f');throat.addColorStop(1,`rgba(${cyan},.55)`);
  c.fillStyle=throat;c.beginPath();c.ellipse(0,0,r,r,0,0,Math.PI*2);c.fill();
  // Released-game entrances have a luminous core inside a dark, turbulent throat.
  // Deterministic helical filaments keep this a lightweight map hologram.
  if(!small)for(let i=0;i<7;i++){
    c.strokeStyle=`rgba(${i%2?cyan:violet},${.11+i*.012})`;c.lineWidth=Math.max(.7,r*(i%2?.009:.018));c.beginPath();
    for(let j=0;j<=40;j++){const t=j/40,a=i*Math.PI*2/7+t*4.5+phase*.08,d=.26+t*.74+.018*Math.sin(t*33+i),px=Math.cos(a)*r*d,py=Math.sin(a)*r*d;if(!j)c.moveTo(px,py);else c.lineTo(px,py);}c.stroke();
  }
  const rim=portalRim(phase,small?32:96);
  const outline=()=>{c.beginPath();rim.forEach(([u,v],i)=>i?c.lineTo(u*r,v*r):c.moveTo(u*r,v*r));c.closePath();};
  for(const [width,alpha] of [[.13,.05],[.055,.18],[.014,.65]]){
    outline();c.strokeStyle=`rgba(${cyan},${alpha})`;c.lineWidth=Math.max(small?1:.7,r*width);c.stroke();
  }
  if(!small)for(let i=0;i<12;i++){
    c.strokeStyle=`rgba(${i%3?cyan:violet},${.07+(i%4)*.025})`;c.lineWidth=Math.max(.6,r*.005);c.beginPath();
    for(let j=0;j<=18;j++){const t=j/18,a=i*2.39996+t*.8+phase*.035,d=.96+t*.35+.025*Math.sin(t*31+i),px=Math.cos(a)*r*d,py=Math.sin(a)*r*d;if(!j)c.moveTo(px,py);else c.lineTo(px,py);}c.stroke();
  }
  c.restore();
}

const TAU=Math.PI*2, clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>v*v*(3-2*v), textures=new Map();
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy),a=hash(ix,iy),b=hash(ix+1,iy),d=hash(ix,iy+1),e=hash(ix+1,iy+1);return a+(b-a)*u+(d-a)*v+(a-b-d+e)*u*v;}
function cloud(x,y){return noise(x,y)*.55+noise(x*2.07+9,y*2.07+3)*.28+noise(x*4.13+23,y*4.13+8)*.12+noise(x*8.3,y*8.3)*.05;}

// Build one small, transparent volume impostor per palette. Pixel work never runs
// in the animation loop. Domain-warped gas replaces the previous polygon outline.
export function portalPixels(size=384,system='stanton',active=true){
  if(!Number.isInteger(size)||size<16||size>512)throw Error('Invalid portal texture size');
  const pixels=new Uint8ClampedArray(size*size*4),p=portalPalette(system,active),rim=p.rim.split(',').map(Number),core=p.core.split(',').map(Number),mist=p.mist.split(',').map(Number);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5-size/2)/(size*.48),v=(y+.5-size/2)/(size*.48),r=Math.hypot(u,v),i=(y*size+x)*4;
    if(r>1)continue;
    const a=Math.atan2(v,u),n=cloud(u*5+31,v*5+17),warped=r+(n-.5)*.13+.022*Math.sin(a*5+r*13),twist=a+r*8;
    const wx=Math.cos(twist)*r*9+34,wy=Math.sin(twist)*r*9+12;
    const gas=cloud(wx,wy),thread=Math.pow(1-Math.abs(noise(wx*4+gas*2,wy*4)-.5)*2,9);
    const mouth=Math.exp(-(((warped-.53)/.085)**2)),outer=Math.exp(-(((warped-.64)/.21)**2));
    const coreR=Math.hypot(u+.018,v-.015),heart=Math.exp(-((coreR/.135)**2))*(active?1:.12);
    const cavity=Math.exp(-(((warped-.30)/.17)**2)),edge=clamp((1-r)*6);
    const emission=(mouth*(.25+gas*1.5+thread*1.15)+outer*thread*.32)*edge*(active?1:.16);
    const fog=outer*(.05+gas*.18)*edge,alpha=clamp((emission*1.5+fog*2+cavity*.97+heart)*edge);
    const light=Array.from({length:3},(_,k)=>emission*rim[k]/255+fog*mist[k]/255+heart*core[k]/255*2.2+cavity*.015),peak=Math.max(...light),tone=(1-Math.exp(-peak*2.6))/Math.max(.001,peak);
    for(let k=0;k<3;k++)pixels[i+k]=255*light[k]*tone;
    pixels[i+3]=255*alpha;
  }
  return pixels;
}
function portalTexture(system,active){
  const key=(active?['stanton','pyro','nyx'].includes(system)?system:'stanton':'inactive');
  if(textures.has(key))return textures.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
  const context=canvas.getContext('2d'),image=context.createImageData(384,384);image.data.set(portalPixels(384,key,active));context.putImageData(image,0,0);textures.set(key,canvas);return canvas;
}
function tunnelTexture(system){
  const key='tunnel:'+(['stanton','pyro','nyx'].includes(system)?system:'stanton');if(textures.has(key))return textures.get(key);
  const size=384,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'),image=context.createImageData(size,size),p=portalPalette(system),colour=p.rim.split(',').map(Number);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5-size/2)/(size*.5),v=(y+.5-size/2)/(size*.5),r=Math.hypot(u,v),a=Math.atan2(v,u)+Math.log(r+.05)*.65;
    const depth=Math.log(r+.05),wx=Math.cos(a)*7+depth*3+18,wy=Math.sin(a)*7-depth*4+23,n=cloud(wx,wy),fibres=Math.pow(1-Math.abs(noise(wx*5+n,wy*5)-.5)*2,12);
    const glow=(.10+n*n*.55+fibres*.42)*Math.min(1,r*5),i=(y*size+x)*4;
    for(let k=0;k<3;k++)image.data[i+k]=colour[k]*glow;image.data[i+3]=255;
  }
  context.putImageData(image,0,0);textures.set(key,canvas);return canvas;
}
export function drawJumpPortal(c,x,y,r,{phase=0,active=true,pitch=-.72,yaw=0,system='stanton'}={}){
  if(r<22){oldPortal(c,x,y,r,{phase,active,pitch,yaw,system});return;}
  const texture=portalTexture(system,active);
  c.save();c.translate(x,y);c.rotate(-.12-Math.sin(yaw)*.13+phase*.012);c.scale(.88+.10*Math.abs(Math.sin(pitch)),1);
  c.drawImage(texture,-r*1.65,-r*1.65,r*3.3,r*3.3);
  // A dim counter-moving gas layer gives parallax without rebuilding the raster.
  c.globalCompositeOperation='screen';c.globalAlpha=.16;c.rotate(-phase*.024+.24);c.drawImage(texture,-r*1.76,-r*1.76,r*3.52,r*3.52);c.restore();
}

export const JUMP_DURATION=1250;
export function tunnelPoint(angle,depth,progress,width,height){
  const z=.075+depth*10.5,scale=Math.min(width,height)*.60/z,bend=Math.sin(depth*2.1+progress*.8);
  const a=angle+depth*.72,rough=1+.065*Math.sin(a*7+depth*8)+.035*Math.sin(a*19-depth*15);
  return [width*(.5+.09*bend*depth)+Math.cos(a)*scale*rough,height*(.5-.07*Math.sin(depth*1.8+progress)*depth)+Math.sin(a)*scale*rough];
}
export function drawJumpTransit(c,width,height,progress,system='stanton'){
  const p=clamp(progress),palette=portalPalette(system),cx=width*(.5+.09*Math.sin(2.1+p*.8)),cy=height*(.5-.07*Math.sin(1.8+p)),span=Math.max(width,height);
  c.fillStyle='#020a10';c.fillRect(0,0,width,height);
  const wall=tunnelTexture(system),size=span*(1.25+p*.6);
  c.drawImage(wall,width*.5-size*.5,height*.5-size*.5,size,size);
  const glow=c.createRadialGradient(cx,cy,0,cx,cy,span*.65);glow.addColorStop(0,`rgba(${palette.core},.9)`);glow.addColorStop(.025,`rgba(${palette.rim},.65)`);glow.addColorStop(.12,`rgba(${palette.mist},.22)`);glow.addColorStop(1,'#02070d');c.fillStyle=glow;c.fillRect(0,0,width,height);
  // Long flowing wall fibres, not evenly spaced concentric hoops. A short curved
  // centreline and sparse dust provide forward motion without a flashing exit.
  c.lineCap='round';
  for(let i=0;i<160;i++){
    const angle=i/160*TAU,seed=hash(i,9),steps=40;
    c.beginPath();
    for(let j=0;j<=steps;j++){const depth=j/steps,[x,y]=tunnelPoint(angle+.028*Math.sin(j*.7+seed*40+p*4),depth,p,width,height);if(!j)c.moveTo(x,y);else c.lineTo(x,y);}
    c.strokeStyle=`rgba(${i%4?palette.rim:palette.core},${.025+seed*.065})`;c.lineWidth=.5+seed*1.3;c.stroke();
  }
  for(let i=0;i<100;i++){
    const a=hash(i,3)*TAU,depth=(hash(i,7)-p*1.7)%1+1,d=depth%1;
    const start=tunnelPoint(a,d,p,width,height),end=tunnelPoint(a,Math.min(1,d+.008+hash(i,12)*.018),p,width,height);
    c.strokeStyle=`rgba(${palette.core},${.12+hash(i,5)*.4})`;c.lineWidth=1+hash(i,1);c.beginPath();c.moveTo(...start);c.lineTo(...end);c.stroke();
  }
  c.strokeStyle=`rgba(${palette.core},.20)`;c.lineWidth=3;c.beginPath();c.moveTo(width*.47,height*1.1);c.bezierCurveTo(width*.32,height*.7,width*.68,height*.5,cx,cy);c.stroke();
  const shade=c.createRadialGradient(width*.5,height*.5,span*.12,width*.5,height*.5,span*.65);shade.addColorStop(0,'transparent');shade.addColorStop(1,'#010509');c.fillStyle=shade;c.fillRect(0,0,width,height);
}
