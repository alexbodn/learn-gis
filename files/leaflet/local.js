
'use strict';

proj4.defs("EPSG:2100","+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=-199.87,74.79,246.62,0,0,0,0 +units=m +no_defs +type=crs");
proj4.defs("EPSG:27700",'PROJCS["OSGB 1936 / British National Grid",GEOGCS["OSGB 1936",DATUM["OSGB_1936",SPHEROID["Airy 1830",6377563.396,299.3249646,AUTHORITY["EPSG","7001"]],TOWGS84[446.448,-125.157,542.06,0.15,0.247,0.842,-20.489],AUTHORITY["EPSG","6277"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4277"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",49],PARAMETER["central_meridian",-2],PARAMETER["scale_factor",0.9996012717],PARAMETER["false_easting",400000],PARAMETER["false_northing",-100000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","27700"]]');

const onLayerClick = (e) => {
	let feature = e.target.feature;
	let coords = e.latlng;
	for (let parent of Object.values(e.target._eventParents)) {
		if (parent?.options?.latLngToCoords) {
			coords = parent.options.latLngToCoords(e.latlng);
			break;
		}
	}
	L.DomEvent.stopPropagation(e);
	let label = feature?.properties?.name_greek || 'the map';
	L.popup()
		.setLatLng(e.latlng)
		.setContent(`You clicked ${label} at ${coords.toString()}`)
		.openOn(e.target._map)
		;
};

function onEachFeature(feature, layer) {
	let label = feature?.properties?.name_greek;
	if (label) {
		//layer.bindPopup(label);
	}
	let style = feature?.properties?.style;
	if (style) {
		//console.log(feature, layer);
		layer.setStyle(style);
	}
	layer.on('click', onLayerClick);
}

function makeLayerJSON(name, style) {
	console.log(name, style);
	function filter(feature, layer, name) {
		return !feature.properties.hide_on_map;
	}
	function pointToLayer(feature, latlng) {
		return L.marker(latlng)
			.bindPopup(feature.properties.name);
	}
	if (false && style) {
		let SLDStyler = new L.SLDStyler(style);
		style = SLDStyler.getStyleFunction;
	}
	
	let layer =
	L.Proj.geoJson
	//L.geoJSON
		(false, {
		filter,
		onEachFeature,
		pointToLayer,
		style,
	});
	
	return layer;
}

function makeLayerJSON0(json, name) {
	
	function filter(feature, layer, name) {
		return !feature.properties.hide_on_map;
	}
	function pointToLayer(feature, latlng) {
		return L.marker(latlng)
			.bindPopup(feature.properties.name);
	}
	
	//transform data from.projection
	let layer =
	L.Proj.geoJson
	//L.geoJSON
		(json, {
		filter,
		onEachFeature,
		pointToLayer,
		style: json?.properties?.style,
	});
	let crsSection = json?.crs;
	let crs;
	if (crsSection?.type === 'name') {
		crs = new L.Proj.CRS(
			crsSection.properties.name);
	}
	else if (crsSection?.type) {
		crs = new L.Proj.CRS(
			crsSection.type + ':' + crsSection.properties.code);
	}
	if (crs !== undefined) {
		layer.options.latLngToCoords = function(latlng) {
			//console.log('conv', latlng);
			return crs.projection.project(latlng);
		};
	}
	else {
		layer.options.latLngToCoords = function(latlng) {
			let point = new L.point(latlng.lng, latlng.lat);
			//console.log('no conv', latlng, point);
			return point;
		};
	}
	//console.log('build', crs, layer.options);
	
	layer.eachLayer(featureInstanceLayer => {
		let style = featureInstanceLayer.feature?.properties?.style;
		featureInstanceLayer.setStyle(style);
	});
	
	return layer;
}

async function handleJson(responses) {
	let layers = {};
	for (let response of responses) {
		let projection = 
			(response.data?.crs?.properties?.name) || 'CRS:84';
		let name = response.urlNames[response.url];
		layers[name] = {data: response.data, projection};
	}
	return layers;
}

function fetchAll(urls, method='text', options={}) {
	return Promise.all(
		urls.map(url => fetch(url)
			.then(resp => resp[method]())
			.then(data => ({ data, url, ...options }))
			.catch(error => ({ error, url, ...options }))
		)
	);
}

function build_map(target='map') {
	let mapdef = 
	//'map'
	document.querySelector('#map')
	;
	let map = L.map(mapdef, {
		// https://leafletjs.com/reference.html#map-zoomsnap
		zoomSnap: 0,
	})
	//.setView([51.505, -0.09], 13)
	;
	
	const onMapClick = (e) => {
		let coords = e.latlng;
		//if (feature.options.latLngToCoords)
		L.popup()
			.setLatLng(e.latlng)
			.setContent("You clicked the map at " + coords.toString())
			.openOn(map);
	};
	map.on('click', onMapClick);

	return map;
}

function show_map(map) {
	L.control.scale({metric: true}).addTo(map);
	
	let bounds;
	map.eachLayer(function(layer) {
		let layerBounds = layer.getBounds ?
			layer.getBounds() : null;
		if (!bounds || !bounds.isValid()) {
			bounds = layerBounds;
		}
		else if (layerBounds && layerBounds.isValid()) {
			bounds.extend(layerBounds);
		}
	});
	if (bounds && bounds.isValid()) {
		map.fitBounds(bounds);
	}
}

//main//
/**
let mapdef = 
//'map'
document.querySelector('.map')
;
let map = L.map(mapdef, {
	// https://leafletjs.com/reference.html#map-zoomsnap
	zoomSnap: 0,
})
.setView([51.505, -0.09], 13)
;

const onMapClick = (e) => {
	let coords = e.latlng;
	//if (feature.options.latLngToCoords)
	L.popup()
		.setLatLng(e.latlng)
		.setContent("You clicked the map at " + coords.toString())
		.openOn(map);
};
map.on('click', onMapClick);

let osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

let osmHOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France'
});

let openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
});
openTopoMap.on('tileload', function (e) {
	//console.log(e.coords, e.tile.src);
});

let baseMaps = {
	"OpenStreetMap": osm,
	"<span style='color: red'>OpenStreetMap.HOT</span>": osmHOT,
};

let overlayMaps = {};

let layerControl = L.control.layers(
	baseMaps, overlayMaps
).addTo(map);

layerControl.addBaseLayer(openTopoMap, "OpenTopoMap");

jsons().then(layers => {
	for (let [name, layerInfo] of Object.entries(layers)) {
		let layer = makeLayerJSON(layerInfo, name);
		map.addLayer(layer);
		layerControl.addOverlay(layer, name);
	}
	
	map.addLayer(osm);
	
	show_map(map);
});
**/

