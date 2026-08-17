/*
 * Istanbul RDF — LULC Atlas
 * Application shell: map, state, panels, URL sync.
 */

import {
  STUDY_AREA, YEARS, CLASSES, CLASS_BY_KEY, AREA_HA, ACCURACY,
  BASEMAPS, LULC_MAXZOOM, CITATION, HEADLINES,
  tileURL, totalHa, delta, series
} from './data.js';
import { trendChart, sparkline } from './charts.js';

/* ------------------------------------------------------------------ *
 * Formatting                                                          *
 * ------------------------------------------------------------------ */

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Snow and cloud residue can be a fraction of a hectare. Rounding those to a
   flat "0" would read as "this class is absent", which is not what the data says. */
const ha = v => (v > 0 && v < 0.5 ? '<1' : nf0.format(v));
const signed = v => (v >= 0 ? '+' : '−') + nf0.format(Math.abs(v));
const pct = v => nf1.format(v);

/* ------------------------------------------------------------------ *
 * Icons (Lucide-derived, 24×24 stroke)                                *
 * ------------------------------------------------------------------ */

const ICON = {
  panel:   'M3 5h18M3 12h18M3 19h18',
  close:   'M18 6 6 18M6 6l12 12',
  chevron: 'm15 18-6-6 6-6',
  plus:    'M12 5v14M5 12h14',
  minus:   'M5 12h14',
  home:    'M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4',
  play:    'M7 4.5v15l13-7.5z',
  pause:   'M8 4.5v15M16 4.5v15',
  compare: 'M12 3v18M4 6h4v12H4zM16 6h4v12h-4z',
  tag:     'M5 7V5h14v2M12 5v14M9 19h6',
  drop:    'M12 3s6 6.4 6 10.2A6 6 0 0 1 6 13.2C6 9.4 12 3 12 3z',
  info:    'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  grip:    'm9 7-4 5 4 5M15 7l4 5-4 5'
};

function icon(name, filled = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', filled ? 'currentColor' : 'none');
  svg.setAttribute('stroke', filled ? 'none' : 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICON[name]);
  svg.appendChild(p);
  return svg;
}

/* ------------------------------------------------------------------ *
 * State                                                               *
 * ------------------------------------------------------------------ */

const ALL_KEYS = CLASSES.map(c => c.key);

const state = {
  year: 2023,
  baseYear: 2019,      // comparison year, drawn on the left in compare mode
  compare: false,
  split: 0.5,
  basemap: 'satellite',
  labels: true,
  opacity: 0.82,
  visible: new Set(ALL_KEYS),
  tab: 'composition',
  panelOpen: true,
  playing: false
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* ------------------------------------------------------------------ *
 * URL state — makes any view shareable                                *
 * ------------------------------------------------------------------ */

function readHash() {
  const q = new URLSearchParams(location.hash.replace(/^#/, ''));
  const yr = Number(q.get('y'));
  if (YEARS.includes(yr)) state.year = yr;
  const by = Number(q.get('vs'));
  if (YEARS.includes(by)) { state.baseYear = by; state.compare = true; }
  if (BASEMAPS[q.get('b')]) state.basemap = q.get('b');
  if (q.has('o')) {
    const o = Number(q.get('o'));
    if (Number.isFinite(o) && o >= 0 && o <= 100) state.opacity = o / 100;
  }
  const cls = q.get('c');
  if (cls) {
    const keep = cls.split(',').filter(k => ALL_KEYS.includes(k));
    if (keep.length) state.visible = new Set(keep);
  }
  /* Guard with has() — Number(null) is 0, which would silently park the
     camera at zoom 0, 0°N 0°E whenever the hash is absent. */
  if (!q.has('z') || !q.has('lat') || !q.has('lng')) return null;
  const z = Number(q.get('z')), lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  return Number.isFinite(z) && Number.isFinite(lat) && Number.isFinite(lng)
    ? { zoom: z, center: [lng, lat] }
    : null;
}

let hashTimer;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    if (!map) return;
    const c = map.getCenter();
    const q = new URLSearchParams();
    q.set('y', state.year);
    if (state.compare) q.set('vs', state.baseYear);
    q.set('b', state.basemap);
    q.set('o', Math.round(state.opacity * 100));
    if (state.visible.size !== ALL_KEYS.length) q.set('c', [...state.visible].join(','));
    q.set('z', map.getZoom().toFixed(2));
    q.set('lat', c.lat.toFixed(4));
    q.set('lng', c.lng.toFixed(4));
    history.replaceState(null, '', '#' + q.toString());
  }, 220);
}

