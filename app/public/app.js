import {
  StarMap
} from './map.js';
import {
  positionOnRoute
} from './route.js';
const $ = s => document.querySelector(s),
  el = (tag, text, cls) => {
    let n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
let catalog, bodies, map, catalogRevision = null,
  user = null,
  reports = [],
  activeRoute = null,
  selected = null,
  loadGeneration = 0,
  reportFraction = .5;
let currentShard = localStorage.getItem('kittizen-shard') || '';
if (!/^(US|EU|AUS|ASIA)-[0-9]{3}$/.test(currentShard)) currentShard = '';
const api = async (path, data) => {
  let response = await fetch('/api/' + path, data ? {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  } : {});
  let result = await response.json();
  if (!response.ok) throw Error(result.error || 'Request failed');
  return result;
};
let toastTimer;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').style.display = 'none', 4500);
}

function panel(id) {
  document.body.classList.remove('panel-sidebar', 'panel-intel');
  if (id !== 'map-area') document.body.classList.add('panel-' + id);
  document.querySelectorAll('#mobile-nav button').forEach(b => b.classList.toggle('active', b.dataset.panel === id));
  if (id === 'intel') document.body.classList.toggle('intel-open');
  map?.invalidate();
}
document.querySelectorAll('[data-panel]').forEach(b => b.onclick = () => panel(b.dataset.panel));
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $('#' + b.dataset.close).close());

function ago(t) {
  if (!t) return 'never';
  let minutes = Math.max(0, Math.floor((Date.now() / 1000 - t) / 60));
  return minutes < 1 ? 'just now' : minutes < 60 ? minutes + 'm ago' : Math.floor(minutes / 60) + 'h ago';
}

function option(value, label) {
  let o = el('option', label);
  o.value = value;
  return o;
}

