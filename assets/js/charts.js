/*
 * Tiny hand-rolled SVG charts.
 *
 * There is no charting library here on purpose: the whole app ships less
 * JavaScript than a single plotting bundle would, and every mark can be
 * styled from the same CSS custom properties as the rest of the interface.
 */

import { YEARS, AREA_HA, CLASS_BY_KEY } from './data.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children) node.appendChild(c);
  return node;
}

/** Catmull-Rom-ish smoothing kept deliberately mild so the data stays honest. */
function polyline(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

/* ------------------------------------------------------------------ *
 * Sparkline — inline, no axes, used inside the headline stat cards.   *
 * ------------------------------------------------------------------ */

export function sparkline(values, { color, w = 76, h = 22 } = {}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2.5;

  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (w - 2 * pad) + pad,
    h - pad - ((v - min) / span) * (h - 2 * pad)
  ]);

  const svg = el('svg', {
    class: 'spark', width: w, height: h, viewBox: `0 0 ${w} ${h}`,
    'aria-hidden': 'true', preserveAspectRatio: 'none'
  });

  const gradId = `sp-${Math.random().toString(36).slice(2, 8)}`;
  const defs = el('defs');
  const grad = el('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.appendChild(el('stop', { offset: '0', 'stop-color': color, 'stop-opacity': '0.35' }));
  grad.appendChild(el('stop', { offset: '1', 'stop-color': color, 'stop-opacity': '0' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(el('path', {
    d: `${polyline(pts)} L${w - pad},${h} L${pad},${h} Z`,
    fill: `url(#${gradId})`
  }));
  svg.appendChild(el('path', {
    d: polyline(pts), fill: 'none', stroke: color,
    'stroke-width': 1.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
  }));
  svg.appendChild(el('circle', {
    cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 2, fill: color
  }));

  return svg;
}

/* ------------------------------------------------------------------ *
 * Indexed trend chart                                                 *
 *                                                                     *
 * Classes differ by an order of magnitude in absolute hectares, so    *
 * raw lines would flatten everything but agriculture. Indexing to the *
 * 2019 baseline puts every trajectory on a comparable footing, which  *
 * is the question the chart is actually answering: who moved, and by  *
 * how much, relative to where they started.                           *
 * ------------------------------------------------------------------ */

export function trendChart(host, { keys, activeYear, onHoverYear }) {
  host.textContent = '';

  const w = Math.max(240, host.clientWidth || 320);
  const h = 168;
  const m = { top: 12, right: 8, bottom: 20, left: 34 };
  const iw = w - m.left - m.right;
  const ih = h - m.top - m.bottom;

  const base = YEARS[0];
  const indexed = keys.map(key => ({
    key,
    color: CLASS_BY_KEY[key].hex,
    label: CLASS_BY_KEY[key].label,
    values: YEARS.map(y => (AREA_HA[y][key] / AREA_HA[base][key]) * 100)
  }));

  const all = indexed.flatMap(s => s.values);
  let lo = Math.min(...all, 100);
  let hi = Math.max(...all, 100);
  const padY = Math.max(0.6, (hi - lo) * 0.18);
  lo -= padY; hi += padY;

  const x = i => m.left + (i / (YEARS.length - 1)) * iw;
  const y = v => m.top + ih - ((v - lo) / (hi - lo)) * ih;

  const svg = el('svg', {
    class: 'chart', viewBox: `0 0 ${w} ${h}`, width: '100%', height: h,
    role: 'img', 'aria-label': `Land cover area indexed to ${base} = 100`
  });

  /* Horizontal grid + y labels */
  const ticks = niceTicks(lo, hi, 4);
  for (const t of ticks) {
    svg.appendChild(el('line', {
      class: 'grid', x1: m.left, x2: m.left + iw, y1: y(t), y2: y(t)
    }));
    const label = el('text', { class: 'axis', x: m.left - 6, y: y(t) + 3, 'text-anchor': 'end' });
    label.textContent = t.toFixed(0);
    svg.appendChild(label);
  }

  /* Baseline at 100 */
  svg.appendChild(el('line', {
    x1: m.left, x2: m.left + iw, y1: y(100), y2: y(100),
    stroke: 'rgba(255,255,255,0.22)', 'stroke-width': 1
  }));

  /* Marker for the year currently on the map */
  const ai = YEARS.indexOf(activeYear);
  if (ai >= 0) {
    svg.appendChild(el('line', {
      class: 'marker-year', x1: x(ai), x2: x(ai), y1: m.top - 2, y2: m.top + ih
    }));
  }

  /* Year labels */
  YEARS.forEach((yr, i) => {
    const t = el('text', {
      class: 'axis', x: x(i), y: h - 5, 'text-anchor': 'middle',
      fill: yr === activeYear ? 'var(--text-dim)' : null
    });
    t.textContent = yr;
    svg.appendChild(t);
  });

  /* Series */
  for (const s of indexed) {
    const pts = s.values.map((v, i) => [x(i), y(v)]);
    svg.appendChild(el('path', { class: 'line', d: polyline(pts), stroke: s.color }));
    pts.forEach(([px, py], i) => {
      svg.appendChild(el('circle', {
        class: 'pt', cx: px, cy: py, r: YEARS[i] === activeYear ? 3.4 : 2.2, fill: s.color
      }));
    });
  }

  /* Hover bands, one per year */
  YEARS.forEach((yr, i) => {
    const bandW = iw / (YEARS.length - 1);
    const rect = el('rect', {
      x: x(i) - bandW / 2, y: m.top - 4, width: bandW, height: ih + 8,
      fill: 'transparent', style: 'cursor:pointer'
    });
    rect.addEventListener('pointerenter', () => onHoverYear && onHoverYear(yr));
    rect.addEventListener('pointerleave', () => onHoverYear && onHoverYear(null));
    rect.addEventListener('click', () => onHoverYear && onHoverYear(yr, true));
    svg.appendChild(rect);
  });

  host.appendChild(svg);

  /* Inline key */
  const key = document.createElement('div');
  key.className = 'legend-inline';
  for (const s of indexed) {
    const span = document.createElement('span');
    const bar = document.createElement('i');
    bar.style.background = s.color;
    span.append(bar, document.createTextNode(s.label));
    key.appendChild(span);
  }
  host.appendChild(key);
}

/** Round tick values that do not look machine-generated. */
function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) || mag * 10;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t * 100) / 100);
  return out;
}
