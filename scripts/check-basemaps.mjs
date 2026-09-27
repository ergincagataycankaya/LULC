// Fails if any basemap URL needs an API key or stops serving images.
// Run: node scripts/check-basemaps.mjs  (also runs weekly in CI)
import { BASEMAPS } from '../assets/js/data.js';

const KEYED = /cartocdn|carto\.com|stadiamaps|maptiler|mapbox|thunderforest|apikey|access_token|api_key/i;
const TILE = { z: 8, x: 145, y: 95 }; // over Istanbul
let failed = 0;

for (const [id, bm] of Object.entries(BASEMAPS)) {
  for (const tpl of [...bm.tiles, ...bm.labels]) {
    const url = tpl.replace('{z}', TILE.z).replace('{x}', TILE.x).replace('{y}', TILE.y);
    let msg = '';
    if (KEYED.test(tpl)) msg = 'provider requires an API key';
    else {
      try {
        const r = await fetch(url);
        const type = r.headers.get('content-type') || '';
        if (!r.ok) msg = `HTTP ${r.status}`;
        else if (!type.startsWith('image/')) msg = `content-type ${type}`;
      } catch (e) { msg = e.message; }
    }
    console.log(`${msg ? 'FAIL' : 'ok  '} ${id}: ${url}${msg ? ' — ' + msg : ''}`);
    if (msg) failed++;
  }
}
process.exit(failed ? 1 : 0);
