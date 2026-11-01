// All coordinates and distances are metres. Geometry is independent of UI/game state.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/norm(a));
const point=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
function trim(intervals,lo,hi){return intervals.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([a,b])=>b-a>1e-10));}
export function planSnare(leg,{radius=20000,margin=2000,startSpread=2000,endSpread=2000,minTravel=1e7,endBuffer=1e5,bodies=[]}={}){
 if(!leg||leg.kind!=='quantum'||!point(leg.start)||!point(leg.end))throw Error('Choose a quantum leg, not local flight or a jump tunnel.');
 if(![radius,margin,startSpread,endSpread,minTravel,endBuffer].every(Number.isFinite)||radius<=0||margin<0||margin>=radius||[startSpread,endSpread,minTravel,endBuffer].some(v=>v<0))throw Error('Check the radius, margin, spread and travel-distance settings.');
 const direction=sub(leg.end,leg.start),length=norm(direction);if(length<1)throw Error('This leg is too short.');
 const axis=mul(direction,1/length),budget=radius-margin,slope=endSpread-startSpread;
 let lo=minTravel/length,hi=1-endBuffer/length;
 if(Math.abs(slope)<1e-9){if(startSpread>budget)throw Error('The route spread exceeds the usable snare radius throughout this leg.');}
 else if(slope<0)lo=Math.max(lo,(budget-startSpread)/slope);else hi=Math.min(hi,(budget-startSpread)/slope);
 lo=Math.max(0,lo);hi=Math.min(1,hi);if(hi-lo<=1e-10)throw Error('No interval meets the spread and minimum-travel assumptions. Reduce uncertainty only if you can justify it, or choose a longer leg.');
 let intervals=[[lo,hi]],exclusions=[];
 for(const b of bodies){
  if(b.system!==leg.system||!(b.radius>0)||!point(b.position))continue;
  // A conservative, visible heuristic, NOT a measured physics-grid boundary.
  const exclusion=Math.max(b.radius*4,b.quantum?.obstructionRadius||0,b.quantum?.arrivalRadius||0)+radius+margin;
  exclusions.push({position:b.position,radius:exclusion});
  const delta=sub(b.position,leg.start),along=dot(delta,axis),perp=norm(sub(delta,mul(axis,along)));
  if(perp>=exclusion)continue;
  const half=Math.sqrt(Math.max(0,exclusion*exclusion-perp*perp));intervals=trim(intervals,(along-half)/length,(along+half)/length);
 }
 if(!intervals.length)throw Error('All eligible positions overlap a body-clearance exclusion. Choose another quantum leg.');
 const interval=intervals.reduce((best,current)=>current[1]-current[0]>best[1]-best[0]?current:best),fraction=(interval[0]+interval[1])/2,position=add(leg.start,mul(direction,fraction)),spread=startSpread+slope*fraction;
 return {position,system:leg.system,leg,axis,length,fraction,intervals,exclusions,radius,margin,startSpread,endSpread,spread,placementBudget:budget-spread,fromStart:fraction*length,toEnd:(1-fraction)*length};
}
export function assessPosition(plan,position){
 if(!plan||!point(position))throw Error('Invalid position.');
 const delta=sub(position,plan.leg.start),along=dot(delta,plan.axis),fraction=along/plan.length,closest=add(plan.leg.start,mul(plan.axis,along)),crossTrack=norm(sub(position,closest));
 const spread=plan.startSpread+(plan.endSpread-plan.startSpread)*fraction,eligible=plan.intervals.some(([a,b])=>fraction>=a&&fraction<=b)&&(plan.exclusions||[]).every(b=>norm(sub(position,b.position))>=b.radius),remaining=plan.radius-plan.margin-spread-crossTrack;
 return {fraction,crossTrack,spread,remaining,eligible,covered:eligible&&remaining>=0,distanceToPlan:norm(sub(position,plan.position))};
}
export function destinationReference(plan,destination,bodies=[]){
 if(!plan||!point(plan.position))throw Error('Calculate a snare plan first.');
 const local=b=>b&&b.system===plan.system&&point(b.position);
 const endName=plan.leg.endName?.replace(/ (?:arrival boundary|QT exit boundary)$/,'');
 const reference=local(destination)?destination:bodies.find(b=>local(b)&&b.name===endName)||bodies.filter(b=>local(b)&&!b.hidden&&['planet','moon','star','lagrange'].includes(b.kind)).sort((a,b)=>norm(sub(a.position,plan.leg.end))-norm(sub(b.position,plan.leg.end)))[0];
 if(!reference)throw Error('No same-system destination reference is available.');
 const interval=plan.intervals.find(([a,b])=>plan.fraction>=a&&plan.fraction<=b);
 if(!interval)throw Error('The planned position is outside the eligible route interval.');
 const along=dot(sub(reference.position,plan.leg.start),plan.axis)/plan.length;
 const range=t=>norm(sub(add(plan.leg.start,mul(plan.axis,t*plan.length)),reference.position));
 const nearest=Math.max(interval[0],Math.min(interval[1],along));
 return {body:reference,distance:norm(sub(plan.position,reference.position)),minimum:range(nearest),maximum:Math.max(range(interval[0]),range(interval[1])),localReference:reference.id!==destination?.id,moving:!['planet','moon','star','lagrange'].includes(reference.kind)};
}
// Three range spheres intersect at zero, one or two points. Never hide the mirror.
export function trilaterate(anchors,ranges,tolerance=1000){
 if(anchors.length!==3||ranges.length!==3||!anchors.every(point)||!ranges.every(r=>Number.isFinite(r)&&r>=0)||!Number.isFinite(tolerance)||tolerance<0)throw Error('Enter three finite, non-negative centre-marker ranges.');
 const [a,b,c]=anchors,ab=sub(b,a),d=norm(ab);if(d<1)throw Error('Reference markers must be distinct.');
 const ex=mul(ab,1/d),ac=sub(c,a),i=dot(ex,ac),perp=sub(ac,mul(ex,i)),j=norm(perp);if(j/d<1e-5||j<1)throw Error('Reference markers are nearly collinear. Choose a wider triangle.');
 const ey=mul(perp,1/j),ez=cross(ex,ey),x=((ranges[0]-ranges[1])*(ranges[0]+ranges[1])+d*d)/(2*d),y=((ranges[0]-ranges[2])*(ranges[0]+ranges[2])+i*i+j*j-2*i*x)/(2*j);
 const height2=ranges[0]*ranges[0]-x*x-y*y;
 if(height2<-(2*ranges[0]*tolerance+tolerance*tolerance))throw Error('These ranges do not intersect within the measurement tolerance. Recheck units and reference markers.');
 const height=Math.sqrt(Math.max(0,height2)),base=add(a,add(mul(ex,x),mul(ey,y))),solutions=height<.01?[base]:[add(base,mul(ez,height)),add(base,mul(ez,-height))];
 const residual=Math.max(...solutions.flatMap(p=>anchors.map((a,k)=>Math.abs(norm(sub(p,a))-ranges[k]))));
 if(residual>tolerance)throw Error('Range residual exceeds the measurement tolerance.');
 return {solutions,residual,ambiguous:solutions.length>1};
}
export function parseCoordinates(text){
 if(typeof text!=='string'||text.length>200)throw Error('Enter X, Y and Z in metres.');
 const parts=text.trim().replace(/^\[/,'').replace(/\]$/,'').split(/[\s,]+/);
 if(parts.length!==3||parts.some(v=>!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(v))||!parts.map(Number).every(Number.isFinite))throw Error('Enter exactly three finite coordinates: X, Y, Z in metres in the planned system.');
 return parts.map(Number);
}
export function referenceMarkers(bodies,plan){
 const candidates=bodies.filter(b=>b.system===plan.system&&!b.hidden&&['planet','moon','star','lagrange'].includes(b.kind)&&point(b.position)&&norm(sub(b.position,plan.position))>plan.radius*2).sort((a,b)=>norm(sub(a.position,plan.position))-norm(sub(b.position,plan.position))).slice(0,16);
 let best=null,score=0;
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)for(let k=j+1;k<candidates.length;k++){
  const group=[candidates[i],candidates[j],candidates[k]],ab=sub(group[1].position,group[0].position),ac=sub(group[2].position,group[0].position),size=Math.max(norm(ab),norm(ac),norm(sub(group[2].position,group[1].position))),quality=norm(cross(ab,ac))/(size*size);
  if(quality>score){score=quality;best=group;}
 }
 if(!best||score<1e-4)throw Error('Not enough well-separated fixed centre markers for range verification.');
 return best.map(body=>({body,distance:norm(sub(body.position,plan.position))}));
}
export function drawSnare(c,plan,project,scale,width,height){
 if(!plan)return;const [x,y]=project(plan.position),r=plan.radius*scale;
 if(x+r<0||x-r>width||y+r<0||y-r>height)return;
 c.save();c.strokeStyle='#ff8fc9';c.fillStyle='#ff8fc91c';c.lineWidth=2;c.beginPath();c.arc(x,y,Math.max(8,r),0,Math.PI*2);c.fill();c.stroke();
 const side=unit(cross(plan.axis,Math.abs(plan.axis[2])<.9?[0,0,1]:[0,1,0]));
 if(r>15){
  for(const sign of [-1,1]){c.beginPath();for(let k=-1;k<=1;k+=2){const offset=k*plan.radius*5,t=plan.fraction+offset/plan.length,spread=Math.max(0,plan.startSpread+(plan.endSpread-plan.startSpread)*t),p=add(add(plan.position,mul(plan.axis,offset)),mul(side,spread*sign)),[px,py]=project(p);if(k===-1)c.moveTo(px,py);else c.lineTo(px,py);}c.strokeStyle='#9bffda99';c.stroke();}
 }
 c.fillStyle='#ffe1f2';c.font='12px Arial';c.fillText(r<8?'Snare plan · zoom for scale':'Snare · '+(plan.radius/1000)+' km radius',x+12,y-12);c.restore();
}
