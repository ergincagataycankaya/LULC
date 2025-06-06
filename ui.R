# ---- UI ----
ui <- fluidPage(
  tags$head(
    tags$link(rel="stylesheet", href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"),
    tags$meta(name = "viewport", content = "width=device-width, initial-scale=1"),
    tags$style(HTML("      body, html { background: #f7f9fa; margin: 0; padding: 0; font-family: 'Roboto', Arial, sans-serif; font-weight: bold !important; }
      .app-header {
        background: linear-gradient(90deg, #007bff 0, #41ae42 100%);
        color: #fff; padding: 22px 0 10px 0;
        text-align: center; font-size: 2.7rem; font-weight: 900 !important; letter-spacing: 1px;
        margin-bottom: 0; box-shadow: 0 4px 16px rgba(0,0,0,0.11);
      }
      .app-subtitle {
        background: #e6f1ee;
        text-align: center; color: #15633c; font-size: 1.25rem;
        font-weight: 900 !important;
        padding: 10px 0 10px 0;
        margin-bottom: 16px;
        border-bottom: 1.5px solid #b4dcc5;
        letter-spacing: 0.4px;
        box-shadow: 0 2px 8px rgba(0,80,20,0.04);
      }
      .lulc-legend-sticky {
        background: #f4f5fa;
        border-radius: 10px;
        box-shadow: 0 2px 12px rgba(180,180,180,0.07);
        margin: 0 auto 12px auto;
        padding: 3px 0 0 0;
        max-width: 1100px;
        display: flex; flex-direction: row; flex-wrap: wrap; justify-content: center;
        gap: 6px;
        font-weight: 900 !important;
      }
      .lulc-legend-item {
        display: flex; align-items: center;
        font-size: 0.95rem;
        font-weight: 900 !important;
        min-width: 80px; margin-bottom: 0px; margin-right: 0;
      }
      .lulc-legend-dot {
        width: 13px; height: 13px; border-radius: 50%; display: inline-block;
        margin-right: 5px; border: 1.1px solid #bbb; opacity: 0.7;
      }
      .lulc-legend-icon { margin-right: 4px; opacity: 0.92; font-size: 1em; }
      .map-sync-container { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 10px; }
      details.map-card { width: 100%; max-width: 1100px; }
      summary.map-card-title { background: linear-gradient(90deg,#0092ff88,#41ae4288); color: #fff; padding: 8px 18px 6px 15px; font-size: 1.25rem; letter-spacing: 0.5px; border: 1.5px solid #e5f4ee; border-radius: 12px; cursor: pointer; list-style: none; }
      summary.map-card-title::-webkit-details-marker { display:none; }
      .map-card-content { background: #fff; border-radius: 0 0 12px 12px; box-shadow: 0 3px 15px rgba(0,0,0,0.09); overflow: hidden; }
      .map-card-content .leaflet-container { min-height: 320px; }
      .map-below-wrapper { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; padding: 10px; }
      .area-table-container { background: #f9fbe8; font-size: 1.18rem; border-top: 1.7px solid #e4e4e4; width: 100%; z-index: 6; min-height: 100px; border-radius: 0 0 12px 12px; font-weight: 900 !important; padding-bottom: 2px; }
      .area-table { width: 100%; border-collapse: collapse; background: none; font-size: 1.11rem; font-weight: 900 !important; }
      .area-table th, .area-table td { padding: 7px 10px; text-align: left; font-size: 1.11rem; font-weight: 900 !important; }
      .area-table th { background: #e9ecef; border-bottom: 2px solid #dadada; font-size: 1.2rem; }
      .area-table td { border-bottom: 1.2px solid #f1f2f6; }
      .area-table tr:last-child td { border-bottom: none; }
      .area-class-icon { font-size: 1.23em; margin-right: 7px; font-weight: 900 !important; }
      .area-table td span { font-size: 1.21em !important; font-weight: 900 !important; }
      .lulc-legend-icon { font-size: 1.2em !important; }
      *, .app-header, .app-subtitle, .map-card-title, .lulc-legend-item, .area-table, .area-table th, .area-table td, .area-class-icon, .lulc-legend-sticky { font-weight: 900 !important; }
    "))
  ),
  tags$div(class = "app-header", "Land Use / Land Cover Dashboard"),
  tags$div(class = "app-subtitle", "2019–2023 Multi-Year Monitoring • Istanbul Regional Directorate of Forest Case Study"),
  div(
    class = "lulc-legend-sticky",
    lapply(seq_len(nrow(class_palette)), function(i) {
      tags$span(class = "lulc-legend-item",
                tags$span(class = "lulc-legend-dot", style = paste0("background:", class_palette$color[i])),
                tags$i(class = paste("fa", class_palette$icon[i], "lulc-legend-icon")),
                class_palette$class_eng[i]
      )
    })
  ),
  div(
    class = "map-sync-container",
    lapply(names(lulc_urls), function(yr) {
      tags$details(class = "map-card", open = ifelse(yr == "2023", TRUE, FALSE),
        tags$summary(class = "map-card-title", paste0("LULC ", yr)),
        div(class = "map-card-content",
          leafletOutput(outputId = paste0("map", yr), height = "320px"),
          div(class = "map-below-wrapper",
            plotlyOutput(paste0("pie_", yr), height = "250px", width = "250px"),
            uiOutput(paste0("area_tbl_", yr), class = "area-table-container")
          )
        )
      )
    })
  ),
  div(
    style = "max-width:1000px; margin:30px auto 35px auto; background: #fff; border-radius: 16px; box-shadow: 0 3px 15px rgba(0,0,0,0.09); padding: 18px;",
    h3("Forest Area Change (2019–2023)", style="text-align:center; margin-bottom:12px; color:#1a6530; font-weight:900;"),
    plotlyOutput("forest_trend", height = "260px")
  )
)
