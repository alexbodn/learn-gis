//import GeoTIFF from 'ol/source/GeoTIFF.js';
//import Map from 'ol/Map.js';
//import TileLayer from 'ol/layer/WebGLTile.js';

const source = new ol.source.GeoTIFF({
  sources: [
    {
      url: 'https://openlayers.org/data/raster/no-overviews.tif',
      overviews: ['https://openlayers.org/data/raster/no-overviews.tif.ovr'],
    },
  ],
});

const map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.WebGLTile({
      source: source,
    }),
  ],
  view: source.getView(),
});
