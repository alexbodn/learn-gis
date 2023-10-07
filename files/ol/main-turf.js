//import GeoJSON from 'ol/format/GeoJSON.js';
//import Map from 'ol/Map.js';
//import View from 'ol/View.js';
//import {OSM, Vector as VectorSource} from 'ol/source.js';
//import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';
//import {fromLonLat} from 'ol/proj.js';

const source = new ol.source.Vector();
fetch('roads-seoul.geojson')
  .then(function (response) {
    return response.json();
  })
  .then(function (json) {
    const format = new ol.format.GeoJSON();
    const features = format.readFeatures(json);
    const street = features[0];

    // convert to a turf.js feature
    const turfLine = format.writeFeatureObject(street);

    // show a marker every 200 meters
    const distance = 0.2;

    // get the line length in kilometers
    const length = turf.lineDistance(turfLine, 'kilometers');
    for (let i = 1; i <= length / distance; i++) {
      const turfPoint = turf.along(turfLine, i * distance, 'kilometers');

      // convert the generated point to a OpenLayers feature
      const marker = format.readFeature(turfPoint);
      marker.getGeometry().transform('EPSG:4326', 'EPSG:3857');
      source.addFeature(marker);
    }

    street.getGeometry().transform('EPSG:4326', 'EPSG:3857');
    source.addFeature(street);
  });
const vectorLayer = new ol.layer.Vector({
  source: source,
});

const rasterLayer = new ol.layer.Tile({
  source: new ol.source.OSM(),
});

const map = new ol.Map({
  layers: [rasterLayer, vectorLayer],
  target: document.getElementById('map'),
  view: new ol.View({
    center: ol.proj.fromLonLat([126.980366, 37.52654]),
    zoom: 15,
  }),
});
