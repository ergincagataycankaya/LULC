source("global.R")

server <- function(input, output, session) {
  
  # helper to build your tile URL
  get_tile_url <- function(year) lulc_urls[[as.character(year)]]
  
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
  
  # Helper to pick a single year from checkboxGroupInput (first checked)
  single_year <- function(input_val) {
    sel <- input_val()
    if(length(sel)) sel[1] else NULL
  }
  
  # MAPS
  output$map_left <- renderLeaflet({
    leaflet() %>%
      addProviderTiles("Esri.WorldImagery") %>%
      addTiles(get_tile_url(single_year(reactive(input$left_year)))) %>%
      setView(29.0,41.1,zoom=12)
  })
  output$map_right <- renderLeaflet({
    leaflet() %>%
      addProviderTiles("Esri.WorldImagery") %>%
      addTiles(get_tile_url(single_year(reactive(input$right_year)))) %>%
      setView(29.0,41.1,zoom=12)
  })
  observe({ session$sendCustomMessage("sync_maps", list()) })
  
  # RESET
  observeEvent(input$reset_left, {
    leafletProxy("map_left") %>% setView(29.0,41.1,zoom=12)
  })
  observeEvent(input$reset_right, {
    leafletProxy("map_right") %>% setView(29.0,41.1,zoom=12)
  })
  
  # 3) PIE DATA (GROUP < 1% AS “Other”)
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
  
  
  # --- TABLES (Professional Look) ---
  output$table_left <- renderUI({
    dat <- subset(area_df, year == input$left_year)
    dat <- merge(dat, class_palette, by = "class_eng", all.x = TRUE)
    dat <- dat[order(match(dat$class_eng, class_palette$class_eng)), ]
    tags$table(class = "area-table",
               tags$thead(
                 tags$tr(
                   tags$th("Class"),
                   tags$th("Area (ha)")
                 )
               ),
               tags$tbody(
                 lapply(seq_len(nrow(dat)), function(i) {
                   tags$tr(
                     tags$td(
                       tags$span(class = "area-class-icon",
                                 style = paste0("color:", dat$color[i]),
                                 tags$i(class = paste("fa", dat$icon[i]))
                       ),
                       tags$span(dat$class_eng[i])
                     ),
                     tags$td(
                       tags$span(style = paste0("color:", dat$color[i]),
                                 formatC(dat$area_ha[i], digits = 0, big.mark = ",", format = "f")
                       )
                     )
                   )
                 })
               )
    )
  })
  output$table_right <- renderUI({
    dat <- subset(area_df, year == input$right_year)
    dat <- merge(dat, class_palette, by = "class_eng", all.x = TRUE)
    dat <- dat[order(match(dat$class_eng, class_palette$class_eng)), ]
    tags$table(class = "area-table",
               tags$thead(
                 tags$tr(
                   tags$th("Class"),
                   tags$th("Area (ha)")
                 )
               ),
               tags$tbody(
                 lapply(seq_len(nrow(dat)), function(i) {
                   tags$tr(
                     tags$td(
                       tags$span(class = "area-class-icon",
                                 style = paste0("color:", dat$color[i]),
                                 tags$i(class = paste("fa", dat$icon[i]))
                       ),
                       tags$span(dat$class_eng[i])
                     ),
                     tags$td(
                       tags$span(style = paste0("color:", dat$color[i]),
                                 formatC(dat$area_ha[i], digits = 0, big.mark = ",", format = "f")
                       )
                     )
                   )
                 })
               )
    )
  })
  
  # --- GROUPED BAR CHART WITH HIGHLIGHTED SELECTED YEARS ---
  output$bar_compare <- renderPlotly({
    left_year <- input$left_year
    right_year <- input$right_year
    plot_df <- area_df[area_df$year %in% c(left_year, right_year),]
    plot_df <- merge(plot_df, class_palette, by = "class_eng", all.x = TRUE)
    plot_df$class_eng <- factor(plot_df$class_eng, levels = class_palette$class_eng)
    plot_df$year <- as.factor(plot_df$year)
    
    # Draw grouped bar
    p <- plot_ly(
      plot_df, x = ~class_eng, y = ~area_ha, color = ~year,
      colors = c("#1976d2", "#ff7f0e"),
      type = "bar",
      hoverinfo = 'text',
      text = ~paste0("Year: ", year, "<br>", "Area: ", formatC(area_ha, big.mark=",", digits=0, format="f"))
    )
    
    # Add dashed lines connecting the two selected bars (for each class)
    for(cl in levels(plot_df$class_eng)) {
      vals <- plot_df[plot_df$class_eng == cl, ]
      if(nrow(vals)==2) {
        p <- add_segments(p,
                          x = cl, xend = cl,
                          y = min(vals$area_ha), yend = max(vals$area_ha),
                          line = list(dash = "dash", color = "#1976d2", width = 3),
                          showlegend = FALSE, inherit = FALSE
        )
      }
    }
    p %>% layout(
      yaxis = list(title = "Area (ha)"),
      xaxis = list(title = ""),
      barmode = "group",
      legend = list(x=0.85, y=1),
      margin = list(l = 60, r = 10, b = 60, t = 20)
    )
  })
}
