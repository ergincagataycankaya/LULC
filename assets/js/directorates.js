/*
 * Istanbul RDF — Directorate land cover change
 * Same reading of the data as the regional atlas, one işletme müdürlüğü at a time.
 *
 * Areas come from assets/data/directorates.json, produced by
 * scripts/zonal-stats.py from the classified rasters. The regional atlas
 * shows the published totals; these are recounted per boundary, so they sum
 * to slightly less than the regional figures (see the panel footer).
 */

import {
  STUDY_AREA, YEARS, CLASSES, CLASS_BY_KEY, BASEMAPS, LULC_MAXZOOM, CITATION, HEADLINES, tileURL
} from './data.js';
import { trendChart, sparkline } from './charts.js';
import { makeDraggable } from './draggable.js';

/* ------------------------------------------------------------------ *
 * Formatting                                                          *
 * ------------------------------------------------------------------ */

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const ha = v => (v > 0 && v < 0.5 ? '<1' : nf0.format(v));
const signed = v => (v >= 0 ? '+' : '−') + nf0.format(Math.abs(v));
const pct = v => nf1.format(v);

/** KIRKLARELİ → Kırklareli (Turkish casing, so İ/I survive). */
const pretty = name => {
  const lower = name.toLocaleLowerCase('tr-TR');
  return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
};

/* ------------------------------------------------------------------ *
 * Icons                                                               *
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
  tag:     'M5 7V5h14v2M12 5v14M9 19h6',
  drop:    'M12 3s6 6.4 6 10.2A6 6 0 0 1 6 13.2C6 9.4 12 3 12 3z',
  back:    'm12 19-7-7 7-7M5 12h14'
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

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* ------------------------------------------------------------------ *
 * Data                                                                *
 * ------------------------------------------------------------------ */

let DATA = null;        // directorates.json
let GEO = null;         // directorates.geojson
let NAMES = [];         // directorate names, Turkish-collated
let ALL_AREA = null;    // summed over the ten directorates
const BOUNDS = new Map();

const ALL_KEYS = CLASSES.map(c => c.key);
const sumYear = (area, y) => Object.values(area[y]).reduce((a, b) => a + b, 0);

/** Area table for a directorate, or the sum of all ten when `name` is null. */
const areaOf = name => (name ? DATA.directorates[name] : ALL_AREA);

function buildAll() {
  ALL_AREA = {};
  for (const y of YEARS) {
    ALL_AREA[y] = Object.fromEntries(ALL_KEYS.map(k =>
      [k, NAMES.reduce((s, n) => s + DATA.directorates[n][y][k], 0)]));
  }
}

function geometryBounds(geom) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = c => {
    if (typeof c[0] === 'number') {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]);
      s = Math.min(s, c[1]); n = Math.max(n, c[1]);
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return [[w, s], [e, n]];
}

/* ------------------------------------------------------------------ *
 * State                                                               *
 * ------------------------------------------------------------------ */

const state = {
  year: 2023,
  baseYear: 2019,
  dir: null,
  basemap: 'satellite',
  labels: true,
  opacity: 0.82,
  visible: new Set(ALL_KEYS),
  tab: 'composition',
  panelOpen: true,
  playing: false,
  rankClass: 'forest',
  rankMetric: 'change'
};

function readHash() {
  const q = new URLSearchParams(location.hash.replace(/^#/, ''));
  const yr = Number(q.get('y'));
  if (YEARS.includes(yr)) state.year = yr;
  const by = Number(q.get('vs'));
  if (YEARS.includes(by)) state.baseYear = by;
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
  if (NAMES.includes(q.get('d'))) state.dir = q.get('d');
  if (['composition', 'change', 'ranking'].includes(q.get('t'))) state.tab = q.get('t');
  if (ALL_KEYS.includes(q.get('rc'))) state.rankClass = q.get('rc');
  if (['change', 'pct', 'area'].includes(q.get('rm'))) state.rankMetric = q.get('rm');
}

let hashTimer;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const q = new URLSearchParams();
    if (state.dir) q.set('d', state.dir);
    q.set('y', state.year);
    q.set('vs', state.baseYear);
    q.set('b', state.basemap);
    q.set('o', Math.round(state.opacity * 100));
    if (state.visible.size !== ALL_KEYS.length) q.set('c', [...state.visible].join(','));
    if (state.tab !== 'composition') q.set('t', state.tab);
    if (state.tab === 'ranking') { q.set('rc', state.rankClass); q.set('rm', state.rankMetric); }
    history.replaceState(null, '', '#' + q.toString());
  }, 220);
}

