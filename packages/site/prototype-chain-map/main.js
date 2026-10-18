// PROTOTYPE, throwaway. Three directions for the chain map, on the real data of a test release.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { animate, inView } from 'motion';
import data from './data.json';

const V = new URLSearchParams(location.search).get('v') ?? 'a';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.add(V);

const STAGE = {
  field: ['Fields', '#4cc27a'], transport: ['Upstream transport', '#e0b23a'],
  processing: ['Refining and liquefaction', '#ff8a3d'], export: ['Export', '#4aa8ff'],
  exit: ['Exit from Russian control', '#ff4d6d'], destination: ['Declared destination', '#a58bff'],
};
const PRODUCT = { crude: ['Crude oil', '#f2b04a'], products: ['Refined products', '#ff6b4a'], gas: ['Gas and LNG', '#3fd0c9'] };
const REVIEW = '#9aa3ad';

const features = data.features.features.map((f) => ({
  ...f, properties: { ...f.properties, c: STAGE[f.properties.stageKey]?.[1] ?? '#6b7075' },
}));
const arcs = data.flows.arcs.features.map((f) => ({
  ...f, properties: { ...f.properties, c: f.properties.style === 'in review' ? REVIEW : PRODUCT[f.properties.product][1], after: f.properties.style === 'dashed' },
}));
const exits = data.flows.exits.features;
const links = data.flows.links;
const fc = (f) => ({ type: 'FeatureCollection', features: f });
const byId = new Map(features.map((f) => [f.id, f]));

// The six steps of the story. "Export" is the leg after the terminal: the links after the export stage and the declared destinations.
const STEPS = [
  { key: 'field', title: 'Extraction', say: (n) => `${n} fields of the record have a position.`, assets: (p) => p.stageKey === 'field' },
  { key: 'pipeline', title: 'Pipeline', say: (n) => `${n} physical links carry the product to a refinery or a terminal.`, arcs: (p) => !p.after },
  { key: 'processing', title: 'Refinery', say: (n) => `${n} refineries and LNG plants.`, assets: (p) => p.stageKey === 'processing' },
  { key: 'export', title: 'Terminal', say: (n) => `${n} export terminals and ports.`, assets: (p) => p.stageKey === 'export' },
  { key: 'flows', title: 'Export', say: (n) => `${n} links after the export stage, to a declared destination.`, arcs: (p) => p.after, assets: (p) => p.stageKey === 'destination' },
  { key: 'exit', title: 'Exit', say: (n) => `${n} exit points, computed from the relations: a sale at a Russian port, a ship-to-ship transfer or a handover at the border.`, exits: true },
];
const stepParts = (s) => {
  const a = s.assets ? features.filter((f) => s.assets(f.properties)) : [];
  const r = s.arcs ? arcs.filter((f) => s.arcs(f.properties)) : [];
  const e = s.exits ? exits : [];
  return { a, r, e, n: s.exits ? e.length : s.arcs ? r.length : a.length };
};

