
'use strict';

function makeLayerJSON(layerInfo, name) {
	function onEachFeature(feature, layer) {
		// does this feature have a property named popupContent?
		if (feature?.properties?.name_greek) {
			layer.bindPopup(feature.properties.name_greek);
		}
	}
	function filter(feature, layer, name) {
		return !feature.properties.hide_on_map;
	}
	//transform data from layerInfo.projection
	let layer = L.geoJSON(layerInfo.data, {
		filter: filter,
		onEachFeature: onEachFeature
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
		'greece-regions',
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

let map = L.map('map', {
	// https://leafletjs.com/reference.html#map-zoomsnap
	zoomSnap: 0,
})
.setView([51.505, -0.09], 13)
;

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
	
	L.control.scale({metric: true}).addTo(map);
	
	let bounds;
	map.eachLayer(function(layer) {
		let layerBounds = layer.getBounds ?
			layer.getBounds() : null;
		if (!bounds) {
			bounds = layerBounds;
		}
		else if (layerBounds) {
			bounds.extend(layerBounds);
		}
	});
	
	map.fitBounds(bounds);
});
