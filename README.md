 # 🗺️ Land Use / Land Cover (LULC) Monitoring Dashboard
 
 This Shiny web application provides an interactive visualization of multi-year Land Use / Land Cover (LULC) changes in the Istanbul Regional Directorate of Forests from 2019 to 2023. It integrates spatial mapping with statistical graphics for better understanding of land cover dynamics.
 
 ---
 
 ## 🌐 Live Demo
 
 You can view the deployed application here:  
 🔗 [https://ergin.shinyapps.io/LULC/](https://ergin.shinyapps.io/LULC/)
 
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

The dashboard relies on the `leaflet.extras2` package to enable the before/after
map slider. If you encounter an error like `could not find function "addSplitMap"`,
install the package from GitHub:

```r
if (!requireNamespace("leaflet.extras2", quietly = TRUE)) {
  devtools::install_github("Timag/leaflet.extras2")
}
```

Alternatively you can install `shiny.slider` with

```r
devtools::install_github("Timag/shiny.slider")
```

Both packages provide the slider functionality used in this app.
 
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
