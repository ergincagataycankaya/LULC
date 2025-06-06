source("global.R")

server <- function(input, output, session) {
  output$big_map <- renderLeaflet({
    left  <- input$left_year
    right <- input$right_year
    m <- leaflet(options = leafletOptions(zoomControl = TRUE)) %>%
      addProviderTiles("Esri.WorldImagery", group = "Satellite")
    for (yr in names(lulc_urls)) {
      m <- m %>% addTiles(
        urlTemplate = lulc_urls[[yr]],
        options     = tileOptions(opacity = 0.7),
        group       = yr
      )
    }
    m %>%
      hideGroup(setdiff(names(lulc_urls), c(left, right))) %>%
      addLayersControl(
        baseGroups = c("Satellite"),
        overlayGroups = names(lulc_urls),
        options = layersControlOptions(collapsed = FALSE)
      ) %>%
      addSwipeControl(m, left, right) %>%
      addResetMapButton() %>%
      setView(lng = 29.0, lat = 41.1, zoom = 12)
  })

  selected_year <- reactive({
    input$right_year
  })

  output$area_tbl_big <- renderUI({
    year_str <- selected_year()
    dat <- subset(area_df, year == year_str)
    if (nrow(dat) == 0) return(NULL)
    dat <- merge(dat, class_palette, by = "class_eng", all.x = TRUE)
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
                       tags$span(
                         class = "area-class-icon",
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

  output$big_pie <- renderPlotly({
    year_str <- selected_year()
    dat <- subset(area_df, year == year_str)
    if (nrow(dat) == 0) return(NULL)
    dat <- merge(dat, class_palette, by = "class_eng", all.x = TRUE)
    dat <- dat[order(match(dat$class_eng, class_palette$class_eng)), ]
    total_area <- sum(dat$area_ha)
    dat$perc <- round(100 * dat$area_ha / total_area, 2)
    plot_ly(
      dat,
      labels = ~class_eng,
      values = ~area_ha,
      type = 'pie',
      textinfo = 'percent',
      textposition = 'inside',
      hoverinfo = 'label+percent+value',
      marker = list(colors = dat$color,
                    line = list(color = '#fff', width = 1)),
      showlegend = FALSE,
      sort = FALSE,
      direction = "clockwise",
      insidetextorientation = "auto"
    ) %>%
      layout(
        margin = list(l = 0, r = 0, b = 0, t = 10, pad = 0),
        height = 250,
        width = 250,
        font = list(size = 16, family = "Arial Black"),
        paper_bgcolor = 'rgba(0,0,0,0)',
        plot_bgcolor = 'rgba(0,0,0,0)'
      )
  })
  
  
  # Forest area trend line
  output$forest_trend <- renderPlotly({
    forest_trend <- subset(area_df, class_eng == "Forest")
    plot_ly(
      forest_trend,
      x = ~as.numeric(year),
      y = ~area_ha,
      type = 'scatter',
      mode = 'lines+markers',
      line = list(color = '#228B22', width = 3),
      marker = list(size = 10, color = '#41ae42'),
      hovertemplate = paste(
        "<b>Year:</b> %{x}<br>",
        "<b>Forest Area (ha):</b> %{y:,.0f}<extra></extra>"
      )
    ) %>%
      layout(
        xaxis = list(title = "Year", dtick = 1, tickmode = "linear"),
        yaxis = list(title = "Forest Area (ha)", rangemode = "tozero"),
        showlegend = FALSE,
        margin = list(l = 60, r = 15, b = 55, t = 20)
      )
  })
}