function needUser() {
  if (user) return true;
  showAuth();
  return false;
}
async function refreshMe() {
  let me = await api('me');
  user = me.user;
  $('#account').textContent = user ? user.handle + ' · ' + me.trust.score + '%' : 'Sign in';
  $('#account').title = user ? 'Open your pilot profile' : 'Sign in';
  await loadRoutes();
}
$('#account').onclick = () => user ? openProfile(user.handle) : showAuth();
$('#sign-out').onclick = async () => {
  try { await api('logout',{}); $('#profile-dialog').close(); history.replaceState(null,'',location.pathname); await refreshMe(); renderReports(); toast('Signed out'); }
  catch(error){toast(error.message);}
};
let googleScript;
async function prepareGoogle(target,status){
  const holder=$(target),message=$(status); holder.replaceChildren();
  try {
    const config=await api('auth-config');
    if(!config.googleClientId){message.textContent='Google sign-in is not available yet. Local accounts still work.';return;}
    message.textContent='';
    googleScript ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>reject(Error('Google sign-in could not load. Please retry or use your password.'));document.head.append(script);}).catch(error=>{googleScript=null;throw error;});
    await googleScript;
    window.google.accounts.id.initialize({client_id:config.googleClientId,nonce:config.nonce,auto_select:false,callback:async response=>{
      try{await api('google',{credential:response.credential});$('#auth-dialog').close();await refreshMe();await loadReports();if($('#profile-dialog').open)await openProfile(user.handle);toast('Google connected');}
      catch(error){message.textContent=error.message;}
    }});
    window.google.accounts.id.renderButton(holder,{theme:'outline',size:'large',text:'continue_with',width:280});
  }catch(error){message.textContent=error.message;}
}
function showAuth(){ $('#auth-dialog').showModal(); prepareGoogle('#google-signin','#google-status'); }
async function openProfile(handle){
  const dialog=$('#profile-dialog'),content=$('#profile-content');
  content.replaceChildren(el('p','Loading pilot profile…'));$('#sign-out').hidden=true;$('#profile-google').replaceChildren();$('#profile-google-status').textContent='';
  if(!dialog.open)dialog.showModal();
  history.replaceState(null,'','#pilot/'+encodeURIComponent(handle));
  try{
    const p=await api('profile?handle='+encodeURIComponent(handle));
    $('#profile-title').textContent=p.handle;
    content.replaceChildren(el('p','Pilot since '+new Date(p.created*1000).toLocaleDateString()),el('p',`${p.trust.tier} · ${p.trust.score}% trust · ${p.trust.verifiers} independent verifiers`),el('p','Last confirmation '+ago(p.trust.lastVerified)));
    const stats=el('dl',undefined,'profile-stats');
    for(const [label,value] of [['Reports submitted',p.stats.reports],['Active reports',p.stats.active],['Confirmations received',p.stats.confirmations],['Disputes received',p.stats.disputes],['Verifications given',p.stats.verificationsGiven]])stats.append(el('dt',label),el('dd',String(value)));
    content.append(stats);
    if(p.own){
      $('#sign-out').hidden=false;
      const edit=el('form'),label=el('label','PILOT HANDLE'),input=el('input'),save=el('button','Save handle');
      input.value=p.handle;input.required=true;input.minLength=3;input.maxLength=24;input.pattern='[A-Za-z0-9_-]{3,24}';input.setAttribute('aria-label','Pilot handle');save.type='submit';label.append(input);edit.append(label,save);
      edit.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await api('profile',{handle:input.value});await refreshMe();await loadReports();await openProfile(user.handle);toast('Pilot handle updated');}catch(error){toast(error.message);save.disabled=false;}};
      content.append(edit);
      content.append(el('h3','Your recent reports'),el('p','Latest 50 reports, including expired reports. Activity locations remain private to this history.', 'hint'));
      if(!p.history.length)content.append(el('p','No reports yet. Choose a shard and report activity from the map.'));
      for(const r of p.history){const card=el('article',undefined,'report-card');card.append(el('h3',r.kind+' · '+(r.active?'Active':'Expired')),el('p',r.location+' · '+r.system.toUpperCase()+' · '+r.shard),el('small',new Date(r.created*1000).toLocaleString()),el('small',`${r.confirmations} confirmed · ${r.disputes} disputed · last confirmation ${ago(r.lastVerified)}`));content.append(card);}
      if(p.googleLinked)$('#profile-google-status').textContent='Google sign-in linked. You can use Google to return to this pilot account.';
      else{const link=el('button','Link Google sign-in');link.type='button';link.onclick=()=>prepareGoogle('#profile-google','#profile-google-status');content.append(link);}
    }else content.append(el('p','Detailed report history is visible only to this pilot.','hint'));
  }catch(error){content.replaceChildren(el('p',error.message,'error'));}
}
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#pilot/')){try{openProfile(decodeURIComponent(location.hash.slice(7)));}catch{toast('Invalid pilot link');}}});
$('#auth-form').onsubmit = async e => {
  e.preventDefault();
  let buttons = [...e.target.querySelectorAll('button[name]')];
  buttons.forEach(b => b.disabled = true);
  try {
    await api(e.submitter.value, {
      handle: $('#handle').value,
      password: $('#password').value
    });
    $('#password').value = '';
    $('#auth-error').textContent = '';
    $('#auth-dialog').close();
    await refreshMe();
    await loadReports();
    toast('Pilot connected');
  } catch (error) {
    $('#auth-error').textContent = error.message;
  } finally {
    buttons.forEach(b => b.disabled = false);
  }
};
$('#shard-form').onsubmit = e => {
  e.preventDefault();
  let s = $('#shard-region').value + '-' + $('#shard').value.trim();
  if (!/^(US|EU|AUS|ASIA)-[0-9]{3}$/.test(s)) return toast('Choose a region and enter exactly three digits');
  currentShard = s;
  localStorage.setItem('kittizen-shard', s);
  reports = [];
  renderReports();
  map.reports = [];
  map.invalidate();
  loadReports();
  $('#map-shard').textContent = s;
  toast('Joined ' + s);
};
async function loadReports() {
  const generation = ++loadGeneration,
    s = currentShard;
  if (!s) {
    $('#connection').textContent = 'SELECT A SHARD';
    renderReports();
    return;
  }
  try {
    let list = await api('reports?shard=' + encodeURIComponent(s));
    if (generation !== loadGeneration || s !== currentShard) return;
    reports = list;
    $('#connection').textContent = 'CONNECTED · ' + s;
    renderReports();
  } catch (e) {
    if (generation !== loadGeneration) return;
    $('#connection').textContent = 'OFFLINE · RETRY';
    toast(e.message);
  }
}

