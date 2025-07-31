# ui.R

library(shiny)
library(leaflet)
library(plotly)
library(fontawesome)

ui <- fluidPage(
  tags$head(
    tags$link(rel = "stylesheet", href = "custom-style.css"),
    tags$link(
      rel = "stylesheet",
      href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    ),
    tags$script(src = "https://cdn.jsdelivr.net/gh/jieter/Leaflet.Sync/L.Map.Sync.js")
  ),

  # Sync JS handler
  tags$script(HTML("
    Shiny.addCustomMessageHandler('sync_maps', function(x){
      setTimeout(function(){
        var L = HTMLWidgets.find('#map_left').getMap();
        var R = HTMLWidgets.find('#map_right').getMap();
        if(L && R){ L.sync(R); R.sync(L); }
      },200);
    });
  ")),

  div(class = "app-header",   "Land Use / Land Cover Dashboard"),
  div(class = "app-subtitle","2019–2023 Multi-Year Monitoring • Istanbul Regional Directorate of Forestry"),

  # custom legend
  uiOutput("map_legend"),

  # two side-by-side map panels
  fluidRow(
    column(
      width = 6, class = "panel-box map-panel",
      checkboxGroupInput(
        inputId  = "left_year",
        label    = "Left Map Year",
        choices  = years,
        selected = 2019,
        inline   = TRUE
      ),
      leafletOutput("map_left", width = "100%", height = 350),
      actionButton("reset_left", "Reset Zoom", icon = icon("search-location")),
      div(class = "flexrow",
        div(class = "pie-panel",   plotlyOutput("pie_left",  height = 220)),
        div(class = "table-panel", uiOutput("table_left"))
      )
    ),

    column(
      width = 6, class = "panel-box map-panel",
      checkboxGroupInput(
        inputId  = "right_year",
        label    = "Right Map Year",
        choices  = years,
        selected = 2023,
        inline   = TRUE
      ),
      leafletOutput("map_right", width = "100%", height = 350),
      actionButton("reset_right", "Reset Zoom", icon = icon("search-location")),
      div(class = "flexrow",
        div(class = "pie-panel",   plotlyOutput("pie_right", height = 220)),
        div(class = "table-panel", uiOutput("table_right"))
      )
    )
  ),

  # bottom comparison bar chart
  div(
    class = "panel-box",
    style = "max-width:1000px;margin:0 auto;",
    h4("Land Use / Land Cover Area Comparison (All Classes)"),
    plotlyOutput("bar_compare", height = 350)
  )
)