// ---------- the map ----------
const style = {
  version: 8,
  sources: {
    countries: { type: 'geojson', data: new URL('./countries.json', location.href).href },
    entities: { type: 'geojson', data: fc(features) },
    arcs: { type: 'geojson', data: fc(arcs), lineMetrics: true },
    exits: { type: 'geojson', data: fc(exits) },
  },
  layers: [
    { id: 'ground', type: 'background', paint: { 'background-color': V === 'b' ? '#0a1220' : '#050912' } },
    { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': '#1c2a3d' } },
    { id: 'coast', type: 'line', source: 'countries', paint: { 'line-color': '#3b4f6b', 'line-width': 0.8 } },
    { id: 'arcs-glow', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.35 } },
    { id: 'arcs-solid', type: 'line', source: 'arcs', filter: ['==', ['get', 'style'], 'solid'], layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 2 } },
    { id: 'arcs-dashed', type: 'line', source: 'arcs', filter: ['==', ['get', 'style'], 'dashed'], paint: { 'line-color': ['get', 'c'], 'line-width': 2, 'line-dasharray': [3, 2] } },
    { id: 'arcs-review', type: 'line', source: 'arcs', filter: ['==', ['get', 'style'], 'in review'], paint: { 'line-color': REVIEW, 'line-width': 2, 'line-dasharray': [0.5, 1.5] } },
    ...Object.entries(PRODUCT).map(([k]) => ({
      id: `pulse-${k}`, type: 'line', source: 'arcs', filter: ['all', ['==', ['get', 'product'], k], ['!=', ['get', 'style'], 'in review']],
      layout: { 'line-cap': 'round' }, paint: { 'line-width': 4, 'line-blur': 1, 'line-gradient': grad(0.5, '#ffffff') },
    })),
    { id: 'points-glow', type: 'circle', source: 'entities', paint: { 'circle-color': ['get', 'c'], 'circle-radius': 14, 'circle-blur': 1, 'circle-opacity': 0.45 } },
    { id: 'points', type: 'circle', source: 'entities', paint: { 'circle-color': ['get', 'c'], 'circle-radius': 4.5, 'circle-stroke-color': '#050912', 'circle-stroke-width': 1 } },
    { id: 'exits', type: 'circle', source: 'exits', paint: { 'circle-opacity': 0, 'circle-radius': 11, 'circle-stroke-color': ['case', ['get', 'inReview'], REVIEW, STAGE.exit[1]], 'circle-stroke-width': 2 } },
  ],
};
if (V === 'a') style.sky = { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0], 'sky-color': '#0b1a33', 'horizon-color': '#1d3b66', 'fog-color': '#050912' };

function grad(p, colour) {
  const T = 'rgba(0,0,0,0)';
  const stops = [[0, T], [p - 0.12, T], [p, colour], [p + 0.02, T], [1, T]].filter(([x], i, all) => x >= 0 && x <= 1 && (i === 0 || x > all[i - 1][0]));
  const out = []; let last = -1;
  for (const [x, c] of stops) if (x > last) { out.push(x, c); last = x; }
  return ['interpolate', ['linear'], ['line-progress'], ...out];
}

const map = new maplibregl.Map({
  container: 'map', style, attributionControl: false,
  center: [70, 58], zoom: V === 'a' ? 1.6 : 2.6, pitch: V === 'b' ? 55 : 0, bearing: V === 'b' ? -12 : 0, maxPitch: 70,
});
map.on('error', (e) => console.error(e.error?.message));
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
map.on('style.load', () => { if (V === 'a') map.setProjection({ type: 'globe' }); });

// ---------- shared UI ----------
let product = 'all';
const card = document.getElementById('card');
const caption = document.getElementById('caption');
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };

function showAsset(p) {
  const regimes = Object.entries(p.sanctions ?? {}).map(([r, l]) => `${r.toUpperCase()}: ${l.length ? l.map((x) => x.measure ?? x.kind ?? 'listed').join(', ') : 'no listing'}`);
  const up = links.arcs.filter((l) => l.toId === p.id).map((l) => byId.get(l.fromId)?.properties.label).filter(Boolean);
  const down = links.arcs.filter((l) => l.fromId === p.id).map((l) => byId.get(l.toId)?.properties.label).filter(Boolean);
  card.replaceChildren(
    el('div', STAGE[p.stageKey]?.[0] ?? 'No stage', 'k'), el('h2', p.label),
    el('div', 'Sanctions', 'k'), ...regimes.map((t) => el('div', t)),
    ...(up.length ? [el('div', 'Upstream', 'k'), ...up.map((t) => el('div', t))] : []),
    ...(down.length ? [el('div', 'Downstream', 'k'), ...down.map((t) => el('div', t))] : []),
    el('div', 'Origin', 'k'), el('div', p.origin_label ?? ''),
    el('div', 'Full card and sources on the entity page.', 'k'),
  );
  card.hidden = false;
  if (!REDUCED) animate(card, { opacity: [0, 1], x: [16, 0] }, { duration: 0.25 });
  focusChain(p.id);
}
function showExit(p) {
  card.replaceChildren(el('div', 'Exit from Russian control', 'k'), el('h2', p.label),
    ...(p.inReview ? [el('p', 'In review: this exit point rests on a proposal, not a fact.', 'review')] : []),
    el('p', p.why), el('div', 'Computed from the relations of the release. Not an entity of the record.', 'k'));
  card.hidden = false;
}
function showArc(p) {
  card.replaceChildren(el('div', `Physical link · ${PRODUCT[p.product][0]}`, 'k'), el('h2', p.label),
    ...(p.style === 'in review' ? [el('p', 'In review: a proposal, not a fact.', 'review')] : []),
    el('p', 'No volume for this link in the release. A volume is an aggregate of the research, not a fact of the record.'));
  card.hidden = false;
}