/* ------------------------------------------------------------------ *
 * Map                                                                 *
 * ------------------------------------------------------------------ */

let map = null;   // primary map — shows `state.year`
let mapB = null;  // compare map — shows `state.baseYear`, clipped to the left
let syncing = false;

function baseStyle() {
  const bm = BASEMAPS[state.basemap];
  return {
    version: 8,
    sources: {
      base:   { type: 'raster', tiles: bm.tiles,  tileSize: 256, maxzoom: 18, attribution: bm.attribution },
      labels: { type: 'raster', tiles: bm.labels, tileSize: 256, maxzoom: 16 }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#080b0f' } },
      { id: 'base', type: 'raster', source: 'base',
        paint: { 'raster-opacity': 1, 'raster-fade-duration': 160 } },
      { id: 'labels', type: 'raster', source: 'labels',
        layout: { visibility: state.labels ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 160 } }
    ]
  };
}

function makeMap(container, opts = {}) {
  const m = new maplibregl.Map({
    container,
    style: baseStyle(),
    center: STUDY_AREA.center,
    zoom: 8.4,
    minZoom: 5,
    maxZoom: 17,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchZoomRotate: true,
    fadeDuration: 160,
    ...opts
  });
  m.touchZoomRotate.disableRotation();
  m.keyboard.disable(); // arrow keys drive the timeline instead
  return m;
}

/* --- LULC layers -------------------------------------------------- */

/** Signature of the current class filter, used to invalidate cached tiles. */
const sigOf = () => [...state.visible].sort().join(',');
const layerSig = new Map();   // "<mapKey>:<year>" → signature

function lulcId(year) { return `lulc-${year}`; }

function ensureLulc(m, mapKey, year) {
  const id = lulcId(year);
  const sig = sigOf();
  const cacheKey = `${mapKey}:${year}`;

  if (!m.getSource(id)) {
    m.addSource(id, {
      type: 'raster',
      tiles: [tileURL(year, state.visible)],
      tileSize: 256,
      minzoom: 0,
      maxzoom: LULC_MAXZOOM,
      bounds: [STUDY_AREA.bounds[0][0], STUDY_AREA.bounds[0][1],
               STUDY_AREA.bounds[1][0], STUDY_AREA.bounds[1][1]]
    });
    m.addLayer({
      id,
      type: 'raster',
      source: id,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 0,
        'raster-opacity-transition': { duration: 260, delay: 0 },
        'raster-resampling': 'nearest',   // categorical data must not be blended
        'raster-fade-duration': 120
      }
    }, m.getLayer('labels') ? 'labels' : undefined);
    layerSig.set(cacheKey, sig);
  } else if (layerSig.get(cacheKey) !== sig) {
    m.getSource(id).setTiles([tileURL(year, state.visible)]);
    layerSig.set(cacheKey, sig);
  }
  return id;
}

function paintLulc(m, mapKey, year) {
  if (!m || !m.isStyleLoaded()) return;
  const empty = state.visible.size === 0;
  const target = empty ? null : ensureLulc(m, mapKey, year);

  for (const y of YEARS) {
    const id = lulcId(y);
    if (!m.getLayer(id)) continue;
    if (id === target) {
      m.setLayoutProperty(id, 'visibility', 'visible');
      m.setPaintProperty(id, 'raster-opacity', state.opacity);
    } else {
      m.setPaintProperty(id, 'raster-opacity', 0);
      setTimeout(() => {
        if (m.getLayer(id) && m.getPaintProperty(id, 'raster-opacity') === 0) {
          m.setLayoutProperty(id, 'visibility', 'none');
        }
      }, 320);
    }
  }
}

function refreshMaps() {
  paintLulc(map, 'a', state.year);
  if (state.compare && mapB) paintLulc(mapB, 'b', state.baseYear);
}

/* --- Basemap ------------------------------------------------------- */

function applyBasemap(m) {
  const bm = BASEMAPS[state.basemap];
  if (!m || !m.getSource('base')) return;
  m.getSource('base').setTiles(bm.tiles);
  m.getSource('labels').setTiles(bm.labels);
  m.setLayoutProperty('labels', 'visibility', state.labels ? 'visible' : 'none');
}

