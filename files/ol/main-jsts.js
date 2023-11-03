//import GeoJSON from 'ol/format/GeoJSON.js';
//import LinearRing from 'ol/geom/LinearRing.js';
//import Map from 'ol/Map.js';
//import OSM from 'ol/source/OSM.js';
//import VectorSource from 'ol/source/Vector.js';
//import View from 'ol/View.js';
//import {
  //LineString,
  //MultiLineString,
  //MultiPoint,
  //MultiPolygon,
  //Point,
  //Polygon,
//} from 'ol/geom.js';
//import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';
//import {fromLonLat} from 'ol/proj.js';

const source = new ol.source.Vector();
fetch('roads-seoul.geojson')
  .then(function (response) {
    return response.json();
  })
  .then(function (json) {
    const format = new ol.format.GeoJSON();
    const features = format.readFeatures(json, {
      featureProjection: 'EPSG:3857',
    });

    const parser = new jsts.io.OL3Parser();
    parser.inject(
      ol.geom.Point,
      ol.geom.LineString,
      ol.geom.LinearRing,
      ol.geom.Polygon,
      ol.geom.MultiPoint,
      ol.geom.MultiLineString,
      ol.geom.MultiPolygon
    );

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      // convert the OpenLayers geometry to a JSTS geometry
      const jstsGeom = parser.read(feature.getGeometry());

      // create a buffer of 40 meters around each line
      const buffered = jstsGeom.buffer(20);

      // convert back from JSTS and replace the geometry on the feature
      feature.setGeometry(parser.write(buffered));
    }

    source.addFeatures(features);
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
    center: ol.proj.fromLonLat([126.979293, 37.528787]),
    zoom: 15,
  }),
});