const ids = (list) => ['literal', list.map((f) => f.id ?? f.properties.id)];
function highlight({ a = null, r = null, e = null } = {}) {
  const on = (set, layer, prop, base) => map.setPaintProperty(layer, prop, set === null ? base : ['case', ['in', ['get', 'id'], set], base, base * 0.12]);
  for (const [l, pr, b] of [['points', 'circle-opacity', 1], ['points', 'circle-stroke-opacity', 1], ['points-glow', 'circle-opacity', 0.45]]) on(a, l, pr, b);
  for (const [l, pr, b] of [['arcs-solid', 'line-opacity', 1], ['arcs-dashed', 'line-opacity', 1], ['arcs-review', 'line-opacity', 1], ['arcs-glow', 'line-opacity', 0.35]]) on(r, l, pr, b);
  on(e, 'exits', 'circle-stroke-opacity', 1);
  three?.setFocus(r);
}
function focusChain(id) {
  const seen = new Set([id]); const arcIds = new Set(); let grew = true;
  while (grew) { grew = false; for (const l of links.arcs) if ((seen.has(l.fromId) || seen.has(l.toId)) && !arcIds.has(l.id)) { arcIds.add(l.id); seen.add(l.fromId); seen.add(l.toId); grew = true; } }
  const ex = links.exits.filter((x) => x.assets.some((a) => seen.has(a))).map((x) => x.id);
  highlight({ a: ['literal', [...seen]], r: ['literal', [...arcIds]], e: ['literal', ex] });
}
function fly(parts) {
  const pts = [...parts.a.map((f) => f.geometry.coordinates), ...parts.e.map((f) => f.geometry.coordinates), ...parts.r.flatMap((f) => f.geometry.coordinates)];
  if (!pts.length) return;
  const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
  const pad = V === 'c' ? 60 : { top: 90, bottom: 190, left: 330, right: 350 };
  map.fitBounds(b, { padding: innerWidth < 720 ? 40 : pad, maxZoom: 5, duration: REDUCED ? 0 : 2200, essential: false, pitch: V === 'b' ? 55 : 0 });
}
function goStep(i) {
  const s = STEPS[i]; const parts = stepParts(s);
  highlight({ a: s.assets ? ids(parts.a) : ['literal', []], r: s.arcs ? ids(parts.r) : ['literal', []], e: s.exits ? ids(parts.e) : ['literal', []] });
  fly(parts);
  return parts;
}

for (const b of document.querySelectorAll('[data-product]')) b.addEventListener('click', () => {
  product = b.dataset.product;
  for (const o of document.querySelectorAll('[data-product]')) o.setAttribute('aria-pressed', String(o === b));
  const f = product === 'all' ? ['boolean', true] : ['==', ['get', 'product'], product];
  for (const [l, st] of [['arcs-glow', null], ['arcs-solid', 'solid'], ['arcs-dashed', 'dashed'], ['arcs-review', 'in review']]) map.setFilter(l, st === null ? f : ['all', ['==', ['get', 'style'], st], f]);
  for (const k of Object.keys(PRODUCT)) map.setLayoutProperty(`pulse-${k}`, 'visibility', product === 'all' || product === k ? 'visible' : 'none');
  three?.setProduct(product);
});
for (const b of document.querySelectorAll('[data-v]')) { b.setAttribute('aria-pressed', String(b.dataset.v === V)); b.addEventListener('click', () => { location.search = `?v=${b.dataset.v}`; }); }

