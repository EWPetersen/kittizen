import {
  StarMap
} from './map.js';
import {
  positionOnRoute
} from './route.js';
import {planSnare,referenceMarkers,trilaterate,assessPosition,parseCoordinates} from './interdiction.js';
const $ = s => document.querySelector(s),
  el = (tag, text, cls) => {
    let n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
if(new URLSearchParams(location.search).get('workspace')==='v3'){const link=$('.workspace-link');if(link){link.href='/v3.html';link.setAttribute('aria-label','Open V3 pilot workspace');link.firstChild.textContent='V3';}}
let catalog, bodies, map, catalogRevision = null,
  user = null,
  reports = [],
  activeRoute = null,
  selected = null,
  loadGeneration = 0,
  reportFraction = .5;
// Shards change between game sessions: require an explicit choice on each visit.
let currentShard = '';
let presenceRequest=0,shardListExpiry;
const compactQuery='(max-width:1100px), (pointer:coarse)';
const compact=()=>matchMedia(compactQuery).matches;
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
  document.querySelectorAll('#mobile-nav button').forEach(b => {const active=b.dataset.panel===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  document.body.classList.toggle('intel-open',id==='intel');
  updatePanelToggles();
  if(id==='sidebar'&&compact())$('#sidebar').scrollTop=0;
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
  joinShard(s);
};
function joinShard(s,system){
  if (!/^(US|EU|AUS|ASIA)-[0-9]{3}$/.test(s)) return toast('Choose a region and enter exactly three digits');
  currentShard = s;
  $('#shard-region').value=s.split('-')[0];$('#shard').value=s.split('-')[1];$('#map-shard').textContent=s;
  if(system&&map.systems.some(item=>item.id===system)){map.setSystem(system);panel('map-area');toast('Joined '+s);return;}
  updatePresence();
  reports = [];
  renderReports();
  map.reports = [];
  map.invalidate();
  loadReports();
  $('#map-shard').textContent = s;
  if(compact())panel('map-area');
  toast('Joined ' + s);
}
async function loadReports() {
  const generation = ++loadGeneration,
    s = currentShard;
  const universe=map?.system==='universe',system=map?.system;
  if (!s&&!universe) {
    reports=[];
    $('#connection').textContent = 'SELECT A SHARD';
    renderReports();
    return;
  }
  try {
    let list = await api(universe?'reports?scope=universe':'reports?shard=' + encodeURIComponent(s));
    if (generation !== loadGeneration || s !== currentShard||system!==map.system) return;
    reports = list;
    $('#connection').textContent = universe?'ALL SHARDS · UNIVERSE':'CONNECTED · ' + s;
    renderReports();
  } catch (e) {
    if (generation !== loadGeneration) return;
    $('#connection').textContent = 'OFFLINE · RETRY';
    toast(e.message);
  }
}

let reportRenderKey='';
function renderReports() {
  reports=reports.filter(r=>Number.isFinite(Number(r.created))&&Date.now()/1000-Number(r.created)<7200);
  let shown = reports.filter(r => (map?.system==='universe'||r.system===map?.system)&&(!$('#filter').value || r.kind === $('#filter').value));
  const key=JSON.stringify([currentShard,map?.system,$('#filter').value,user?.id,Math.floor(Date.now()/60000),shown]);
  if(key===reportRenderKey){map?.invalidate();return;}reportRenderKey=key;
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
  for (let r of shown.slice(0,200)) {
    let card = el('article', undefined, 'report-card' + (r.kind === 'Clear' ? ' clear' : ''));
    let title = el('h3', (r.kind === 'Clear' ? '○ ' : '△ ') + r.kind),
      meta = el('div', undefined, 'meta');
    const pilot=el('button',r.handle,'text-button');pilot.onclick=()=>openProfile(r.handle);
    meta.append(pilot,el('span',(r.system || 'stanton').toUpperCase()+' · '+r.shard),el('span',ago(r.created)));
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
  const body=map.byId.get(r.locationId);selected=body||null;
  if(body)mapLocationActions(body);else if($('#map-location-actions'))$('#map-location-actions').hidden=true;
  panel('map-area');
}

let routeRequest=0;
function chooseRoutePoint(id,b){
  if(!b)return;const other=map.routePins?.[id==='origin'?'destination':'origin'];
  if(other?.id===b.id)return toast('Choose two different locations');
  $('#'+id).value=b.id;map.routePins={...(map.routePins||{}),[id]:b};
  updateLocationPickers();
  if(map.routePins.origin&&map.routePins.destination){plot(map.routePins.origin.id,map.routePins.destination.id);return;}
  routeRequest++;activeRoute=null;map.route=null;map.routePlan=null;clearSnare();
  $('#plot').disabled=false;$('#route-itinerary')?.replaceChildren();$('#route-summary').textContent=(id==='origin'?'Departure: ':'Destination: ')+b.name+' · select '+(id==='origin'?'a destination':'a departure')+' on the map.';
  map.invalidate();toast((id==='origin'?'Departure':'Destination')+' set · '+b.name);
}
function mapActionRoot(){
  let root=$('#map-location-actions');if(!root){root=el('div',undefined,'map-location-actions');root.id='map-location-actions';root.setAttribute('aria-label','Selected location route actions');document.querySelector('.map-title').append(root);}
  return root;
}
function mapResetButton(){const button=el('button','Reset pins');button.id='map-clear-route';button.onclick=()=>$('#clear-route').click();return button;}
function mapLocationActions(b){
  const root=mapActionRoot();
  root.hidden=false;root.replaceChildren();
  for(const [id,label] of [['origin','Depart here'],['destination','Route here']]){const button=el('button',label);button.id='map-'+id;button.onclick=()=>chooseRoutePoint(id,b);root.append(button);}
  root.append(mapResetButton());
  if(b.kind==='gateway'&&map.systems.some(s=>s.id===b.destinationSystem)){
    const travel=el('button','Travel to '+map.systems.find(s=>s.id===b.destinationSystem).name);travel.onclick=()=>jumpToSystem(b.destinationSystem);root.append(travel);
  }
  if(map.belts?.some(belt=>belt.parent===b.id)){
    const view=el('button','Ring & orbits');view.onclick=()=>{map.focusSystem(b);selectBody(b,false);};root.append(view);
  }
}
function selectBody(b, focus = true) {
  if (map.system !== b.system && b.system) map.setSystem(b.system);
  selected = b;
  recentLocations=[b.id,...recentLocations.filter(id=>id!==b.id)].slice(0,8);
  map.selected = b.id;
  if (focus) map.focus(b);
  $('#map-name').textContent = b.name;
  $('#map-subtitle').textContent = (map.view?.level==='orbits'?'LOCAL ORBITS':b.modelStyle==='asteroid'?'ASTEROID BASE':b.modelStyle==='prison'?'REHABILITATION FACILITY':b.kind.toUpperCase()) + ' / ' + (b.system || 'stanton').toUpperCase();
  let root = $('#selection');
  const parent = bodies.find(p => p.id === b.parent);
  root.replaceChildren(el('h3', b.name), el('small', b.kind.toUpperCase() + (parent ? ' · ' + parent.name : '')));
  mapLocationActions(b);
  if(b.artwork){const image=el('img');image.src=b.artwork;image.alt=b.name+' · game location artwork';image.className='location-art';image.loading='lazy';image.decoding='async';root.append(image);}
  if(b.kind==='om')root.append(el('p','Derived orbital position; OM numbering is approximate.','hint'));
  if(b.model&&b.modelRole!=='symbol')root.append(el('p',b.modelNote||'Extracted game starmap model.','hint'));
  let actions = el('div', undefined, 'inline');
  for (let [id, label] of [
      ['origin', 'Depart here'],
      ['destination', 'Route here']
    ]) {
    let btn = el('button', label);
    btn.onclick = () => chooseRoutePoint(id,b);
    actions.append(btn);
  }
  root.append(actions);
  if (b.kind === 'gateway') {
    const available = map.systems.some(s => s.id === b.destinationSystem),
      button = el('button', available ? 'Travel to ' + map.systems.find(s => s.id === b.destinationSystem).name : 'Destination not installed');
    button.disabled = !available;
    button.onclick = () => {
      jumpToSystem(b.destinationSystem);
      panel('map-area');
    };
    root.append(button);
  }
  if (b.radius > 0) {
    const views = el('div', undefined, 'inline');
    for (const [label, action] of [
        ['Surface view', () => map.focus(b,{close:true})],
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
  let list = bodies.filter(b => !b.hidden && b.name.toLowerCase().replace(/[\s_-]/g, '').includes(q) && (!q ? b.system === map.system && (['planet', 'star'].includes(b.kind)||b.mapImportance==='primary'||recentLocations.includes(b.id)) : true)).slice(0, 24);
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
  const request=++routeRequest;
  try {
    $('#plot').disabled = true;
    activeRoute = null;
    clearSnare();
    map.routePlan = null;
    map.route = null;
    $('#route-summary').textContent = 'Planning route…';
    $('#route-itinerary')?.replaceChildren();
    map.invalidate();
    const plan = await api('plan', {
      origin: a.id,
      destination: b.id
    });
    if(request!==routeRequest)return;
    activeRoute = {
      origin: a.id,
      destination: b.id,
      plan
    };
    $('#origin').value = a.id;
    $('#destination').value = b.id;
    updateLocationPickers();
    map.routePins={origin:a,destination:b};
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
    const routeActions=mapActionRoot();routeActions.hidden=false;routeActions.replaceChildren(mapResetButton(),snareButton());
    $('#map-subtitle').textContent = a.name + ' → ' + b.name;
    panel('map-area');
  } catch (e) {
    if(request!==routeRequest)return;
    $('#route-summary').textContent = 'Route unavailable: ' + e.message;
    toast(e.message);
  } finally {
    if(request===routeRequest)$('#plot').disabled = false;
  }
}
$('#plot').onclick = () => plot();
$('#clear-route').onclick = () => {
  clearSnare();
  routeRequest++;$('#plot').disabled=false;map.routePins={};
  activeRoute = null;
  map.route = null;
  map.routePlan = null;
  for(const id of ['origin','destination'])$('#'+id).value='';updateLocationPickers();
  $('#route-itinerary')?.replaceChildren();
  map.marker = null;
  map.invalidate();
  $('#route-summary').textContent = 'Plot a jump, then tap its line to place an incident.';
  showSystem(map.system);
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
    if(compact())$('#shard-region').scrollIntoView({block:'center'});
    return toast('Join a shard before reporting');
  }
  if (!needUser()) return;
  const routeAvailable=activeRoute?.plan?.totalDistance>0;
  $('#report-location').replaceChildren(option('','Choose a mapped location'));
  $('#report-location').required=false;
  if (routeAvailable) $('#report-location').append(option('@route', 'Along planned flight route'));
  for (let b of bodies.filter(b => !b.hidden)) $('#report-location').append(option(b.id, b.name));
  $('#report-location').value = typeof fraction === 'number' && routeAvailable ? '@route' : selected?.id || (routeAvailable ? '@route' : '');
  reportFraction = fraction ?? .5;
  $('#fraction').value = Math.round(reportFraction * 1000);
  $('#report-shard').textContent = 'VISIBLE TO PILOTS ON ' + currentShard;
  $('#report-error').textContent = '';
  placement();
  $('#report-dialog').showModal();
  updateLocationPickers();
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
  if(!$('#report-location').value){$('#report-error').textContent='Choose where this happened.';$('#pick-report-location').focus();return;}
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

// Small touch enhancements share the existing form controls and API paths.
let pickerTarget=null,recentLocations=[];
let snareReferences=[];
function clearSnare(){if(map){map.snarePlan=null;map.invalidate();}snareReferences=[];if($('#snare-results'))$('#snare-results').hidden=true;if($('#snare-check-result'))$('#snare-check-result').textContent='';if($('#snare-dialog')?.open)$('#snare-dialog').close();}
function snareButton(){const button=el('button','Plan interception');button.type='button';button.className='snare-open';button.onclick=openSnarePlanner;return button;}
function openSnarePlanner(){
  if(!activeRoute?.plan){panel('sidebar');$('#pick-origin').focus();return toast('Choose the target departure and destination, then plot its route.');}
  if(!catalog.interdiction)return toast('Snare device data is unavailable. Refresh after game-data extraction finishes.');
  if(map.snarePlan&&activeRoute.plan.legs.includes(map.snarePlan.leg)){$('#snare-dialog').showModal();return;}
  const legs=activeRoute.plan.legs.map((leg,index)=>({leg,index})).filter(({leg})=>leg.kind==='quantum'&&leg.distance>0);
  $('#snare-leg').replaceChildren(...legs.map(({leg,index})=>option(index,leg.system.toUpperCase()+' · '+leg.startName+' → '+leg.endName)));
  $('#snare-error').textContent=legs.length?'':'This route contains no quantum leg. Local flight and jump tunnels cannot be planned as snares.';
  $('#snare-calculate').disabled=!legs.length;
  const device=catalog.interdiction;$('#snare-device').textContent=device.ship+' · '+device.snareRadius/1000+' km snare radius · '+device.chargeSeconds+' s charge + '+device.activationSeconds+' s activation · '+device.dampenerRadius/1000+' km dampener. Installed build '+catalog.build+'.';$('#snare-green-zone').textContent=device.greenZoneCheckRange/1000+' km';
  $('#snare-dialog').showModal();
  $('#snare-results').hidden=true;snareReferences=[];snareDefaults();
}
function snareDefaults(){
  const leg=activeRoute?.plan.legs[Number($('#snare-leg').value)];
  const origin=bodies?.find(b=>b.id===activeRoute?.origin),parent=bodies?.find(b=>b.id===origin?.parent);
  const spread=leg?.startName.includes('OM-')?2000:Math.max(2000,(origin?.radius||parent?.radius||0)*1.5);
  $('#snare-start-spread').value=(spread/1000).toFixed(1);$('#snare-end-spread').value='10';
  if($('#snare-results'))$('#snare-results').hidden=true;
}
function focusSnare(position=map.snarePlan?.position){
  const plan=map.snarePlan;if(!plan||!position)return;
  $('#snare-dialog').close();if(map.system!==plan.system)map.setSystem(plan.system);
  map.flyTo({...map.camera(),center:[...position],span:plan.radius*10});
  $('#map-name').textContent='Interdiction plan';$('#map-subtitle').textContent=plan.leg.startName+' → '+plan.leg.endName+' · geometric estimate';
  const actions=mapActionRoot();actions.hidden=false;actions.replaceChildren(snareButton(),mapResetButton());panel('map-area');
}
function calculateSnare(e){
  e.preventDefault();$('#snare-error').textContent='';$('#snare-results').hidden=true;$('#snare-check-result').textContent='';
  try{
    const read=id=>{const input=$('#snare-'+id);if(input.value.trim()===''||!input.checkValidity())throw Error('Check the '+id.replaceAll('-',' ')+' value.');return Number(input.value)*1000;};
    const leg=activeRoute.plan.legs[Number($('#snare-leg').value)],plan=planSnare(leg,{radius:catalog.interdiction.snareRadius,margin:read('margin'),startSpread:read('start-spread'),endSpread:read('end-spread'),minTravel:read('min-travel'),endBuffer:read('end-buffer'),bodies});
    map.snarePlan=plan;map.invalidate();
    const stats=$('#snare-stats');stats.replaceChildren();
    for(const [label,value] of [['Travel from QT leg start',plan.fromStart],['Distance to modeled leg end',plan.toEnd],['Assumed corridor radius here',plan.spread],['Remaining placement budget',plan.placementBudget]])stats.append(el('dt',label),el('dd',(value/1000).toLocaleString(undefined,{maximumFractionDigits:3})+' km'));
    $('#snare-instructions').textContent='Follow the quantum leg '+leg.startName+' → '+leg.endName+'. Stop near the calculated point and compare the three centre-marker ranges below. Distances to modeled QT boundaries are not HUD marker distances. This creates a map plan, not an in-game waypoint.';
    $('#snare-coordinates').textContent=plan.system.toUpperCase()+' · metres\nX '+plan.position[0].toFixed(3)+'\nY '+plan.position[1].toFixed(3)+'\nZ '+plan.position[2].toFixed(3);
    $('#snare-references').replaceChildren();
    try{snareReferences=referenceMarkers(bodies,plan);}catch(error){snareReferences=[];$('#snare-references').append(el('p',error.message,'hint'));}
    for(const [index,ref] of snareReferences.entries()){
      const label=el('label',ref.body.name+' · expected '+(ref.distance/1000).toFixed(3)+' km');label.htmlFor='snare-range-'+index;
      const input=el('input');input.id=label.htmlFor;input.type='number';input.min='0';input.step='any';input.inputMode='decimal';input.placeholder='Measured centre-marker range (km)';
      $('#snare-references').append(label,input);
    }
    $('#snare-verify').disabled=false;$('#snare-position').value='';
    $('#snare-results').hidden=false;$('#snare-results').scrollIntoView({block:'start'});
  }catch(error){map.snarePlan=null;snareReferences=[];map.invalidate();$('#snare-error').textContent=error.message;}
}
function verifySnare(e){
  e.preventDefault();const output=$('#snare-check-result');output.replaceChildren();
  try{
    if(!map.snarePlan)throw Error('Calculate a plan first.');
    if($('#snare-position').value.trim()){
      const position=parseCoordinates($('#snare-position').value),a=assessPosition(map.snarePlan,position),delta=map.snarePlan.position.map((v,i)=>v-position[i]);
      output.append(el('strong',a.covered?'Coordinates are inside modeled corridor coverage.':'Coordinates are outside modeled corridor coverage.'),el('p',(a.crossTrack/1000).toFixed(3)+' km off route · '+(a.distanceToPlan/1000).toFixed(3)+' km from planned point.'),el('p','Correction to planned point (world metres): X '+delta[0].toFixed(1)+', Y '+delta[1].toFixed(1)+', Z '+delta[2].toFixed(1)+'. Same-system coordinates required; no live telemetry.'));output.scrollIntoView({block:'start'});return;
    }
    if(snareReferences.length!==3)throw Error('No suitable range references. Enter same-system coordinates instead.');
    const ranges=snareReferences.map((_,i)=>{const input=$('#snare-range-'+i);if(!input.value.trim()||!input.checkValidity())throw Error('Enter all three measured ranges in kilometres.');return Number(input.value)*1000;});
    const solution=trilaterate(snareReferences.map(r=>r.body.position),ranges,1000),assessments=solution.solutions.map(p=>assessPosition(map.snarePlan,p));
    output.append(el('strong',solution.ambiguous?'Two possible positions — mirror ambiguity remains.':'One geometric position found.'),el('p','Maximum range residual '+(solution.residual/1000).toFixed(3)+' km · 1 km input tolerance. HUD rounding and marker-centre accuracy may dominate.'));
    for(const [i,a] of assessments.entries()){
      output.append(el('p','Solution '+String.fromCharCode(65+i)+': '+(a.covered?'inside modeled corridor coverage':'outside modeled coverage')+' · '+(a.crossTrack/1000).toFixed(3)+' km off route · '+(a.distanceToPlan/1000).toFixed(3)+' km from planned point.'));
    }
    if(solution.ambiguous)output.append(el('p','Three ranges cannot resolve which side of the reference plane you occupy. Do not treat either solution as a verified live position.','hint'));
    output.append(el('p','A small range residual does not bound position error. Distant markers and HUD rounding can produce large position errors; use same-system coordinates for narrow corridors.','hint'));output.scrollIntoView({block:'start'});
  }catch(error){output.textContent=error.message;}
}
function setupSnarePlanner(){
  const dialog=el('dialog');dialog.id='snare-dialog';dialog.setAttribute('aria-labelledby','snare-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="snare-title">Interdiction planner</h2><button type="button" id="snare-close" aria-label="Close interdiction planner">×</button></div>
    <p>Plan a Mantis snare along a target's plotted route. A dampener alone cannot pull ships out of quantum.</p><p id="snare-device" class="hint"></p><p class="hint">Static geometry estimate. Rotating cities/stations, unknown departure positions and server behavior can invalidate it. Approximate body exclusions do not prove physics-grid or armistice clearance.</p>
    <form id="snare-form"><label for="snare-leg">TARGET QUANTUM LEG</label><select id="snare-leg"></select>
    <details><summary>Route uncertainty &amp; assumptions</summary><p>These are planning inputs, not measured game limits. A route from a whole planet has much more departure uncertainty than a specific marker.</p>
    <label for="snare-start-spread">DEPARTURE SPREAD RADIUS (km)</label><input id="snare-start-spread" type="number" min="0" max="1000000000" step="any" inputmode="decimal" required>
    <label for="snare-end-spread">ARRIVAL SPREAD RADIUS (km)</label><input id="snare-end-spread" type="number" min="0" max="1000000000" step="any" inputmode="decimal" required>
    <label for="snare-margin">SAFETY MARGIN INSIDE SNARE (km)</label><input id="snare-margin" type="number" min="0" step="any" value="2" inputmode="decimal" required>
    <label for="snare-min-travel">MINIMUM QT TRAVEL BEFORE CATCH (km)</label><input id="snare-min-travel" type="number" min="0" step="any" value="10000" inputmode="decimal" required>
    <label for="snare-end-buffer">MINIMUM DISTANCE BEFORE LEG END (km)</label><input id="snare-end-buffer" type="number" min="0" step="any" value="100" inputmode="decimal" required></details>
    <p id="snare-error" class="error" role="alert"></p><button id="snare-calculate" class="primary full">Calculate snare position</button></form>
    <section id="snare-results" hidden><h3>Suggested setup point</h3><dl id="snare-stats" class="profile-stats"></dl><p id="snare-instructions"></p><button id="snare-focus" class="primary full" type="button">Show snare on map</button>
    <h3>Check your position</h3><p>Use distances to the named marker centres, in kilometres. Leave measurements blank until you read them in game. Three ranges can produce two mirrored positions; both are reported.</p>
    <form id="snare-check-form" novalidate><div id="snare-references"></div><label for="snare-position">OR YOUR SAME-SYSTEM X, Y, Z (metres)</label><textarea id="snare-position" rows="2" maxlength="200" placeholder="X, Y, Z — optional coordinate alternative"></textarea><p class="hint">Coordinates take precedence over range measurements. Keep the same system and world reference frame as the plan. Prefer coordinates for narrow corridors: distant-marker range rounding can create large position errors.</p><button id="snare-verify" class="full">Check my position</button></form><div id="snare-check-result" role="status" aria-live="polite"></div><details><summary>Setup coordinates (metres)</summary><pre id="snare-coordinates"></pre></details></section>
    <details><summary>How this estimate works &amp; sources</summary><p>The corridor radius interpolates linearly between your departure and arrival spread. The planner keeps that corridor inside the snare with your margin, excludes local flight and jump tunnels, removes body-clearance intervals, then selects the midpoint of the widest remaining interval.</p><p>Body clearance uses the greater of four body radii, extracted obstruction radius or arrival radius, plus snare radius and margin. This is a heuristic, not a measured physics-grid or armistice boundary. Rotating cities/stations, live departure geometry, server state and patch-specific minimum snare travel can invalidate the estimate. The 10,000 km minimum is an editable community planning assumption.</p><p>Green-zone check range in the installed device: <span id="snare-green-zone"></span>. Armistice-zone volumes are not mapped; this tool cannot establish whether activation is permitted at a point. A snare also catches unrelated passing traffic.</p><p>Device values come from the installed Reynie DataCore record. <a href="https://robertsspaceindustries.com/en/comm-link/engineering/17270-Q-A-RSI-Mantis" target="_blank" rel="noopener noreferrer">RSI Mantis Q&amp;A</a> · <a href="https://snareplan.dolus.eu/" target="_blank" rel="noopener noreferrer">SnarePlan operator reference</a>. Geometry is independently implemented; no live ship tracking or catch probability is provided.</p></details>`;
  document.body.append(dialog);$('#snare-close').onclick=()=>dialog.close();$('#snare-form').onsubmit=calculateSnare;$('#snare-check-form').onsubmit=verifySnare;$('#snare-focus').onclick=()=>focusSnare();$('#snare-leg').onchange=()=>{map.snarePlan=null;map.invalidate();snareDefaults();};
  $('#snare-green-zone').textContent=catalog.interdiction?catalog.interdiction.greenZoneCheckRange/1000+' km':'unavailable';
  $('#route-summary').before(snareButton());
  $('#snare-form').addEventListener('input',()=>{map.snarePlan=null;snareReferences=[];$('#snare-results').hidden=true;map.invalidate();});
}
function updateLocationPickers(){
  for(const id of ['origin','destination','report-location']){
    const control=$('#'+id),button=$('#pick-'+id);if(!button)continue;
    button.textContent=control.selectedOptions[0]?.textContent||'Choose a location';
    button.setAttribute('aria-label',(id==='origin'?'Departure':id==='destination'?'Destination':'Reported location')+': '+button.textContent);
  }
}
function renderLocationPicker(){
  const list=$('#location-picker-results'),query=$('#location-query').value.toLowerCase().replace(/[\s_-]/g,''),system=$('#location-system').value;
  list.replaceChildren();
  if(pickerTarget==='report-location'&&activeRoute?.plan?.totalDistance>0&&!query){
    const route=el('button','Along planned flight route','result');route.type='button';route.onclick=()=>pickLocation('@route');list.append(route);
  }
  let candidates=bodies.filter(b=>!b.hidden&&(!system||b.system===system)&&(!query||b.name.toLowerCase().replace(/[\s_-]/g,'').includes(query)));
  const rank=b=>!query&&recentLocations.includes(b.id)?-3:!query&&selected&&(b.id===selected.id||b.parent===selected.id)?-2:b.mapImportance==='primary'?-1:['planet','star'].includes(b.kind)?0:1;
  candidates.sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name));
  for(const b of candidates.slice(0,40)){
    const row=el('button',undefined,'result');row.type='button';
    row.append(el('strong',b.name),el('small',b.system.toUpperCase()+' · '+(bodies.find(p=>p.id===b.parent)?.name||b.kind)));
    row.onclick=()=>pickLocation(b.id);list.append(row);
  }
  $('#location-picker-hint').textContent=candidates.length>40?'Showing 40 of '+candidates.length+' places. Search to narrow the list.':candidates.length?'Choose a place; recent and nearby locations appear first.':'No matching locations. Try another system or a shorter name.';
}
function pickLocation(id){
  const target=pickerTarget;if(!target)return;
  $('#'+target).value=id;
  if(id!=='@route')recentLocations=[id,...recentLocations.filter(x=>x!==id)].slice(0,8);
  $('#location-picker').close();pickerTarget=null;
  if(target==='report-location')placement();
  updateLocationPickers();$('#pick-'+target).focus();
}
function setupCockpit(){
  const searchLabel=document.querySelector('label[for="search"]');$('#sidebar .section-head').after(searchLabel,$('#search'),$('#results'));
  const controls=$('.map-controls'),pan=el('button','Rotate');pan.id='drag-mode';pan.type='button';pan.setAttribute('aria-label','Map drag mode: rotate. Switch to pan');pan.setAttribute('aria-pressed','false');
  pan.onclick=()=>{map.dragMode=map.dragMode==='pan'?'rotate':'pan';const p=map.dragMode==='pan';pan.textContent=p?'Pan':'Rotate';pan.setAttribute('aria-pressed',String(p));pan.setAttribute('aria-label','Map drag mode: '+(p?'pan. Switch to rotate':'rotate. Switch to pan'));};
  const tools=el('details',undefined,'map-tools');tools.id='map-tools';const summary=el('summary','Tools'),tray=el('div',undefined,'map-tools-tray');
  for(const id of ['universe','home','tilt','legend-toggle'])tray.append($('#'+id));tools.append(summary,tray);controls.replaceChildren(tools,$('#back-view'),pan,$('#zoom-out'),$('#zoom-in'));
  tray.addEventListener('click',e=>{if(e.target.closest('button')){tools.open=false;map.invalidate();}});
  const picker=el('dialog');picker.id='location-picker';picker.setAttribute('aria-labelledby','location-picker-title');
  const heading=el('div',undefined,'dialog-heading'),title=el('h2','Choose a location');title.id='location-picker-title';const close=el('button','×');close.type='button';close.setAttribute('aria-label','Close location picker');close.onclick=()=>picker.close();heading.append(title,close);
  const queryLabel=el('label','FIND A PLACE');queryLabel.htmlFor='location-query';const query=el('input');query.id='location-query';query.type='search';query.placeholder='Station, planet, city or POI';query.autocomplete='off';query.oninput=renderLocationPicker;
  const scopeLabel=el('label','SYSTEM');scopeLabel.htmlFor='location-system';const scope=el('select');scope.id='location-system';scope.onchange=renderLocationPicker;
  const hint=el('p',undefined,'hint');hint.id='location-picker-hint';hint.setAttribute('aria-live','polite');const results=el('div',undefined,'results');results.id='location-picker-results';
  picker.append(heading,queryLabel,query,scopeLabel,scope,hint,results);document.body.append(picker);
  for(const id of ['origin','destination','report-location']){
    const select=$('#'+id),button=el('button','Choose a location','location-picker-button');button.type='button';button.id='pick-'+id;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','location-picker');
    select.classList.add('location-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.after(button);document.querySelector('label[for="'+id+'"]').htmlFor=button.id;
    button.onclick=()=>{pickerTarget=id;title.textContent=id==='origin'?'Choose departure':id==='destination'?'Choose destination':'Reported location';query.value='';scope.replaceChildren(option('','All systems'),...map.systems.map(s=>option(s.id,s.name)));scope.value='';renderLocationPicker();picker.showModal();close.focus();};
  }
  const kinds=el('div',undefined,'activity-kinds');kinds.setAttribute('role','group');kinds.setAttribute('aria-label','Activity type');
  for(const value of ['Interdiction','Pirates','Suspicious','Clear']){const button=el('button',value);button.type='button';button.setAttribute('aria-pressed',String($('#kind').value===value));button.onclick=()=>{$('#kind').value=value;for(const b of kinds.children)b.setAttribute('aria-pressed',String(b===button));};kinds.append(button);}
  $('#kind').classList.add('location-source');$('#kind').tabIndex=-1;$('#kind').setAttribute('aria-hidden','true');$('#kind').after(kinds);document.querySelector('label[for="kind"]').removeAttribute('for');
  $('#map').setAttribute('aria-label','System map. Drag to rotate or choose Pan. Two fingers pan and pinch to zoom. Tap a location to select. Back steps out one level.');
  $('.map-help').textContent='DRAG TO ROTATE · CHOOSE PAN TO MOVE · PINCH TO ZOOM · BACK TO STEP OUT';
}
async function start() {
  try {
    catalog = await fetch('catalog.json').then(r => r.json());
    bodies = catalog.bodies;
    map = new StarMap($('#map'), bodies, (b,focus=true) => selectBody(b,focus), (t, r) => r ? focusActivity(r) : report(t));
    map.belts=catalog.belts||[];
    setupCockpit();
    setupSnarePlanner();
    map.systems = catalog.systems || [{
      id: 'stanton',
      name: 'Stanton',
      position: [0, 0, 0]
    }];
    map.onSystemChanged = showSystem;
    map.onViewChanged=b=>selectBody(b,false);
    $('#back-view').onclick=()=>map.stepOut();
    $('#system-picker').replaceChildren(option('universe', 'Universe · all systems'), ...map.systems.map(s => option(s.id, s.name)));
    map.onJump=jumpToSystem;
    $('#system-picker').onchange = () => map.setSystem($('#system-picker').value);
    $('#universe').onclick = () => map.setSystem('universe');
    map.setSystem('universe');
    $('#build').textContent = catalog.build;
    $('#provenance').textContent = catalog.currentBuildVerified ? 'Extracted from your installed LIVE game.' : 'Legacy catalogue; current game not verified.';
    for (let id of ['origin', 'destination'])
      for (let b of bodies.filter(b => !b.hidden)) $('#' + id).append(option(b.id, b.name));
    for(const id of ['origin','destination']){$('#'+id).prepend(option('','Choose '+(id==='origin'?'departure':'destination')));$('#'+id).value='';}
    updateLocationPickers();
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
    $('#shard-region').value = currentShard ? currentShard.split('-')[0] : '';
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
        updatePresence();
        syncGame();
      }
    }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        updatePresence();
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
      map.belts=fresh.belts||[];
      map.systems = fresh.systems || map.systems;
      map.globeTextures.cache.clear();
      activeRoute = null;
      clearSnare();
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
      if($('#location-picker').open)$('#location-picker').close();
      updateLocationPickers();
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

let jumping=false;
async function jumpToSystem(id) {
  if(jumping||id===map.system||!map.systems.some(s=>s.id===id))return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){map.setSystem(id);return;}
  jumping=true;
  const source=map.system, overlay=el('div',undefined,'wormhole'),tunnel=el('div',undefined,'wormhole-tunnel');
  overlay.setAttribute('aria-hidden','true');overlay.append(tunnel);$('#map-area').append(overlay);
  const animation=overlay.animate([{opacity:0},{opacity:1,offset:.25},{opacity:1,offset:.65},{opacity:0}],{duration:760,easing:'ease-in-out'});
  const travel=setTimeout(()=>{if(map.system===source)map.setSystem(id);},380);
  try{await animation.finished;}catch{}finally{clearTimeout(travel);overlay.remove();jumping=false;}
}

function showSystem(id) {
  if(id==='universe')renderActiveShards(null,'loading');else if($('#active-shards'))$('#active-shards').hidden=true;
  if($('#map-location-actions'))$('#map-location-actions').hidden=true;
  selected=null;map.selected=null;$('#selection').replaceChildren();
  $('#system-picker').value = id;
  $('#system-context').textContent = id.toUpperCase();
  $('#map-name').textContent = id === 'universe' ? 'The known universe' : (map.systems.find(s => s.id === id)?.name || id) + ' system';
  $('#map-subtitle').textContent = id === 'universe' ? 'Stanton · Pyro · Nyx — select a disc to explore.' : 'Extracted navigation · zoom out for universe · double-click a gate to travel';
  search();
  updateHeatLegend();
  reports=[];renderReports();loadReports();updatePresence();
}

function updatePanelToggles(){
  const mobile=compact(),tablet=false;
  document.body.classList.toggle('touch-layout',mobile);
  for(const [side,id,name] of [['nav','sidebar','Navigation'],['intel','intel','Intelligence']]){
    const button=$('#toggle-'+side);if(!button)continue;
    const open=mobile?document.body.classList.contains('panel-'+id):side==='intel'&&tablet?document.body.classList.contains('intel-open'):!document.body.classList.contains(side+'-hidden');
    button.textContent=(side==='nav'?(open?'‹ ':'› '):'')+name+(side==='intel'?(open?' ›':' ‹'):'');
    button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',(open?'Hide ':'Show ')+name+' panel');
  }
}
function setupPanelToggles(){
  let saved={};try{saved=JSON.parse(localStorage.getItem('kittizen-panels')||'{}')||{};}catch{}
  for(const side of ['nav','intel']){
    if(saved[side]===true)document.body.classList.add(side+'-hidden');
    const button=el('button',undefined,'panel-toggle');button.id='toggle-'+side;button.type='button';button.setAttribute('aria-controls',side==='nav'?'sidebar':'intel');
    button.onclick=()=>{
      const mobile=compact(),tablet=false;
      if(mobile){const id=side==='nav'?'sidebar':'intel';panel(document.body.classList.contains('panel-'+id)?'map-area':id);}
      else if(side==='intel'&&tablet){document.body.classList.toggle('intel-open');updatePanelToggles();}
      else{document.body.classList.toggle(side+'-hidden');updatePanelToggles();}
      try{localStorage.setItem('kittizen-panels',JSON.stringify({nav:document.body.classList.contains('nav-hidden'),intel:document.body.classList.contains('intel-hidden')}));}catch{}
      map?.invalidate();
    };
    document.body.append(button);
  }
  matchMedia(compactQuery).addEventListener('change',updatePanelToggles);updatePanelToggles();
}
setupPanelToggles();
async function updatePresence(){
  if(!map||document.hidden)return;
  const system=map.system,shard=currentShard,request=++presenceRequest;
  const viewers=n=>n+' connected viewer'+(n===1?'':'s');
  let label=$('#viewer-count');if(!label){label=el('small',undefined,'hint');label.id='viewer-count';$('#map-subtitle').after(label);}
  try{const counts=await api('presence',{system,shard,includeShards:system==='universe'});if(request!==presenceRequest||system!==map.system||shard!==currentShard)return;label.textContent=system==='universe'?viewers(counts.total)+' · all shards':shard?viewers(counts.count)+' · '+shard+' / '+system:'Choose a shard to see its viewer count';if(system==='universe')renderActiveShards(counts);}
  catch{if(request!==presenceRequest||system!==map.system||shard!==currentShard)return;label.textContent='Viewer count unavailable';if(system==='universe')renderActiveShards(null,'error');}
}
function renderActiveShards(data,state='ready'){
  if(!map||map.system!=='universe')return;
  clearTimeout(shardListExpiry);if(state==='ready')shardListExpiry=setTimeout(()=>renderActiveShards(null,'error'),45000);
  let card=$('#active-shards');
  if(!card){
    card=el('details',undefined,'active-shards');card.id='active-shards';card.open=!compact();
    const summary=el('summary','Active shards'),list=el('div',undefined,'active-shard-list'),hint=el('small',undefined,'hint');
    list.id='active-shard-list';list.setAttribute('aria-label','Active shards on Kittizen');hint.id='active-shard-hint';card.append(summary,list,hint);document.querySelector('.map-title').append(card);
  }
  card.hidden=false;const key=JSON.stringify([state,data?.shards,data?.activeShardCount]);if(card.dataset.state===key)return;card.dataset.state=key;
  const rows=data?.shards||[],list=$('#active-shard-list');list.replaceChildren();
  card.querySelector('summary').textContent='Active shards'+(state==='ready'?' · '+(data?.activeShardCount||0):'');
  $('#active-shard-hint').textContent=state==='loading'?'Checking connected viewers…':state==='error'?'Live list unavailable · retrying automatically.':rows.length?'Kittizen viewers active in the last 45 seconds. Select a shard to open it.':'No active shards yet. Choose a region and shard to appear here.';
  for(const row of rows){
    const button=el('button',undefined,'active-shard');button.type='button';const system=map.systems.find(s=>s.id===row.system);
    const stats=el('small',undefined,'active-shard-stats'),reports=Number(row.reports)||0,reportText=reports+' active report'+(reports===1?'':'s');
    stats.append(el('span',row.count+' viewer'+(row.count===1?'':'s')),el('span',reportText,'active-shard-reports'+(reports?' has-reports':'')));
    button.append(el('strong',row.shard),stats);button.title='Open '+row.shard+' in '+(system?.name||row.system);
    button.setAttribute('aria-label','Open '+row.shard+' · '+row.count+' viewer'+(row.count===1?'':'s')+' · '+reportText);button.onclick=()=>joinShard(row.shard,row.system);list.append(button);
  }
  if(data?.activeShardCount>rows.length)list.append(el('small','Showing the '+rows.length+' most active shards.','hint'));
  map.invalidate();
}
function updateHeatLegend(){
  $('#heat-scope').textContent=map?.system==='universe'?'System totals · select a disc for location detail':'Recent activity · follows the map camera';
}
start().then(()=>{if(location.hash.startsWith('#pilot/')){try{openProfile(decodeURIComponent(location.hash.slice(7)));}catch{toast('Invalid pilot link');}}});


function setupHeatLegend(){
  const legend=$('#heat-legend');if(!legend)return;
  const positions=['bottom-left','bottom-right','top-left','top-right'];
  let settings={hidden:false,position:'bottom-left'};
  try{const value=JSON.parse(localStorage.getItem('kittizen-heat-legend')||'null');if(value){settings.hidden=value.hidden===true;if(positions.includes(value.position))settings.position=value.position;}}catch{}
  const toggle=el('button','Heat');toggle.id='legend-toggle';toggle.type='button';toggle.title='Show or hide activity heat legend';toggle.setAttribute('aria-label','Toggle activity heat legend');toggle.setAttribute('aria-controls','heat-legend');$('.map-controls').append(toggle);
  const controls=el('div',undefined,'legend-controls'),select=el('select');select.setAttribute('aria-label','Heat legend position');
  for(const value of positions)select.append(option(value,value.replace('-',' ')));
  const hide=el('button','Hide');hide.type='button';hide.setAttribute('aria-label','Hide activity heat legend');controls.append(select,hide);legend.append(controls);
  function apply(){legend.hidden=settings.hidden;legend.dataset.position=settings.position;select.value=settings.position;toggle.setAttribute('aria-pressed',String(!settings.hidden));try{localStorage.setItem('kittizen-heat-legend',JSON.stringify(settings));}catch{}map?.invalidate();}
  toggle.onclick=()=>{settings.hidden=!settings.hidden;apply();};hide.onclick=()=>{settings.hidden=true;apply();};select.onchange=()=>{settings.position=select.value;apply();};apply();
}
setupHeatLegend();
