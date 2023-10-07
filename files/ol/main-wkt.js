//import Map from 'ol/Map.js';
//import View from 'ol/View.js';
//import WKT from 'ol/format/WKT.js';
//import {OSM, Vector as VectorSource} from 'ol/source.js';
//import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';

const raster = new ol.layer.Tile({
  source: new ol.source.OSM(),
});

const wkt =
  `POLYGON((10.689 -25.092, 34.595 
  -20.170, 38.814 -35.639, 13.502 
  -39.155, 10.689 -25.092))`;

const format = new ol.format.WKT();

const feature = format.readFeature(wkt, {
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
});

const vector = new ol.layer.Vector({
  source: new ol.source.Vector({
    features: [feature],
  }),
});

const map = new ol.Map({
  layers: [raster, vector],
  target: 'map',
  view: new ol.View({
    center: [2952104.0199, -3277504.823],
    zoom: 4,
  }),
});
