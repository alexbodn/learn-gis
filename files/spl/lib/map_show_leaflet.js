
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
	let label = feature?.properties?.name || 'the map';
	L.popup()
		.setLatLng(e.latlng)
		.setContent(`You clicked ${label} at ${coords.toString()}`)
		.openOn(e.target._map)
		;
};

function onEachFeature(feature, layer) {
	let label = feature?.properties?.name;
	if (false && label) {
		//layer.setText(label, {below: true});
		layer.bindTooltip(label, {
			permanent: true,
			className: 'myClass',
			direction: 'center',
		}).openTooltip();
	}
	let style = feature?.properties?.style;
	if (style) {
		//console.log(feature, layer.options.name);
		layer.setStyle(style);
	}
	layer.on('click', onLayerClick);
}

function makeLayerJSON(name, {sldStyle, style, dataProjection}={}) {
	function filter(feature, layer, name) {
		return !feature.properties.hide_on_map;
	}
	function pointToLayer(feature, latlng) {
		let defaultPoint = {radius: 5, weight: 0.5, opacity: 0.5, fillOpacity: 0};
		let featureStyle = feature?.properties?.style || style || defaultPoint;
		let marker;
		if ('iconMarker' in featureStyle) {
			let icon;
			if ('iconUrl' in (featureStyle || {})) {
				icon = {icon: L.icon(featureStyle)};
			}
			marker = L.marker(latlng, icon);
		}
		else {
			marker = L.circleMarker(latlng, featureStyle);
		}
		return marker
			.bindPopup(feature.properties.name);
	}
	let layer =
	L.Proj.geoJson (
	//L.geoJSON (
		false, {
		filter,
		onEachFeature,
		pointToLayer,
		style,
	});
	layer.options.name = name;
	if (sldStyle) {
		let SLDStyler = new L.SLDStyler(sldStyle);
		layer.setStyle(SLDStyler.getStyleFunction);
	}
	/*
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
	*/
	if (dataProjection) {
		let crs = new L.Proj.CRS(dataProjection);
		layer.options.latLngToCoords = function(latlng) {
			///console.log('11111', latlng)
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
	
	/*layer.eachLayer(featureInstanceLayer => {
		let style = featureInstanceLayer.feature?.properties?.style;
//console.log('123', featureInstanceLayer, featureInstanceLayer.setStyle, style);
		if (style && featureInstanceLayer.setStyle) {
			featureInstanceLayer?.setStyle(style);
		}
	});*/
	
	return layer;
}

async function addJSON(layer, json, dataProjection='CRS:84', featureProjection='EPSG:3857') {
	layer.addData(json);
}

function makeLayerGroup(data, name) {
	let layerGroup = L.layerGroup();
	layerGroup.options.name = name;
	for (let [name, json] of Object.entries(data)) {
		let layer = makeLayerJSON(name);
		layerGroup.addLayer(layer);
		addJSON(layer, json);
	}
	return layerGroup;
}

function tile_layer(title, url, options) {
	let layer = L.tileLayer(url, options);
	return layer;
}

function osm_layer() {
	let osm = tile_layer(
		'base layer (OSM)',
		'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});
	return osm;
}

function bw_layer() {
	return tile_layer(
		'bw osm',
		'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png', {
		maxZoom: 16,
		attribution: `
			&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>
			&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>
			&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>
		`
	});
}

function build_map(target) {
	let map = L.map(target, {
		// https://leafletjs.com/reference.html#map-zoomsnap
		zoomSnap: 0,
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
	
	L.control.scale({metric: true}).addTo(map);
	
	return map;
}

function build_map1(target='map') {
	let mapdef = 
	//'map'
	document.querySelector('#map')
	;
	let map = L.map(mapdef, {
		// https://leafletjs.com/reference.html#map-zoomsnap
		//zoomSnap: 0,
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
                
            var transparentLayer = new L.geoJSON(null, {
				style: {
					"opacity": 0,
					"fillOpacity": 0.5 // value between 0-1 or 0% - 100%
				}
			});

	
	layerControl.addBaseLayer(openTopoMap, "OpenTopoMap");
	//map.addLayer(osm);
	
	return map;
}


function show_map(map, viewOptions=[]) {
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
//	console.log('calc bounds', bounds?.isValid(), bounds.getCenter());
		if (bounds && bounds.isValid()) {
			map.fitBounds(bounds);
		}
		else {
			map.setView([0, 0], 1);
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

function makeTiledLayer(name, {min_zoom, max_zoom, bounds, imgSizes, fetchTile}) {
	
	let layer = new L.GridLayer({
		noWrap: true,
		//pane: 'overlayPane',
		minZoom: min_zoom,
		maxZoom: max_zoom,
	});
	layer.options.name = name;
	if (bounds) {
		layer.options.bounds = L.latLngBounds(...bounds);
	}
	layer.options.imgSizes = imgSizes;
	layer.options.fetchTile = fetchTile;
	layer.options.emptyCache = {};
	
	//code taken from
	//https://stackoverflow.com/a/70465895/4444742
	const createImage = ({width, height}) => {
		let key = `empty-${width}x${height}`;
		if (!(key in layer.options.emptyCache)) {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			
			const ctx = canvas.getContext('2d');
			ctx.fillStyle = 'rgba(0, 0, 0, 0)';
			ctx.fillRect(0, 0, width, height);
			layer.options.emptyCache[key] = canvas.toDataURL('image/png');
		}
		
		let img = new Image(width, height);
		img.src = layer.options.emptyCache[key];
		img.crossOrigin = "anonymous";
		img.style.outline = '1px solid red';
		
		return img;
	}
	
	layer.createTile = (coords, done) => {
		let timeLabel = `tile_${coords.x},${coords.y},${coords.z}`;
		console.time(timeLabel);
		let error = null;
		let img = createImage(layer.options.imgSizes[coords.z]);
		let timeRetrieve = `tile_${coords.x},${coords.y},${coords.z} retrieve`;
		console.time(timeRetrieve);
		layer.options.fetchTile(coords.x, coords.y, coords.z)
		.then(url => {
		console.timeEnd(timeRetrieve);
			if (url) {
				img.src = url;
				img.addEventListener('load', function() {
					URL.revokeObjectURL(url);
				});
				img.style.outline = '1px solid green';
			}
		})
		.catch(err => {
			error = err;
			console.error(error);
		})
		.finally(() => {
			console.timeEnd(timeLabel);
			done(error, img);
		});
		return img;
	}
	
	return layer;
}