function renderReports() {
  reports=reports.filter(r=>Number.isFinite(Number(r.created))&&Date.now()/1000-Number(r.created)<7200);
  let shown = reports.filter(r => !$('#filter').value || r.kind === $('#filter').value);
  $('#reports').replaceChildren();
  $('#report-count').textContent = String(shown.length).padStart(2, '0');
  $('#mobile-count').textContent = reports.length || '';
  if (map) {
    map.reports = shown;
    map.invalidate();
  }
  if (!shown.length) {
    let n = el('div', undefined, 'empty');
    n.append(el('strong', currentShard ? 'No recent reports' : 'Choose your shard'), el('span', currentShard ? 'Nothing reported here in the last 2 hours. That does not mean the area is safe.' : 'Choose your region and shard number in Navigate to see activity from other pilots.'));
    $('#reports').append(n);
  }
  for (let r of shown) {
    let card = el('article', undefined, 'report-card' + (r.kind === 'Clear' ? ' clear' : ''));
    let title = el('h3', (r.kind === 'Clear' ? '○ ' : '△ ') + r.kind),
      meta = el('div', undefined, 'meta');
    const pilot=el('button',r.handle,'text-button');pilot.onclick=()=>openProfile(r.handle);
    meta.append(pilot,el('span',(r.system || 'stanton').toUpperCase()),el('span',ago(r.created)));
    let loc = el('button', r.location, 'loc');
    loc.onclick = () => focusActivity(r);
    const show=el('button',title.textContent,'text-button');
    show.title='Show reported activity on map';show.onclick=()=>focusActivity(r);
    title.replaceChildren(show);
    card.onclick=e=>{if(!e.target.closest('button,a,input,select'))focusActivity(r);};
    card.append(title, meta, loc);
    if (r.notes) card.append(el('p', r.notes));
    card.append(el('small', `${r.trust.tier} · ${r.trust.score}% trust · ${r.trust.verifiers} independent verifiers`), el('small', `${r.confirmations} confirmed · ${r.disputes} disputed · last confirmation ${ago(r.lastVerified)}`));
    let votes = el('div', undefined, 'votes');
    for (let [value, label] of [
        [1, '✓ Confirm'],
        [-1, '× Dispute']
      ]) {
      let b = el('button', r.myVote === value ? 'Recorded' : label);
      b.disabled = !!r.myVote || user?.id === r.user;
      b.onclick = async () => {
        if (!needUser()) return;
        b.disabled = true;
        try {
          await api('vote', {
            report: r.id,
            value
          });
          await loadReports();
          await refreshMe();
          toast('Verification recorded');
        } catch (e) {
          toast(e.message);
          b.disabled = false;
        }
      };
      votes.append(b);
    }
    card.append(votes);
    $('#reports').append(card);
  }
}

function focusActivity(r) {
  if($('#profile-dialog').open)$('#profile-dialog').close();
  if(!map.focusReport(r))return toast('This report has no mapped position');
  $('#map-name').textContent=r.kind+' · '+r.location;
  $('#map-subtitle').textContent='Reported activity / '+(r.system||'stanton').toUpperCase();
  panel('map-area');
}

