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
export function drawJumpPortal(c,x,y,r,{phase=0,active=true,pitch=-.72,yaw=0,system='stanton'}={}){
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