/* ------------------------------------------------------------------ *
 * Map                                                                 *
 * ------------------------------------------------------------------ */

let map = null;
const layerSig = new Map();
const sigOf = () => [...state.visible].sort().join(',');
const lulcId = year => `lulc-${year}`;
const NONE = '__none__';

function baseStyle() {
  const bm = BASEMAPS[state.basemap];
  return {
    version: 8,
    sources: {
      base:   { type: 'raster', tiles: bm.tiles,  tileSize: 256, maxzoom: bm.maxzoom ?? 18, attribution: bm.attribution },
      labels: { type: 'raster', tiles: bm.labels, tileSize: 256, maxzoom: 16 }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#080b0f' } },
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 1, 'raster-fade-duration': 160 } },
      { id: 'labels', type: 'raster', source: 'labels',
        layout: { visibility: state.labels ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 160 } }
    ]
  };
}

/** Boundary layers sit above the land cover and below the place labels. */
function addBoundaryLayers() {
  map.addSource('dirs', { type: 'geojson', data: GEO });
  const before = 'labels';
  map.addLayer({ id: 'dir-dim', type: 'fill', source: 'dirs',
    layout: { visibility: 'none' },
    filter: ['!=', ['get', 'name'], NONE],
    paint: { 'fill-color': '#05080b', 'fill-opacity': 0.62 } }, before);
  map.addLayer({ id: 'dir-hit', type: 'fill', source: 'dirs',
    paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.01 } }, before);
  map.addLayer({ id: 'dir-hover', type: 'fill', source: 'dirs',
    filter: ['==', ['get', 'name'], NONE],
    paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.12 } }, before);
  map.addLayer({ id: 'dir-line', type: 'line', source: 'dirs',
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': 1 } }, before);
  map.addLayer({ id: 'dir-sel', type: 'line', source: 'dirs',
    filter: ['==', ['get', 'name'], NONE],
    paint: { 'line-color': '#3fd07e', 'line-width': 2.6 } }, before);
}

function applySelectionToMap() {
  if (!map?.getSource('dirs')) return;
  const sel = state.dir ?? NONE;
  map.setFilter('dir-dim', ['!=', ['get', 'name'], sel]);
  map.setLayoutProperty('dir-dim', 'visibility', state.dir ? 'visible' : 'none');
  map.setFilter('dir-sel', ['==', ['get', 'name'], sel]);
}

function ensureLulc(year) {
  const id = lulcId(year);
  const sig = sigOf();
  if (!map.getSource(id)) {
    map.addSource(id, {
      type: 'raster',
      tiles: [tileURL(year, state.visible)],
      tileSize: 256,
      minzoom: 0,
      maxzoom: LULC_MAXZOOM,
      bounds: [STUDY_AREA.bounds[0][0], STUDY_AREA.bounds[0][1],
               STUDY_AREA.bounds[1][0], STUDY_AREA.bounds[1][1]]
    });
    map.addLayer({
      id, type: 'raster', source: id,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 0,
        'raster-opacity-transition': { duration: 260, delay: 0 },
        'raster-resampling': 'nearest',
        'raster-fade-duration': 120
      }
    }, map.getLayer('dir-dim') ? 'dir-dim' : 'labels');
    layerSig.set(id, sig);
  } else if (layerSig.get(id) !== sig) {
    map.getSource(id).setTiles([tileURL(year, state.visible)]);
    layerSig.set(id, sig);
  }
  return id;
}

function paintLulc() {
  if (!map || !map.isStyleLoaded()) return;
  const target = state.visible.size === 0 ? null : ensureLulc(state.year);
  for (const y of YEARS) {
    const id = lulcId(y);
    if (!map.getLayer(id)) continue;
    if (id === target) {
      map.setLayoutProperty(id, 'visibility', 'visible');
      map.setPaintProperty(id, 'raster-opacity', state.opacity);
    } else {
      map.setPaintProperty(id, 'raster-opacity', 0);
      setTimeout(() => {
        if (map.getLayer(id) && map.getPaintProperty(id, 'raster-opacity') === 0) {
          map.setLayoutProperty(id, 'visibility', 'none');
        }
      }, 320);
    }
  }
}

function applyBasemap() {
  const bm = BASEMAPS[state.basemap];
  if (!map?.getSource('base')) return;
  map.getSource('base').setTiles(bm.tiles);
  map.getSource('labels').setTiles(bm.labels);
  map.setLayoutProperty('labels', 'visibility', state.labels ? 'visible' : 'none');
}

