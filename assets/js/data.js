/*
 * Istanbul RDF — LULC Atlas
 * Reference dataset
 *
 * Source: Cankaya, E. C., Gencal, B., & Sonmez, T. (2025).
 * "Advancing Forest Land Monitoring in Istanbul Regional Directorate of Forestry:
 *  Integrating U-Net Deep Learning."
 * Journal of Architecture, Engineering & Fine Arts (ArtGRID) 7(1): 26-44.
 *
 * Classified from Sentinel-2 L2A composites (June-September, cloud cover < 5%)
 * with a U-Net semantic segmentation model trained on 15,056 annotated
 * 256x256 tiles across 8 land-cover classes.
 */

/* ------------------------------------------------------------------ *
 * Study area                                                          *
 * ------------------------------------------------------------------ */

export const STUDY_AREA = {
  name: 'Istanbul Regional Directorate of Forestry',
  short: 'Istanbul RDF',
  // 26 19'48"E - 29 57'31"E, 40 48'38"N - 42 06'21"N
  bounds: [[26.33, 40.8106], [29.9586, 42.1058]],
  center: [28.55, 41.35],
  provinces: ['İstanbul', 'Adapazarı', 'İzmit', 'Edirne', 'Kırklareli', 'Tekirdağ'],
  directorates: [
    'Bahçeköy', 'Çatalca', 'Demirköy', 'Edirne', 'İstanbul',
    'Kanlıca', 'Kırklareli', 'Şile', 'Tekirdağ', 'Vize'
  ]
};

export const YEARS = [2019, 2020, 2021, 2022, 2023];

/* ------------------------------------------------------------------ *
 * Land-cover classes                                                  *
 *                                                                     *
 * `value` is the raster pixel value emitted by the U-Net model.       *
 * `rgb` follows the Esri / Sentinel-2 land-cover convention so the    *
 * maps read the same way as every other published LULC product.       *
 * ------------------------------------------------------------------ */

export const CLASSES = [
  { value: 1,  key: 'water',       label: 'Water',        rgb: [26, 91, 171],    hex: '#1A5BAB', blurb: 'Rivers, reservoirs, the Bosphorus and coastal waters.' },
  { value: 2,  key: 'forest',      label: 'Forest',       rgb: [53, 130, 33],    hex: '#358221', blurb: 'Closed and open canopy woodland under RDF management.' },
  { value: 4,  key: 'wetland',     label: 'Wetland',      rgb: [135, 209, 158],  hex: '#87D19E', blurb: 'Flooded vegetation, lagoons and seasonal marsh.' },
  { value: 5,  key: 'agriculture', label: 'Agriculture',  rgb: [255, 219, 92],   hex: '#FFDB5C', blurb: 'Cropland, orchards and actively cultivated parcels.' },
  { value: 7,  key: 'built',       label: 'Built Area',   rgb: [237, 2, 42],     hex: '#ED022A', blurb: 'Settlement, industry and transport infrastructure.' },
  { value: 8,  key: 'bare',        label: 'Bare Ground',  rgb: [237, 233, 228],  hex: '#EDE9E4', blurb: 'Exposed soil, quarries and unvegetated surfaces.' },
  { value: 9,  key: 'snow',        label: 'Snow / Ice',   rgb: [242, 250, 255],  hex: '#F2FAFF', blurb: 'Persistent snow at acquisition time. Marginal in this region.' },
  { value: 10, key: 'clouds',      label: 'Clouds',       rgb: [200, 200, 200],  hex: '#C8C8C8', blurb: 'Residual cloud and shadow that survived the composite filter.' },
  { value: 11, key: 'rangeland',   label: 'Rangeland',    rgb: [198, 173, 141],  hex: '#C6AD8D', blurb: 'Grassland and pasture. The hardest class to separate (see Accuracy).' }
];

export const CLASS_BY_KEY = Object.fromEntries(CLASSES.map(c => [c.key, c]));

/* ------------------------------------------------------------------ *
 * Area statistics, hectares                                           *
 * ------------------------------------------------------------------ */

