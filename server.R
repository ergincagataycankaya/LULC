# server.R

source("global.R")

server <- function(input, output, session) {
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 1) CUSTOM LEGEND ABOVE THE TWO MAPS
  # ──────────────────────────────────────────────────────────────────────────────
  output$map_legend <- renderUI({
    tags$div(class="map-legend",
             lapply(names(new_colors)[1:9], function(cl) {
               tags$span(
                 tags$span(class="dot", style=sprintf("background:%s;", new_colors[cl])),
                 cl
               )
             })
    )
  })
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 2) REACTIVE TILE URLS
  # ──────────────────────────────────────────────────────────────────────────────
  left_tile  <- reactive({
    req(input$left_year)
    lulc_urls[[ as.character(input$left_year[1]) ]]
  })
  right_tile <- reactive({
    req(input$right_year)
    lulc_urls[[ as.character(input$right_year[1]) ]]
  })
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 3) INITIAL BASEMAPS (no LULC layer yet)
  # ──────────────────────────────────────────────────────────────────────────────
  output$map_left <- renderLeaflet({
    leaflet() %>%
      addProviderTiles("Esri.WorldImagery") %>%
      setView(lng = 29.0, lat = 41.1, zoom = 12)
  })
  output$map_right <- renderLeaflet({
    leaflet() %>%
      addProviderTiles("Esri.WorldImagery") %>%
      setView(lng = 29.0, lat = 41.1, zoom = 12)
  })
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 4) DYNAMIC LULC LAYERS VIA PROXY (fixed clearGroup)
  # ──────────────────────────────────────────────────────────────────────────────
  observe({
    leafletProxy("map_left") %>%
      clearGroup("LULC") %>%
      addTiles(urlTemplate = left_tile(), group = "LULC")
  })
  observe({
    leafletProxy("map_right") %>%
      clearGroup("LULC") %>%
      addTiles(urlTemplate = right_tile(), group = "LULC")
  })
  
  # keep the two maps in sync
  observe({
    session$sendCustomMessage("sync_maps", list())
  })
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 5) RESET ZOOM BUTTONS
  # ──────────────────────────────────────────────────────────────────────────────
  observeEvent(input$reset_left, {
    leafletProxy("map_left") %>% setView(lng = 29.0, lat = 41.1, zoom = 12)
  })
  observeEvent(input$reset_right, {
    leafletProxy("map_right") %>% setView(lng = 29.0, lat = 41.1, zoom = 12)
  })
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 6) TABLES (Professional Look)
  # ──────────────────────────────────────────────────────────────────────────────
  output$table_left <- renderUI({
    req(input$left_year)
    dat <- subset(area_df, year == input$left_year[1])
    dat <- merge(dat, class_palette, by="class_eng", all.x=TRUE)
    dat <- dat[order(match(dat$class_eng, class_palette$class_eng)), ]
    tags$table(class="area-table",
               tags$thead(
                 tags$tr(tags$th("Class"), tags$th("Area (ha)"))
               ),
               tags$tbody(
                 lapply(seq_len(nrow(dat)), function(i) {
                   tags$tr(
                     tags$td(
                       tags$span(class="area-class-icon",
                                 style=paste0("color:", dat$color[i]),
                                 tags$i(class=paste("fa", dat$icon[i]))
                       ),
                       tags$span(dat$class_eng[i])
                     ),
                     tags$td(
                       tags$span(style=paste0("color:", dat$color[i]),
                                 formatC(dat$area_ha[i], big.mark=",", digits=0, format="f")
                       )
                     )
                   )
                 })
               )
    )
  })
  output$table_right <- renderUI({
    req(input$right_year)
    dat <- subset(area_df, year == input$right_year[1])
    dat <- merge(dat, class_palette, by="class_eng", all.x=TRUE)
    dat <- dat[order(match(dat$class_eng, class_palette$class_eng)), ]
    tags$table(class="area-table",
               tags$thead(
                 tags$tr(tags$th("Class"), tags$th("Area (ha)"))
               ),
               tags$tbody(
                 lapply(seq_len(nrow(dat)), function(i) {
                   tags$tr(
                     tags$td(
                       tags$span(class="area-class-icon",
                                 style=paste0("color:", dat$color[i]),
                                 tags$i(class=paste("fa", dat$icon[i]))
                       ),
                       tags$span(dat$class_eng[i])
                     ),
                     tags$td(
                       tags$span(style=paste0("color:", dat$color[i]),
                                 formatC(dat$area_ha[i], big.mark=",", digits=0, format="f")
                       )
                     )
                   )
                 })
               )
    )
  })
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 7) PIE CHARTS (<1% → “Other”)
  # ──────────────────────────────────────────────────────────────────────────────
  make_pie <- function(sel_year) {
    dat <- subset(area_df, year == sel_year)
    dat$perc  <- dat$area_ha / sum(dat$area_ha) * 100
    dat$label <- ifelse(dat$perc < 1, "Other", dat$class_eng)
    df <- aggregate(area_ha ~ label, dat, sum)
    df$color <- class_palette$color[match(df$label, class_palette$class_eng)]
    
    plot_ly(
      df,
      labels   = ~label,
      values   = ~area_ha,
      type     = 'pie',
      marker   = list(colors = df$color),
      textinfo = 'label+percent'
    ) %>% layout(showlegend = FALSE)
  }
  output$pie_left  <- renderPlotly({ req(input$left_year);  make_pie(input$left_year[1]) })
  output$pie_right <- renderPlotly({ req(input$right_year); make_pie(input$right_year[1]) })
  
  # ──────────────────────────────────────────────────────────────────────────────
  # 8) GROUPED BAR CHART WITH CUSTOM COLORS
  # ──────────────────────────────────────────────────────────────────────────────
  output$bar_compare <- renderPlotly({
    yrs     <- unique(c(input$left_year[1], input$right_year[1]))
    plot_df <- subset(area_df, year %in% yrs)
    plot_df <- merge(plot_df, class_palette, by="class_eng", all.x=TRUE)
    plot_df$class_eng <- factor(plot_df$class_eng, levels=class_palette$class_eng)
    plot_df$year      <- factor(plot_df$year)
    
    year_cols <- setNames(
      c("#4E79A7", "#F28E2B"),   # ← customize your two hex codes
      levels(plot_df$year)
    )
    
    p <- plot_ly(
      plot_df,
      x      = ~class_eng,
      y      = ~area_ha,
      color  = ~year,
      colors = year_cols,
      type   = "bar",
      hoverinfo = 'text',
      text      = ~paste0("Year: ", year, "<br>Area: ", formatC(area_ha, big.mark=",", digits=0))
    )
    
    for(cl in levels(plot_df$class_eng)) {
      vals <- subset(plot_df, class_eng==cl)
      if(nrow(vals)==2) {
        p <- add_segments(
          p,
          x     = cl, xend = cl,
          y     = min(vals$area_ha), yend = max(vals$area_ha),
          line  = list(dash="dash", color=year_cols[1], width=2),
          showlegend  = FALSE, inherit=FALSE
        )
      }
    }
    
    p %>%
      layout(
        barmode = "group",
        yaxis   = list(title="Area (ha)"),
        xaxis   = list(title=""),
        legend  = list(x=0.85, y=1),
        margin  = list(l=60, r=10, b=60, t=20)
      )
  })
  
}
