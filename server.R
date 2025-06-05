source("global.R")

server <- function(input, output, session) {
  # Helper: Render each LULC map, synced
  makeLULCMapSimple <- function(tiler_url) {
    leaflet(options = leafletOptions(zoomControl = TRUE)) %>%
      addTiles(
        urlTemplate = tiler_url,
        options     = tileOptions(opacity = 0.85)
      ) %>%
      setView(lng = 29.0, lat = 41.1, zoom = 12) %>%
      syncWith("maps")
  }
  
  # Render LULC maps
  for (yr in names(lulc_urls)) {
    local({
      year_str    <- yr
      url_for_map <- lulc_urls[[year_str]]
      output_name <- paste0("map", year_str)
      output[[output_name]] <- renderLeaflet({
        makeLULCMapSimple(url_for_map)
      })
    })
  }
  
  # Render Area tables
  for (yr in names(lulc_urls)) {
    local({
      year_str <- yr
      output[[paste0("area_tbl_", year_str)]] <- renderUI({
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
    })
  }
  
  # Render Pie Charts under each table
  for (yr in names(lulc_urls)) {
    local({
      year_str <- yr
      output[[paste0("pie_", year_str)]] <- renderPlotly({
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
          textinfo = 'percent',            # Only show percent in chart
          textposition = 'inside',
          hoverinfo = 'label+percent+value', # Show all info on hover
          marker = list(colors = dat$color,
                        line = list(color = '#fff', width = 1)),
          showlegend = FALSE,
          sort = FALSE,
          direction = "clockwise",
          insidetextorientation = "auto"
        ) %>%
          layout(
            margin = list(l = 0, r = 0, b = 0, t = 10, pad = 0),
            height = 250,    # Increase or decrease as needed for your card
            width = 250,
            font = list(size = 16, family="Arial Black"),
            paper_bgcolor = 'rgba(0,0,0,0)',
            plot_bgcolor = 'rgba(0,0,0,0)'
          )
      })
    })
  }
  
  
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