function selectBody(b, focus = true) {
  if (map.system !== b.system && b.system) map.setSystem(b.system);
  selected = b;
  map.selected = b.id;
  if (focus && b.kind !== 'gateway') map.focus(b);
  $('#map-name').textContent = b.name;
  $('#map-subtitle').textContent = b.kind.toUpperCase() + ' / ' + (b.system || 'stanton').toUpperCase();
  let root = $('#selection');
  const parent = bodies.find(p => p.id === b.parent);
  root.replaceChildren(el('h3', b.name), el('small', b.kind.toUpperCase() + (parent ? ' · ' + parent.name : '')));
  if(b.kind==='om')root.append(el('p','Derived orbital position; OM numbering is approximate.','hint'));
  let actions = el('div', undefined, 'inline');
  for (let [id, label] of [
      ['origin', 'Depart here'],
      ['destination', 'Route here']
    ]) {
    let btn = el('button', label);
    btn.onclick = () => {
      $('#' + id).value = b.id;
      if (id === 'destination') plot();
      else toast(label + ' · ' + b.name);
    };
    actions.append(btn);
  }
  root.append(actions);
  if (b.kind === 'gateway') {
    const available = map.systems.some(s => s.id === b.destinationSystem),
      button = el('button', available ? 'Travel to ' + map.systems.find(s => s.id === b.destinationSystem).name : 'Destination not installed');
    button.disabled = !available;
    button.onclick = () => {
      map.setSystem(b.destinationSystem);
      panel('map-area');
    };
    root.append(button);
  }
  if (b.radius > 0) {
    const views = el('div', undefined, 'inline');
    for (const [label, action] of [
        ['Surface view', () => map.focus(b)],
        ['Orbital view', () => map.focusSystem(b)]
      ]) {
      const button = el('button', label);
      button.onclick = () => {
        action();
        panel('map-area');
      };
      views.append(button);
    }
    root.append(views);
  }
  map.invalidate();
}

function search() {
  let q = $('#search').value.toLowerCase().replace(/[\s_-]/g, '');
  $('#results').replaceChildren();
  if (!q && map.system === 'universe') {
    for (const system of map.systems) {
      const button = el('button', system.name + ' system', 'result');
      button.onclick = () => {
        map.setSystem(system.id);
        panel('map-area');
      };
      $('#results').append(button);
    }
    return;
  }
  let list = bodies.filter(b => !b.hidden && b.name.toLowerCase().replace(/[\s_-]/g, '').includes(q) && (!q ? b.system === map.system && ['planet', 'star'].includes(b.kind) : true)).slice(0, 24);
  for (let b of list) {
    let row = el('button', undefined, 'result');
    row.append(el('span', b.name), el('small', bodies.find(p => p.id === b.parent)?.name || b.kind));
    row.onclick = () => {
      selectBody(b);
      panel('map-area');
    };
    $('#results').append(row);
  }
  if (!list.length) $('#results').append(el('p', 'No matching locations in this catalogue.', 'hint'));
}
$('#search').oninput = search;