/* --- Compare ------------------------------------------------------- */

function applySplit() {
  const pctSplit = (state.split * 100).toFixed(3);
  const hostB = $('#map-b');
  const handle = $('.compare-handle');
  hostB.style.clipPath = `inset(0 0 0 ${pctSplit}%)`;
  handle.style.left = `${pctSplit}%`;
  $('.compare-tag.a').style.left = `max(12px, calc(${pctSplit}% - 60px))`;
  $('.compare-tag.b').style.left = `calc(${pctSplit}% + 14px)`;
}

function enableCompare(on) {
  state.compare = on;
  $('.app').classList.toggle('compare', on);
  $('#btn-compare').setAttribute('aria-pressed', String(on));
  $('#tl-base-wrap').hidden = !on;

  if (on) {
    if (!mapB) {
      mapB = makeMap('map-b', { interactive: false, attributionControl: false });
      mapB.on('load', () => { paintLulc(mapB, 'b', state.baseYear); });
      // Keep the clipped map locked to the interactive one.
      map.on('move', syncB);
    }
    syncB();
    applySplit();
    if (mapB.isStyleLoaded()) { applyBasemap(mapB); paintLulc(mapB, 'b', state.baseYear); }
    mapB.resize();
  }
  renderTimeline();
  renderPanel();
  writeHash();
}

function syncB() {
  /* Once created, mapB is kept around for instant re-entry into compare mode —
     but it must stop chasing the camera while hidden, or it keeps fetching
     tiles nobody can see. */
  if (!mapB || syncing || !state.compare) return;
  syncing = true;
  mapB.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
  syncing = false;
}

function initSplitDrag() {
  const handle = $('.compare-handle');
  const stage = $('.stage');
  let dragging = false;

  const move = ev => {
    if (!dragging) return;
    const r = stage.getBoundingClientRect();
    state.split = Math.min(0.97, Math.max(0.03, (ev.clientX - r.left) / r.width));
    applySplit();
  };

  handle.addEventListener('pointerdown', ev => {
    dragging = true;
    handle.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', ev => {
    dragging = false;
    try { handle.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
  });
  handle.addEventListener('lostpointercapture', () => { dragging = false; });
}

/* ------------------------------------------------------------------ *
 * Actions                                                             *
 * ------------------------------------------------------------------ */

function setYear(year, { fromChart = false } = {}) {
  if (!YEARS.includes(year) || year === state.year) return;
  state.year = year;
  refreshMaps();
  renderTimeline();
  renderPanel();
  writeHash();
  if (fromChart) $('.panel-body')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function setBaseYear(year) {
  state.baseYear = year;
  if (mapB) paintLulc(mapB, 'b', year);
  renderTimeline();
  renderPanel();
  writeHash();
}

function toggleClass(key, solo = false) {
  if (solo) {
    state.visible = state.visible.size === 1 && state.visible.has(key)
      ? new Set(ALL_KEYS)
      : new Set([key]);
  } else if (state.visible.has(key)) {
    state.visible.delete(key);
  } else {
    state.visible.add(key);
  }
  refreshMaps();
  renderLegend();
  renderPanel();
  writeHash();
}

function setOpacity(v) {
  state.opacity = v;
  $('#opacity-val').textContent = `${Math.round(v * 100)}%`;
  const idA = lulcId(state.year);
  if (map.getLayer(idA)) map.setPaintProperty(idA, 'raster-opacity', state.visible.size ? v : 0);
  if (mapB) {
    const idB = lulcId(state.baseYear);
    if (mapB.getLayer(idB)) mapB.setPaintProperty(idB, 'raster-opacity', state.visible.size ? v : 0);
  }
  writeHash();
}

let playTimer = null;
function togglePlay(force) {
  state.playing = force !== undefined ? force : !state.playing;
  $('#btn-play').setAttribute('aria-pressed', String(state.playing));
  $('#btn-play').replaceChildren(icon(state.playing ? 'pause' : 'play', !state.playing));
  $('#btn-play').title = state.playing ? 'Pause (Space)' : 'Play through years (Space)';

  clearInterval(playTimer);
  if (state.playing) {
    playTimer = setInterval(() => {
      const next = YEARS[(YEARS.indexOf(state.year) + 1) % YEARS.length];
      setYear(next);
    }, 1300);
  }
}

/* ------------------------------------------------------------------ *
 * Rendering — timeline                                                *
 * ------------------------------------------------------------------ */

function renderTimeline() {
  const wrap = $('#tl-years');
  wrap.replaceChildren(...YEARS.map(y => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'num';
    b.textContent = y;
    b.setAttribute('aria-pressed', String(y === state.year));
    if (state.compare) {
      if (y === state.baseYear) b.dataset.side = 'a';
      if (y === state.year) b.dataset.side = 'b';
    }
    b.addEventListener('click', () => { togglePlay(false); setYear(y); });
    return b;
  }));

  const sel = $('#tl-base');
  if (sel.options.length !== YEARS.length) {
    sel.replaceChildren(...YEARS.map(y => new Option(String(y), String(y))));
  }
  sel.value = String(state.baseYear);

  $('.compare-tag.a').textContent = state.baseYear;
  $('.compare-tag.b').textContent = state.year;
}

/* ------------------------------------------------------------------ *
 * Rendering — legend strip                                            *
 * ------------------------------------------------------------------ */

function renderLegend() {
  const host = $('#legend');
  host.replaceChildren(...CLASSES.map(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'legend-chip';
    b.dataset.off = String(!state.visible.has(c.key));
    b.title = `${c.label} — click to toggle, alt-click to isolate`;

    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = c.hex;
    b.append(sw, document.createTextNode(c.label));
    b.addEventListener('click', ev => toggleClass(c.key, ev.altKey || ev.metaKey));
    return b;
  }));
}

