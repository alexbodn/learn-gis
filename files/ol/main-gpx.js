//import GPX from 'ol/format/GPX.js';
//import Map from 'ol/Map.js';
//import VectorSource from 'ol/source/Vector.js';
//import View from 'ol/View.js';
//import XYZ from 'ol/source/XYZ.js';
//import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style.js';
//import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';

const key = 'Get your own API key at https://www.maptiler.com/cloud/';
const attributions =
  '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';

const raster = new ol.layer.Tile({
  source: new ol.source.XYZ({
    attributions: attributions,
    url: 'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=' + key,
    maxZoom: 20,
  }),
});

const style = {
  'Point': new ol.style.Style({
    image: new ol.style.Circle({
      fill: new ol.style.Fill({
        color: 'rgba(255,255,0,0.4)',
      }),
      radius: 5,
      stroke: new ol.style.Stroke({
        color: '#ff0',
        width: 1,
      }),
    }),
  }),
  'LineString': new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: '#f00',
      width: 3,
    }),
  }),
  'MultiLineString': new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: '#0f0',
      width: 3,
    }),
  }),
};

const vector = new ol.layer.Vector({
  source: new ol.source.Vector({
    url: 'fells_loop.gpx',
    format: new ol.format.GPX(),
  }),
  style: function (feature) {
    return style[feature.getGeometry().getType()];
  },
});

const map = new ol.Map({
  layers: [raster, vector],
  target: document.getElementById('map'),
  view: new ol.View({
    center: [-7916041.528716288, 5228379.045749711],
    zoom: 12,
  }),
});

const displayFeatureInfo = function (pixel) {
  const features = [];
  map.forEachFeatureAtPixel(pixel, function (feature) {
    features.push(feature);
  });
  if (features.length > 0) {
    const info = [];
    let i, ii;
    for (i = 0, ii = features.length; i < ii; ++i) {
      info.push(features[i].get('desc'));
    }
    document.getElementById('info').innerHTML = info.join(', ') || '(unknown)';
    map.getTarget().style.cursor = 'pointer';
  } else {
    document.getElementById('info').innerHTML = '&nbsp;';
    map.getTarget().style.cursor = '';
  }
};

map.on('pointermove', function (evt) {
  if (evt.dragging) {
    return;
  }
  const pixel = map.getEventPixel(evt.originalEvent);
  displayFeatureInfo(pixel);
});

map.on('click', function (evt) {
  displayFeatureInfo(evt.pixel);
});
