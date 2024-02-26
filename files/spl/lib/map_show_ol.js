
'use strict';

class DisplayOpenLayers extends DisplayDriver{
	static resource_urls = {
		css: [
			"https://cdn.jsdelivr.net/npm/ol@v8.2.0/ol.css",
			"https://unpkg.com/ol-layerswitcher@4.1.1/dist/ol-layerswitcher.css",
		],
		js: [
			"https://cdn.jsdelivr.net/npm/ol@v8.2.0/dist/ol.js",
			"https://unpkg.com/ol-layerswitcher@4.1.1/dist/ol-layerswitcher.js",
			"./sldreader.js",
//			"./lib/map_show_ol.js",
		],
	};
	
	constructor(target='map') {
		super();
		this._map = this.build_map(target);
		this.commonClickStyle = this.colorStyle('orange');
	}
	
build_map(target='map') {
//	ol.proj.proj4.register(proj4);
	// Create Map canvas and View
	return new ol.Map({
		target: target,
		layers: [],
	});
}

_addLayer(layer) {
	let map = this._map;
	map.addLayer(layer);
}

calcExtent(layers) {
	let extent = ol.extent.createEmpty();
	layers.forEach(layer => {
		try {
			let layerExtent;
			if ('getSource' in layer) {
				let source = layer.getSource();
				try {
					layerExtent = source.getExtent();
				}
				catch(err) {
					layerExtent = source.get('extent');
				}
				//console.log('layer extent', layerExtent, source.getProperties());
			}
			else if ('getLayers' in layer) {
				layerExtent = calcExtent(layer.getLayers());
				//console.log('calculated extent', layerExtent);
			}
			if (layerExtent) {
				ol.extent.extend(extent, layerExtent);
			}
//console.log('xxx', layer, layerExtent);
		}
		catch (err) {
			console.log('layer without extent', err);
		}
	});
//console.log('calc extent', extent);
	return extent;
}

/**
 * @param {object} vectorLayer
 * @param {string} text the xml text
 * apply sld
 */
applySLD(vectorLayer, text) {
	const sldObject = SLDReader.Reader(text);
	// for debugging
	//	window.sldObject = sldObject;
	const sldLayer = SLDReader.getLayer(sldObject);
	const style = SLDReader.getStyle(sldLayer);
	const featureTypeStyle = style.featuretypestyles[0];

	vectorLayer.setStyle(
		SLDReader.createOlStyleFunction(
			featureTypeStyle, {
				imageLoadedCallback: () => {
					// Signal OpenLayers to redraw the layer when an image icon has loaded.
					// On redraw, the updated symbolizer with the correct image scale will be used to draw the icon.
					vectorLayer.changed();
				},
			}
		)
	);
}

static makeLayerJSON(name, id, {sldStyle, style, extent}={}) {
	ol.proj.proj4.register(proj4);
	const vectorSource = new ol.source.Vector({
		extent,
	});
	const vectorLayer = new ol.layer.Vector({
		title: name,
		source: vectorSource,
		style,
	});
	vectorLayer.set('id', id);
	if (sldStyle) {
		this.applySLD(vectorLayer, sldStyle);
	}
	return vectorLayer;
}

static async addJSON(layer, json) {
	const featureProjection = 'EPSG:3857';
	let dataProjection='CRS:84';
	let crsSection = json?.crs;
	if (crsSection?.type === 'name' || crsSection?.properties?.name && !crsSection.type) {
		dataProjection = crsSection.properties.name;
	}
	else if (crsSection?.type) {
		dataProjection = crsSection.type + ':' + crsSection.properties.code;
	}
	const formatJson = new ol.format.GeoJSON();
	let features = formatJson.readFeatures(json, {
		dataProjection, featureProjection
	});
	for (let feature of features) {
		let flatstyle = feature.get('flatstyle');
		if (flatstyle) {
			let fillColor = flatstyle['fill-color'];
			let fillOpacity = flatstyle['fill-opacity'];
			if (fillColor && fillOpacity) {
				flatstyle['fill-color'] = ol.color.asString(
					ol.color.asArray(fillColor)
					.slice(0, 3).concat(fillOpacity));
			}
			let parsingContext = ol.expr.expression.newParsingContext();
			let style = ol.render.canvas.style.buildStyle(flatstyle, parsingContext)();
			feature.setStyle(style);
		}
		//todo do i need copy properties explicitly?
		//features[0].setProperties(features.properties);
	}
	layer.getSource().setProperties({origProjection: dataProjection});
	layer.getSource().addFeatures(features);
}

/**
 * @param {Array} layers 
 * make layerGroup
 */
static makeLayerGroup(layers, name, id) {
	let layerGroup = new ol.layer.Group({
		title: name,
		fold: 'close',
		combined: false,
		layers,
	});
	layerGroup.set('id', id);
	return layerGroup;
}

servedTileLayer(title, url, options) {
	let {attribution, ...rest} = options;
	let source = new ol.source.XYZ({
		url,
		attributions: attribution,
		...rest,
	});
	source.set({
		origProjection: source.projection.code,
	});
	return new ol.layer.Tile({
		title,
		source,
	});
	return layer;
}

colorStyle(mainColor='orange', opacity=0.05) {
	const dimColor = ol.color.asString(
		ol.color.asArray(mainColor).slice(0, 3).concat(opacity));
	return new ol.style.Style({
		stroke: new ol.style.Stroke({
			color: mainColor,
			width: 1,
		}),
		fill: new ol.style.Fill({
			color: dimColor,
		}),
		image: new ol.style.Circle({
			fill: new ol.style.Fill({
				color: dimColor,
			}),
			radius: 6,
			stroke: new ol.style.Stroke({
				color: mainColor,
				width: 1,
			}),
		}),
		text: new ol.style.Text({
			//font: '50px Calibri',
			text: 'your label',
			//placement: 'line',
			fill: new ol.style.Fill({
				color: mainColor
			}),
			stroke: new ol.style.Stroke({
				color: dimColor,
				width: 3
			})
		}),
	});
}

show_map(viewOptions) {
	let map = this._map;
	map.updateSize();
	let center = [0, 0];
	let zoom = 2;
	if (viewOptions && viewOptions.length) {
		[center, zoom] = viewOptions;
	}
	let mapView = new ol.View({
		maxZoom: 28,
		minZoom: 1,
		center,
		zoom,
	});
	let extent = this.calcExtent(map.getLayers());
//	console.log('fit', extent, map.getSize());
	if (!ol.extent.isEmpty(extent)) {
		mapView.fit(extent, {
			size: map.getSize(),
			padding: [10, 10, 10, 10],
			//constrainResolution: false,
		});
	}
	map.setView(mapView);
	
	let layerSwitcher = new ol.control.LayerSwitcher({
		tipLabel: 'Légende', // Optional label for button
		trash: true,
	});
	map.addControl(layerSwitcher);
	/**/
	let scaleLine = new ol.control.ScaleLine({
		//units: 'degrees',
		//units: 'imperial',
		units: 'metric',
		bar: true,
	});
	map.addControl(scaleLine);
	/**/
	
	function styleOnClick(feature, resolution, dom) {
		let style = this.commonClickStyle;
		style.getText().setText(feature.get("name"));
		return style;
	}
	
	/*
	let selectHitTolerance;
	if (hitToleranceSelector) {
		selectHitTolerance = new SelectHitTolerance(hitToleranceSelector);
	}
	*/
	
	map.on('singleclick', (evt) => {
		var coordinates = map.getEventCoordinate(evt.originalEvent);
		//console.log(coordinates);
		//let target = document.getElementById('mouse-position');
		//target.textContent = coordinates;
		
		let hit = false;
		map.forEachFeatureAtPixel(
			evt.pixel,
			(feature, layer) => {
				// getData(feature.getProperties());
				// getData(layer.getProperties());
				if (hit) {
					return;
				}
				if (!feature) {
					feature = layer.getClosestFeatureToCoordinate(coordinates);
				}
				if (feature) {
					feature.setStyle(styleOnClick);
					let source = layer.getSource();
					let layerProjection = source.get('origProjection');
					//let layerCoordinates = ol.proj.fromLonLat(coordinates, layerProjection);
					let layerCoordinates = ol.proj.transform(coordinates, map.getView().getProjection(), layerProjection);
					let target = document.getElementById('mouse-position');
					let stringifyFunc = ol.coordinate.createStringXY(4);
					let out = stringifyFunc(layerCoordinates);
					console.log(layerCoordinates, coordinates);
					target.textContent = out;
					hit = true;
					console.log(feature.get('style'));
				}
			},
			(
				selectHitTolerance ? {
					hitTolerance: selectHitTolerance.hitTolerance,
				} : undefined
			)
		);
	});
	
	function getData(data) {
		console.log(data);
		console.log(data.id);
	}
}

static makeTiledLayer(name, id, {min_zoom, max_zoom, bounds, fetchTile}) {
	
	let extentw = [
		bounds[0].lng,
		bounds[0].lat,
		bounds[1].lng,
		bounds[1].lat,
	];
	let extent = ol.proj.transformExtent(
		extentw, 'EPSG:4326', 'EPSG:3857');
	
	let tileSource = new ol.source.XYZ({
		attributions: '&copy;',
		tileUrlFunction: function(tileCoord) {
			// create a simplified url for use in the tileLoadFunction
			return '';
		},
		tileLoadFunction: async function (tile, src) {
			const coords = tile.getTileCoord();
			let image = tile.getImage();
			let timeLabel = `tile_${[1,2,0].map(c => coords[c]).join(',')}`;
			console.time(timeLabel);
			fetchTile(
				coords[1], coords[2], coords[0],
			)
			.then(url => {
				if (url) {
					image.addEventListener('load', function() {
						URL.revokeObjectURL(url);
					});
					src = url;
					image.crossOrigin = "anonymous";
					image.style.outline = '1px solid green';
				}
			})
			.catch(err => {
				console.error(err);
			})
			.finally(() => {
				image.src = src;
				console.timeEnd(timeLabel);
			});
		}
	});
	tileSource.setProperties({extent});
	let layer = new ol.layer.Tile({
		title: name,
		source: tileSource,
		maxZoom: max_zoom,
		minZoom: min_zoom,
	});
	layer.set('id', id);
	return layer;
}

remove_layer(layerId) {
	let map = this._map;
	map.getLayers().getArray()
		.filter(layer => layer.get('id') === layerId)
		.forEach(layer => map.removeLayer(layer));
}
};

