library(shiny)
library(leaflet)
library(leaflet.minicharts)
library(plotly)

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


# LULC class color palette & icons (add/edit if needed)
class_palette <- data.frame(
  class_eng = c("Water", "Forest", "Wetland", "Agriculture", "Built Area", "Bare Ground", "Snow/Ice", "Clouds", "Rangeland"),
  color = c("#2596be", "#41ae42", "#b6e0b6", "#ffe55c", "#df4242", "#d6c99a", "#cccccc", "#b2b6b6", "#efbc2f"),
  icon = c("fa-water", "fa-tree", "fa-water", "fa-seedling", "fa-city", "fa-mountain", "fa-snowflake", "fa-cloud", "fa-tractor")
)

# ─────────────────────────────────────────────────────────────────────────────
# 1) DEFINE A SINGLE COLORMAP STRING (URL‐ENCODED)
#    – This is the same colormap block for all five years.
#    – Do NOT insert any line breaks inside this quoted string.
colormap_block <- "%5B%5B%5B1%2C%201.6%5D%2C%20%5B0%2C%200%2C%20131%2C%20255%5D%5D%2C%20%5B%5B1.6%2C%202.2%5D%2C%20%5B0%2C%2030%2C%20151%2C%20255%5D%5D%2C%20%5B%5B2.2%2C%202.8%5D%2C%20%5B0%2C%2060%2C%20170%2C%20255%5D%5D%2C%20%5B%5B2.8%2C%203.4%5D%2C%20%5B1%2C%2099%2C%20187%2C%20255%5D%5D%2C%20%5B%5B3.4%2C%204%5D%2C%20%5B2%2C%20138%2C%20204%2C%20255%5D%5D%2C%20%5B%5B4%2C%204.6%5D%2C%20%5B3%2C%20177%2C%20221%2C%20255%5D%5D%2C%20%5B%5B4.6%2C%205.2%5D%2C%20%5B4%2C%20216%2C%20238%2C%20255%5D%5D%2C%20%5B%5B5.2%2C%205.8%5D%2C%20%5B5%2C%20255%2C%20255%2C%20255%5D%5D%2C%20%5B%5B5.8%2C%206.4%5D%2C%20%5B55%2C%20255%2C%20204%2C%20255%5D%5D%2C%20%5B%5B6.4%2C%207%5D%2C%20%5B105%2C%20255%2C%20153%2C%20255%5D%5D%2C%20%5B%5B7%2C%207.6%5D%2C%20%5B155%2C%20255%2C%20102%2C%20255%5D%5D%2C%20%5B%5B7.6%2C%208.2%5D%2C%20%5B205%2C%20255%2C%2051%2C%20255%5D%5D%2C%20%5B%5B8.2%2C%208.8%5D%2C%20%5B255%2C%20255%2C%200%2C%20255%5D%5D%2C%20%5B%5B8.8%2C%209.4%5D%2C%20%5B254%2C%20204%2C%200%2C%20255%5D%5D%2C%20%5B%5B9.4%2C%2010%5D%2C%20%5B253%2C%20153%2C%200%2C%20255%5D%5D%2C%20%5B%5B10%2C%2010.6%5D%2C%20%5B252%2C%20102%2C%200%2C%20255%5D%5D%2C%20%5B%5B10.6%2C%2011.2%5D%2C%20%5B251%2C%2051%2C%200%2C%20255%5D%5D%2C%20%5B%5B11.2%2C%2011.8%5D%2C%20%5B250%2C%200%2C%200%2C%20255%5D%5D%2C%20%5B%5B11.8%2C%2012.4%5D%2C%20%5B189%2C%200%2C%200%2C%20255%5D%5D%2C%20%5B%5B12.4%2C%2013%5D%2C%20%5B128%2C%200%2C%200%2C%20255%5D%5D%5D"

# ─────────────────────────────────────────────────────────────────────────────
# 2) SPECIFY A NAMED LIST OF YEARS → THEIR MAP_IDs
#    (so we can loop rather than hard-code five separate variables)
years   <- 2019:2023
map_ids <- list(
  "2019" = "e89d93ac-5816-4771-be04-1434e3e02f00",
  "2020" = "2c1bcbac-4733-4c7b-ad79-40227fdf0dd2",
  "2021" = "44aa06c9-77e6-4605-a2d4-61c0abd46932",
  "2022" = "894992b8-57d6-4e3e-b3c3-fe13a573f956",
  "2023" = "d38e21eb-b8ab-4879-9ac1-e0369fc8b213"
)

# Build full URLs programmatically, all sharing the same colormap_block
lulc_urls <- lapply(map_ids, function(id) {
  paste0(
    "https://api-main-432878571563.europe-west4.run.app/tiler/raster/",
    "{z}/{x}/{y}?map_id=", id,
    "&colormap=", colormap_block
  )
})
# lulc_urls is now a named list: lulc_urls[["2019"]], lulc_urls[["2020"]], etc.