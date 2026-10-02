"""
Per-directorate land cover areas for the Istanbul RDF.

Reads the Istanbul region's işletme müdürlüğü boundaries from the AMENAJMAN
geodatabase, burns them into the 10 m classified rasters' grid and counts
pixels per class. One pixel is 10 m x 10 m = 0.01 ha, so counts are exact.

Writes:
  assets/data/directorates.json     hectares per directorate / year / class
  assets/data/directorates.geojson  simplified boundaries for the map

Usage:
  python scripts/zonal-stats.py [--gdb PATH] [--rasters DIR]

Needs: geopandas, pyogrio, rasterio, numpy.  Run locally; the site itself has
no build step and does not run this.
"""
import argparse, json, sys
from pathlib import Path

import numpy as np
import geopandas as gpd
import rasterio
from rasterio import features

ROOT = Path(__file__).resolve().parent.parent
REGION_ID = '{A9B65307-AC87-49AA-A006-F3983CADE8A3}'  # Istanbul RDF
YEARS = [2019, 2020, 2021, 2022, 2023]
CLASS_KEYS = {1: 'water', 2: 'forest', 4: 'wetland', 5: 'agriculture', 7: 'built',
              8: 'bare', 9: 'snow', 10: 'clouds', 11: 'rangeland'}
# Published RDF totals (data.js) used to sanity-check the zonal sums.
PUBLISHED_FOREST = {2019: 599307.83, 2020: 603173.17, 2021: 603720.91, 2022: 575284.16, 2023: 584056.63}

ap = argparse.ArgumentParser()
ap.add_argument('--gdb', default=r'C:\Users\ergin\OneDrive\Desktop\TC_Data\AMENAJMAN_08082022.gdb')
ap.add_argument('--rasters', default=r'D:\PhD\Journals\PUBLISHED\artgrid_LULC\deeplearning_LULC\Ergin_Makale\Results_DATA')
args = ap.parse_args()

md = gpd.read_file(args.gdb, layer='APP_MUDURLUK')
md = md[md['BOLGE_ID'] == REGION_ID]
md = md.dissolve(by='ISLETME_MD_ADI', as_index=False)  # a few directorates are multipart
names = sorted(md['ISLETME_MD_ADI'])
print(len(names), 'directorates:', ', '.join(names))

proj = None
out = {'unit': 'ha', 'years': YEARS, 'directorates': {n: {} for n in names}}
outside = {}
for y in YEARS:
    with rasterio.open(Path(args.rasters) / f'{y}_lulc.tif') as src:
        if proj is None:
            proj = md.to_crs(src.crs)
        data = src.read(1)
        # Each year is burned on its own grid: the 2023 raster is offset by a
        # sub-pixel shift and is 3 px smaller than the others.
        labels = np.zeros(src.shape, dtype=np.uint8)
        for i, geom in enumerate(proj.geometry, start=1):
            features.rasterize([(geom, i)], out=labels, transform=src.transform, all_touched=False)
    key = labels.astype(np.uint16) * 256 + data
    counts = np.bincount(key.ravel(), minlength=(len(names) + 1) * 256)
    for i, n in enumerate(names, start=1):
        out['directorates'][n][str(y)] = {
            k: round(float(counts[i * 256 + v]) * 0.01, 2) for v, k in CLASS_KEYS.items()}
        unknown = int(sum(counts[i * 256 + v] for v in range(256) if v not in CLASS_KEYS and v != 0))
        if unknown:
            print(f'  warn {y} {n}: {unknown} px with unlisted class values')
    inside = sum(sum(out['directorates'][n][str(y)].values()) for n in names)
    total = float((data > 0).sum()) * 0.01
    forest = sum(out['directorates'][n][str(y)]['forest'] for n in names)
    outside[y] = round(total - inside, 2)
    print(f'{y}: inside {inside:,.0f} of {total:,.0f} ha raster ({inside / total * 100:.2f}%); '
          f'forest {forest:,.0f} vs published {PUBLISHED_FOREST[y]:,.0f}')
out['outsideBoundariesHa'] = outside

dest = ROOT / 'assets' / 'data'
dest.mkdir(parents=True, exist_ok=True)
(dest / 'directorates.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

geo = md[['ISLETME_MD_ADI', 'geometry']].rename(columns={'ISLETME_MD_ADI': 'name'})
geo['geometry'] = geo.geometry.simplify(0.0005, preserve_topology=True)
geo.to_file(dest / 'directorates.geojson', driver='GeoJSON', COORDINATE_PRECISION=5)
print('wrote', dest)