/* ------------------------------------------------------------------ *
 * Rendering — panel                                                   *
 * ------------------------------------------------------------------ */

function renderPanel() {
  const y = state.year;
  const total = totalHa(y);

  $('#panel-year').textContent = y;
  $('#panel-tag').textContent = state.compare ? `vs ${state.baseYear}` : 'On map';
  $('#panel-meta').textContent =
    `${ha(total)} ha mapped · Sentinel-2 · overall F1 ${nf2.format(ACCURACY[y].overall)}%`;

  renderComposition();
  renderChange();
  renderAccuracy();
}

function renderComposition() {
  const y = state.year;
  const total = totalHa(y);
  const rows = CLASSES.map(c => ({ ...c, value: AREA_HA[y][c.key] }))
    .sort((a, b) => b.value - a.value);
  const maxV = rows[0].value;

  /* Composition ribbon */
  const ribbon = $('#ribbon');
  ribbon.replaceChildren(...rows.map(r => {
    const s = document.createElement('span');
    s.style.flex = `0 0 ${(r.value / total) * 100}%`;
    s.style.background = r.hex;
    s.style.opacity = state.visible.has(r.key) ? '1' : '0.18';
    s.title = `${r.label} — ${pct((r.value / total) * 100)}%`;
    return s;
  }));

  /* Class rows double as map filters */
  const list = $('#class-list');
  list.replaceChildren(...rows.map(r => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'class-row';
    btn.dataset.off = String(!state.visible.has(r.key));
    btn.title = `${r.blurb}\n\nClick to toggle on the map · alt-click to isolate`;

    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = r.hex;

    const main = document.createElement('span');
    main.className = 'class-main';
    const name = document.createElement('span');
    name.className = 'class-name';
    name.textContent = r.label;
    const bar = document.createElement('span');
    bar.className = 'class-bar';
    const fill = document.createElement('i');
    fill.style.width = `${Math.max(1.5, (r.value / maxV) * 100)}%`;
    fill.style.background = r.hex;
    bar.appendChild(fill);
    main.append(name, bar);

    const figs = document.createElement('span');
    figs.className = 'class-figs';
    const v = document.createElement('span');
    v.className = 'class-ha';
    v.textContent = ha(r.value);
    const p = document.createElement('span');
    p.className = 'class-pct';
    p.textContent = `${pct((r.value / total) * 100)}%`;
    figs.append(v, p);

    btn.append(sw, main, figs);
    btn.addEventListener('click', ev => toggleClass(r.key, ev.altKey || ev.metaKey));
    return btn;
  }));

  $('#comp-total').textContent = `${ha(total)} ha`;
  $('#comp-shown').textContent = state.visible.size === CLASSES.length
    ? 'all 9 classes'
    : `${state.visible.size} of ${CLASSES.length} classes shown`;
}