function fitPadding() {
  const wide = window.innerWidth > 860;
  if (!wide) return { top: 70, bottom: 80, left: 16, right: 16 };
  return { top: 40, bottom: 90, left: state.panelOpen ? 420 : 40, right: 60 };
}

function frame(duration = 700) {
  const b = state.dir ? BOUNDS.get(state.dir) : STUDY_AREA.bounds;
  map.fitBounds(b, { padding: fitPadding(), duration, maxZoom: 12 });
}

/* ------------------------------------------------------------------ *
 * Actions                                                             *
 * ------------------------------------------------------------------ */

function selectDir(name, { fit = true } = {}) {
  state.dir = name && NAMES.includes(name) ? name : null;
  $('#dir-select').value = state.dir ?? '';
  applySelectionToMap();
  renderPanel();
  if (fit && map) frame();
  writeHash();
}

function setYear(year, { fromChart = false } = {}) {
  if (!YEARS.includes(year) || year === state.year) return;
  state.year = year;
  paintLulc();
  renderTimeline();
  renderPanel();
  writeHash();
  if (fromChart) $('.panel-body')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function setBaseYear(year) {
  state.baseYear = year;
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
  paintLulc();
  renderLegend();
  renderPanel();
  writeHash();
}

function setOpacity(v) {
  state.opacity = v;
  $('#opacity-val').textContent = `${Math.round(v * 100)}%`;
  const id = lulcId(state.year);
  if (map.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', state.visible.size ? v : 0);
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
      setYear(YEARS[(YEARS.indexOf(state.year) + 1) % YEARS.length]);
    }, 1300);
  }
}

/* ------------------------------------------------------------------ *
 * Rendering — timeline and legend                                     *
 * ------------------------------------------------------------------ */

function renderTimeline() {
  $('#tl-years').replaceChildren(...YEARS.map(y => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'num';
    b.textContent = y;
    b.setAttribute('aria-pressed', String(y === state.year));
    b.addEventListener('click', () => { togglePlay(false); setYear(y); });
    return b;
  }));
}