// The text equivalent for a screen reader and a small screen.
document.getElementById('list').append(...features.map((f) => el('li', `${f.properties.label}: ${STAGE[f.properties.stageKey]?.[0] ?? 'no stage'}`)));

map.on('click', (ev) => {
  const hit = map.queryRenderedFeatures(ev.point, { layers: ['points', 'exits', 'arcs-solid', 'arcs-dashed', 'arcs-review'] })[0];
  if (!hit) { card.hidden = true; highlight(); return; }
  if (hit.layer.id === 'points') showAsset(hit.properties.sanctions ? { ...hit.properties, sanctions: JSON.parse(hit.properties.sanctions) } : hit.properties);
  else if (hit.layer.id === 'exits') showExit(hit.properties);
  else showArc(hit.properties);
});
for (const l of ['points', 'exits', 'arcs-solid', 'arcs-dashed']) { map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; }); }

// The flow pulse: a bright head that runs along each line. No pulse when the reader asks for reduced motion.
map.on('load', () => {
  if (REDUCED) { for (const k of Object.keys(PRODUCT)) map.setLayoutProperty(`pulse-${k}`, 'visibility', 'none'); return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = (((t - t0) / 2600) % 1) * 1.1;
    if (p < 1) for (const k of Object.keys(PRODUCT)) map.setPaintProperty(`pulse-${k}`, 'line-gradient', grad(p, '#ffffff'));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (V === 'a') { // a slow spin of the globe until the reader acts
    let spin = true; const stop = () => { spin = false; };
    map.on('mousedown', stop); map.on('touchstart', stop); map.on('wheel', stop); document.addEventListener('keydown', stop, { once: true }); document.addEventListener('click', stop, { once: true });
    const turn = () => { if (!spin) return; const c = map.getCenter(); c.lng -= 0.04; map.jumpTo({ center: c }); requestAnimationFrame(turn); };
    requestAnimationFrame(turn);
  }
});

// ---------- A and B: the stepper of six stages ----------
if (V !== 'c') {
  const steps = document.getElementById('steps');
  const play = el('button', REDUCED ? 'Step through' : '▶ Play the chain', 'play');
  steps.append(play);
  const buttons = STEPS.map((s, i) => {
    const n = stepParts(s).n;
    const b = el('button'); b.setAttribute('aria-pressed', 'false');
    const t = el('span'); const d = el('span', null, 'dot'); d.style.background = (STAGE[s.key] ?? STAGE[s.key === 'pipeline' ? 'transport' : 'destination'])[1]; t.append(d, `${i + 1} ${s.title}`);
    const bar = el('span', null, 'bar'); bar.append(el('i'));
    b.append(t, el('small', `${n}`), bar);
    b.addEventListener('click', () => select(i));
    steps.append(b); return b;
  });
  let current = -1; let timer = null;
  const select = (i) => {
    current = i; const parts = goStep(i);
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    caption.textContent = `${i + 1} · ${STEPS[i].title}. ${STEPS[i].say(parts.n)}`;
    if (!REDUCED) animate(caption, { opacity: [0, 1], y: [8, 0] }, { duration: 0.35 });
    card.hidden = true;
  };
  play.addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = null; play.textContent = '▶ Play the chain'; return; }
    if (REDUCED) { select((current + 1) % STEPS.length); return; }
    play.textContent = '❚❚ Pause';
    const run = () => {
      const i = (current + 1) % STEPS.length; select(i);
      const bar = buttons[i].querySelector('.bar i'); animate(bar, { width: ['0%', '100%'] }, { duration: 4, ease: 'linear' });
    };
    run(); timer = setInterval(run, 4200);
  });
}