function renderChange() {
  const from = state.compare ? state.baseYear : YEARS[0];
  const to = state.year;
  const same = from === to;

  $('#change-range').textContent = same
    ? `${from}`
    : `${Math.min(from, to)} → ${Math.max(from, to)}`;

  /* Headline cards */
  const cards = $('#headline-cards');
  cards.replaceChildren(...HEADLINES.map(hRow => {
    const cls = CLASS_BY_KEY[hRow.key];
    const d = same ? 0 : delta(hRow.key, from, to);
    const rel = same ? 0 : (d / AREA_HA[from][hRow.key]) * 100;

    const card = document.createElement('div');
    card.className = 'stat';

    const label = document.createElement('div');
    label.className = 'stat-label';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = cls.hex;
    label.append(dot, document.createTextNode(cls.label));

    const val = document.createElement('div');
    val.className = 'stat-value num' + (d < 0 ? ' loss' : d > 0 ? ' gain' : '');
    val.append(
      document.createTextNode(same ? ha(AREA_HA[to][hRow.key]) : signed(d)),
      Object.assign(document.createElement('span'), { className: 'unit', textContent: 'ha' })
    );

    const note = document.createElement('div');
    note.className = 'stat-note num';
    note.textContent = same
      ? `total in ${to}`
      : `${d >= 0 ? '+' : '−'}${nf1.format(Math.abs(rel))}% since ${from}`;

    card.append(label, val, note);
    card.appendChild(sparkline(series(hRow.key), { color: cls.hex, w: 88, h: 20 }));
    return card;
  }));

  /* Diverging change bars across every class */
  const list = $('#change-list');
  const deltas = CLASSES.map(c => ({ ...c, d: same ? 0 : delta(c.key, from, to) }))
    .sort((a, b) => a.d - b.d);
  const scale = Math.max(1, ...deltas.map(x => Math.abs(x.d)));

  list.replaceChildren(...deltas.map(r => {
    const row = document.createElement('div');
    row.className = 'change-row';
    row.title = `${r.label}: ${ha(AREA_HA[from][r.key])} ha → ${ha(AREA_HA[to][r.key])} ha`;

    const label = document.createElement('div');
    label.className = 'change-label';
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = r.hex;
    label.append(sw, document.createTextNode(r.label));

    const track = document.createElement('div');
    track.className = 'change-track';
    const bar = document.createElement('i');
    const wPct = (Math.abs(r.d) / scale) * 50;
    bar.style.background = r.hex;
    bar.style.width = `${wPct}%`;
    bar.style.left = r.d >= 0 ? '50%' : `${50 - wPct}%`;
    track.appendChild(bar);

    const val = document.createElement('div');
    val.className = 'change-val num' + (r.d < 0 ? ' loss' : r.d > 0 ? ' gain' : '');
    val.textContent = same ? '—' : signed(r.d);

    row.append(label, track, val);
    return row;
  }));

  /* Indexed trajectories */
  trendChart($('#trend'), {
    keys: ['forest', 'rangeland', 'agriculture', 'built'],
    activeYear: state.year,
    onHoverYear: (yr, click) => { if (click && yr) { togglePlay(false); setYear(yr, { fromChart: true }); } }
  });
}

function renderAccuracy() {
  const y = state.year;
  const acc = ACCURACY[y];

  $('#acc-overall').textContent = nf2.format(acc.overall) + '%';
  $('#acc-overall-note').innerHTML =
    `Overall F1-score for <b class="num">${y}</b>, validated against National Forest Inventory ` +
    `plots and expert review of high-resolution imagery.`;

  const body = $('#acc-rows');
  const rows = CLASSES.map(c => ({ ...c, m: acc.byClass[c.key] }))
    .sort((a, b) => b.m[2] - a.m[2]);

  body.replaceChildren(...rows.map(r => {
    const [p, rc, f1] = r.m;
    const row = document.createElement('div');
    row.className = 'acc-row';

    const name = document.createElement('div');
    name.className = 'acc-name';
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = r.hex;
    const nm = document.createElement('span');
    nm.textContent = r.label;
    name.append(sw, nm);

    const pc = document.createElement('span');
    pc.className = 'acc-num num';
    pc.textContent = nf2.format(p);

    const rcv = document.createElement('span');
    rcv.className = 'acc-num num';
    rcv.textContent = nf2.format(rc);

    const f1cell = document.createElement('span');
    f1cell.className = 'acc-f1';
    const meter = document.createElement('span');
    meter.className = 'meter';
    const fill = document.createElement('i');
    fill.style.width = `${f1}%`;
    fill.style.background = f1 >= 85 ? 'var(--accent)' : f1 >= 70 ? '#e8b64c' : 'var(--loss)';
    meter.appendChild(fill);
    const b = document.createElement('b');
    b.textContent = nf1.format(f1);
    f1cell.append(meter, b);

    row.append(name, pc, rcv, f1cell);
    return row;
  }));
}

