import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiYW5pYm9wcGFuYSIsImEiOiJjbXA1dnY5NWYwZnUxMnhwcmV5dmhnNTVxIn0.KBo1AJPuyZI7gW_53DzUSg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.0836113, 42.3656572],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

const bikeLaneStyle = {
  'line-color': '#32D400',
  'line-width': 4,
  'line-opacity': 0.6
};

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();
  let minMinute = (minute - 60 + 1440) % 1440;
  let maxMinute = (minute + 60) % 1440;
  if (minMinute > maxMinute) {
    let beforeMidnight = tripsByMinute.slice(minMinute);
    let afterMidnight = tripsByMinute.slice(0, maxMinute);
    return beforeMidnight.concat(afterMidnight).flat();
  } else {
    return tripsByMinute.slice(minMinute, maxMinute).flat();
  }
}

function computeStationTraffic(stations, timeFilter = -1, departuresByMinute, arrivalsByMinute) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    v => v.length,
    d => d.start_station_id
  );
  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    v => v.length,
    d => d.end_station_id
  );
  return stations.map(station => {
    let id = station.short_name;
    return {
      ...station,
      arrivals: arrivals.get(id) ?? 0,
      departures: departures.get(id) ?? 0,
      totalTraffic: (arrivals.get(id) ?? 0) + (departures.get(id) ?? 0)
    };
  });
}

map.on('load', async () => {
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: bikeLaneStyle,
  });
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: bikeLaneStyle,
  });

  const svg = d3.select('#map').select('svg');
  const jsonurl = 'bluebikes-stations.json';
  const jsonData = await d3.json(jsonurl);
  let stations = jsonData.data.stations;

  let trips = await d3.csv(
    'bluebikes-traffic-2024-03.csv',
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    }
  );

  let departuresByMinute = Array.from({ length: 1440 }, () => []);
  let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
  trips.forEach(trip => {
    let startedMinutes = minutesSinceMidnight(trip.started_at);
    let endedMinutes = minutesSinceMidnight(trip.ended_at);
    departuresByMinute[startedMinutes].push(trip);
    arrivalsByMinute[endedMinutes].push(trip);
  });

  let timeFilter = -1;

  let stationData = computeStationTraffic(stations, timeFilter, departuresByMinute, arrivalsByMinute);

  let radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stationData, d => d.totalTraffic)])
    .range([0, 12]);

  let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

  let circles = svg
    .selectAll('circle')
    .data(stationData, d => d.short_name)
    .enter()
    .append('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('pointer-events', 'auto')
    .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic))
    .each(function (d) {
      d3.select(this)
        .append('title')
        .text(
          `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
        );
    });

  function updatePositions() {
    circles
      .attr('cx', d => getCoords(d).cx)
      .attr('cy', d => getCoords(d).cy);
  }

  function updateScatterPlot(timeFilter) {
    let filteredStations = computeStationTraffic(stations, timeFilter, departuresByMinute, arrivalsByMinute);
    let maxTraffic = d3.max(filteredStations, d => d.totalTraffic);
    if (timeFilter === -1) {
      radiusScale.range([0, 12]);
    } else {
      radiusScale.range([2, 20]);
    }
    radiusScale.domain([0, maxTraffic]);
    circles = svg
      .selectAll('circle')
      .data(filteredStations, d => d.short_name)
      .join(
        enter => enter.append('circle')
          .attr('fill', 'steelblue')
          .attr('fill-opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 1)
          .attr('pointer-events', 'auto')
          .each(function (d) {
            d3.select(this)
              .append('title')
              .text(
                `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
              );
          }),
        update => update,
        exit => exit.remove()
      )
      .attr('r', d => radiusScale(d.totalTraffic))
      .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic));
    updatePositions();
  }

  function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);
    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }
    updateScatterPlot(timeFilter);
  }

  updatePositions();
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');
  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();
});