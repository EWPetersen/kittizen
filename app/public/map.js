import {
  GlobeTextures
} from './sphere.js';
import {activityWeight,heatField,heatPixels} from './heatmap.js';
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
    new ResizeObserver(() => this.invalidate()).observe(canvas);
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
      this.moved = false;
    });
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => {
      if (!this.moved && this.pointers.size === 1 && (e.button ?? this.dragButton) === 2) {
        const time = e.timeStamp ?? performance.now(),
          prior = this.rightTap;
        if (prior && time - prior.time < 450 && Math.hypot(e.clientX - prior.x, e.clientY - prior.y) < 12) {
          this.home();
          this.onSystemChanged?.(this.system);
          this.rightTap = null;
        } else this.rightTap = {
          time,
          x: e.clientX,
          y: e.clientY
        };
      } else if (!this.moved && this.pointers.size === 1) this.click(e);
      this.pointers.delete(e.pointerId);
      this.invalidate();
    });
    canvas.addEventListener('pointercancel', e => this.pointers.delete(e.pointerId));
    canvas.addEventListener('dblclick', e => {
      if (e.button === 2) {
        this.home();
        this.onSystemChanged?.(this.system);
        return;
      }
      const rect = canvas.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const gate = this.hits.find(h => h.body?.kind === 'gateway' && Math.hypot(h.x - x, h.y - y) < h.r);
      if (gate && this.systems.some(s => s.id === gate.body.destinationSystem)) this.setSystem(gate.body.destinationSystem);
      else this.zoom(1.8);
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
      this.draw();
    });
  }
  setBodies(bodies) {
    this.bodies = bodies;
    this.byId = new Map(bodies.map(b => [b.id, b]));
  }
  drawHeatmap(now=Date.now()/1000){
    const points=this.reports.filter(r=>(r.system||'stanton')===this.system).map(r=>{
      const [x,y]=this.project(r.position);return {x,y,weight:activityWeight(r,now)};
    }).filter(p=>p.weight>0);
    if(!points.length)return;
    const data=heatField(points,this.w,this.h),layer=this.heatLayer||(this.heatLayer=document.createElement('canvas'));
    layer.width=data.width;layer.height=data.height;
    layer.getContext('2d').putImageData(new ImageData(heatPixels(data.field),data.width,data.height),0,0);
    this.ctx.drawImage(layer,0,0,this.w,this.h);
  }
  project(p) {
    let [x, y, z] = p.map((v, i) => v - this.center[i]);
    let u = x * Math.cos(this.yaw) - y * Math.sin(this.yaw),
      v = x * Math.sin(this.yaw) + y * Math.cos(this.yaw);
    return [this.w / 2 + u * this.scale, this.h / 2 + (v * Math.sin(this.pitch) - z * Math.cos(this.pitch)) * this.scale, v * Math.cos(this.pitch) + z * Math.sin(this.pitch)];
  }
  zoom(f, anchor) {
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
        this.focus(body.body);
        this.onSelect(body.body);
        this.zoom(f);
        return;
      }
    }
    const prior = this.span;
    this.span = Math.max(this.system === 'universe' ? 20 : 2e4, Math.min(3e12, this.span / f));
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
    const major = this.bodies.filter(b => b.system === this.system && ['planet', 'gateway', 'body'].includes(b.kind));
    this.systemSpan = major.length ? Math.max(...major.map(b => Math.hypot(...b.position))) * 2.6 : 1.2e11;
    this.span = this.systemSpan;
    this.yaw = -.35;
    this.pitch = -.72;
    this.invalidate();
  }
  setSystem(id) {
    if (id !== 'universe' && !this.systems.some(s => s.id === id)) return;
    this.system = id;
    this.selected = null;
    this.home();
    this.onSystemChanged?.(id);
  }
  focus(b) {
    this.center = [...b.position];
    const parent = this.surfaceParent(b);
    this.span = b.radius > 0 ? b.radius * 2.8 : b.kind === 'star' ? 1.2e11 : parent ? parent.radius * 2.8 : 2e7;
    if (parent) {
      const normal = b.position.map((v, i) => v - parent.position[i]),
        length = Math.hypot(...normal);
      this.center = [...parent.position];
      this.yaw = Math.atan2(normal[0], normal[1]);
      this.pitch = Math.asin(normal[2] / length);
    }
    this.selected = b.id;
    this.invalidate();
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
    const scale = Math.min(this.w, this.h) / this.span,
      u = dx / scale,
      v = dy / scale;
    this.center[0] -= u * Math.cos(this.yaw) + v * Math.sin(this.yaw) * Math.sin(this.pitch);
    this.center[1] -= -u * Math.sin(this.yaw) + v * Math.cos(this.yaw) * Math.sin(this.pitch);
    this.center[2] += v * Math.cos(this.pitch);
  }
  focusSystem(body) {
    this.center = [...body.position];
    this.selected = body.id;
    const children = this.bodies.filter(b => b.parent === body.id);
    this.span = Math.max(body.radius * 8, ...children.map(b => Math.hypot(...b.position.map((v, i) => v - body.position[i])) * 2.6));
    this.invalidate();
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
        this.rightTap = null;
        if (!e.shiftKey && this.dragButton !== 2 && !(e.buttons & 2)) {
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
    let hit = this.hits.filter(h => Math.hypot(h.x - x, h.y - y) < h.r).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (hit) {
      if (hit.body?.kind === 'system') this.setSystem(hit.body.id);
      else if (hit.body) this.onSelect(hit.body);
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
    for (const gate of this.bodies.filter(b => b.kind === 'gateway')) {
      const a = this.systems.find(s => s.id === gate.system),
        b = this.systems.find(s => s.id === gate.destinationSystem);
      if (!a || !b || !this.bodies.some(g => g.kind === 'gateway' && g.system === b.id && g.destinationSystem === a.id)) continue;
      const key = [a.id, b.id].sort().join(':');
      if (connections.has(key)) continue;
      connections.add(key);
      const p = this.project(a.position),
        q = this.project(b.position),
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
      const [x, y] = this.project(s.position), radius = Math.max(34, Math.min(76, this.w * .1));
      const planets = this.bodies.filter(b => b.system === s.id && ['planet', 'body'].includes(b.kind));
      const extent = Math.max(1, ...planets.map(b => Math.hypot(...b.position)));
      c.fillStyle = '#08151ef0';
      c.beginPath();
      c.ellipse(x, y, radius + 8, (radius + 8) * .65, -.12, 0, Math.PI * 2);
      c.fill();
      {
        const weight=this.reports.filter(r=>(r.system||'stanton')===s.id).reduce((total,r)=>total+activityWeight(r),0);
        if(weight>0){const alpha=1-Math.exp(-weight*.6),gradient=c.createRadialGradient(x,y,0,x,y,radius+12);gradient.addColorStop(0,`rgba(255,95,30,${alpha*.8})`);gradient.addColorStop(1,'rgba(255,95,30,0)');c.fillStyle=gradient;c.fillRect(x-radius-12,y-radius-12,(radius+12)*2,(radius+12)*2);}
      }
      for (const body of planets) {
        const orbit = Math.hypot(...body.position) / extent * radius;
        c.strokeStyle = '#7998a16e';
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
      c.beginPath();
      c.arc(x, y, 5, 0, Math.PI * 2);
      c.fillStyle = '#e7d29c';
      c.fill();
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
        line(ps, '#49657050');
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
          c.fillStyle = '#e6f5ec';
          c.font = '10px Arial';
          c.fillText(name, x + 7, y - 5);
        }
      }
    } else if (this.route) line(this.route.map(b => b.position), '#a9dcff', 2, [7, 5]);
    let labelBoxes = [];
    const priority = b => b.kind === 'planet' ? 0 : b.kind === 'moon' ? 1 : b.kind === 'star' ? 2 : b.id === this.selected ? 99 : 4;
    const sorted = [...visibleBodies].sort((a, b) => priority(a) - priority(b));
    for (let b of sorted) {
      let [x, y] = this.project(b.position);
      const bound = Math.max(30, (b.radius || 0) * this.scale);
      if (x < -bound || x > this.w + bound || y < -bound || y > this.h + bound) continue;
      if (b.hidden) continue;
      if (b.category === 'auxiliary' && this.selected !== b.id) continue;
      let major = ['planet', 'star', 'gateway', 'body'].includes(b.kind);
      const parent = this.surfaceParent(b);
      if (parent && this.span > parent.radius * 25 && b.kind !== 'moon') continue;
      if (parent && this.span < parent.radius * 25 && this.occluded(b.position, parent)) continue;
      const container = this.byId.get(b.parent);
      if (!major && this.span > 3e9 && b.kind !== 'lagrange' && container?.kind !== 'lagrange') continue;
      let selected = this.selected === b.id;
      let r = b.kind === 'star' ? 10 : b.radius > 0 ? Math.max(b.kind === 'planet' ? 13 : 7, b.radius * this.scale) : 4;
      let color = b.kind === 'star' ? '#e7ce90' : b.kind === 'gateway' ? '#d9bf88' : b.kind === 'planet' ? '#86c8d0' : '#6b9ca8';
      if (selected && b.radius > 0) {
        c.strokeStyle = '#ff9dd0';
        c.lineWidth = 1;
        c.strokeRect(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12);
      }
      if (b.radius > 0 || b.kind === 'star') {
        const globe = this.globeTextures.get(b, this.yaw, this.pitch, r > 150 && !this.pointers.size ? 384 : 256);
        if (globe) {
          c.drawImage(globe, x - r, y - r, r * 2, r * 2);
          c.strokeStyle = '#d9e4e470';
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
        c.beginPath();
        c.ellipse(x, y, r * .45, r, 0, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.ellipse(x, y, r, r * .35, 0, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.strokeStyle = selected ? '#ecf5f5' : color;
        c.lineWidth = selected ? 2 : 1;
        c.beginPath();
        c.moveTo(x, y - r - 2);
        c.lineTo(x + r + 2, y);
        c.lineTo(x, y + r + 2);
        c.lineTo(x - r - 2, y);
        c.closePath();
        c.stroke();
      }
      this.hits.push({
        x,
        y,
        r: Math.max(18, r + 6),
        body: b
      });
      c.font = (major ? '11' : '9') + 'px Arial';
      let w = c.measureText(b.name).width,
        box = [Math.min(this.w - w - 8, x + r + 7), y - 7, w + 4, 16];
      if (selected || !labelBoxes.some(a => a[0] < box[0] + box[2] && a[0] + a[2] > box[0] && a[1] < box[1] + box[3] && a[1] + a[3] > box[1])) {
        c.fillStyle = '#081318c9';
        c.fillRect(box[0] - 3, y - 9, w + 6, 17);
        c.fillStyle = selected ? '#ffffff' : major ? '#d8e4e4' : '#c3d3d8';
        c.fillText(b.name, box[0], y + 4);
        labelBoxes.push(box);
      }
    }
    this.drawHeatmap();
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
    document.querySelector('#scale').textContent = (this.span / 1e9).toFixed(this.span < 1e9 ? 3 : 1) + ' M km / VIEW';
  }
}
