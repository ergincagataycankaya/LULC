# Archived: R Shiny implementation (2025)

This is the original dashboard that accompanied the ArtGRID paper, kept for
provenance. It is **no longer deployed or maintained** — the live atlas is the
static application at the repository root.

## What it was

- `global.R` — area table, class palette, tiler URLs
- `ui.R` — `fluidPage` layout and inline CSS
- `server.R` — Leaflet map, Plotly pie chart and forest trend line
- `rsconnect/` — the shinyapps.io deployment record for <https://ergin.shinyapps.io/LULC/>

## Why it was replaced

- **It needed a server.** Every visitor occupied an R process, and each interaction
  was a websocket round-trip. The replacement is static files, so it can be served
  from a CDN edge and deployed to Vercel, which cannot host Shiny at all.
- **The tile colour map was wrong.** The raster is categorical — nine class values —
  but `colormap_block` in `global.R` applied a continuous blue-to-red temperature
  ramp binned in steps of 0.6. The classes were rendered as an arbitrary gradient
  rather than as land cover. The replacement builds a discrete colour map from the
  class values using the Esri land-cover palette.
- **The comparison feature never shipped.** `addSplitMap` is commented out in
  `server.R`; the "swipe" reduced to two checkbox layer groups stacked on one map.
- **Legibility.** The stylesheet forced `font-weight: 900 !important` onto every
  element on the page, including a wildcard `*` selector.

The published figures themselves were correct and carried over unchanged into
`assets/js/data.js`.

## Running it

```r
# from this directory
shiny::runApp(".")
```

Requires `shiny`, `leaflet`, `leaflet.extras`, `leaflet.extras2`,
`leaflet.minicharts` and `plotly`.
