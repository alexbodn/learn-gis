
'use strict';

proj4.defs("EPSG:2100","+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=-199.87,74.79,246.62,0,0,0,0 +units=m +no_defs +type=crs");

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
	if (feature?.properties?.style) {
		//
	}
	layer.on('click', onLayerClick);
}

function makeLayerJSON(layerInfo, name) {
	
	function filter(feature, layer, name) {
		return !feature.properties.hide_on_map;
	}
	function pointToLayer(feature, latlng) {
		return L.marker(latlng)
			.bindPopup(feature.properties.name);
	}
	
	//transform data from layerInfo.projection
	let layer =
	L.Proj.geoJson
	//L.geoJSON
		(layerInfo.data, {
		filter,
		onEachFeature,
		pointToLayer,
		style: layerInfo.data?.properties?.style,
	});
	let crsSection = layerInfo.data?.crs;
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

async function jsons() {
	let urlNames = {};
	let jsonUrls = [
		'greece-regions-2100',
		'greece-prefectures',
	].map(name => {
		let url = new URL(
			`./test/files/dbs/${name}.geojson`,
			window.location.href
		).toString();
		urlNames[url] = name;
		return url;
	});
	return fetchAll(
		jsonUrls, 'json', {urlNames}
	).then(handleJson);
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

let mapdef = 
//'map'
document.querySelector('.map')
;
let map = L.map(mapdef, {
	// https://leafletjs.com/reference.html#map-zoomsnap
	zoomSnap: 0,
})
//.setView([51.505, -0.09], 13)
;

/**/
const onMapClick = (e) => {
	let coords = e.latlng;
	//if (feature.options.latLngToCoords)
	L.popup()
		.setLatLng(e.latlng)
		.setContent("You clicked the map at " + coords.toString())
		.openOn(map);
};
map.on('click', onMapClick);
/**/

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
    console.log(e.coords, e.tile.src);
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