// ---------- C: the story, one chapter for each stage ----------
if (V === 'c') {
  for (const id of ['steps', 'caption']) document.getElementById(id).hidden = true;
  document.querySelector('details.about').style.display = 'none';
  const story = document.getElementById('story'); story.hidden = false;
  const intro = el('section', null, 'chapter on'); const box = el('div');
  box.append(el('h2', 'From the well to the exit from Russian control'), el('p', 'Six stages. Each point is an asset of the record with a position, each line a physical link that a document supports. Scroll.'));
  intro.append(box); story.append(intro);
  STEPS.forEach((s, i) => {
    const parts = stepParts(s);
    const sec = el('section', null, 'chapter'); const d = el('div');
    const n = el('div', String(parts.n), 'n'); n.append(el('small', `${i + 1} / 6 · ${s.title}`));
    d.append(n, el('h2', s.title), el('p', s.say(parts.n)));
    const more = el('details'); more.append(el('summary', 'How to read this stage'), el('p', i === 1 || i === 4 ? 'A link with no volume has one width. A dashed line is a link after the export stage. A grey dotted line is in review: a proposal, not a fact.' : 'The colour of a point is its stage. Select a point for its card.'));
    d.append(more); sec.append(d); story.append(sec);
    inView(sec, () => {
      for (const o of story.children) o.classList.remove('on'); sec.classList.add('on');
      goStep(i);
      if (!REDUCED) {
        animate(d, { opacity: [0.35, 1], y: [24, 0] }, { duration: 0.5 });
        if (s.arcs) animate(0, 1, { duration: 1.6, onUpdate: (v) => { for (const k of Object.keys(PRODUCT)) map.setPaintProperty(`pulse-${k}`, 'line-gradient', grad(v, '#ffffff')); } });
      }
    }, { amount: 0.6 });
  });
}

// ---------- B: raised 3D arcs with particles, a three.js layer ----------
let three = null;
if (V === 'b') {
  const THREE = await import('three');
  const merc = (lng, lat, z = 0) => maplibregl.MercatorCoordinate.fromLngLat([lng, lat], z);
  const curves = arcs.map((f) => {
    const c = f.geometry.coordinates; const [a, b] = [c[0], c[c.length - 1]];
    const ma = merc(...a), mb = merc(...b);
    const d = Math.hypot(ma.x - mb.x, ma.y - mb.y);
    const pts = Array.from({ length: 48 }, (_, i) => { const t = i / 47; const m = merc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); return new THREE.Vector3(m.x, m.y, Math.sin(Math.PI * t) * d * 0.35); });
    return { f, curve: new THREE.CatmullRomCurve3(pts) };
  });
  let scene, camera, renderer; const parts = []; let focus = null; let prod = 'all';
  const layer = {
    id: 'three-arcs', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      scene = new THREE.Scene(); camera = new THREE.Camera();
      for (const { f, curve } of curves) {
        const col = new THREE.Color(f.properties.c);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.00028, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: f.properties.after ? 0.45 : 0.9 }));
        tube.userData = f.properties; scene.add(tube);
        const dots = REDUCED ? 0 : 5;
        for (let k = 0; k < dots; k++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.0007, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
          s.userData = { curve, offset: k / dots, p: f.properties }; scene.add(s); parts.push(s);
        }
        tube.userData.tube = true;
      }
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(gl, args) {
      const t = performance.now() / 4000;
      for (const s of parts) s.position.copy(s.userData.curve.getPointAt((t + s.userData.offset) % 1));
      for (const o of scene.children) {
        const p = o.userData.p ?? o.userData; const id = p.id;
        o.visible = prod === 'all' || p.product === prod;
        o.material.opacity = (focus === null || focus.includes(id) ? 1 : 0.08) * (o.userData.tube ? (p.after ? 0.5 : 0.9) : 1);
      }
      camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      renderer.resetState(); renderer.render(scene, camera);
      if (!REDUCED) map.triggerRepaint();
    },
  };
  map.on('load', () => {
    // The 3D arcs replace the flat lines; the flat lines stay hidden for the click.
    for (const l of ['arcs-glow', 'arcs-solid', 'arcs-dashed', ...Object.keys(PRODUCT).map((k) => `pulse-${k}`)]) map.setPaintProperty(l, l.startsWith('pulse') ? 'line-opacity' : 'line-opacity', 0.0001);
    map.addLayer(layer, 'points-glow');
  });
  three = { setFocus: (r) => { focus = r === null ? null : r[1]; map.triggerRepaint(); }, setProduct: (p) => { prod = p; map.triggerRepaint(); } };
}
