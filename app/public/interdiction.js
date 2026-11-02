// All coordinates and distances are metres. Geometry is independent of UI/game state.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/norm(a));
const point=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
export const DISTANCE_UNITS={km:1000,Mm:1e6,Gm:1e9};
export function parseDistance(text,unit='km'){
 if(typeof text!=='string'||text.length>100||!Object.hasOwn(DISTANCE_UNITS,unit))throw Error('Choose km, Mm or Gm.');
 const match=text.trim().match(/^([+]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(km|Mm|Gm)?$/);
 if(!match)throw Error('Use a positive distance with decimal points and optional comma groups, e.g. 4,327.145698 Mm.');
 const value=Number(match[1].replaceAll(',',''))*DISTANCE_UNITS[match[2]||unit];
 if(!Number.isFinite(value)||value<0)throw Error('Enter a finite, non-negative distance.');
 return value;
}
export function distanceUnit(metres){return metres>=1e9?'Gm':metres>=1e6?'Mm':'km';}
export function distanceValue(metres,unit='km'){
 if(!Number.isFinite(metres)||metres<0||!Object.hasOwn(DISTANCE_UNITS,unit))throw Error('Invalid distance.');
 return (metres/DISTANCE_UNITS[unit]).toLocaleString('en-US',{maximumFractionDigits:12});
}
export function formatDistance(metres,unit=distanceUnit(metres)){
 if(!Number.isFinite(metres)||metres<0||!Object.hasOwn(DISTANCE_UNITS,unit))throw Error('Invalid distance.');
 return (metres/DISTANCE_UNITS[unit]).toLocaleString('en-US',{maximumFractionDigits:{km:3,Mm:6,Gm:9}[unit]})+' '+unit;
}
function trim(intervals,lo,hi){return intervals.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([a,b])=>b-a>1e-10));}
export function planSnare(leg,{radius=20000,margin=2000,startSpread=2000,endSpread=2000,minTravel=1e7,endBuffer=1e5,bodies=[],centreOffset=0}={}){
 if(!leg||leg.kind!=='quantum'||!point(leg.start)||!point(leg.end))throw Error('Choose a quantum leg, not local flight or a jump tunnel.');
 if(![radius,margin,startSpread,endSpread,minTravel,endBuffer,centreOffset].every(Number.isFinite)||radius<=0||margin<0||margin>=radius||[startSpread,endSpread,minTravel,endBuffer,centreOffset].some(v=>v<0))throw Error('Check the radius, margin, spread and travel-distance settings.');
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
  const physicalExclusion=Math.max(b.radius*4,b.quantum?.obstructionRadius||0,b.quantum?.arrivalRadius||0)+radius+margin,exclusion=physicalExclusion+centreOffset;
  exclusions.push({position:b.position,radius:physicalExclusion});
  const delta=sub(b.position,leg.start),along=dot(delta,axis),perp=norm(sub(delta,mul(axis,along)));
  if(perp>=exclusion)continue;
  const half=Math.sqrt(Math.max(0,exclusion*exclusion-perp*perp));intervals=trim(intervals,(along-half)/length,(along+half)/length);
 }
 if(!intervals.length)throw Error('All eligible positions overlap a body-clearance exclusion. Choose another quantum leg.');
 const interval=intervals.reduce((best,current)=>current[1]-current[0]>best[1]-best[0]?current:best),fraction=(interval[0]+interval[1])/2,position=add(leg.start,mul(direction,fraction)),spread=startSpread+slope*fraction;
 return {position,system:leg.system,leg,axis,length,fraction,intervals,exclusions,radius,margin,startSpread,endSpread,spread,placementBudget:budget-spread,fromStart:fraction*length,toEnd:(1-fraction)*length};
}
// Minimum enclosing circle of uncertainty discs, via exact disc-intersection
// feasibility and bounded bisection. This permits an off-centre QED position.
export function enclosingDiscs(discs){
 if(!discs.length||discs.length>6||discs.some(d=>!Array.isArray(d.center)||d.center.length!==2||!d.center.every(Number.isFinite)||!Number.isFinite(d.radius)||d.radius<0))throw Error('Choose one to six finite approach corridors.');
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 let low=Math.max(...discs.map(d=>d.radius)),high=Math.max(...discs.map(d=>distance(d.center,discs[0].center)+d.radius));
 const feasible=radius=>{
  const contains=p=>discs.every(d=>distance(p,d.center)+d.radius<=radius+1e-7);
  for(const d of discs)if(contains(d.center))return [...d.center];
  for(let i=0;i<discs.length;i++)for(let j=i+1;j<discs.length;j++){
   const a=discs[i],b=discs[j],r=radius-a.radius,s=radius-b.radius,dx=b.center[0]-a.center[0],dy=b.center[1]-a.center[1],length=Math.hypot(dx,dy);
   if(r<0||s<0||length<1e-9||length>r+s+1e-7||length<Math.abs(r-s)-1e-7)continue;
   const along=((r-s)*(r+s)+length*length)/(2*length),height=Math.sqrt(Math.max(0,r*r-along*along)),x=a.center[0]+dx*along/length,y=a.center[1]+dy*along/length;
   for(const sign of [-1,1]){const p=[x-sign*dy*height/length,y+sign*dx*height/length];if(contains(p))return p;}
  }
  return null;
 };
 let center=feasible(high)||[...discs[0].center];
 for(let i=0;i<42;i++){const mid=(low+high)/2,p=feasible(mid);if(p){high=mid;center=p;}else low=mid;}
 return {center,radius:Math.max(...discs.map(d=>distance(center,d.center)+d.radius))};
}
function approachSection(approaches,primary,fraction){
 const axis=unit(sub(primary.end,primary.start)),length=norm(sub(primary.end,primary.start)),origin=add(primary.start,mul(axis,length*fraction)),right=unit(cross(axis,Math.abs(axis[2])<.9?[0,0,1]:[0,1,0])),up=cross(axis,right);
 const discs=approaches.map(a=>{
  const vector=sub(a.leg.end,a.leg.start),denom=dot(vector,axis),cosine=denom/norm(vector),t=dot(sub(origin,a.leg.start),axis)/denom,position=add(a.leg.start,mul(vector,t)),delta=sub(position,origin);
  return {center:[dot(delta,right),dot(delta,up)],radius:Math.max(0,a.startSpread+(a.endSpread-a.startSpread)*t)/cosine,position,fraction:t,name:a.name};
 });
 const circle=enclosingDiscs(discs),position=add(origin,add(mul(right,circle.center[0]),mul(up,circle.center[1])));
 return {discs,circle,position,right,up,origin};
}
export function optimizeSnare(approaches,options={}){
 if(!Array.isArray(approaches)||!approaches.length||approaches.length>6)throw Error('Choose one to six target approaches.');
 const {radius=20000,margin=2000,minTravel=1e7,endBuffer=1e5,placement=100}=options;
 if(!Number.isFinite(placement)||placement<0||placement>100)throw Error('Setup position must be between 0 and 100.');
 const normalized=approaches.map(a=>({...a,startSpread:a.startSpread??options.startSpread??2000,endSpread:a.endSpread??options.endSpread??2000})),primary=normalized[0].leg,budget=radius-margin;
 const base=planSnare(primary,{...options,startSpread:normalized[0].startSpread,endSpread:normalized[0].endSpread,centreOffset:approaches.length>1?budget:0});
 let intervals=base.intervals.map(a=>[...a]);
 for(const a of normalized){
  if(!a.leg||a.leg.kind!=='quantum'||a.leg.system!==primary.system||!point(a.leg.start)||!point(a.leg.end)||![a.startSpread,a.endSpread].every(v=>Number.isFinite(v)&&v>=0))throw Error('Approaches must be finite quantum legs in the same system.');
  const v=sub(a.leg.end,a.leg.start),length=norm(v),denom=dot(v,base.axis);
  if(length<1||denom/length<.1)throw Error('These approaches do not converge in a compatible direction. Choose another leg or origin.');
  const offset=dot(sub(primary.start,a.leg.start),base.axis)/denom,slope=base.length/denom;
  const lo=(minTravel/length-offset)/slope,hi=(1-endBuffer/length-offset)/slope;
  intervals=intervals.map(([x,y])=>[Math.max(x,lo),Math.min(y,hi)]).filter(([x,y])=>y-x>1e-12);
 }
 const evaluate=t=>approachSection(normalized,primary,t),feasible=[];
 for(const [a,b] of intervals){
  let l=a,h=b;
  // The minimax enclosing-disc radius is convex along these straight legs.
  for(let i=0;i<58;i++){const x=l+(h-l)/3,y=h-(h-l)/3;if(evaluate(x).circle.radius<evaluate(y).circle.radius)h=y;else l=x;}
  const minimum=[a,(l+h)/2,b].reduce((best,t)=>evaluate(t).circle.radius<evaluate(best).circle.radius?t:best,a);
  if(evaluate(minimum).circle.radius>budget)continue;
  let lo=a,hi=b;
  if(evaluate(a).circle.radius>budget){let x=a,y=minimum;for(let i=0;i<48;i++){const t=(x+y)/2;if(evaluate(t).circle.radius>budget)x=t;else y=t;}lo=y;}
  if(evaluate(b).circle.radius>budget){let x=minimum,y=b;for(let i=0;i<48;i++){const t=(x+y)/2;if(evaluate(t).circle.radius>budget)y=t;else x=t;}hi=x;}
  if(hi-lo>1e-12)feasible.push([lo,hi]);
 }
 if(!feasible.length)throw Error('No common setup covers all selected approaches within the snare and clearance assumptions. Remove an origin or review its departure spread.');
 const interval=feasible.reduce((a,b)=>b[0]<a[0]?b:a),inset=Math.min((interval[1]-interval[0])/10,.1/base.length),fraction=interval[0]+inset+(interval[1]-interval[0]-2*inset)*(1-placement/100),section=evaluate(fraction);
 if(section.circle.radius>budget+1e-4)throw Error('The selected position exceeds the snare budget.');
 return {...base,position:section.position,fraction,intervals:feasible,placementInterval:interval,placement,approaches:normalized,section,spread:section.circle.radius,placementBudget:Math.max(0,budget-section.circle.radius),fromStart:fraction*base.length,toEnd:(1-fraction)*base.length,offset:norm(sub(section.position,section.origin)),optimization:'Furthest validated cross-section; conservative straight-corridor model'};
}
export function assessPosition(plan,position){
 if(!plan||!point(position))throw Error('Invalid position.');
 const delta=sub(position,plan.leg.start),along=dot(delta,plan.axis),fraction=along/plan.length,closest=add(plan.leg.start,mul(plan.axis,along)),crossTrack=norm(sub(position,closest));
 const section=plan.approaches?approachSection(plan.approaches,plan.leg,fraction):null;
 const spread=section?section.circle.radius:plan.startSpread+(plan.endSpread-plan.startSpread)*fraction,eligible=plan.intervals.some(([a,b])=>fraction>=a&&fraction<=b)&&(plan.exclusions||[]).every(b=>norm(sub(position,b.position))>=b.radius),required=section?Math.max(...section.discs.map(d=>norm(sub(position,d.position))+d.radius)):spread+crossTrack,remaining=plan.radius-plan.margin-required;
 return {fraction,crossTrack:section?norm(sub(position,section.position)):crossTrack,spread,remaining,eligible,covered:eligible&&remaining>=-1e-4,distanceToPlan:norm(sub(position,plan.position))};
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
 const optimizedRange=t=>norm(sub(approachSection(plan.approaches,plan.leg,t).position,reference.position)),samples=plan.approaches?Array.from({length:33},(_,i)=>optimizedRange(interval[0]+(interval[1]-interval[0])*i/32)):null;
 return {body:reference,distance:norm(sub(plan.position,reference.position)),minimum:samples?Math.min(...samples):range(nearest),maximum:samples?Math.max(...samples):Math.max(range(interval[0]),range(interval[1])),rangeApproximate:!!samples,localReference:reference.id!==destination?.id,moving:!['planet','moon','star','lagrange'].includes(reference.kind)};
}
export function navigationCandidates(plan,origins,destination,bodies=[]){
 if(!destination||destination.system!==plan.system||!point(destination.position))return [];
 const direction=unit(sub(destination.position,plan.position)),out=[];
 const clear=(a,b)=>bodies.every(body=>{if(body.system!==plan.system||!(body.radius>0))return true;const v=sub(b,a),length=dot(v,v),t=Math.max(0,Math.min(1,dot(sub(body.position,a),v)/length)),p=add(a,mul(v,t));return norm(sub(p,body.position))>=Math.max(body.radius,body.quantum?.obstructionRadius||0);});
 for(let i=0;i<origins.length;i++)for(let j=i+1;j<origins.length;j++){
  const a=origins[i],b=origins[j];if(!point(a.position)||!point(b.position)||a.system!==plan.system||b.system!==plan.system)continue;
  const vector=sub(b.position,a.position),length=norm(vector);if(length<1)continue;const u=mul(vector,1/length),w=sub(a.position,plan.position),d=dot(u,direction),denom=1-d*d;if(denom<1e-8)continue;
  const along=(d*dot(direction,w)-dot(u,w))/denom,waypoint=add(a.position,mul(u,along)),axisT=dot(direction,w)+d*along,axisPoint=add(plan.position,mul(direction,axisT));
  if(along<=0||along>=length||norm(sub(waypoint,axisPoint))>Math.max(1,plan.margin*.1)||!clear(waypoint,plan.position)||(plan.exclusions||[]).some(body=>norm(sub(waypoint,body.position))<body.radius))continue;
  out.push({from:a,toward:b,waypoint,remaining:norm(sub(waypoint,b.position))},{from:b,toward:a,waypoint,remaining:norm(sub(waypoint,a.position))});
 }
 return out.sort((a,b)=>norm(sub(a.from.position,a.waypoint))-norm(sub(b.from.position,b.waypoint)));
}
export function drawSnareSection(c,plan,width=320,height=220){
 c.clearRect(0,0,width,height);if(!plan?.section)return;
 const scale=Math.min(width,height)*.34/plan.radius,x=width/2,y=height/2;
 c.strokeStyle='#ff8fc9';c.fillStyle='#ff8fc914';c.lineWidth=2;c.beginPath();c.arc(x,y,plan.radius*scale,0,Math.PI*2);c.fill();c.stroke();
 for(const [i,d] of plan.section.discs.entries()){const px=x+(d.center[0]-plan.section.circle.center[0])*scale,py=y-(d.center[1]-plan.section.circle.center[1])*scale;c.strokeStyle=['#9bffda','#9bdcff','#e1c6ff','#ffd68c','#b8c7ff','#ffb1c4'][i];c.fillStyle=c.strokeStyle;c.lineWidth=1;c.beginPath();c.arc(px,py,Math.max(2,d.radius*scale),0,Math.PI*2);c.stroke();c.beginPath();c.arc(px,py,2,0,Math.PI*2);c.fill();c.font='12px Arial';c.fillText(String(i+1),px+5,py-5);}
 c.fillStyle='#d4e6f1';c.font='11px Arial';c.fillText(formatDistance(plan.radius)+' field · numbered approach spreads',8,height-8);
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
 if(r>15&&plan.approaches?.length>1){
  c.setLineDash([5,5]);c.strokeStyle='#9bffda99';c.lineWidth=1;
  for(const approach of plan.approaches){const v=sub(approach.leg.end,approach.leg.start),length=norm(v),t=dot(sub(plan.position,approach.leg.start),v)/(length*length),a=project(add(approach.leg.start,mul(v,Math.max(0,t-plan.radius*5/length)))),b=project(add(approach.leg.start,mul(v,Math.min(1,t+plan.radius*5/length))));c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}c.setLineDash([]);
 }else if(r>15){
  for(const sign of [-1,1]){c.beginPath();for(let k=-1;k<=1;k+=2){const offset=k*plan.radius*5,t=plan.fraction+offset/plan.length,spread=Math.max(0,plan.startSpread+(plan.endSpread-plan.startSpread)*t),p=add(add(plan.position,mul(plan.axis,offset)),mul(side,spread*sign)),[px,py]=project(p);if(k===-1)c.moveTo(px,py);else c.lineTo(px,py);}c.strokeStyle='#9bffda99';c.stroke();}
 }
 c.fillStyle='#ffe1f2';c.font='12px Arial';c.fillText(r<8?'Snare plan · zoom for scale':'Snare · '+(plan.radius/1000)+' km radius',x+12,y-12);c.restore();
}