function renderLegend() {
  $('#legend').replaceChildren(...CLASSES.map(c => {
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
  const area = areaOf(state.dir);
  const total = sumYear(area, state.year);
  const regionTotal = sumYear(ALL_AREA, state.year);

  $('#panel-title').textContent = state.dir ? `${pretty(state.dir)} Directorate` : 'All directorates';
  $('#panel-year').textContent = state.year;
  $('#panel-meta').textContent = state.dir
    ? `${ha(total)} ha · ${pct((total / regionTotal) * 100)}% of the ten directorates`
    : `${ha(total)} ha across ${NAMES.length} directorates`;

  renderComposition(area, total);
  renderChange(area);
  renderRanking();
}

function renderComposition(area, total) {
  const y = state.year;
  const rows = CLASSES.map(c => ({ ...c, value: area[y][c.key] })).sort((a, b) => b.value - a.value);
  const maxV = rows[0].value || 1;

  $('#ribbon').replaceChildren(...rows.map(r => {
    const s = document.createElement('span');
    s.style.flex = `0 0 ${(r.value / total) * 100}%`;
    s.style.background = r.hex;
    s.style.opacity = state.visible.has(r.key) ? '1' : '0.18';
    s.title = `${r.label} — ${pct((r.value / total) * 100)}%`;
    return s;
  }));

  $('#class-list').replaceChildren(...rows.map(r => {
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

function renderChange(area) {
  const from = state.baseYear;
  const to = state.year;
  const same = from === to;

  const sel = $('#base-select');
  if (sel.options.length !== YEARS.length) {
    sel.replaceChildren(...YEARS.map(y => new Option(`vs ${y}`, String(y))));
  }
  sel.value = String(from);
  $('#change-range').textContent = same ? `${to}` : `→ ${to}`;

  const d = key => same ? 0 : area[to][key] - area[from][key];
  const rel = key => (same || !area[from][key] ? null : (d(key) / area[from][key]) * 100);

  $('#headline-cards').replaceChildren(...HEADLINES.map(h => {
    const cls = CLASS_BY_KEY[h.key];
    const dv = d(h.key);
    const r = rel(h.key);

    const card = document.createElement('div');
    card.className = 'stat';

    const label = document.createElement('div');
    label.className = 'stat-label';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = cls.hex;
    label.append(dot, document.createTextNode(cls.label));

    const val = document.createElement('div');
    val.className = 'stat-value num' + (dv < 0 ? ' loss' : dv > 0 ? ' gain' : '');
    val.append(
      document.createTextNode(same ? ha(area[to][h.key]) : signed(dv)),
      Object.assign(document.createElement('span'), { className: 'unit', textContent: 'ha' })
    );

    const note = document.createElement('div');
    note.className = 'stat-note num';
    note.textContent = same ? `total in ${to}`
      : r === null ? `none in ${from}`
      : `${dv >= 0 ? '+' : '−'}${pct(Math.abs(r))}% since ${from}`;

    card.append(label, val, note);
    card.appendChild(sparkline(YEARS.map(y => area[y][h.key]), { color: cls.hex, w: 88, h: 20 }));
    return card;
  }));

  const rows = CLASSES.map(c => ({ ...c, d: d(c.key) })).sort((a, b) => a.d - b.d);
  const scale = Math.max(1, ...rows.map(x => Math.abs(x.d)));

  $('#change-list').replaceChildren(...rows.map(r => {
    const row = document.createElement('div');
    row.className = 'change-row';
    row.title = `${r.label}: ${ha(area[from][r.key])} ha → ${ha(area[to][r.key])} ha`;

    const label = document.createElement('div');
    label.className = 'change-label';
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = r.hex;
    label.append(sw, document.createTextNode(r.label));

    const track = document.createElement('div');
    track.className = 'change-track';
    const bar = document.createElement('i');
    const w = (Math.abs(r.d) / scale) * 50;
    bar.style.background = r.hex;
    bar.style.width = `${w}%`;
    bar.style.left = r.d >= 0 ? '50%' : `${50 - w}%`;
    track.appendChild(bar);

    const val = document.createElement('div');
    val.className = 'change-val num' + (r.d < 0 ? ' loss' : r.d > 0 ? ' gain' : '');
    val.textContent = same ? '—' : signed(r.d);

    row.append(label, track, val);
    return row;
  }));

  /* A class absent in the first year cannot be indexed to it. */
  const keys = ['forest', 'rangeland', 'agriculture', 'built'].filter(k => area[YEARS[0]][k] > 0);
  trendChart($('#trend'), {
    keys,
    area,
    activeYear: state.year,
    onHoverYear: (yr, click) => { if (click && yr) { togglePlay(false); setYear(yr, { fromChart: true }); } }
  });
}

function renderRanking() {
  const key = state.rankClass;
  const from = state.baseYear;
  const to = state.year;
  const metric = state.rankMetric;
  const cls = CLASS_BY_KEY[key];

  const sel = $('#rank-class');
  if (sel.options.length !== CLASSES.length) {
    sel.replaceChildren(...CLASSES.map(c => new Option(c.label, c.key)));
  }
  sel.value = key;
  $$('#seg-rank button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === metric)));

  const rows = NAMES.map(n => {
    const a = DATA.directorates[n];
    const change = a[to][key] - a[from][key];
    return {
      name: n,
      area: a[to][key],
      change,
      pct: a[from][key] > 0 ? (change / a[from][key]) * 100 : null
    };
  });
  const val = r => r[metric];
  const ranked = rows.filter(r => val(r) !== null).sort((a, b) => val(b) - val(a));
  const dropped = rows.length - ranked.length;
  const scale = Math.max(1e-9, ...ranked.map(r => Math.abs(val(r))));
  const diverging = metric !== 'area';

  const fmt = r => metric === 'pct'
    ? `${val(r) >= 0 ? '+' : '−'}${pct(Math.abs(val(r)))}%`
    : metric === 'change' ? signed(val(r)) : ha(val(r));

  $('#rank-list').replaceChildren(...ranked.map(r => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'rank-row';
    row.dataset.selected = String(r.name === state.dir);
    row.title = `${pretty(r.name)}: ${ha(DATA.directorates[r.name][from][key])} ha → ${ha(r.area)} ha`;

    const nm = document.createElement('span');
    nm.className = 'rank-name';
    nm.textContent = pretty(r.name);

    const track = document.createElement('span');
    track.className = 'change-track';
    const bar = document.createElement('i');
    const w = (Math.abs(val(r)) / scale) * (diverging ? 50 : 100);
    bar.style.background = cls.hex;
    bar.style.width = `${w}%`;
    bar.style.left = !diverging ? '0' : val(r) >= 0 ? '50%' : `${50 - w}%`;
    track.appendChild(bar);

    const fig = document.createElement('span');
    const sign = metric === 'area' ? '' : val(r) < 0 ? ' loss' : val(r) > 0 ? ' gain' : '';
    fig.className = 'change-val num' + sign;
    fig.textContent = fmt(r);

    row.append(nm, track, fig);
    row.addEventListener('click', () => selectDir(r.name));
    return row;
  }));

  const period = metric === 'area' ? `${to}` : from === to ? 'pick a baseline different from the map year' : `${from} → ${to}`;
  $('#rank-note').textContent =
    `${cls.label}, ${period}.` +
    (dropped ? ` ${dropped} directorate${dropped > 1 ? 's' : ''} omitted: no ${cls.label.toLowerCase()} in ${from}.` : '') +
    ' Click a directorate to select it.';
}

/* ------------------------------------------------------------------ *
 * Tabs / chrome                                                       *
 * ------------------------------------------------------------------ */

function setTab(name) {
  state.tab = name;
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tabpane').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  if (name === 'change') requestAnimationFrame(() => renderChange(areaOf(state.dir)));
  writeHash();
}

function setPanel(open) {
  state.panelOpen = open;
  $('.app').classList.toggle('panel-collapsed', !open);
  const btn = $('#btn-panel');
  btn.setAttribute('aria-pressed', String(open));
  btn.title = open ? 'Hide panel (P)' : 'Show panel (P)';
  const sheet = window.innerWidth <= 860;
  btn.replaceChildren(icon(open ? (sheet ? 'close' : 'chevron') : 'panel'));
  setTimeout(() => map?.resize(), 340);
}

function wireControls() {
  $$('#seg-basemap button').forEach(b => {
    b.addEventListener('click', () => {
      state.basemap = b.dataset.value;
      $$('#seg-basemap button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      applyBasemap();
      writeHash();
    });
  });

  $('#btn-labels').addEventListener('click', () => {
    state.labels = !state.labels;
    $('#btn-labels').setAttribute('aria-pressed', String(state.labels));
    map.getLayer('labels') && map.setLayoutProperty('labels', 'visibility', state.labels ? 'visible' : 'none');
  });

  const slider = $('#opacity');
  slider.value = String(Math.round(state.opacity * 100));
  slider.addEventListener('input', () => setOpacity(Number(slider.value) / 100));

  $('#btn-panel').addEventListener('click', () => setPanel(!state.panelOpen));
  $$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#btn-play').addEventListener('click', () => togglePlay());
  $('#base-select').addEventListener('change', e => setBaseYear(Number(e.target.value)));
  $('#dir-select').addEventListener('change', e => selectDir(e.target.value || null));

  $('#rank-class').addEventListener('change', e => { state.rankClass = e.target.value; renderRanking(); writeHash(); });
  $$('#seg-rank button').forEach(b => b.addEventListener('click', () => {
    state.rankMetric = b.dataset.value;
    renderRanking();
    writeHash();
  }));

  $('#btn-zoom-in').addEventListener('click', () => map.zoomIn());
  $('#btn-zoom-out').addEventListener('click', () => map.zoomOut());
  $('#btn-home').addEventListener('click', () => { selectDir(null); });
}

function wireKeys() {
  window.addEventListener('keydown', ev => {
    if (ev.target.matches('input, select, textarea')) return;
    const i = YEARS.indexOf(state.year);
    switch (ev.key) {
      case 'ArrowRight': togglePlay(false); setYear(YEARS[Math.min(YEARS.length - 1, i + 1)]); break;
      case 'ArrowLeft':  togglePlay(false); setYear(YEARS[Math.max(0, i - 1)]); break;
      case ' ':          ev.preventDefault(); togglePlay(); break;
      case 'Escape':     selectDir(null); break;
      case 'p': case 'P': setPanel(!state.panelOpen); break;
      case 'l': case 'L': $('#btn-labels').click(); break;
      case 'b': case 'B': {
        const keys = Object.keys(BASEMAPS);
        const next = keys[(keys.indexOf(state.basemap) + 1) % keys.length];
        $(`#seg-basemap button[data-value="${next}"]`).click();
        break;
      }
      default:
        if (/^[1-5]$/.test(ev.key)) { togglePlay(false); setYear(YEARS[Number(ev.key) - 1]); }
    }
  });
}

function wireMap() {
  const tip = $('#map-tip');
  const stage = $('.stage');
  const hit = e => map.queryRenderedFeatures(e.point, { layers: ['dir-hit'] })[0]?.properties.name ?? null;
  let hovered = null;

  map.on('mousemove', e => {
    $('#ro-coord').textContent = `${e.lngLat.lat.toFixed(3)}°N ${e.lngLat.lng.toFixed(3)}°E`;
    const name = hit(e);
    if (name !== hovered) {
      hovered = name;
      map.setFilter('dir-hover', ['==', ['get', 'name'], name ?? NONE]);
      map.getCanvas().style.cursor = name ? 'pointer' : '';
    }
    if (!name) { tip.hidden = true; return; }
    const r = stage.getBoundingClientRect();
    const total = sumYear(DATA.directorates[name], state.year);
    tip.textContent = `${pretty(name)} · ${ha(total)} ha`;
    tip.style.left = `${e.originalEvent.clientX - r.left + 14}px`;
    tip.style.top = `${e.originalEvent.clientY - r.top + 14}px`;
    tip.hidden = false;
  });
  map.on('mouseout', () => { tip.hidden = true; });

  map.on('click', e => {
    const name = hit(e);
    if (name) selectDir(name);
    else if (state.dir) selectDir(null);
  });

  const zoomEl = $('#ro-zoom');
  map.on('move', () => { zoomEl.textContent = `z${map.getZoom().toFixed(1)}`; });

  const app = $('.app');
  const sync = () => app.classList.toggle('busy', !map.areTilesLoaded());
  map.on('dataloading', sync);
  map.on('data', sync);
  map.on('idle', () => app.classList.remove('busy'));
}

/* ------------------------------------------------------------------ *
 * Boot                                                                *
 * ------------------------------------------------------------------ */

async function boot() {
  const [data, geo] = await Promise.all([
    fetch('assets/data/directorates.json').then(r => r.json()),
    fetch('assets/data/directorates.geojson').then(r => r.json())
  ]);
  DATA = data;
  GEO = geo;
  NAMES = Object.keys(DATA.directorates).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  for (const f of GEO.features) BOUNDS.set(f.properties.name, geometryBounds(f.geometry));
  buildAll();
  readHash();

  $$('#seg-basemap button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.value === state.basemap)));
  $('#dir-select').replaceChildren(
    new Option('All directorates', ''),
    ...NAMES.map(n => new Option(pretty(n), n)));
  $('#dir-select').value = state.dir ?? '';

  const inside = sumYear(ALL_AREA, 2023);
  const covered = inside / (inside + DATA.outsideBoundariesHa['2023']);
  $('#foot-coverage').textContent = `${pct(covered * 100)}%`;
  $('#foot-cite').href = CITATION.url;

  map = new maplibregl.Map({
    container: 'map',
    style: baseStyle(),
    center: STUDY_AREA.center,
    zoom: 8.4,
    minZoom: 5,
    maxZoom: 17,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    fadeDuration: 160
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disable();

  const dismissBoot = () => {
    const b = $('.boot');
    if (!b || b.classList.contains('gone')) return;
    b.classList.add('gone');
    setTimeout(() => b.remove(), 600);
  };

  map.on('load', () => {
    map.resize();
    /* Raster first: adding the GeoJSON source leaves the style "not loaded"
       until it parses, and paintLulc bails out in that state. Boundary
       layers are inserted below the labels, so they still end up on top. */
    paintLulc();
    addBoundaryLayers();
    applySelectionToMap();
    frame(0);
    wireMap();
    dismissBoot();
  });
  map.on('error', e => console.warn('[atlas] map error', e && e.error));
  setTimeout(dismissBoot, 6000);

  if ('ResizeObserver' in window) new ResizeObserver(() => map.resize()).observe($('.stage'));

  wireControls();
  wireKeys();

  renderTimeline();
  renderLegend();
  renderPanel();
  setTab(state.tab);
  setPanel(window.innerWidth > 860);
  togglePlay(false);
  $('#opacity-val').textContent = `${Math.round(state.opacity * 100)}%`;
  $('#btn-labels').setAttribute('aria-pressed', String(state.labels));

  $('#btn-labels').prepend(icon('tag'));
  $('#btn-zoom-in').replaceChildren(icon('plus'));
  $('#btn-zoom-out').replaceChildren(icon('minus'));
  $('#btn-home').replaceChildren(icon('home'));
  $('.opacity-ctl').prepend(icon('drop'));
  $('a.pill-btn[href="./"]').prepend(icon('back'));

  makeDraggable($('#legend-card'), {
    container: $('.stage'),
    storageKey: 'lulc.legend.pos',
    enabled: () => window.innerWidth > 860
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.tab === 'change') renderChange(areaOf(state.dir)); }, 160);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