async function plot(origin = $('#origin').value, destination = $('#destination').value) {
  let a = bodies.find(b => b.id === origin),
    b = bodies.find(b => b.id === destination);
  if (!a || !b || a.id === b.id) return toast('Choose two different locations');
  try {
    $('#plot').disabled = true;
    activeRoute = null;
    map.routePlan = null;
    map.route = null;
    $('#route-summary').textContent = 'Planning route…';
    $('#route-itinerary')?.replaceChildren();
    map.invalidate();
    const plan = await api('plan', {
      origin: a.id,
      destination: b.id
    });
    activeRoute = {
      origin: a.id,
      destination: b.id,
      plan
    };
    $('#origin').value = a.id;
    $('#destination').value = b.id;
    map.setPlan(plan);
    $('#route-summary').textContent = `${a.name} → ${b.name} · ${(plan.totalDistance/1e9).toFixed(3)} M km · ${plan.legs.filter(l=>l.kind==='jump').length} jumps. Amber = local flight; green = quantum. OM numbering and flight model are approximations.`;
    let itinerary = $('#route-itinerary');
    if (!itinerary) {
      itinerary = el('div');
      itinerary.id = 'route-itinerary';
      $('#route-summary').after(itinerary);
    }
    itinerary.replaceChildren();
    for (const leg of plan.legs) {
      const button = el('button', `${leg.kind==='jump'?'Jump tunnel':leg.kind==='local'?'Local flight':'QT'} · ${leg.startName} → ${leg.endName}`, 'route-leg');
      button.onclick = () => {
        map.setSystem(leg.system);
        map.center = leg.start.map((v, i) => (v + leg.end[i]) / 2);
        map.span = Math.max(2e5, leg.distance * 1.8);
        if (leg.kind === 'jump') map.setSystem('universe');
        map.invalidate();
        panel('map-area');
      };
      itinerary.append(button);
    }
    $('#map-name').textContent = 'Quantum route';
    $('#map-subtitle').textContent = a.name + ' → ' + b.name;
    panel('map-area');
  } catch (e) {
    $('#route-summary').textContent = 'Route unavailable: ' + e.message;
    toast(e.message);
  } finally {
    $('#plot').disabled = false;
  }
}
$('#plot').onclick = () => plot();
$('#clear-route').onclick = () => {
  activeRoute = null;
  map.route = null;
  map.routePlan = null;
  $('#route-itinerary')?.replaceChildren();
  map.marker = null;
  map.invalidate();
  $('#route-summary').textContent = 'Plot a jump, then tap its line to place an incident.';
};
$('#save-route').onclick = async () => {
  if (!needUser()) return;
  if (!activeRoute) return toast('Plot a route first');
  let a = bodies.find(b => b.id === activeRoute.origin),
    b = bodies.find(b => b.id === activeRoute.destination);
  try {
    await api('routes', {
      origin: activeRoute.origin,
      destination: activeRoute.destination,
      name: a.name + ' → ' + b.name
    });
    await loadRoutes();
    toast('Jump saved');
  } catch (e) {
    toast(e.message);
  }
};
async function loadRoutes() {
  let list = user ? await api('routes') : [];
  $('#saved-count').textContent = list.length;
  $('#saved-routes').replaceChildren();
  for (let r of list) {
    let row = el('div', undefined, 'saved'),
      load = el('button', r.name),
      del = el('button', '×');
    del.setAttribute('aria-label', 'Delete ' + r.name);
    load.onclick = () => plot(r.origin, r.destination);
    del.onclick = async () => {
      try {
        await api('routes/delete', {
          id: r.id
        });
        await loadRoutes();
      } catch (e) {
        toast(e.message);
      }
    };
    row.append(load, del);
    $('#saved-routes').append(row);
  }
  if (!list.length) $('#saved-routes').append(el('p', user ? 'No saved jumps yet.' : 'Sign in to save and recall jumps.', 'hint'));
}

function routeDistance() {
  if (activeRoute?.plan) return activeRoute.plan.totalDistance / 1000;
  if (!activeRoute) return 0;
  let a = bodies.find(b => b.id === activeRoute.origin),
    b = bodies.find(b => b.id === activeRoute.destination);
  return Math.hypot(...a.position.map((v, i) => v - b.position[i])) / 1000;
}

function placement() {
  let route = $('#report-location').value === '@route';
  $('#distance').disabled = !route;
  $('#distance').required = route;
  $('#route-placement').hidden = !route;
  if (route && activeRoute) {
    let t = reportFraction;
    $('#fraction-value').textContent = (t * 100).toFixed(3) + '%';
    $('#distance').max = routeDistance();
    $('#distance').value = (t * routeDistance()).toFixed(3);
    const point = positionOnRoute(activeRoute.plan, t);
    if (point) {
      if (map.system !== point.system) map.setSystem(point.system);
      map.marker = point.position;
    }
  } else map.marker = null;
  map.invalidate();
}

