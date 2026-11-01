// Small procedural holograms: no image downloads or continuous overview loop.
export const PORTAL_SPAN=20000;
export function portalRadius(span,viewport){return Math.max(8,Math.min(viewport*.38,7500*viewport/Math.max(1,span)));}
export function portalRim(phase=0,steps=96){
  return Array.from({length:steps+1},(_,i)=>{
    const a=i/steps*Math.PI*2,r=1+.045*Math.sin(a*3+phase)+.025*Math.sin(a*7-phase*.7);
    return [Math.cos(a)*r,Math.sin(a)*r];
  });
}
export function animatePortal({selected,radius,visible,reducedMotion,dragging,connected}){
  return !!(selected&&radius>24&&visible&&!reducedMotion&&!dragging&&connected);
}
export function drawJumpPortal(c,x,y,r,{phase=0,active=true,pitch=-.72,yaw=0}={}){
  const small=r<22,cyan=active?'115,240,255':'188,177,154',violet=active?'185,125,255':'166,153,139';
  c.save();c.translate(x,y);c.rotate(-.25-Math.sin(yaw)*.22);c.scale(.68+.22*Math.abs(Math.sin(pitch)),1);
  const aura=c.createRadialGradient(0,0,r*.35,0,0,r*1.38);
  aura.addColorStop(0,`rgba(${cyan},0)`);aura.addColorStop(.57,`rgba(${violet},.08)`);aura.addColorStop(.73,`rgba(${cyan},.20)`);aura.addColorStop(1,`rgba(${cyan},0)`);
  c.fillStyle=aura;c.fillRect(-r*1.4,-r*1.4,r*2.8,r*2.8);
  const throat=c.createRadialGradient(-r*.12,r*.08,0,0,0,r);
  throat.addColorStop(0,'#010810');throat.addColorStop(.48,'#03101c');throat.addColorStop(.8,active?'#173044':'#242628');throat.addColorStop(1,`rgba(${cyan},.6)`);
  c.fillStyle=throat;c.beginPath();c.ellipse(0,0,r,r,0,0,Math.PI*2);c.fill();
  // Offset crescents give the aperture depth, rather than a flat target icon.
  if(!small)for(let i=0;i<6;i++){
    const a=phase*.17+i*1.07,depth=.28+i*.085;
    c.strokeStyle=`rgba(${i%2?cyan:violet},${.07+i*.025})`;c.lineWidth=Math.max(1,r*.018);
    c.beginPath();c.ellipse(Math.sin(a)*r*.09,Math.cos(a)*r*.07,r*depth,r*depth*.83,a,a+.25,a+2.6);c.stroke();
  }
  const rim=portalRim(phase,small?32:96);
  const outline=()=>{c.beginPath();rim.forEach(([u,v],i)=>i?c.lineTo(u*r,v*r):c.moveTo(u*r,v*r));c.closePath();};
  for(const [width,alpha] of [[.09,.09],[.035,.35],[.008,.95]]){
    outline();c.strokeStyle=`rgba(${cyan},${alpha})`;c.lineWidth=Math.max(small?1:.7,r*width);c.stroke();
  }
  if(!small)for(let i=0;i<24;i++){
    const a=i*2.39996+phase*.09,d=1.02+.14*(.5+.5*Math.sin(i*7.3+phase)),s=(i%4===0?1.8:.8)*Math.max(.7,r/180);
    c.fillStyle=`rgba(${i%3?cyan:violet},${.3+.5*(.5+.5*Math.sin(i+phase))})`;
    c.beginPath();c.arc(Math.cos(a)*r*d,Math.sin(a)*r*d,s,0,Math.PI*2);c.fill();
  }
  c.restore();
}
