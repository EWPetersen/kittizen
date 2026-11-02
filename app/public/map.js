import {
  GlobeTextures
} from './sphere.js';
import {activityWeight,heatField,heatPixels} from './heatmap.js';
import {MapModels} from './models.js';
import {StarSurfaces,stellarRadius,stellarFocusSpan,drawStar,drawOrbitalLight,starColor} from './stars.js';
import {PORTAL_SPAN,portalRadius,drawJumpPortal,animatePortal} from './portals.js';
import {drawBelts} from './belts.js';
import {drawSnare} from './interdiction.js';
import {globeResolution,modelResolution} from './render-budget.js';
export const LOCATION_FOCUS_PULLBACK=3.5;
export function secondaryLandmark(body){return body.system==='nyx'&&body.kind==='station'&&/^(QV Breaker Station BRK-|Transit Point Glaciem )/.test(body.name);}
// Stable candidate order and remembered anchor choices reduce label swapping while orbiting.
export function labelPriority(body,selected=false) {
  return body.kind==='planet'||body.kind==='body'?0:body.kind==='gateway'?1:body.kind==='star'?2:body.mapImportance==='primary'?3:body.kind==='moon'?4:selected?5:body.kind==='lagrange'||secondaryLandmark(body)?6:body.kind==='om'?7:8;
}
// Stanton's cities/orbital hubs belong to their planet view. Pyro/Nyx's
// sparse primary hubs also serve as system-level navigation landmarks.
export function prominentLocation(body,parent,span) {
  return ['planet','star','body','gateway'].includes(body.kind)||body.mapImportance==='primary'&&
    (body.system!=='stanton'||parent&&span<=parent.radius*25);
}
export function detailSpan(body,container) {
  if(['planet','star','body','gateway','lagrange'].includes(body.kind))return Infinity;
  if(secondaryLandmark(body))return Infinity;
  if(body.mapImportance==='primary'){
    if(body.system!=='stanton')return Infinity;
    if(container?.radius>0)return container.radius*25;
  }
  if(body.kind==='moon')return 3e9;
  if(container?.kind==='lagrange')return 3e10;
  return 3e9;
}
export function markerFits(point,occupied,spacing) {
  return !occupied.some(p=>Math.hypot(point.x-p.x,point.y-p.y)<Math.max(spacing,(p.r||0)+12));
}
export function trackLabels(boxes,previous,elapsed,width,height,obstacles=[]){
  const blend=1-Math.exp(-Math.max(1,Math.min(50,elapsed))/65),next=new Map();let moving=false;
  let placed=boxes.map(box=>{const b=box.item,old=previous.get(b.id),dx=box.x-b.x,dy=box.y-b.y;
    const state={dx:old?old.dx+(dx-old.dx)*blend:dx,dy:old?old.dy+(dy-old.dy)*blend:dy,alpha:old?old.alpha+(1-old.alpha)*blend:previous.size&&!b.major?blend:1};
    if(Math.abs(state.dx-dx)<.3)state.dx=dx;if(Math.abs(state.dy-dy)<.3)state.dy=dy;if(state.alpha>.99)state.alpha=1;
    next.set(b.id,state);moving||=state.dx!==dx||state.dy!==dy||state.alpha!==1;
    return {...box,x:Math.max(8,Math.min(width-box.w-8,b.x+state.dx)),y:Math.max(8,Math.min(height-box.h-8,b.y+state.dy)),alpha:state.alpha};
  });
  const overlaps=(a,b)=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
  // Never trade collision avoidance for animation. Follow the clear target when
  // an interpolated label would sweep across another label or a control.
  if(placed.some((b,i)=>placed.slice(0,i).some(a=>overlaps(a,b))||obstacles.some(o=>o.bodyId!==b.item.id&&overlaps(b,o)))){
    placed=boxes.map(b=>({...b,alpha:next.get(b.item.id).alpha}));moving=false;
    for(const b of placed){const state={dx:b.x-b.item.x,dy:b.y-b.item.y,alpha:b.alpha};next.set(b.item.id,state);moving||=state.alpha!==1;}
  }
  return {placed,history:next,moving};
}
export function layoutLabels(candidates,width,height,previous=new Map(),obstacles=[]) {
  const placed=[],anchors=new Map();
  const overlaps=(a,b)=>a.x<b.x+b.w+5&&a.x+a.w+5>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y;
  const primaryCount=candidates.filter(c=>c.major).length;
  const budget=Math.max(width<500?8:14,Math.min(width<500?16:24,primaryCount+(width<500?2:4))),detailBudget=width<500?3:6;let detailCount=0;
  for(const item of [...candidates].sort((a,b)=>a.priority-b.priority||Number(!!b.selected)-Number(!!a.selected)||(a.major&&b.major?(b.body?.radius||0)-(a.body?.radius||0):0)||Number(previous.has(b.id))-Number(previous.has(a.id))||a.id.localeCompare(b.id))){
    const detail=!item.major&&!item.selected&&!item.important;
    if(detail&&detailCount>=detailBudget)continue;
    const offscreen=item.x<0||item.x>width||item.y<0||item.y>height;
    if(offscreen&&(!item.major||item.x+item.r<0||item.x-item.r>width||item.y+item.r<0||item.y-item.r>height))continue;
    const w=Math.min(item.width+14,width-16),h=item.major?23:20,gap=(item.major?Math.min(item.r,Math.min(width,height)*.4):Math.max(item.r,item.selected?20:14))+10;
    const positions=[[gap,-h/2],[-w-gap,-h/2],[-w/2,-gap-h],[-w/2,gap],[gap,-h-18],[-w-gap,-h-18],[gap,18],[-w-gap,18]];
    if(item.major)for(const extra of [36,72,108])positions.push([gap+extra,-h/2],[-w-gap-extra,-h/2],[-w/2,gap+extra],[-w/2,-gap-h-extra],[gap+extra,gap+extra],[-w-gap-extra,gap+extra],[gap+extra,-gap-h-extra],[-w-gap-extra,-gap-h-extra]);
    const order=[previous.get(item.id),...positions.map((_,i)=>i)].filter((n,i,a)=>n!==undefined&&n<positions.length&&a.indexOf(n)===i);
    for(const index of order){
      const [dx,dy]=positions[index];const box={x:Math.max(8,Math.min(width-w-8,item.x+dx)),y:Math.max(8,Math.min(height-h-8,item.y+dy)),w,h,item};
      if(placed.some(other=>overlaps(box,other))||obstacles.some(other=>other.bodyId!==item.id&&overlaps(box,other)))continue;
      placed.push(box);anchors.set(item.id,index);if(detail)detailCount++;break;
    }
    if(placed.length>=budget)break;
  }
  return {placed,anchors};
}
// Demand-rendered orthographic 3D map. Doubles retain metre coordinates;
// the camera origin is subtracted before projection. No GPU or asset downloads.
export class StarMap {
  constructor(canvas, bodies, onSelect, onRoute) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.setBodies(bodies);
    this.onSelect = onSelect;
    this.onRoute = onRoute;
    this.center = [0, 0, 0];
    this.span = 1.2e11;
    this.yaw = -.35;
    this.pitch = -.72;
    this.reports = [];
    this.hits = [];
    this.pointers = new Map();
    this.route = null;
    this.system = 'stanton';
    this.systems = [];
    this.routePlan = null;
    this.globeTextures = new GlobeTextures(() => this.invalidate());
    this.mapModels = new MapModels(() => this.invalidate());
    this.starSurfaces=new StarSurfaces(()=>this.invalidate());
    new ResizeObserver(() => this.invalidate()).observe(canvas);
    document.addEventListener?.('visibilitychange',()=>this.invalidate());
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect(),
        delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      this.zoom(Math.exp(-delta * .001), [e.clientX - rect.left, e.clientY - rect.top]);
    }, {
      passive: false
    });
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      this.start = [e.clientX, e.clientY];
      this.dragButton = e.button || 0;
      this.moved = this.pointers.size>1;
      if(this.pointers.size>1)this.multiGesture=true;
    });
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => {
      if (!this.moved && this.pointers.size === 1 && (e.button ?? this.dragButton) === 2) {
        const time = e.timeStamp ?? performance.now(),
          prior = this.rightTap;
        if (prior && time - prior.time < 450 && Math.hypot(e.clientX - prior.x, e.clientY - prior.y) < 12) {
          this.stepOut();
          this.rightTap = null;
        } else this.rightTap = {
          time,
          x: e.clientX,
          y: e.clientY
        };
      } else if (!this.moved && !this.multiGesture && this.pointers.size === 1) this.click(e);
      this.pointers.delete(e.pointerId);
      if(!this.pointers.size)this.multiGesture=false;
      this.invalidate();
    });
    canvas.addEventListener('pointercancel', e => {this.pointers.delete(e.pointerId);this.moved=true;if(!this.pointers.size)this.multiGesture=false;});
    canvas.addEventListener('dblclick', e => {
      if (e.button === 2) {
        // Right-button stepping is handled by pointer-up, once per gesture.
        return;
      }
      const rect = canvas.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const recent=this.lastSelection;
      const fallback=recent&&(e.timeStamp??performance.now())-recent.time<500&&Math.hypot(x-recent.x,y-recent.y)<14?recent:null;
      const gate = this.hits.find(h => h.body?.kind === 'gateway' && Math.hypot(h.x - x, h.y - y) < h.r)||(fallback?.body.kind==='gateway'?fallback:null);
      if (gate && this.systems.some(s => s.id === gate.body.destinationSystem)) {
        if(this.onJump)this.onJump(gate.body.destinationSystem);
        else this.setSystem(gate.body.destinationSystem);
      }
      else {
        const body=this.hits.find(h=>h.body&&h.body.kind!=='system'&&(h.box?x>=h.box.x&&x<=h.box.x+h.box.w&&y>=h.box.y&&y<=h.box.y+h.box.h:Math.hypot(h.x-x,h.y-y)<h.r))||fallback;
        if(body)this.onSelect(this.navigationTarget(body.body));
        else if(!this.transition)this.zoom(1.8);
      }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('keydown', e => {
      if (e.key === '+' || e.key === '=') this.zoom(1.4);
      if (e.key === '-') this.zoom(1 / 1.4);
      if (e.key === 'Home') this.home();
    });
    this.invalidate();
  }
  invalidate() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.advanceCamera(performance.now());
      this.draw();
      if (this.transition) this.invalidate();
    });
  }
  camera() { return {center:[...this.center],span:this.span,yaw:this.yaw,pitch:this.pitch}; }
  flyTo(target) {
    if(this.transition&&target.span===this.transition.target.span&&target.center.every((v,i)=>v===this.transition.target.center[i]))return;
    const start=this.camera();
    if (typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(this,target);this.transition=null;this.invalidate();return;
    }
    const angle=((target.yaw-start.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    this.transition={start,target:{...target,yaw:start.yaw+angle},time:performance.now(),duration:Math.min(1750,850+Math.abs(Math.log(target.span/start.span))*75)};
    this.invalidate();
  }
  advanceCamera(now) {
    const move=this.transition;if(!move)return;
    // Quintic easing starts and finishes with zero velocity and acceleration.
    const t=now-move.time>=move.duration-.01?1:Math.min(1,Math.max(0,(now-move.time)/move.duration)),ease=t*t*t*(10+t*(-15+6*t));
    this.span=Math.exp(Math.log(move.start.span)*(1-ease)+Math.log(move.target.span)*ease);
    // Keep the target's projected distance shrinking steadily as scale changes.
    const remaining=(1-ease)*this.span/move.start.span;
    this.center=move.target.center.map((v,i)=>v+(move.start.center[i]-v)*remaining);
    this.yaw=move.start.yaw+(move.target.yaw-move.start.yaw)*ease;
    this.pitch=move.start.pitch+(move.target.pitch-move.start.pitch)*ease;
    if(t===1){Object.assign(this,move.target);this.transition=null;}
  }
  setBodies(bodies) {
    this.bodies = bodies;
    this.byId = new Map(bodies.map(b => [b.id, b]));
    this.maxStarRadius=Math.max(1,...bodies.filter(b=>b.kind==='star').map(stellarRadius));
    this.labelAnchors=new Map();this.labelVisibility=new Set();this.markerVisibility=new Set();this.labelMotion=new Map();this.labelClock=0;
  }
  drawHeatmap(now=Date.now()/1000){
    const points=this.reports.filter(r=>(r.system||'stanton')===this.system).map(r=>{
      const [x,y]=this.project(r.position);return {x,y,weight:activityWeight(r,now)};
    }).filter(p=>p.weight>0);
    if(!points.length)return;
    const moving=!!this.transition||this.pointers.size>0||performance.now()<(this.motionUntil||0),cell=moving?8:4;
    const key=JSON.stringify([this.w,this.h,cell,Math.floor(now/15),points.map(p=>[p.x,p.y,Math.round(p.weight*1000)])]),layer=this.heatLayer||(this.heatLayer=document.createElement('canvas'));
    if(this.heatKey!==key){const data=heatField(points,this.w,this.h,cell);layer.width=data.width;layer.height=data.height;
      layer.getContext('2d').putImageData(new ImageData(heatPixels(data.field),data.width,data.height),0,0);this.heatKey=key;}
    this.ctx.drawImage(layer,0,0,this.w,this.h);
  }
  noteMotion(){
    this.motionUntil=performance.now()+120;clearTimeout(this.settleTimer);
    if(document.visibilityState==='visible')this.settleTimer=setTimeout(()=>{this.motionUntil=0;this.invalidate();},125);
  }
  project(p) {
    let [x, y, z] = p.map((v, i) => v - this.center[i]);
    let u = x * Math.cos(this.yaw) - y * Math.sin(this.yaw),
      v = x * Math.sin(this.yaw) + y * Math.cos(this.yaw);
    return [this.w / 2 + u * this.scale, this.h / 2 + (v * Math.sin(this.pitch) - z * Math.cos(this.pitch)) * this.scale, v * Math.cos(this.pitch) + z * Math.sin(this.pitch)];
  }
  zoom(f, anchor) {
    this.noteMotion();
    this.transition = null;
    if (this.system === 'universe' && f > 1 && this.span / f < 45) {
      const point = anchor || [this.w / 2, this.h / 2],
        closest = this.hits.filter(h => h.body?.kind === 'system').sort((a, b) => Math.hypot(a.x - point[0], a.y - point[1]) - Math.hypot(b.x - point[0], b.y - point[1]))[0];
      if (closest) {
        this.setSystem(closest.body.id);
        return;
      }
    }
    if (this.system !== 'universe' && f > 1 && anchor) {
      const body = this.hits.find(h => h.body?.radius > 0 && this.span > h.body.radius * 40 && Math.hypot(h.x - anchor[0], h.y - anchor[1]) < Math.max(22, h.r));
      if (body) {
        const target=this.navigationTarget(body.body);this.focus(target);
        this.onSelect(target,false);
        this.zoom(f);
        return;
      }
    }
    const prior = this.span;
    this.span = Math.max(this.system === 'universe' ? 20 : 500, Math.min(3e12, this.span / f));
    if (this.systems.length && this.system !== 'universe' && this.span > this.systemSpan * 1.25) {
      this.setSystem('universe');
      return;
    }
    if (this.system === 'universe') this.span = Math.min(200, this.span);
    if (anchor && this.w && this.h) {
      const factor = (prior - this.span) / Math.min(this.w, this.h),
        u = (anchor[0] - this.w / 2) * factor,
        v = (anchor[1] - this.h / 2) * factor;
      this.center[0] += u * Math.cos(this.yaw) + v * Math.sin(this.yaw) * Math.sin(this.pitch);
      this.center[1] += -u * Math.sin(this.yaw) + v * Math.cos(this.yaw) * Math.sin(this.pitch);
      this.center[2] -= v * Math.cos(this.pitch);
    }
    this.invalidate();
  }
  home() {
    clearTimeout(this.settleTimer);this.motionUntil=0;
    clearTimeout(this.portalTimer);this.portalTimer=null;
    this.transition = null;
    this.view={level:this.system==='universe'?'universe':'system'};this.orbitFocus=null;this.selected=null;
    if (this.system === 'universe') {
      this.center = [0, 0, 0];
      for (const s of this.systems) s.position.forEach((v, i) => this.center[i] += v / this.systems.length);
      this.span = 70;
      this.yaw = 0;
      this.pitch = -.9;
      this.invalidate();
      return;
    }
    this.center = [0, 0, 0];
    const major = this.bodies.filter(b => b.system === this.system && (['planet', 'gateway', 'body'].includes(b.kind)||b.system!=='stanton'&&b.mapImportance==='primary'));
    this.systemSpan = major.length ? Math.max(...major.map(b => Math.hypot(...b.position))) * 2.6 : 1.2e11;
    this.span = this.systemSpan;
    this.yaw = -.35;
    this.pitch = -.72;
    this.invalidate();
  }
  setSystem(id) {
    if (id !== 'universe' && !this.systems.some(s => s.id === id)) return;
    this.system = id;
    this.labelAnchors.clear();this.labelVisibility.clear();this.markerVisibility.clear();this.labelMotion.clear();
    this.selected = null;
    this.home();
    this.onSystemChanged?.(id);
  }
  localSpan(body){
    const children=this.bodies.filter(b=>b.parent===body.id);
    const distance=b=>Math.hypot(...b.position.map((v,i)=>v-body.position[i]))+(b.radius||0),orbiters=children.filter(b=>b.kind==='moon'||b.kind==='planet');
    const localRadius=Math.max(body.radius*25,...orbiters.map(distance));
    // Some mining bases inherit a planet container while lying billions of
    // metres away. They must not turn a local moon view into a system view.
    return Math.max(body.radius*8,...children.filter(b=>distance(b)<=localRadius).map(b=>distance(b)*2.6));
  }
  focus(b,{close=false}={}) {
    const active=this.byId.get(this.view?.bodyId),localContext=this.view?.bodyId===b.id||this.orbitFocus===b.id||this.view?.level==='location'&&active&&this.surfaceParent(active)?.id===b.id;
    const inParentOrbits=!!this.orbitFocus&&this.orbitFocus===b.parent;
    if(b.kind==='planet'&&!close&&!inParentOrbits&&(!localContext||this.span>this.localSpan(b)*1.25)){this.focusSystem(b);return;}
    const start=this.camera();
    this.orbitFocus=null;this.view={level:b.radius>0||b.kind==='star'?'body':'location',bodyId:b.id};
    this.center = [...b.position];
    const parent = b.radius > 0 ? null : this.surfaceParent(b);
    this.span = b.radius > 0 ? b.radius * 2.8 : b.kind === 'star' ? 1.2e11 : parent ? parent.radius * 2.8 : 2e7;
    if (parent) {
      const normal = b.position.map((v, i) => v - parent.position[i]),
        length = Math.hypot(...normal);
      this.center = [...(b.kind==='om' ? b.position : parent.position)];
      if(length>0){this.yaw = Math.atan2(normal[0], normal[1]);
      this.pitch = Math.asin(Math.max(-1,Math.min(1,normal[2] / length)));}
    }
    // Enter a populated planet on its landing-zone hemisphere, so its local
    // hubs are useful immediately rather than hidden on the back of the globe.
    if(b.kind==='planet'){
      const hub=this.bodies.find(p=>p.parent===b.id&&p.kind==='poi'&&p.mapImportance==='primary');
      if(hub){const normal=hub.position.map((v,i)=>v-b.position[i]),length=Math.hypot(...normal);
        if(length>0){this.yaw=Math.atan2(normal[0],normal[1]);this.pitch=Math.asin(Math.max(-1,Math.min(1,normal[2]/length)));}
      }
    }
    this.selected = b.id;
    const target=this.camera();
    if(b.kind==='star')target.span=stellarFocusSpan(this.bodies);
    if(b.kind==='gateway')target.span=PORTAL_SPAN;
    if(b.kind==='om'){
      target.span=Math.max(2e4,parent ? parent.radius*4 : 2e6);
      target.pitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,target.pitch-.55));
    }
    if(parent&&b.kind!=='om'&&!b.radius&&(!b.model||b.modelRole==='symbol')){
      target.center=[...b.position];target.span=Math.max(25000,Math.min(2.5e6,parent.radius*.1));
    }
    if(b.model&&b.modelRole!=='symbol'){
      target.center=[...b.position];target.span=Math.max(600,(b.modelSize||1000)*.95);
      if(parent&&b.modelRole!=='surface'){
        // Look along the parent body's limb with the station in the foreground.
        const distance=Math.hypot(...b.position.map((v,i)=>v-parent.position[i]));
        target.pitch-=Math.asin(Math.min(.9999,parent.radius/Math.max(1,distance)));
      }
    }
    if(!b.radius&&!['star','gateway','om'].includes(b.kind))target.span*=LOCATION_FOCUS_PULLBACK;
    // Orbital facilities use a consistent 30 km frame; wheel zoom stays free.
    if(b.kind==='station'&&b.modelRole!=='surface')target.span=30000;
    Object.assign(this,start);this.flyTo(target);
  }
  focusReport(report) {
    if(!Array.isArray(report.position)||report.position.length!==3||!report.position.every(Number.isFinite))return false;
    const system=report.system||'stanton';
    if(this.system!==system)this.setSystem(system);
    const body=this.byId.get(report.locationId);
    if(body)this.focus(body,{close:true});
    else {
      const parent=this.bodies.find(b=>b.system===system&&b.radius>0&&Math.hypot(...report.position.map((v,i)=>v-b.position[i]))<b.radius*2);
      if(parent)this.focus({id:null,parent:parent.id,position:report.position});
      else this.flyTo({...this.camera(),center:[...report.position],span:2e7});
    }
    this.marker=[...report.position];this.invalidate();return true;
  }
  surfaceParent(body) {
    const seen = new Set();
    let parent = this.byId.get(body.parent);
    while (parent && !seen.has(parent.id)) {
      if (parent.radius > 0) return parent;
      seen.add(parent.id);
      parent = this.byId.get(parent.parent);
    }
    return null;
  }
  occluded(position, parent) {
    if (!parent?.radius) return false;
    const center = this.project(parent.position),
      point = this.project(position),
      distance = Math.hypot(point[0] - center[0], point[1] - center[1]) / this.scale;
    return distance < parent.radius && point[2] - center[2] < Math.sqrt(parent.radius ** 2 - distance ** 2) - 50;
  }
  pan(dx, dy) {
    if(this.system==='universe')dy=-dy;
    this.noteMotion();
    this.transition=null;
    const scale = Math.min(this.w, this.h) / this.span,
      u = dx / scale,
      v = dy / scale;
    this.center[0] -= u * Math.cos(this.yaw) + v * Math.sin(this.yaw) * Math.sin(this.pitch);
    this.center[1] -= -u * Math.sin(this.yaw) + v * Math.cos(this.yaw) * Math.sin(this.pitch);
    this.center[2] += v * Math.cos(this.pitch);
  }
  focusSystem(body) {
    const start=this.camera();
    this.center = [...body.position];
    this.selected = body.id;
    this.orbitFocus=body.id;this.view={level:'orbits',bodyId:body.id};
    this.span = this.localSpan(body);
    const target=this.camera();Object.assign(this,start);this.flyTo(target);
  }
  stepOut(){
    const body=this.byId.get(this.view?.bodyId),level=this.view?.level;
    if(level==='universe')return;
    if(level==='location'&&body){const parent=this.surfaceParent(body);if(parent){this.focus(parent,{close:true});this.onViewChanged?.(parent);return;}}
    if(level==='body'&&body&&body.kind!=='star'){
      const container=this.byId.get(body.parent),parent=container?.kind==='planet'?container:body.kind==='moon'?this.surfaceParent(body):body;
      if(parent){this.focusSystem(parent);this.onViewChanged?.(parent);return;}
    }
    if(level==='orbits'&&body?.kind==='moon'){
      const parent=this.surfaceParent(body);if(parent){this.focusSystem(parent);this.onViewChanged?.(parent);return;}
    }
    if(level==='system'){this.setSystem('universe');return;}
    this.home();this.onSystemChanged?.(this.system);
  }
  navigationTarget(body){
    if(this.view?.level!=='system'||body.kind!=='planet')return body;
    const seen=new Set();let target=body;
    while(!seen.has(target.id)){seen.add(target.id);const parent=this.byId.get(target.parent);if(parent?.kind!=='planet')break;target=parent;}
    return target;
  }
  fitRoute(a, b) {
    this.route = [a, b];
    this.center = a.position.map((v, i) => (v + b.position[i]) / 2);
    this.span = Math.max(2e7, Math.hypot(...a.position.map((v, i) => v - b.position[i])) * 1.65);
    this.invalidate();
  }
  move(e) {
    let prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    if (this.pointers.size === 2) {
      const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      let old = Math.hypot(prev[0] - other[0], prev[1] - other[1]),
        now = Math.hypot(e.clientX - other[0], e.clientY - other[1]);
      const system = this.system;
      if (old > 5) this.zoom(now / old);
      if (this.system === system) this.pan((e.clientX - prev[0]) / 2, (e.clientY - prev[1]) / 2);
      this.moved = true;
    } else {
      let dx = e.clientX - prev[0],
        dy = e.clientY - prev[1];
      if (Math.hypot(e.clientX - this.start[0], e.clientY - this.start[1]) > 5) this.moved = true;
      if (this.moved) {
        this.transition = null;
        this.rightTap = null;
        if (this.dragMode!=='pan' && !e.shiftKey && this.dragButton !== 2 && !(e.buttons & 2)) {
          this.yaw += dx * .006;
          this.pitch = Math.max(-Math.PI / 2 + .01, Math.min(Math.PI / 2 - .01, this.pitch + dy * .006));
        } else {
          this.pan(dx, dy);
        }
        this.invalidate();
      }
    }
    this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
  }
  click(e) {
    let rect = this.canvas.getBoundingClientRect(),
      x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    const touch=e.pointerType==='touch'||e.pointerType==='pen',padding=touch?6:0;
    let hit = this.hits.filter(h => h.box ? x>=h.box.x-padding&&x<=h.box.x+h.box.w+padding&&y>=h.box.y-padding&&y<=h.box.y+h.box.h+padding : Math.hypot(h.x - x, h.y - y) < Math.max(h.r,touch?22:0)).sort((a, b) => (a.box?-1:0)-(b.box?-1:0)||Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (hit) {
      if (hit.body?.kind === 'system') this.setSystem(hit.body.id);
      else if (hit.body) {const target=this.navigationTarget(hit.body);this.lastSelection={body:target,x,y,time:e.timeStamp??performance.now()};this.onSelect(target);}
      else this.onRoute(hit.report.route?.fraction ?? .5, hit.report);
      return;
    }
    if (this.routePlan && this.system !== 'universe') {
      for (const leg of this.routePlan.legs.filter(l => l.kind !== 'jump' && l.system === this.system)) {
        const a = this.project(leg.start),
          b = this.project(leg.end),
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = dx * dx + dy * dy;
        if (!length) continue;
        const t = ((x - a[0]) * dx + (y - a[1]) * dy) / length;
        if (t >= 0 && t <= 1 && Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < 24) {
          this.onRoute((leg.offset + t * leg.distance) / this.routePlan.totalDistance);
          return;
        }
      }
    }
    if (this.route && !this.routePlan) {
      let a = this.project(this.route[0].position),
        b = this.project(this.route[1].position),
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = dx * dx + dy * dy,
        t = l ? ((x - a[0]) * dx + (y - a[1]) * dy) / l : 0;
      if (t >= 0 && t <= 1 && Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < 24) this.onRoute(t);
    }
  }
  setPlan(plan) {
    this.routePlan = plan;
    this.route = null;
    if (plan.systems.length > 1) this.setSystem('universe');
    else {
      this.setSystem(plan.systems[0]);
      const points = plan.legs.flatMap(l => [l.start, l.end]);
      if (points.length) {
        const lo = [0, 1, 2].map(i => Math.min(...points.map(p => p[i]))),
          hi = [0, 1, 2].map(i => Math.max(...points.map(p => p[i])));
        this.center = lo.map((v, i) => (v + hi[i]) / 2);
        this.span = Math.max(2e5, Math.hypot(...lo.map((v, i) => hi[i] - v)) * 1.6);
      }
    }
    this.invalidate();
  }
  drawUniverse() {
    const c = this.ctx,
      connections = new Set();
    const short=this.h<340&&this.w>this.h*1.5;
    const point=s=>{if(short)return [this.w*(this.systems.length-this.systems.indexOf(s))/(this.systems.length+1),this.h*.40];const [x,y]=this.project(s.position);return [x,this.h-y];};
    for (const gate of this.bodies.filter(b => b.kind === 'gateway')) {
      const a = this.systems.find(s => s.id === gate.system),
        b = this.systems.find(s => s.id === gate.destinationSystem);
      if (!a || !b || !this.bodies.some(g => g.kind === 'gateway' && g.system === b.id && g.destinationSystem === a.id)) continue;
      const key = [a.id, b.id].sort().join(':');
      if (connections.has(key)) continue;
      connections.add(key);
      const p = point(a),
        q = point(b),
        planned = this.routePlan?.systems.some((s, i, list) => i > 0 && [s, list[i - 1]].sort().join(':') === key);
      c.strokeStyle = planned ? '#a9dcff' : '#73909b';
      c.lineWidth = planned ? 2.5 : 1;
      c.setLineDash([6, 5]);
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.lineTo(q[0], q[1]);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#b4c8ce';
      c.font = '10px Arial';
      c.fillText('JUMP TUNNEL', (p[0] + q[0]) / 2 - 30, (p[1] + q[1]) / 2 - 10);
    }
    for (const s of this.systems) {
      const [x, y] = point(s), radius = short?Math.min(54,this.h*.16):Math.max(34, Math.min(76, this.w * .1));
      const planets = this.bodies.filter(b => b.system === s.id && ['planet', 'body'].includes(b.kind));
      const extent = Math.max(1, ...planets.map(b => Math.hypot(...b.position)));
      c.fillStyle = '#08151ef0';
      c.beginPath();
      c.ellipse(x, y, radius + 8, (radius + 8) * .65, -.12, 0, Math.PI * 2);
      c.fill();
      const star=this.bodies.find(b=>b.system===s.id&&b.kind==='star');
      drawOrbitalLight(c,star,x,y,radius,.65);
      {
        const weight=this.reports.filter(r=>(r.system||'stanton')===s.id).reduce((total,r)=>total+activityWeight(r),0);
        if(weight>0){const alpha=1-Math.exp(-weight*.6),gradient=c.createRadialGradient(x,y,0,x,y,radius+12);gradient.addColorStop(0,`rgba(255,95,30,${alpha*.8})`);gradient.addColorStop(1,'rgba(255,95,30,0)');c.fillStyle=gradient;c.fillRect(x-radius-12,y-radius-12,(radius+12)*2,(radius+12)*2);}
      }
      for (const body of planets) {
        const orbit = Math.hypot(...body.position) / extent * radius;
        c.strokeStyle = starColor(star,.24);
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(x, y, orbit, orbit * .65, -.12, 0, Math.PI * 2);
        c.stroke();
        const a = body.position[0] / extent * radius,
          b = body.position[1] / extent * radius;
        const bx = x + a * Math.cos(-.35) - b * Math.sin(-.35),
          by = y - (a * Math.sin(-.35) + b * Math.cos(-.35)) * .65;
        c.fillStyle = '#d4e1df';
        c.beginPath();
        c.arc(bx, by, 2.5, 0, Math.PI * 2);
        c.fill();
      }
      if(star)drawStar(c,this.starSurfaces,star,x,y,5*stellarRadius(star)/this.maxStarRadius);
      c.fillStyle = '#e2eeee';
      c.font = '17px Arial';
      c.fillText(s.name, x - 23, y + radius * .7 + 24);
      c.font = '9px Arial';
      c.fillStyle = '#a6bec5';
      c.fillText(this.bodies.filter(b => b.system === s.id && !b.hidden).length + ' locations', x - 23, y + radius * .7 + 41);
      this.hits.push({
        x,
        y,
        r: radius + 15,
        body: {
          ...s,
          kind: 'system'
        }
      });
    }
    document.querySelector('#scale').textContent = 'GAME GALACTIC COORDINATES';
  }
  draw() {
    const c = this.ctx;
    let rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    if (!this.w || !this.h) return;
    const moving=!!this.transition||this.pointers.size>0||performance.now()<(this.motionUntil||0);
    let d = Math.min(devicePixelRatio || 1, 1.5);
    if (this.canvas.width !== Math.round(this.w * d) || this.canvas.height !== Math.round(this.h * d)) {
      this.canvas.width = Math.round(this.w * d);
      this.canvas.height = Math.round(this.h * d);
    }
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.scale = Math.min(this.w, this.h) / this.span;
    this.hits = [];
    // Stable, sparse star field: no continuously animated background.
    for (let i = 0; i < 150; i++) {
      let x = ((i * 7919) % 1009) / 1009 * this.w,
        y = ((i * 3571) % 1013) / 1013 * this.h;
      c.fillStyle = i % 6 ? '#44616b50' : '#8daca760';
      c.fillRect(x, y, i % 6 ? 1 : 1.5, 1);
    }
    if (this.system === 'universe') {
      this.drawUniverse();
      return;
    }
    const visibleBodies = this.bodies.filter(b => !b.system || b.system === this.system);
    const beltLabels=drawBelts(c,this.belts,this.system,p=>this.project(p),this.center,this.span,this.w,this.h);
    const star=visibleBodies.find(b=>b.kind==='star');
    if(star&&this.span>stellarRadius(star)*12){const [x,y]=this.project(star.position);drawOrbitalLight(c,star,x,y,Math.min(this.w,this.h)*.65,Math.sin(this.pitch));}
    const line = (points, color, width = 1, dash = []) => {
      c.beginPath();
      points.forEach((p, i) => {
        let s = this.project(p);
        i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
      });
      c.strokeStyle = color;
      c.lineWidth = width;
      c.setLineDash(dash);
      c.stroke();
      c.setLineDash([]);
    };
    if (this.span > 2e10) {
      for (let planet of visibleBodies.filter(b => b.kind === 'planet' || b.kind === 'body')) {
        const r = Math.hypot(...planet.position);
        let ps = Array.from({
          length: 129
        }, (_, i) => [Math.cos(i * Math.PI / 64) * r, Math.sin(i * Math.PI / 64) * r, 0]);
        line(ps, starColor(star,.16));
      }
      line([
        [-6e10, 0, 0],
        [6e10, 0, 0]
      ], '#37535c50');
      line([
        [0, -6e10, 0],
        [0, 6e10, 0]
      ], '#37535c50');
    }
    for (let b of visibleBodies.filter(b => b.kind === 'moon')) {
      let p = this.byId.get(b.parent);
      if (!p) continue;
      let r = Math.hypot(...b.position.map((v, i) => v - p.position[i]));
      if (r * this.scale > 15 && r * this.scale < this.w * 2) line(Array.from({
        length: 97
      }, (_, i) => [p.position[0] + Math.cos(i * Math.PI / 48) * r, p.position[1] + Math.sin(i * Math.PI / 48) * r, p.position[2]]), '#35505a60');
    }
    const labels=[...beltLabels];
    if (this.routePlan) {
      for (const segment of this.routePlan.legs.filter(l => l.kind !== 'jump' && l.system === this.system)) {
        line([segment.start, segment.end], segment.kind === 'local' ? '#e9c28d' : '#a9dcff', 2, [7, 5]);
        for (const [p, name] of [
            [segment.start, segment.startName],
            [segment.end, segment.endName]
          ]) {
          if (!name.includes('OM-') && !name.includes('boundary')) continue;
          const [x, y] = this.project(p);
          c.strokeStyle = '#c9e7df';
          c.strokeRect(x - 4, y - 4, 8, 8);
          // Real catalogue OMs get their normal label; synthetic boundary labels
          // share the same collision pass as planets and POIs.
          if(!this.bodies.some(b=>b.system===this.system&&b.name===name)){
            c.font='10px Arial';labels.push({id:'route:'+name,x,y,r:4,text:name,width:c.measureText(name).width,priority:4});
          }
        }
      }
    } else if (this.route) line(this.route.map(b => b.position), '#a9dcff', 2, [7, 5]);
    const routeNames=new Set(this.routePlan?.legs.filter(l=>l.system===this.system).flatMap(l=>[l.startName,l.endName])||[]);
    const important=b=>b.id===this.selected||this.route?.some(p=>p.id===b.id)||routeNames.has(b.name);
    const prominent=b=>prominentLocation(b,this.surfaceParent(b),this.span)||(b.mapImportance==='primary'||b.kind==='moon')&&this.surfaceParent(b)?.id===this.orbitFocus;
    const priority = b => b.kind==='planet'&&this.byId.get(b.parent)?.kind==='planet'?4:labelPriority(prominent(b)?b:{...b,mapImportance:'local'},important(b));
    const layer=b=>b.radius>0||b.kind==='star'?0:b.id===this.selected?2:1;
    const sorted = [...visibleBodies].sort((a,b)=>layer(a)-layer(b)||priority(a)-priority(b)||Number(this.markerVisibility.has(b.id))-Number(this.markerVisibility.has(a.id))||a.id.localeCompare(b.id));
    clearTimeout(this.portalTimer);this.portalTimer=null;
    const occupied=[],markers=new Set();let portalMoving=false;
    for (let b of sorted) {
      let [x, y] = this.project(b.position);
      const bound = Math.max(30, (b.kind==='star'?stellarRadius(b)*3.2:b.radius||0) * this.scale);
      if (x < -bound || x > this.w + bound || y < -bound || y > this.h + bound) continue;
      // The game hides occupied Lagrange anchors in favour of their stations.
      // At system scale use the short anchor label, then reveal the station locally.
      if (b.hidden && !(b.kind==='lagrange'&&this.span>3e10)) continue;
      if(b.kind==='planet'&&b.id!==this.selected){
        const group=this.byId.get(b.parent);
        if(group?.kind==='planet'){const [gx,gy]=this.project(group.position);if(Math.hypot(x-gx,y-gy)<Math.max(32,(group.radius+b.radius)*this.scale+12))continue;}
      }
      if (b.category === 'auxiliary' && this.selected !== b.id) continue;
      const major = prominent(b);
      const pinned=important(b)||secondaryLandmark(b),selected=this.selected===b.id;
      const parent = this.surfaceParent(b);
      const orbitFacility=this.view?.level==='orbits'&&parent&&!(b.radius>0)&&b.kind!=='om';
      if (!pinned&&!major&&parent && this.span > parent.radius * 25 && b.kind !== 'moon') continue;
      if (parent && this.span < parent.radius * 6 && this.occluded(b.position, parent)) continue;
      const container = this.byId.get(b.parent);
      if(!pinned&&!major&&this.span>detailSpan(b,container)*(this.markerVisibility.has(b.id)?1.18:1))continue;
      // Do not draw a cloud of diamonds over a planet or at the same station hub.
      if(!major&&b.kind!=='moon'&&!pinned&&!markerFits({x,y},occupied,this.w<500?42:30))continue;
      let r = b.kind === 'star' ? Math.max(6,10*stellarRadius(b)/this.maxStarRadius,stellarRadius(b)*this.scale) : b.radius > 0 ? Math.max(b.kind === 'planet' ? 13 : 7, b.radius * this.scale) : 4;
      occupied.push({x,y,r:major||b.kind==='moon'?Math.min(r,60):4});markers.add(b.id);
      let color = b.kind === 'star' ? '#e7ce90' : b.kind === 'gateway' ? '#d9bf88' : b.kind === 'planet' ? '#86c8d0' : '#6b9ca8';
      const detailedModel=b.modelRole!=='symbol'&&this.span<4e8&&(!parent||this.span<parent.radius*12);
      // Share one fixed silhouette per game mesh until a close-up needs camera rotation.
      const model=!orbitFacility&&b.model&&b.kind!=='gateway'?this.mapModels.get(b.modelRole==='symbol'?{...b,rotation:[1,0,0,0]}:b,detailedModel?this.yaw:0,detailedModel?this.pitch:-.6,modelResolution(detailedModel?(b.modelSize||1000)*this.scale:12,moving,Math.min(this.w,this.h))):null;
      if(orbitFacility){
        // At local-orbit scale, city/station art would cover the globe. Keep
        // selectable labels, but defer both art loading and glyph hit targets.
      }else if(b.kind==='star'){
        drawStar(c,this.starSurfaces,b,x,y,r);
      }else if(b.kind==='gateway'){
        r=portalRadius(this.span,Math.min(this.w,this.h));
        const active=this.systems.some(s=>s.id===b.destinationSystem),reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
        const moving=animatePortal({selected,radius:r,visible:document.visibilityState==='visible',reducedMotion,dragging:this.pointers.size>0,connected:active});
        const seed=[...b.id].reduce((sum,char)=>sum+char.charCodeAt(0),0)*.37;
        drawJumpPortal(c,x,y,r,{phase:moving?performance.now()/1000+seed:seed,active,pitch:this.pitch,yaw:this.yaw,system:b.system});portalMoving||=moving;
      }else if(model){
        r=detailedModel?Math.max(14,Math.min(Math.min(this.w,this.h)*.40/(model.meshExtent||model.meshRadius||.5),(b.modelSize||1000)*this.scale)):selected&&parent&&this.span<parent.radius?28:pinned||major?12:9;
        c.drawImage(model,x-r,y-r,r*2,r*2);
      } else if (b.radius > 0 || b.kind === 'star') {
        const viewport=r>Math.max(this.w,this.h)*2?{width:this.w,height:this.h,x,y,radius:r}:null;
        const globe = this.globeTextures.get(b, this.yaw, this.pitch, globeResolution(r,moving,Math.min(this.w,this.h),!!viewport),viewport,{moving});
        if (globe) {
          if(viewport)c.drawImage(globe,0,0,this.w,this.h);else c.drawImage(globe, x - r, y - r, r * 2, r * 2);
          c.strokeStyle = '#91e3f04d';
          c.lineWidth = 1;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.stroke();
        } else {
          let g = c.createRadialGradient(x - r * .35, y - r * .35, 1, x, y, r);
          g.addColorStop(0, color);
          g.addColorStop(.7, '#29474e');
          g.addColorStop(1, '#102128');
          c.fillStyle = g;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = color + '99';
          c.stroke();
        }
      } else {
        c.strokeStyle = pinned ? '#ecf5f5' : b.kind==='gateway'?color:'#6b9ca890';
        c.lineWidth = selected ? 2 : 1;
        c.beginPath();
        if(!pinned&&b.kind==='om'){
          c.arc(x,y,2.5,0,Math.PI*2);
        }else if(!pinned&&b.kind==='lagrange'){
          c.moveTo(x-3,y);c.lineTo(x+3,y);c.moveTo(x,y-3);c.lineTo(x,y+3);
        }else if(!pinned&&!major){
          c.rect(x-3,y-3,6,6);
        }else{
        c.moveTo(x, y - r - 2);
        c.lineTo(x + r + 2, y);
        c.lineTo(x, y + r + 2);
        c.lineTo(x - r - 2, y);
        c.closePath();
        }
        c.stroke();
      }
      const displayR=orbitFacility?Math.max(parent.kind==='planet'?13:7,parent.radius*this.scale):model?r*(model.meshRadius||1):r;
      if(!orbitFacility)this.hits.push({
        x,
        y,
        r: Math.max(18, displayR + 6),
        body: b
      });
      const prominentLabel=major||b.kind==='moon';
      const threshold=b.kind==='om'?35:100;
      const pixels=parent?parent.radius*this.scale:Infinity;
      const allowed=prominentLabel||pinned||b.kind==='lagrange'||pixels>(this.labelVisibility.has(b.id)?threshold*.82:threshold);
      if(!allowed){this.labelVisibility.delete(b.id);continue;}
      this.labelVisibility.add(b.id);
      c.font = (prominentLabel ? '12' : '10') + 'px Arial';
      const fullText=b.name.replace(/^People's Service Station /,"People's ").replace(/^QV Breaker Station /,'QV ').replace(/^Transit Point Glaciem /,'Glaciem ');let text=fullText;const limit=selected?190:145;
      while(text.length>4&&c.measureText(text).width>limit)text=text.slice(0,-2);
      if(text!==fullText)text+='…';
      labels.push({id:b.id,x,y,r:displayR,text,width:c.measureText(text).width,body:b,selected,important:pinned,major:prominentLabel,priority:priority(b)});
    }
    labels.push(...drawBelts(c,this.belts,this.system,p=>this.project(p),this.center,this.span,this.w,this.h,{local:true,occluded:(p,belt)=>{const parent=this.byId.get(belt.parent);return parent?this.occluded(p,parent):false;}}));
    this.markerVisibility=markers;
    if(portalMoving)this.portalTimer=setTimeout(()=>{this.portalTimer=null;this.invalidate();},50);
    this.drawHeatmap();
    const obstacles=[];
    for(const overlay of document.querySelectorAll?.('.map-title,.map-controls,.map-tools-tray,#map-location-actions,#heat-legend,#report,.map-bottom,.map-help,.panel-toggle')||[]){
      const box=overlay.getBoundingClientRect();if(box.width&&box.height)obstacles.push({x:box.left-rect.left,y:box.top-rect.top,w:box.width,h:box.height});
    }
    for(const report of this.reports){if((report.system||'stanton')!==this.system)continue;const [x,y]=this.project(report.position);obstacles.push({x:x-17,y:y-17,w:34,h:34});}
    for(const hit of this.hits){if(hit.body&&['planet','moon','star','body'].includes(hit.body.kind)&&hit.r<70)obstacles.push({bodyId:hit.body.id,x:hit.x-hit.r,y:hit.y-hit.r,w:hit.r*2,h:hit.r*2});}
    const layout=layoutLabels(labels,this.w,this.h,this.labelAnchors,obstacles);
    for(const [id,anchor] of layout.anchors)this.labelAnchors.set(id,anchor);
    const labelTime=performance.now(),tracked=trackLabels(layout.placed,this.labelMotion,labelTime-this.labelClock,this.w,this.h,obstacles);this.labelClock=labelTime;this.labelMotion=tracked.history;
    if(tracked.moving)this.invalidate();
    for(const box of tracked.placed){
      c.globalAlpha=box.alpha;
      const b=box.item;c.font=(b.major?'12':'10')+'px Arial';
      const end=[Math.max(box.x,Math.min(box.x+box.w,b.x)),box.y+box.h/2],dx=end[0]-b.x,dy=end[1]-b.y,distance=Math.hypot(dx,dy)||1;
      // A globe's leader starts at its limb, never across the whole surface.
      const inset=b.major?Math.min(b.r,distance):0;
      c.strokeStyle=b.selected?'#aadff0aa':'#6c9da44d';c.lineWidth=.7;c.beginPath();c.moveTo(b.x+dx/distance*inset,b.y+dy/distance*inset);c.lineTo(...end);c.stroke();
      c.fillStyle='#081623dc';c.fillRect(box.x,box.y,box.w,box.h);
      c.fillStyle=b.selected?'#f1fbff':b.major?'#c2e8ee':'#9fc7d1';c.fillText(b.text,box.x+7,box.y+(b.major?16:14));
      if(b.body)this.hits.push({x:box.x+box.w/2,y:box.y+box.h/2,r:0,box,body:b.body});
    }
    c.globalAlpha=1;
    for (let r of this.reports) {
      if(!Number.isFinite(Number(r.created))||Date.now()/1000-Number(r.created)>=7200)continue;
      if ((r.system || 'stanton') !== this.system) continue;
      if (visibleBodies.some(b => b.radius > 0 && this.occluded(r.position, b))) continue;
      let [x, y] = this.project(r.position);
      if (x < 0 || x > this.w || y < 0 || y > this.h) continue;
      c.strokeStyle = r.kind === 'Clear' ? '#8be7dc' : '#f3917e';
      c.fillStyle = '#182328';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, y - 11);
      c.lineTo(x + 10, y + 8);
      c.lineTo(x - 10, y + 8);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = c.strokeStyle;
      c.font = 'bold 10px Arial';
      c.fillText(r.kind === 'Clear' ? '✓' : '!', x - 3, y + 4);
      this.hits.push({
        x,
        y,
        r: 19,
        report: r
      });
    }
    if (this.marker) {
      let [x, y] = this.project(this.marker);
      c.strokeStyle = '#fff0ad';
      c.beginPath();
      c.arc(x, y, 14, 0, Math.PI * 2);
      c.moveTo(x - 22, y);
      c.lineTo(x + 22, y);
      c.moveTo(x, y - 22);
      c.lineTo(x, y + 22);
      c.stroke();
    }
    for(const [role,body] of Object.entries(this.routePins||{})){
      if(!body||body.system!==this.system)continue;const [x,y]=this.project(body.position);
      c.strokeStyle=role==='origin'?'#9bffda':'#ffa1d2';c.fillStyle=c.strokeStyle;c.lineWidth=2;c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.stroke();c.font='bold 11px Arial';c.fillText(role==='origin'?'A':'B',x-4,y+4);
    }
    if(this.snarePlan?.system===this.system)drawSnare(c,this.snarePlan,p=>this.project(p),this.scale,this.w,this.h);
    document.querySelector('#scale').textContent = this.span<1e6?(this.span/1000).toFixed(this.span<10000?1:0)+' km / VIEW':(this.span / 1e9).toFixed(this.span < 1e9 ? 3 : 1) + ' M km / VIEW';
  }
}