export const AREA_HA = {
  2019: { water: 23760.58, forest: 599307.83, wetland: 349.90, agriculture: 1192377.29, built: 194610.98, bare: 11020.41, snow: 0.39, clouds: 0.18,  rangeland: 177250.97 },
  2020: { water: 27481.89, forest: 603173.17, wetland: 363.90, agriculture: 1192673.71, built: 198705.60, bare: 12034.53, snow: 0.52, clouds: 42.45, rangeland: 164202.76 },
  2021: { water: 26338.78, forest: 603720.91, wetland: 299.93, agriculture: 1190589.87, built: 203396.13, bare: 10590.51, snow: 2.08, clouds: 15.73, rangeland: 163724.59 },
  2022: { water: 22300.29, forest: 575284.16, wetland: 213.93, agriculture: 1197516.16, built: 207717.34, bare: 10094.49, snow: 1.13, clouds: 11.49, rangeland: 185539.54 },
  2023: { water: 25231.87, forest: 584056.63, wetland: 261.08, agriculture: 1208330.27, built: 208488.50, bare: 8269.59,  snow: 0.70, clouds: 14.80, rangeland: 164025.03 }
};

/* ------------------------------------------------------------------ *
 * Classification accuracy — Table 1 of the paper                      *
 * [precision, recall, F1 %]                                           *
 * ------------------------------------------------------------------ */

export const ACCURACY = {
  2019: { overall: 91.54, byClass: { water: [0.83, 0.98, 89.9], forest: [0.93, 0.94, 93.5], wetland: [0.62, 0.68, 64.9], agriculture: [0.91, 0.90, 90.5], built: [0.96, 0.79, 86.7], bare: [0.84, 0.87, 85.5], snow: [0.96, 0.97, 96.5], clouds: [0.98, 0.96, 97.0], rangeland: [0.74, 0.55, 63.1] } },
  2020: { overall: 92.21, byClass: { water: [0.85, 0.91, 87.9], forest: [0.91, 0.95, 93.0], wetland: [0.58, 0.62, 59.9], agriculture: [0.88, 0.91, 89.5], built: [0.97, 0.80, 87.7], bare: [0.78, 0.88, 82.7], snow: [0.99, 0.97, 98.0], clouds: [0.97, 0.95, 96.0], rangeland: [0.89, 0.56, 68.7] } },
  2021: { overall: 89.47, byClass: { water: [0.86, 0.92, 88.9], forest: [0.92, 0.89, 90.5], wetland: [0.48, 0.66, 55.6], agriculture: [0.90, 0.88, 89.0], built: [0.89, 0.79, 83.7], bare: [0.59, 0.77, 66.8], snow: [0.98, 0.98, 98.0], clouds: [0.96, 0.95, 95.5], rangeland: [0.89, 0.59, 71.0] } },
  2022: { overall: 92.89, byClass: { water: [0.84, 0.96, 89.6], forest: [0.93, 0.91, 92.0], wetland: [0.68, 0.72, 69.9], agriculture: [0.92, 0.90, 91.0], built: [0.94, 0.89, 91.4], bare: [0.68, 0.81, 73.9], snow: [0.97, 0.96, 96.5], clouds: [0.96, 0.97, 96.5], rangeland: [0.82, 0.51, 62.9] } },
  2023: { overall: 90.36, byClass: { water: [0.91, 0.94, 92.5], forest: [0.88, 0.92, 90.0], wetland: [0.58, 0.67, 62.2], agriculture: [0.89, 0.92, 90.5], built: [0.95, 0.81, 87.4], bare: [0.66, 0.83, 73.5], snow: [0.96, 0.94, 95.0], clouds: [0.92, 0.94, 93.0], rangeland: [0.78, 0.48, 59.4] } }
};

/* ------------------------------------------------------------------ *
 * Raster tile service                                                 *
 * ------------------------------------------------------------------ */

const TILER = 'https://api-main-432878571563.europe-west4.run.app/tiler/raster/{z}/{x}/{y}';

