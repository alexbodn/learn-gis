
/*
import {ol} from './lib/build/ol/index.js';
import * as LayerSwitcher from './lib/ol-layerswitcher.js';
import * as SLDReader from './sld/sldreader.js';
*/
import SPL from './dist/index.js';

async function build_source(tableInfo, displayProjection) {
	let table_name = tableInfo.table_name;
	let tableDataProjection = 'EPSG:' + tableInfo.srs_id;
	// Check if we have a definition for the data projection (SRS)
	if (!ol.proj.get(tableDataProjection)) {
		throw new Error("Missing data projection [" +
			tableDataProjection + '] for table "' + table_name +
			'" - can be added beforehand with ol/proj/proj4');
	}
	
	let vectorSource = new ol.source.Vector();
	let geometry_column_name = tableInfo.geometry_column_name;
	let allProperties = await db.exec(`
		SELECT *
		FROM [${table_name}]
	`).get.objs;
	
	let features;
	const formatWKB = new ol.format.WKB();
	const formatJson = new ol.format.GeoJSON({
		dataProjection: tableDataProjection,
		featureProjection: displayProjection,
	});
	for (let properties of allProperties) {
		// Extract properties & geometry for a single feature
		let geomProp = properties[geometry_column_name];
		delete properties[geometry_column_name];
		if (geomProp && typeof geomProp === 'object' && geomProp.constructor === Object) {
			features = formatJson.readFeatures(geomProp);
		}
		else {
			let featureWkb = parseGpkgGeom(geomProp);
			/*
			// DEBUG: show endianness of WKB data (can differ from header)
			if (!vectorSource.getFeatures().length) {
				console.log('WKB Geometry: ' +
					(featureWkb[0] ? 'NDR (Little' : 'XDR (Big') + ' Endian)');
			}
			*/
			// Put the feature into the vector source for the current table
			features = formatWKB.readFeatures(featureWkb, {
				dataProjection: tableDataProjection,
				featureProjection: displayProjection
			});
		}
		features[0].setProperties(properties);
		vectorSource.addFeatures(features);
	}
	
	// For information only, save details of	original projection (SRS)
	vectorSource.setProperties({origProjection: tableDataProjection});
	
	return vectorSource;
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

/**
 * Extract (SRS ID &) WKB from an OGC GeoPackage feature
 * (i.e. strip off the variable length header)
 * @param {object} gpkgBinGeom feature geometry property (includes header)
 * @returns feature geometry in WKB (Well Known Binary) format
 */
function parseGpkgGeom(gpkgBinGeom) {
	var flags = gpkgBinGeom[3];
	var eFlags = (flags >> 1) & 7;
	var envelopeSize;
	switch (eFlags) {
		case 0:
			envelopeSize = 0;
			break;
		case 1:
			envelopeSize = 32;
			break;
		case 2:
		case 3:
			envelopeSize = 48;
			break;
		case 4:
			envelopeSize = 64;
			break;
		default:
			throw new Error("Invalid geometry envelope size flag in GeoPackage");
	}
/*
	// Extract SRS (EPSG code)
	// (not required as given for whole table in gpkg_contents table)
	var littleEndian = flags & 1;
	var srs = gpkgBinGeom.subarray(4,8);
	var srsId;
	if (littleEndian) {
		srsId = srs[0] + (srs[1]<<8) + (srs[2]<<16) + (srs[3]<<24);
	} else {
		srsId = srs[3] + (srs[2]<<8) + (srs[1]<<16) + (srs[0]<<24);
	}
*/
/*
	// DEBUG: display other properties of the feature
	console.log('gpkgBinGeom Header: ' + (littleEndian ? 'Little' : 'Big')
		+ ' Endian');
	console.log("gpkgBinGeom Magic: 0x${gpkgBinGeom[0].toString(16)}${gpkgBinGeom[1].toString(16)}");
	console.log("gpkgBinGeom Version:", gpkgBinGeom[2]);
	console.log("gpkgBinGeom Flags:", flags);
	console.log("gpkgBinGeom srs_id:", srsId);
	console.log("gpkgBinGeom envelope size (bytes):", envelopeSize);
*/
	// Extract WKB which starts after variable-size "envelope" field
	var wkbOffset = envelopeSize + 8;
	return gpkgBinGeom.subarray(wkbOffset);
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

	vectorLayer.setStyle(SLDReader.createOlStyleFunction(featureTypeStyle, {
	imageLoadedCallback: () => {
		// Signal OpenLayers to redraw the layer when an image icon has loaded.
		// On redraw, the updated symbolizer with the correct image scale will be used to draw the icon.
		vectorLayer.changed();
	},
	}));
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

async function spl_db() {
	const spl = await SPL();
	console.log('spl loaded');
	
	const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString() 
	const projdbArrayBuffer = await fetch(projdbUrl)
		.then(response => response.arrayBuffer())
		.catch(error => {console.error(error)})
		;
	console.log('projdb fetched', projdbArrayBuffer);
	
	const db = await spl
		.mount('proj', [
						{ name: 'proj.db', data: projdbArrayBuffer }
				])
				.db()
						.read(`
								--SELECT enablegpkgmode();
				SELECT EnableGpkgAmphibiousMode();
				SELECT AutoGPKGStart();
				--SELECT AutoGPKGStop();
								SELECT initspatialmetadata(1);
								SELECT PROJ_SetDatabasePath('/proj/proj.db'); -- set proj.db path
						`);
	console.log('db loaded', db);
	
	return db;
}

function fetchAll(urls, method='text') {
	return Promise.all(
		urls.map(url => fetch(url)
			.then(r => r[method]())
			.then(data => ({ data, url }))
			.catch(error => ({ error, url }))
		)
	)
}

async function spl_loadgpkg(gpkgUrl) {
	const spl = await SPL(
		[],
		{
			autoGeoJSON: {
				precision: 6,
				options: 0,
			},
		},
	);
	console.log('spl loaded');
	
	let gpkgArrayBuffer, projdbArrayBuffer;
	const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString();
	console.time('fetching');
	if (1) {
	let urls = [projdbUrl, gpkgUrl];
	await fetchAll(urls, 'arrayBuffer').then(responses => {
		for (let response of responses) {
			if (response.url == projdbUrl) {
				projdbArrayBuffer = response.data;
			}
			if (response.url == gpkgUrl) {
				gpkgArrayBuffer = response.data;
			}
		}
	});
	}
	else {
	projdbArrayBuffer = await fetch(projdbUrl)
		.then(response => response.arrayBuffer())
		.catch(error => {console.error(error)})
		;
	console.log('projdb fetched');
	
	gpkgArrayBuffer = await fetch(gpkgUrl)
		.then(response => response.arrayBuffer())
		.catch(error => {console.error(error)})
		;
	console.log('london fetched');
	}
	console.timeEnd('fetching');
	
	const db = spl
		.mount('proj', [
			{ name: 'proj.db', data: projdbArrayBuffer }
		])
		.mount('data', [
			{ name: 'london_boroughs.gpkg', data: gpkgArrayBuffer }
		])
		//.db()
		//	.load('file:data/london_boroughs.gpkg?immutable=1')
		.db(gpkgArrayBuffer)
			.read(`
				--SELECT enablegpkgmode();
				SELECT EnableGpkgAmphibiousMode();
				SELECT AutoGPKGStart();
				--SELECT AutoGPKGStop();
				SELECT initspatialmetadata(1);
				SELECT PROJ_SetDatabasePath('/proj/proj.db'); -- set proj.db path
			`);
	//console.log('db loaded', db);
	
	return db;
}

async function read_gpkg(db, displayProjection) {
	// Data and associated SLD styles loaded both from GPKG
	var dataFromGpkg = {};
	var sldsFromGpkg = {};
	
	// Extract all feature tables, SRS IDs and their geometry types
	// Note the following fields are not extracted:
	//	 gpkg_contents.identifier - title (QGIS: same as table_name)
	//	 gpkg_contents.description - human readable (QGIS: blank)
	//	 gpkg_geometry_columns.geometry_type_name
	//	 - e.g. LINESTRING (but info also embedded in each feature)
	let featureTable = await db.exec(`
		SELECT
			gpkg_contents.table_name, 
			cast(gpkg_contents.srs_id as text) as srs_id,
			min_x, min_y, max_x, max_y, 
			gpkg_geometry_columns.column_name as geometry_column_name,
			geometry_type_name
		FROM gpkg_contents
		INNER JOIN gpkg_geometry_columns
			ON gpkg_contents.table_name=gpkg_geometry_columns.table_name
		WHERE gpkg_contents.data_type='features'
	`).get.objs;
	
	let projections = await db.exec(`
		SELECT
			organization||':'||organization_coordsys_id as srs,
			definition
		FROM gpkg_spatial_ref_sys
		WHERE srs_id>0 AND srs_id NOT IN (4326, 3857);
	`).get.rows;
	proj4.defs(projections);
	// Make non-built-in projections defined in proj4 available in OpenLayers.
	// (must be done before GeoPackages are loaded)
	ol.proj.proj4.register(proj4);
	
	// Extract SLD styles for each layer (if styles included in the gpkg)
	let has_layer_styles = await db.exec(`
		SELECT count(*)
		FROM gpkg_contents
		WHERE table_name='layer_styles'
	`).get.first;
	//console.log(has_layer_styles);
	if (has_layer_styles) {
		let layer_styles = await db.exec(`
			SELECT f_table_name, styleSLD
			FROM layer_styles`).get.objs;
		for (let row of layer_styles) {
			sldsFromGpkg[row.f_table_name] = row.styleSLD;
		}
	}
	
	// For each table, extract geometry and other properties
	// (Note: becomes OpenLayers-specific from here)
	for (let tableInfo of featureTable) {
		let table_name = tableInfo.table_name;
		let tableDataProjection = 'EPSG:' + tableInfo.srs_id;
		
		tableInfo.vectorSource = await build_source(tableInfo, displayProjection);
		if (table_name in sldsFromGpkg) {
			tableInfo.style = sldsFromGpkg[table_name];
		}
	}
	
	return featureTable;
}

async function build_map(db, displayProjection) {
	let featureTable = await read_gpkg(db, displayProjection);
	// Create Map canvas and View
	let map = new ol.Map({
		target: 'map',
		layers: [
			new ol.layer.Tile({
				title: 'base layer (OSM)',
				source: new ol.source.OSM()
			}),
		],
	});
	
	// For each table, extract geometry and other properties
	// (Note: becomes OpenLayers-specific from here)
	for (let tableInfo of featureTable) {
		let table_name = tableInfo.table_name;
		let tableDataProjection = 'EPSG:' + tableInfo.srs_id;
		
		//let vectorSource = dataFromGpkg[table_name];
		const vectorLayer = new ol.layer.Vector({
			title: table_name,
			source: tableInfo.vectorSource,
			//style: colorStyle(),
		});
		
		const formatJson = new ol.format.GeoJSON({
				dataProjection: tableDataProjection,
				featureProjection: displayProjection,
			});
		const extentObject = {
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[tableInfo.min_x, tableInfo.min_y],
						[tableInfo.max_x, tableInfo.min_y],
						[tableInfo.max_x, tableInfo.max_y],
						[tableInfo.min_x, tableInfo.max_y],
						[tableInfo.min_x, tableInfo.min_y],
					],
				],
			},
		};
		const extentSource = new ol.source.Vector({
			features: formatJson.readFeatures(extentObject),
		});
		extentSource.setProperties({
			origProjection: tableDataProjection});
		const extentLayer = new ol.layer.Vector({
			title: `extent ${table_name}`,
			source: extentSource,
		});
		
		if ('style' in tableInfo) {
			applySLD(extentLayer, tableInfo.style);
			applySLD(vectorLayer, tableInfo.style);
		}
		map.addLayer(extentLayer);
		map.addLayer(vectorLayer);
	}
	
	return map;
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

