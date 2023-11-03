//import Map from 'ol/Map.js';
//import View from 'ol/View.js';
//import WKT from 'ol/format/WKT.js';
//import {OSM, Vector as VectorSource} from 'ol/source.js';
//import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer.js';

const raster = new ol.layer.Tile({
  source: new ol.source.OSM(),
});

const wkt = [
  `POLYGON((10.689 -25.092, 34.595 
  -20.170, 38.814 -35.639, 13.502 
  -39.155, 10.689 -25.092))`,
  'EPSG:4326'
  ];

proj4.defs([["EPSG:2154", "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"]]);

let proj_triangle = ['EPSG:9802', '+proj=lcc +lon_0=-90 +lat_1=2 +lat_2=45'];
//	proj4.defs([proj_triangle]);
	// Make non-built-in projections defined in proj4 available in OpenLayers.
	// (must be done before GeoPackages are loaded)
	ol.proj.proj4.register(proj4);
	
const triangle = [
	`POLYGON((
	2 2,
	2.8660254037844385 0.5773502691896257,
	1.1339745962155615 0.5773502691896257,
	2 2))`,
	'EPSG:4326'
];

const geojsonObject = {
  'type': 'FeatureCollection',
  'crs': {
    'type': 'name',
    'properties': {
      'name': 'EPSG:4326',
    },
  },
  'features': [
    {
      'type': 'Feature',
      'geometry': {
        'type': 'Polygon',
        'coordinates': [
          [
			[2, 2],
			[2.8660254037844385, 0.5773502691896257],
			[1.1339745962155615, 0.5773502691896257],
			[2, 2],
          ],
        ],
      },
    },
  ],
};

let gformat = new ol.format.GeoJSON();
let gfeatures = gformat
	.readFeatures(geojsonObject, {
		dataProjection: 'EPSG:4326',
		featureProjection: 'EPSG:3857',
	});
        var from = turf.point([2, 2]);
        var to = turf.point([2.8660254037844385, 0.5773502691896257]);
        console.log(turf.distance(from, to));

var distance = ol.sphere.getDistance([2, 2], [2.8660254037844385, 0.5773502691896257]) / 1000;
console.log('dist', distance);

// convert to a turf.js feature
const turfLine = gformat.writeFeatureObject(gfeatures[0]);
// get the line length in kilometers
const length = turf.lineDistance(turfLine, 'kilometers');
console.log(length);

const format = new ol.format.WKT();

let features = [
	wkt, 
	//triangle
].map(
	feature => {
	return format.readFeature(feature[0], {
		dataProjection: feature[1],
		featureProjection: 'EPSG:3857',
		});
	}
);
features.push(...gfeatures);

const vector = new ol.layer.Vector({
  source: new ol.source.Vector({
    features: features,
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