/* Consumed only by tileURL below; nothing outside this module needs the ids. */
const MAP_IDS = {
  2019: 'e89d93ac-5816-4771-be04-1434e3e02f00',
  2020: '2c1bcbac-4733-4c7b-ad79-40227fdf0dd2',
  2021: '44aa06c9-77e6-4605-a2d4-61c0abd46932',
  2022: '894992b8-57d6-4e3e-b3c3-fe13a573f956',
  2023: 'd38e21eb-b8ab-4879-9ac1-e0369fc8b213'
};

/**
 * Build the tiler colormap for a set of visible class keys.
 * Classes left out are simply not painted, which turns the legend into a
 * live server-side filter instead of a static key.
 */
export function tileURL(year, visibleKeys) {
  const stops = CLASSES
    .filter(c => visibleKeys.has(c.key))
    .map(c => [[c.value - 0.5, c.value + 0.5], [...c.rgb, 255]]);
  const colormap = encodeURIComponent(JSON.stringify(stops));
  return `${TILER}?map_id=${MAP_IDS[year]}&colormap=${colormap}`;
}

/* ------------------------------------------------------------------ *
 * Basemaps                                                            *
 * ------------------------------------------------------------------ */

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const LABELS_DARK = [`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`];
const LABELS_LIGHT = [`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`];

export const BASEMAPS = {
  satellite: {
    label: 'Satellite',
    tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
    labels: LABELS_DARK,
    attribution: 'Esri, Maxar, Earthstar Geographics'
  },
  /* Every basemap comes from Esri's keyless tile service. CARTO started
     serving an "API KEY REQUIRED" watermark with HTTP 200, which no
     runtime error handler can catch; scripts/check-basemaps.mjs guards
     against a repeat. Add a provider only if it works without a key. */
  dark: {
    label: 'Dark',
    tiles: [`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
    maxzoom: 16,
    labels: LABELS_DARK,
    attribution: 'Esri, HERE, Garmin, OpenStreetMap contributors'
  },
  light: {
    label: 'Light',
    tiles: [`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
    maxzoom: 16,
    labels: LABELS_LIGHT,
    attribution: 'Esri, HERE, Garmin, OpenStreetMap contributors'
  }
};

/* The classified rasters are derived from 10 m Sentinel-2, so z14 is the
   last zoom that carries real information. Anything deeper is overzoomed
   with nearest-neighbour resampling, which keeps class edges honest
   instead of inventing intermediate colours. */
export const LULC_MAXZOOM = 14;

/* ------------------------------------------------------------------ *
 * Derived helpers                                                     *
 * ------------------------------------------------------------------ */

export const CITATION = {
  authors: 'Çankaya, E. Ç., Gencal, B., & Sönmez, T.',
  year: 2025,
  title: 'Advancing forest land monitoring in Istanbul Regional Directorate of Forestry: integrating U-Net deep learning',
  journal: 'Journal of Architecture, Engineering & Fine Arts (ArtGRID)',
  volume: '7(1)',
  pages: '26-44',
  doi: '10.57165/artgrid.1709260',
  url: 'https://doi.org/10.57165/artgrid.1709260',
  pdf: 'docs/cankaya-2025-istanbul-rdf-lulc.pdf'
};

/** Total mapped area for a year, hectares. */
export function totalHa(year) {
  return Object.values(AREA_HA[year]).reduce((a, b) => a + b, 0);
}

/** Signed change in hectares for a class between two years. */
export function delta(classKey, fromYear, toYear) {
  return AREA_HA[toYear][classKey] - AREA_HA[fromYear][classKey];
}

/** Series of area values for one class across all years. */
export function series(classKey) {
  return YEARS.map(y => AREA_HA[y][classKey]);
}

/* Headline numbers used in the summary strip, straight from the abstract. */
export const HEADLINES = [
  { key: 'forest',      label: 'Forest',      dir: 'loss' },
  { key: 'rangeland',   label: 'Rangeland',   dir: 'loss' },
  { key: 'agriculture', label: 'Agriculture', dir: 'gain' },
  { key: 'built',       label: 'Built Area',  dir: 'gain' }
];
