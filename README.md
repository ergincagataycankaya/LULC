 # 🗺️ Land Use / Land Cover (LULC) Monitoring Dashboard
 
 This Shiny web application provides an interactive visualization of multi-year Land Use / Land Cover (LULC) changes in the Istanbul Regional Directorate of Forests from 2019 to 2023. It integrates spatial mapping with statistical graphics for better understanding of land cover dynamics.
 
 ---
 
 ## 🌐 Live Demo!
 
[![ShinyApps.io](https://img.shields.io/badge/ShinyApp-LULC-blue?logo=R&logoColor=white)](https://ergin.shinyapps.io/LULC/)

 ---
 
 ## 📊 Features
 
 - 📍 **Interactive LULC Maps** (2019–2023) using Leaflet
 - 🧾 **Area Statistics Tables** with color-coded icons for each LULC class
 - 📈 **Pie Charts** visualizing class composition by year
 - 🌲 **Trend Line** showing forest area changes over time
 - 🖼️ Clean and modern UI with responsive layout and custom CSS
- 🔁 Supports synchronized map views (when used with `leaflet.extras2::syncWith()`)
- 🛰️ Satellite imagery base maps with LULC overlay
- ↩️ Reset zoom button on each map

## Dependencies

The swipe comparison uses the JavaScript **Leaflet.SideBySide** plugin loaded
from a CDN. No additional R packages are required, though `leaflet.extras2` or
`shiny.slider` can still be installed if you prefer their helper functions.
 
 ---
 
 ## 🗂️ Folder Structure
 
 ```bash
 LULC_Shiny_Dashboard/
 │
 ├── ui.R              # User interface layout
 ├── server.R          # Server-side logic
 ├── global.R          # Shared data, helper functions, and variables
 │
 ├── www/              # Static files
 │   └── custom.css    # Custom CSS styling
 │
 ├── data/
 │   └── area_data.csv # Land cover area dataset (2019–2023)
 │
 └── README.md         # Project documentation (this file)
```

---

This repository contains the full Shiny source code along with example data.
To launch the app locally run:

```r
shiny::runApp()
```

The app uses a JavaScript swipe control so no extra R packages are needed.