/* ------------------------------------------------------------------ *
 * Tabs / panel chrome                                                 *
 * ------------------------------------------------------------------ */

function setTab(name) {
  state.tab = name;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tabpane').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  if (name === 'change') requestAnimationFrame(() => renderChange());
}

function setPanel(open) {
  state.panelOpen = open;
  $('.app').classList.toggle('panel-collapsed', !open);
  const btn = $('#btn-panel');
  btn.setAttribute('aria-pressed', String(open));
  btn.title = open ? 'Hide panel (P)' : 'Show panel (P)';
  /* The panel slides sideways on desktop and up from the bottom on mobile,
     so the affordance has to match the direction it actually moves. */
  const sheet = window.innerWidth <= 860;
  btn.replaceChildren(icon(open ? (sheet ? 'close' : 'chevron') : 'panel'));
  setTimeout(() => { map?.resize(); mapB?.resize(); }, 340);
}

/* ------------------------------------------------------------------ *
 * Wiring                                                              *
 * ------------------------------------------------------------------ */

function wireControls() {
  /* Basemap */
  $$('#seg-basemap button').forEach(b => {
    b.addEventListener('click', () => {
      state.basemap = b.dataset.value;
      $$('#seg-basemap button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      applyBasemap(map);
      if (mapB) applyBasemap(mapB);
      writeHash();
    });
  });

  /* Labels */
  $('#btn-labels').addEventListener('click', () => {
    state.labels = !state.labels;
    $('#btn-labels').setAttribute('aria-pressed', String(state.labels));
    [map, mapB].forEach(m => m?.getLayer('labels') &&
      m.setLayoutProperty('labels', 'visibility', state.labels ? 'visible' : 'none'));
  });

  /* Compare */
  $('#btn-compare').addEventListener('click', () => enableCompare(!state.compare));

  /* Opacity */
  const slider = $('#opacity');
  slider.value = String(Math.round(state.opacity * 100));
  slider.addEventListener('input', () => setOpacity(Number(slider.value) / 100));

  /* Panel */
  $('#btn-panel').addEventListener('click', () => setPanel(!state.panelOpen));

  /* Tabs */
  $$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  /* Timeline */
  $('#btn-play').addEventListener('click', () => togglePlay());
  $('#tl-base').addEventListener('change', e => setBaseYear(Number(e.target.value)));

  /* Map nav */
  $('#btn-zoom-in').addEventListener('click', () => map.zoomIn());
  $('#btn-zoom-out').addEventListener('click', () => map.zoomOut());
  $('#btn-home').addEventListener('click', () =>
    map.fitBounds(STUDY_AREA.bounds, { padding: fitPadding(), duration: 800 }));

  /* About */
  const dlg = $('#about');
  $('#btn-about').addEventListener('click', () => dlg.showModal());
  $('#about-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
}

function fitPadding() {
  const wide = window.innerWidth > 860;
  if (!wide) return { top: 70, bottom: 80, left: 16, right: 16 };
  return {
    top: 40,
    bottom: 90,
    left: state.panelOpen ? 420 : 40,
    right: 60
  };
}

function wireKeys() {
  window.addEventListener('keydown', ev => {
    if (ev.target.matches('input, select, textarea')) return;
    const i = YEARS.indexOf(state.year);
    switch (ev.key) {
      case 'ArrowRight': togglePlay(false); setYear(YEARS[Math.min(YEARS.length - 1, i + 1)]); break;
      case 'ArrowLeft':  togglePlay(false); setYear(YEARS[Math.max(0, i - 1)]); break;
      case ' ':          ev.preventDefault(); togglePlay(); break;
      case 'c': case 'C': enableCompare(!state.compare); break;
      case 'p': case 'P': setPanel(!state.panelOpen); break;
      case 'l': case 'L': $('#btn-labels').click(); break;
      case 'b': case 'B': {
        const keys = Object.keys(BASEMAPS);
        const next = keys[(keys.indexOf(state.basemap) + 1) % keys.length];
        document.querySelector(`#seg-basemap button[data-value="${next}"]`).click();
        break;
      }
      case '?': $('#about').showModal(); break;
      default:
        if (/^[1-5]$/.test(ev.key)) { togglePlay(false); setYear(YEARS[Number(ev.key) - 1]); }
    }
  });
}

function wireReadout() {
  const zoomEl = $('#ro-zoom');
  const coordEl = $('#ro-coord');
  const update = () => {
    zoomEl.textContent = `z${map.getZoom().toFixed(1)}`;
    const c = map.getCenter();
    coordEl.textContent = `${c.lat.toFixed(3)}°N ${c.lng.toFixed(3)}°E`;
  };
  map.on('move', update);
  map.on('moveend', writeHash);
  map.on('mousemove', e => {
    coordEl.textContent = `${e.lngLat.lat.toFixed(3)}°N ${e.lngLat.lng.toFixed(3)}°E`;
  });
  update();

  const app = $('.app');
  const sync = () => app.classList.toggle('busy', !map.areTilesLoaded());
  map.on('dataloading', sync);
  map.on('data', sync);
  map.on('idle', () => app.classList.remove('busy'));
}

/* ------------------------------------------------------------------ *
 * About dialog content                                                *
 * ------------------------------------------------------------------ */

function fillAbout() {
  $('#cite-text').innerHTML =
    `${CITATION.authors} (${CITATION.year}). ${CITATION.title}. ` +
    `<em>${CITATION.journal}</em>, ${CITATION.volume}, ${CITATION.pages}.`;
  $('#cite-link').href = CITATION.url;
  $('#cite-pdf').href = CITATION.pdf;
  $('#area-provinces').textContent = STUDY_AREA.provinces.join(', ');
  $('#area-directorates').textContent = STUDY_AREA.directorates.join(', ');
  $('#foot-cite').href = CITATION.url;
  $('#foot-about').addEventListener('click', () => $('#about').showModal());
}

/* ------------------------------------------------------------------ *
 * Boot                                                                *
 * ------------------------------------------------------------------ */

function boot() {
  const view = readHash();

  /* Reflect restored state in the chrome before the map paints. */
  $$('#seg-basemap button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.value === state.basemap)));

  map = makeMap('map');

  const dismissBoot = () => {
    const b = $('.boot');
    if (!b || b.classList.contains('gone')) return;
    b.classList.add('gone');
    setTimeout(() => b.remove(), 600);
  };

  map.on('load', () => {
    /* The container can still be settling when the constructor runs, so size
       the map before framing anything — otherwise fitBounds divides by zero
       and the camera lands in the Gulf of Guinea. */
    map.resize();
    if (view) map.jumpTo(view);
    else map.fitBounds(STUDY_AREA.bounds, { padding: fitPadding(), duration: 0 });

    paintLulc(map, 'a', state.year);
    if (state.compare) enableCompare(true);
    dismissBoot();
  });

  /* Never trap the user behind a splash screen if WebGL or the style fails. */
  map.on('error', e => console.warn('[atlas] map error', e && e.error));
  setTimeout(dismissBoot, 6000);

  /* Keep both canvases in step with the layout. */
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { map.resize(); mapB?.resize(); })
      .observe($('.stage'));
  }

  wireControls();
  wireKeys();
  wireReadout();
  initSplitDrag();
  fillAbout();

  renderTimeline();
  renderLegend();
  renderPanel();
  setTab(state.tab);
  setPanel(window.innerWidth > 860);
  togglePlay(false);
  $('#opacity-val').textContent = `${Math.round(state.opacity * 100)}%`;
  $('#btn-compare').setAttribute('aria-pressed', String(state.compare));
  $('#btn-labels').setAttribute('aria-pressed', String(state.labels));

  /* Icons that are not re-rendered elsewhere */
  $('#btn-compare').prepend(icon('compare'));
  $('#btn-labels').prepend(icon('tag'));
  $('#btn-about').replaceChildren(icon('info'));
  $('#btn-zoom-in').replaceChildren(icon('plus'));
  $('#btn-zoom-out').replaceChildren(icon('minus'));
  $('#btn-home').replaceChildren(icon('home'));
  $('#about-close').replaceChildren(icon('close'));
  $('.compare-grip').replaceChildren(icon('grip'));
  $('.opacity-ctl').prepend(icon('drop'));

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.tab === 'change') renderChange(); }, 160);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
