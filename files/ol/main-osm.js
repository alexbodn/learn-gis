//import Map from 'ol/Map.js';
//import OSMXML from 'ol/format/OSMXML.js';
//import VectorSource from 'ol/source/Vector.js';
//import View from 'ol/View.js';
//import XYZ from 'ol/source/XYZ.js';
//import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style.js';
//import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';
//import {bbox as bboxStrategy} from 'ol/loadingstrategy.js';
//import {transformExtent} from 'ol/proj.js';

let map = null;

const styles = {
  'amenity': {
    'parking': new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(170, 170, 170, 1.0)',
        width: 1,
      }),
      fill: new ol.style.Fill({
        color: 'rgba(170, 170, 170, 0.3)',
      }),
    }),
  },
  'building': {
    '.*': new ol.style.Style({
      zIndex: 100,
      stroke: new ol.style.Stroke({
        color: 'rgba(246, 99, 79, 1.0)',
        width: 1,
      }),
      fill: new ol.style.Fill({
        color: 'rgba(246, 99, 79, 0.3)',
      }),
    }),
  },
  'highway': {
    'service': new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(255, 255, 255, 1.0)',
        width: 2,
      }),
    }),
    '.*': new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(255, 255, 255, 1.0)',
        width: 3,
      }),
    }),
  },
  'landuse': {
    'forest|grass|allotments': new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: 'rgba(140, 208, 95, 1.0)',
        width: 1,
      }),
      fill: new ol.style.Fill({
        color: 'rgba(140, 208, 95, 0.3)',
      }),
    }),
  },
  'natural': {
    'tree': new ol.style.Style({
      image: new ol.style.Circle({
        radius: 2,
        fill: new ol.style.Fill({
          color: 'rgba(140, 208, 95, 1.0)',
        }),
        stroke: null,
      }),
    }),
  },
};

const formatOSM = new ol.format.OSMXML();
const vectorSource = new ol.source.Vector({
  format: formatOSM,
  loader: function (extent, resolution, projection, success, failure) {
    const epsg4326Extent = ol.proj.transformExtent(extent, projection, 'EPSG:4326');
    const client = new XMLHttpRequest();
    client.open('POST', 'https://overpass-api.de/api/interpreter');
    client.addEventListener('load', function () {
      const features = formatOSM.readFeatures(client.responseText, {
        featureProjection: map.getView().getProjection(),
      });
      vectorSource.addFeatures(features);
      success(features);
    });
    client.addEventListener('error', failure);
    const query =
    	`(
    	node(
    	${epsg4326Extent[1]},
    	${Math.max(epsg4326Extent[0], -180)},
    	${epsg4326Extent[3]},
    	${Math.min(epsg4326Extent[2], 180)}
    	);
    	rel(bn)->.foo;
    	way(bn);
    	node(w)->.foo;
    	rel(bw);
    	);
    	out meta;`;
    client.send(query);
  },
  strategy: ol.loadingstrategy.bbox,
});

const vector = new ol.layer.Vector({
  source: vectorSource,
  style: function (feature) {
    for (const key in styles) {
      const value = feature.get(key);
      if (value !== undefined) {
        for (const regexp in styles[key]) {
          if (new RegExp(regexp).test(value)) {
            return styles[key][regexp];
          }
        }
      }
    }
    return null;
  },
});

const key = maptiler_apikey;
//const key = 'Get your own API key at https://www.maptiler.com/cloud/';
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

map = new ol.Map({
  layers: [raster, vector],
  target: document.getElementById('map'),
  view: new ol.View({
    center: [739218, 5906096],
    maxZoom: 19,
    zoom: 17,
  }),
});
