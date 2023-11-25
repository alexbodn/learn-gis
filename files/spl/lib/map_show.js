
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

const selectHitToleranceElement = document.getElementById('hitTolerance');
const circleCanvas = document.getElementById('circle');

let hitTolerance = 0;

const changeHitTolerance = function () {
	hitTolerance = parseInt(selectHitToleranceElement.value, 10);
	
	const size = 2 * hitTolerance + 2;
	circleCanvas.width = size;
	circleCanvas.height = size;
	const ctx = circleCanvas.getContext('2d');
	ctx.clearRect(0, 0, size, size);
	ctx.beginPath();
	ctx.arc(
		hitTolerance + 1,
		hitTolerance + 1,
		hitTolerance + 0.5,
		0,
		2 * Math.PI
	);
	ctx.fill();
	ctx.stroke();
};

selectHitToleranceElement.onchange = changeHitTolerance;
changeHitTolerance();


function show_map(map, displayProjection) {
	let mapView = new ol.View({
		projection: displayProjection,
		maxZoom: 28,
		minZoom: 1
	});
	let extent = calcExtent(map.getLayers());
	console.log(extent, map.getSize());
	mapView.fit(extent, {
		size: map.getSize(),
		padding: [10, 10, 10, 10],
		constrainResolution: false,
	});
	map.setView(mapView);
	
	let layerSwitcher = new ol.control.LayerSwitcher({
		tipLabel: 'Légende', // Optional label for button
		trash: true,
	});
	map.addControl(layerSwitcher);
	let scaleLine = new ol.control.ScaleLine({
		//units: 'degrees',
		//units: 'imperial',
		units: 'metric',
		bar: true,
	});
	map.addControl(scaleLine);

	function styleOnClick(feature, resolution, dom) {
		let style = commonClickStyle;
		style.getText().setText(feature.get("name"));
		return style;
	}
	
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
				}
			},
			{
				hitTolerance: hitTolerance
			}
		);
	});
	
	function getData(data) {
		console.log(data);
		console.log(data.id);
	}
}