let commonClickStyle = colorStyle('orange');

function show_map(map) {
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

function handleLines(tfl_lines) {
	const formatJson = new ol.format.GeoJSON({
		featureProjection: displayProjection,
	});
	let linesProjection = tfl_lines.projection;
	let segments = tfl_lines.data.features;
	let index = segments.reduce((a, b) => {a[b.properties.id] = b; return a;}, {});
	let features = {
		inactive: {},
		regular: {},
		special: {},
	};
	var thisYear = (new Date()).getUTCFullYear()
	//group features by line name
	for (let segment of segments) {
		for (let line of segment.properties.lines) {
			let branch;
			let inactive =
				'opened' in line && line.opened > thisYear ||
				'closed' in line && line.closed <= thisYear;
			if (inactive) {
				branch = features.inactive;
			}
			else if ('name' in line && 'start_sid' in line && 'end_sid' in line) {
				branch = features.regular;
			}
			else {
				branch = features.special;
			}
			if (!(line.name in branch)) {
				branch[line.name] = [];
			}
			branch[line.name].push({...line, id: segment.properties.id});
		}
	}
	for (let [branch, contents] of Object.entries(features)) {
		let features = [];
		for (let [line, segments] of Object.entries(contents)) {
			let coordinates = contents[line].map(
				sgmnt => index[sgmnt.id].geometry.coordinates
			);
			features.push({
				type: "Feature",
				properties: {name: line,},
				geometry: {
					coordinates: coordinates,
					type: 'MultiLineString',
				},
			});
		}
		let layers = features.map(feature => {
			const vectorSource = new ol.source.Vector({
				features: formatJson.readFeatures(feature),
			});
			vectorSource.setProperties({origProjection: linesProjection});
			const vectorLayer = new ol.layer.Vector({
				title: feature.properties.name,
				source: vectorSource,
				//style: styleFunction,
			});
			return vectorLayer;
		});
		let layerGroup = new ol.layer.Group({
			title: `tfl_lines ${branch}`,
			fold: 'close',
			combined: false,
			layers,
		});
		map.addLayer(layerGroup);
	}
}

function handleStations(tfl_stations) {
	const formatJson = new ol.format.GeoJSON({
		featureProjection: displayProjection,
	});
	let stationsProjection = tfl_stations.projection;
	const vectorSource = new ol.source.Vector({
		features: formatJson.readFeatures(tfl_stations.data),
	});
	vectorSource.setProperties({origProjection: stationsProjection});
	const vectorLayer = new ol.layer.Vector({
		title: 'tfl_stations',
		source: vectorSource,
		//style: styleFunction,
	});
	map.addLayer(vectorLayer);
}

function handleJson(responses) {
	let files = {};
	for (let response of responses) {
		let sourceProjection = 
			(response.data?.crs?.properties?.name) || 'CRS:84';
		files[response.data.name] = {
			data: response.data,
			projection: sourceProjection,
		};
	}
	handleLines(files.tfl_lines);
	handleStations(files.tfl_stations);
}

//const url = 'https://data.london.gov.uk/download/london_boroughs/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/london_boroughs.gpkg'
const url = new URL('./test/files/dbs/london.gpkg', window.location.href).toString();
//const url = new URL('./test/files/dbs/Natural_Earth_QGIS_layers_and_styles.gpkg', window.location.href).toString();
// Map View Projection
const displayProjection = 'EPSG:3857';

let db = await spl_loadgpkg(url);
//let db = await spl_db();
//console.log('db', db);

let map = await build_map(db, displayProjection);

	let urls = [
		'tfl_lines.json',
		'tfl_stations.json',
		//'London_Train_Lines.json',
		//'London_stations.json',
	].map(file => new URL(`./test/files/dbs/${file}`, window.location.href).toString());
	await fetchAll(urls, 'json').then(handleJson);

show_map(map);

window.sqlConsole = new SQLQuery('div#sqlQuery', db, 'sqlConsole');
window.sqlConsole.addSnippets({
	spatiaLiteVersion: `
		SELECT spatialite_version()`,
	projVersion: `
		SELECT proj_version()`,
	gpkg_contents: `
		SELECT *
		FROM gpkg_contents`,
	transform_point: `
		select 
		--aswkt (
		st_transform(
		st_transform(
		MakePoint (-22562.401432422717, 6730934.887787993, 3857)
		, 27700)
		, 3857)
		--)`,
	gpkg_spatial_ref_sys: `
		select *
		from gpkg_spatial_ref_sys;`,
});
