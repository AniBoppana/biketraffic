import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

mapboxgl.accessToken = 'pk.eyJ1IjoiYW5pYm9wcGFuYSIsImEiOiJjbXA1dnY5NWYwZnUxMnhwcmV5dmhnNTVxIn0.KBo1AJPuyZI7gW_53DzUSg';

const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/navigation-night-v1',
  center: [-71.0836113, 42.3656572],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});