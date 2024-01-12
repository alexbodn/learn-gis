
'use strict';


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

function makeLayerJSON(json, name, {sldStyle, style}={}) {
	function filter(feature, layer, name) {
		return !feature.properties.hide_on_map;
	}
	function pointToLayer(feature, latlng) {
		return L.marker(latlng, 'iconUrl' in (style || {}) ? {icon: L.icon(style)} : undefined)
		//return L.circleMarker(latlng)
			.bindPopup(feature.properties.name);
	}
	let styleFunction;
	if (sldStyle) {
		let SLDStyler = new L.SLDStyler(sldStyle);
		styleFunction = SLDStyler.getStyleFunction;
	}
	
	let layer =
	L.Proj.geoJson (
	//L.geoJSON (
		json, {
		filter,
		onEachFeature,
		pointToLayer,
		style: style || styleFunction || json?.properties?.style,
	});
	console.log('style:', style || styleFunction || json?.properties?.style);
	layer.options.name = name;
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
			return crs.projection.project(latlng);
		};
	}
	else {
		layer.options.latLngToCoords = function(latlng) {
			let point = new L.point(latlng.lng, latlng.lat);
			return point;
		};
	}
	//console.log('build', crs, layer.options);
	
	layer.eachLayer(featureInstanceLayer => {
		let style = featureInstanceLayer.feature?.properties?.style;
//console.log(featureInstanceLayer, featureInstanceLayer.setStyle, style);
		if (style && featureInstanceLayer.setStyle) {
			featureInstanceLayer?.setStyle(style);
		}
	});
	
	return layer;
}

function build_map(target='map') {
	let mapdef = 
	//'map'
	document.querySelector('#map')
	;
	let map = L.map(mapdef, {
		// https://leafletjs.com/reference.html#map-zoomsnap
		//zoomSnap: 2,
		worldCopyJump: true,
	});
	
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

function build_map1(target='map') {
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
	
	map.on("baselayerchange",
		function(e) {
			// e.name has the layer name
			// e.layer has the layer reference
			map.activeBaseLayer = e.layer;
			let maxBounds = e.layer.getBounds();
			if (maxBounds && maxBounds.isValid()) {
				map.setMaxBounds(maxBounds);
			}
			console.log("base map changed to " + e.name);
		});
	let osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});
	
	let bwOSM = L.tileLayer('http://{s}.www.toolserver.org/tiles/bw-mapnik/{z}/{x}/{y}.png', {
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
		'OpenStreetMap BW': bwOSM,
		"<span style='color: red'>OpenStreetMap.HOT</span>": osmHOT,
	};
	
	let overlayMaps = {};
	
	let layerControl = L.control.layers(
		baseMaps, overlayMaps
	).addTo(map);
	
            var terrainMap = L.tileLayer(
                'http://{s}.tile.stamen.com/terrain/{z}/{x}/{y}.jpg', {
                    attribution: attrLink,
                    maxZoom: 18,
                }).addTo(map);

            var tonerMap = L.tileLayer(
                'http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png', {
                    attribution: attrLinkToner,
                    maxZoom: 18,
                });

            var watercolorMap = L.tileLayer(
                'http://{s}.tile.stamen.com/watercolor/{z}/{x}/{y}.jpg', {
                    attribution: attrLink,
                    maxZoom: 18,
                });
	
	layerControl.addBaseLayer(openTopoMap, "OpenTopoMap");
	//map.addLayer(osm);
	
	return map;
}


function show_map(map, viewOptions=[]) {
	L.control.scale({metric: true}).addTo(map);
	
	//todo break viewOptions in center & zoom
	if (viewOptions && viewOptions.length) {
		map.setView(...viewOptions);
	}
	else {
		let bounds;
		map.eachLayer(function(layer) {
	//console.log('/////', layer.options);
			let layerBounds = layer.getBounds ?
				layer.getBounds() : null//layer.options.bounds;
	//console.log('xxx', layer.options.name, layerBounds, layerBounds?.isValid());
			if (!bounds || !bounds.isValid()) {
				bounds = layerBounds;
			}
			else if (layerBounds && layerBounds.isValid()) {
				bounds.extend(layerBounds);
			}
		});
	console.log('calc bounds', bounds?.isValid(), bounds.getCenter());
		if (bounds && bounds.isValid()) {
			map.fitBounds(bounds);
		}
	}
	map.on("baselayerchange",
		function(e) {
			// e.name has the layer name
			// e.layer has the layer reference
			map.activeBaseLayer = e.layer;
			let maxBounds = e.layer.getBounds();
			if (maxBounds && maxBounds.isValid()) {
				map.setMaxBounds(maxBounds);
			}
			console.log("base map changed to " + e.name);
		}
	);
}

