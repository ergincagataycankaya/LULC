FROM rocker/shiny:latest

RUN R -e "install.packages(c('shiny', 'leaflet', 'plotly'), repos = 'https://cloud.r-project.org')"
RUN R -e "if (!requireNamespace('remotes')) install.packages('remotes')"
RUN R -e "remotes::install_github('danielhers/leaflet.extras2')"

COPY . /srv/shiny-server/
