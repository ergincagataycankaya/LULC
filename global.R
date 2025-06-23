library(shiny)
library(leaflet)
library(plotly)
library(DT)
library(leaflet.extras)


years <- 2019:2023

# ──────────────────────────────────────────────────────────────────────────────
# 0) Your new RGBA → hex palette & lookup
# ──────────────────────────────────────────────────────────────────────────────
new_colors <- c(
  "Water"       = "#2A61B0",
  "Forest"      = "#217B55",
  "Wetland"     = "#6D5FAA",
  "Agriculture" = "#E78E0D",
  "Built-Area"  = "#EF0606",
  "Bare Ground" = "#D6D6D6",
  "Snow/Ice"    = "#9FE2E8",
  "Clouds"      = "#535353",
  "Rangeland"   = "#DDD25D",
  "Other"       = "#BBBBBB"
)
lut <- c(
  `1`  = "Water",
  `2`  = "Forest",
  `4`  = "Wetland",
  `5`  = "Agriculture",
  `7`  = "Built-Area",
  `8`  = "Bare Ground",
  `9`  = "Snow/Ice",
  `10` = "Clouds",
  `11` = "Rangeland"
)

area_df <- read.table(header=TRUE, text="
year value class_eng area_ha
2019 1 Water 23760.58
2019 2 Forest 599307.83
2019 4 Wetland 349.9
2019 5 Agriculture 1192377.29
2019 7 'Built Area' 194610.98
2019 8 'Bare Ground' 11020.41
2019 9 'Snow/Ice' 0.39
2019 10 Clouds 0.18
2019 11 Rangeland 177250.97
2020 1 Water 27481.89
2020 2 Forest 603173.17
2020 4 Wetland 363.9
2020 5 Agriculture 1192673.71
2020 7 'Built Area' 198705.6
2020 8 'Bare Ground' 12034.53
2020 9 'Snow/Ice' 0.52
2020 10 Clouds 42.45
2020 11 Rangeland 164202.76
2021 1 Water 26338.78
2021 2 Forest 603720.91
2021 4 Wetland 299.93
2021 5 Agriculture 1190589.87
2021 7 'Built Area' 203396.13
2021 8 'Bare Ground' 10590.51
2021 9 'Snow/Ice' 2.08
2021 10 Clouds 15.73
2021 11 Rangeland 163724.59
2022 1 Water 22300.29
2022 2 Forest 575284.16
2022 4 Wetland 213.93
2022 5 Agriculture 1197516.16
2022 7 'Built Area' 207717.34
2022 8 'Bare Ground' 10094.49
2022 9 'Snow/Ice' 1.13
2022 10 Clouds 11.49
2022 11 Rangeland 185539.54
2023 1 Water 25231.87
2023 2 Forest 584056.63
2023 4 Wetland 261.08
2023 5 Agriculture 1208330.27
2023 7 'Built Area' 208488.5
2023 8 'Bare Ground' 8269.59
2023 9 'Snow/Ice' 0.7
2023 10 Clouds 14.8
2023 11 Rangeland 164025.03
", stringsAsFactors = FALSE)
area_df$year <- as.character(area_df$year)

class_palette <- data.frame(
  class_eng = c(
    "Water", "Forest", "Wetland", "Agriculture", "Built Area",
    "Bare Ground", "Snow/Ice", "Clouds", "Rangeland"
  ),
  color = c(
    "#2596be",  # Water
    "#41ae42",  # Forest
    "#b6e0b6",  # Wetland
    "#ffe55c",  # Agriculture
    "#df4242",  # Built Area
    "#d6c99a",  # Bare Ground
    "#cccccc",  # Snow/Ice
    "#b2b6b6",  # Clouds
    "#efbc2f"   # Rangeland
  ),
  icon = c(
    "fa-water", "fa-tree", "fa-water", "fa-seedling",
    "fa-city", "fa-mountain", "fa-snowflake", "fa-cloud",
    "fa-tractor"
  )
)

# Raster tile URLs for each year
map_ids <- list(
  "2019" = "e89d93ac-5816-4771-be04-1434e3e02f00",
  "2020" = "2c1bcbac-4733-4c7b-ad79-40227fdf0dd2",
  "2021" = "44aa06c9-77e6-4605-a2d4-61c0abd46932",
  "2022" = "894992b8-57d6-4e3e-b3c3-fe13a573f956",
  "2023" = "d38e21eb-b8ab-4879-9ac1-e0369fc8b213"
)
colormap_block <- "%5B%5B%5B1%2C%202%5D%2C%20%5B42%2C%2097%2C%20176%2C%20255%5D%5D%2C%20%5B%5B2%2C%203%5D%2C%20%5B33%2C%20123%2C%2085%2C%20255%5D%5D%2C%20%5B%5B4%2C%205%5D%2C%20%5B109%2C%2095%2C%20170%2C%20255%5D%5D%2C%20%5B%5B5%2C%206%5D%2C%20%5B231%2C%20142%2C%2013%2C%20255%5D%5D%2C%20%5B%5B7%2C%208%5D%2C%20%5B239%2C%206%2C%206%2C%20255%5D%5D%2C%20%5B%5B8%2C%209%5D%2C%20%5B214%2C%20214%2C%20214%2C%20255%5D%5D%2C%20%5B%5B9%2C%2010%5D%2C%20%5B159%2C%20226%2C%20232%2C%20255%5D%5D%2C%20%5B%5B10%2C%2011%5D%2C%20%5B83%2C%2083%2C%2083%2C%20255%5D%5D%2C%20%5B%5B11%2C%2012%5D%2C%20%5B221%2C%20210%2C%2093%2C%20255%5D%5D%5D"

lulc_urls <- lapply(map_ids, function(id) {
  paste0(
    "https://api-main-432878571563.europe-west4.run.app/tiler/raster/",
    "{z}/{x}/{y}?map_id=", id,
    "&colormap=", colormap_block
  )
})
names(lulc_urls) <- names(map_ids)
