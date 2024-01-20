
'use strict';

class SelectHitTolerance {
	formCode = `
		<form>
			<label>
				Hit tolerance for selecting features:
				<br />Area: &nbsp;
				<canvas class="circle" width="22" height="22" style="vertical-align: middle;"></canvas>
				&nbsp;
				<select class="hitTolerance">
					<option value="0" selected>0 Pixels</option>
					<option value="5">5 Pixels</option>
					<option value="10">10 Pixels</option>
				</select>
			</label>
		</form>
		`;
	hitTolerance = 0;
	
	constructor(formElem) {
		this.formElem = document.querySelector(formElem);
		this.formElem.textContent = '';
		this.formElem.insertAdjacentHTML('beforeend', this.formCode);
		this.selectHitTolerance = this.formElem.querySelector('.hitTolerance');
		this.circleCanvas = this.formElem.querySelector('.circle');
		this.selectHitTolerance.addEventListener('change', e => {this.changeHitTolerance();});
		this.changeHitTolerance();
	}
	
	changeHitTolerance() {
		this.hitTolerance = parseInt(
			this.selectHitTolerance.value, 10);
		
		const size = 2 * this.hitTolerance + 2;
		this.circleCanvas.width = size;
		this.circleCanvas.height = size;
		const ctx = this.circleCanvas.getContext('2d');
		ctx.clearRect(0, 0, size, size);
		ctx.beginPath();
		ctx.arc(
			this.hitTolerance + 1,
			this.hitTolerance + 1,
			this.hitTolerance + 0.5,
			0,
			2 * Math.PI
		);
		ctx.fill();
		ctx.stroke();
	}
};

function build_map(target='map') {
//	ol.proj.proj4.register(proj4);
	// Create Map canvas and View
	return new ol.Map({
		target: target,
		layers: [],
	});
}

function calcExtent(layers) {
	let extent = ol.extent.createEmpty();
	layers.forEach(layer => {
		try {
			let layerExtent;
			if ('getSource' in layer) {
				let source = layer.getSource();
				layerExtent = source.getExtent();
				//console.log('layer extent', layerExtent, source.getProperties());
			}
			else if ('getLayers' in layer) {
				layerExtent = calcExtent(layer.getLayers());
				//console.log('calculated extent', layerExtent);
			}
			if (layerExtent) {
				ol.extent.extend(extent, layerExtent);
			}
		}
		catch (err) {
			console.log('layer without extent', err);
		}
	});
	return extent;
}

/**
 * @param {object} vectorLayer
 * @param {string} text the xml text
 * apply sld
 */
function applySLD(vectorLayer, text) {
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

function makeLayerJSON(name, {sldStyle, style}={}) {
	ol.proj.proj4.register(proj4);
	const vectorSource = new ol.source.Vector();
	const vectorLayer = new ol.layer.Vector({
		title: name,
		source: vectorSource,
		style,
	});
	if (sldStyle) {
		applySLD(vectorLayer, sldStyle);
	}
	return vectorLayer;
}

function addJSON(layer, json, dataProjection='CRS:84', featureProjection='EPSG:3857') {
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
	}
	//todo do i need copy properties explicitly?
	//features[0].setProperties(features.properties);
	layer.getSource().setProperties({origProjection: dataProjection});
	layer.getSource().addFeatures(features);
}

function makeLayerGroup(data, name) {
	let layerGroup = new ol.layer.Group({
		title: name,
		fold: 'close',
		combined: false,
	});
	for (let [name, json] of Object.entries(data)) {
		let layer = makeLayerJSON(json, name);
		layerGroup.addLayer(layer);
	}
	return layerGroup;
}

function colorStyle(mainColor='orange', opacity=0.05) {
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

let commonClickStyle = colorStyle('orange');

function show_map(map, displayProjection, hitToleranceSelector) {
	let mapView = new ol.View({
		projection: displayProjection,
		maxZoom: 28,
		minZoom: 1,
		center: [0, 0],
		zoom: 2,
	});
	let extent = calcExtent(map.getLayers());
	console.log(extent, map.getSize());
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
		let style = commonClickStyle;
		style.getText().setText(feature.get("name"));
		return style;
	}
	
	let selectHitTolerance = new SelectHitTolerance(hitToleranceSelector);
	
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
			{
				hitTolerance: selectHitTolerance.hitTolerance,
			}
		);
	});
	
	function getData(data) {
		console.log(data);
		console.log(data.id);
	}
}