function report(fraction) {
  if (!currentShard) {
    panel('sidebar');
    return toast('Join a shard before reporting');
  }
  if (!needUser()) return;
  const routeAvailable=activeRoute?.plan?.totalDistance>0;
  $('#report-location').replaceChildren(option('','Choose a mapped location'));
  $('#report-location').required=true;
  if (routeAvailable) $('#report-location').append(option('@route', 'Along planned flight route'));
  for (let b of bodies.filter(b => !b.hidden)) $('#report-location').append(option(b.id, b.name));
  $('#report-location').value = typeof fraction === 'number' && routeAvailable ? '@route' : selected?.id || (routeAvailable ? '@route' : '');
  reportFraction = fraction ?? .5;
  $('#fraction').value = Math.round(reportFraction * 1000);
  $('#report-shard').textContent = 'VISIBLE TO PILOTS ON ' + currentShard;
  $('#report-error').textContent = '';
  placement();
  $('#report-dialog').showModal();
}
$('#report').onclick = () => report();
$('#report-location').onchange = placement;
$('#fraction').oninput = () => {
  reportFraction = Number($('#fraction').value) / 1000;
  placement();
};
$('#distance').oninput = () => {
  let distance = Number($('#distance').value),
    total = routeDistance();
  if (!Number.isFinite(distance) || distance < 0 || distance > total) return;
  reportFraction = distance / total;
  $('#fraction').value = reportFraction * 1000;
  $('#fraction-value').textContent = (reportFraction * 100).toFixed(3) + '%';
  const point = positionOnRoute(activeRoute.plan, reportFraction);
  if (point) {
    if (map.system !== point.system) map.setSystem(point.system);
    map.marker = point.position;
  }
  map.invalidate();
};
$('#report-dialog').addEventListener('close', () => {
  map.marker = null;
  map.invalidate();
});
$('#report-form').onsubmit = async e => {
  e.preventDefault();
  let button = e.target.querySelector('button.primary');
  button.disabled = true;
  try {
    let d = {
      shard: currentShard,
      kind: $('#kind').value,
      notes: $('#notes').value,
      location: $('#report-location').value
    };
    if (d.location === '@route') d.route = {
      origin: activeRoute.origin,
      destination: activeRoute.destination,
      fraction: reportFraction
    };
    await api('reports', d);
    $('#report-dialog').close();
    $('#notes').value = '';
    await loadReports();
    toast('Report shared with ' + currentShard);
  } catch (error) {
    $('#report-error').textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
$('#refresh').onclick = loadReports;
$('#filter').onchange = renderReports;
$('#shard-help').onclick = () => $('#shard-help-dialog').showModal();
$('#trust-info').onclick = () => $('#info-dialog').showModal();
async function start() {
  try {
    catalog = await fetch('catalog.json').then(r => r.json());
    bodies = catalog.bodies;
    map = new StarMap($('#map'), bodies, b => selectBody(b), (t, r) => r ? focusActivity(r) : report(t));
    map.systems = catalog.systems || [{
      id: 'stanton',
      name: 'Stanton',
      position: [0, 0, 0]
    }];
    map.onSystemChanged = showSystem;
    $('#system-picker').replaceChildren(option('universe', 'Universe · all systems'), ...map.systems.map(s => option(s.id, s.name)));
    $('#system-picker').onchange = () => map.setSystem($('#system-picker').value);
    $('#universe').onclick = () => map.setSystem('universe');
    map.setSystem('universe');
    $('#build').textContent = catalog.build;
    $('#provenance').textContent = catalog.currentBuildVerified ? 'Extracted from your installed LIVE game.' : 'Legacy catalogue; current game not verified.';
    for (let id of ['origin', 'destination'])
      for (let b of bodies.filter(b => !b.hidden)) $('#' + id).append(option(b.id, b.name));
    $('#origin').value = bodies.find(b => b.name === 'Crusader').id;
    $('#destination').value = bodies.find(b => b.name === 'Hurston').id;
    $('#home').onclick = () => {
      map.home();
      showSystem(map.system);
    };
    $('#tilt').onclick = () => {
      map.pitch = Math.abs(map.pitch) > 1.4 ? -.72 : -Math.PI / 2;
      map.invalidate();
    };
    $('#zoom-in').onclick = () => map.zoom(1.6);
    $('#zoom-out').onclick = () => map.zoom(1 / 1.6);
    $('#shard-region').value = currentShard ? currentShard.split('-')[0] : 'US';
    $('#shard').value = currentShard ? currentShard.split('-')[1] : '';
    $('#map-shard').textContent = currentShard || 'NO SHARD';
    search();
    await refreshMe();
    await loadReports();
    await syncGame();
    setInterval(() => {
      if (!document.hidden) {
        renderReports();
        loadReports();
        syncGame();
      }
    }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        renderReports();
        loadReports();
        syncGame();
      }
    });
  } catch (e) {
    $('#connection').textContent = 'UNAVAILABLE';
    toast('Could not load Kittizen: ' + e.message);
  }
}
async function syncGame() {
  try {
    const status = await api('status');
    $('#provenance').textContent = status.update.state === 'error' ? 'Update failed · retaining last good map' : `${status.locations} locations · game textures · ${status.update.state==='extracting'?'patch extraction running':'automatic patch watch'}`;
    $('#provenance').title = status.update.message;
    if (catalog.generation !== status.generation || (catalogRevision && catalogRevision !== status.revision)) {
      const fresh = await fetch('catalog.json', {
        cache: 'no-store'
      }).then(r => r.json());
      catalog = fresh;
      bodies = fresh.bodies;
      map.setBodies(bodies);
      map.systems = fresh.systems || map.systems;
      map.globeTextures.cache.clear();
      activeRoute = null;
      selected = null;
      map.route = null;
      map.routePlan = null;
      map.marker = null;
      map.selected = null;
      if ($('#report-dialog').open) $('#report-dialog').close();
      for (const id of ['origin', 'destination']) {
        const control = $('#' + id),
          prior = control.value;
        control.replaceChildren(...bodies.filter(b => !b.hidden).map(b => option(b.id, b.name)));
        if (bodies.some(b => b.id === prior && !b.hidden)) control.value = prior;
      }
      $('#build').textContent = fresh.build;
      $('#selection').replaceChildren();
      $('#route-summary').textContent = 'Game data updated. Plot your jump using the refreshed locations.';
      search();
      map.home();
      toast('Game map data refreshed');
    }
    catalogRevision = status.revision;
  } catch (e) {
    $('#provenance').textContent = 'Patch status unavailable · using loaded map';
  }
}

function showSystem(id) {
  selected=null;map.selected=null;$('#selection').replaceChildren();
  $('#system-picker').value = id;
  $('#system-context').textContent = id.toUpperCase();
  $('#map-name').textContent = id === 'universe' ? 'The known universe' : (map.systems.find(s => s.id === id)?.name || id) + ' system';
  $('#map-subtitle').textContent = id === 'universe' ? 'Stanton · Pyro · Nyx — select a disc to explore.' : 'Extracted navigation · zoom out for universe · double-click a gate to travel';
  search();
  updateHeatLegend();
}
function updateHeatLegend(){
  $('#heat-scope').textContent=map?.system==='universe'?'System totals · select a disc for location detail':'Recent activity · follows the map camera';
}
start().then(()=>{if(location.hash.startsWith('#pilot/')){try{openProfile(decodeURIComponent(location.hash.slice(7)));}catch{toast('Invalid pilot link');}}});
