//import Map from 'ol/Map.js';
//import TopoJSON from 'ol/format/TopoJSON.js';
//import VectorSource from 'ol/source/Vector.js';
//import View from 'ol/View.js';
//import XYZ from 'ol/source/XYZ.js';
//import {Fill, Stroke, Style} from 'ol/style.js';
//import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';

const key = maptiler_apikey;
//const key = 'Get your own API key at https://www.maptiler.com/cloud/';
const attributions =
  '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';

const raster = new ol.layer.Tile({
  source: new ol.source.XYZ({
    attributions: attributions,
    url: 'https://api.maptiler.com/maps/darkmatter/{z}/{x}/{y}.png?key=' + key,
    tileSize: 512,
  }),
});

const style = new ol.style.Style({
  fill: new ol.style.Fill({
    color: 'rgba(255, 255, 255, 0.6)',
  }),
  stroke: new ol.style.Stroke({
    color: '#319FD3',
    width: 1,
  }),
});

const vector = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: './world-110m.json',
    format: new ol.format.TopoJSON({
      // don't want to render the full world polygon (stored as 'land' layer),
      // which repeats all countries
      layers: ['countries'],
    }),
    overlaps: false,
  }),
  style: style,
});

const map = new ol.Map({
  layers: [raster, vector],
  target: 'map',
  view: new ol.View({
    center: [0, 0],
    zoom: 1,
  }),
});
