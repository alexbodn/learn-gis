
import SPL from '../dist/index.js';

async function build_source(db, tableInfo, displayProjection) {
	let table_name = tableInfo.table_name;
	let tableDataProjection = tableInfo.srs_id;
	// Check if we have a definition for the data projection (SRS)
	if (!ol.proj.get(tableDataProjection)) {
		throw new Error("Missing data projection [" +
			tableDataProjection + '] for table "' + table_name +
			'" - can be added beforehand with ol/proj/proj4');
	}
	
	let vectorSource = new ol.source.Vector();
	let geometry_column_name = tableInfo.geometry_column_name;
	let label = `select ${table_name}`;
	console.time(label);
	let allProperties = await db.exec(`
		SELECT *
		FROM [${table_name}]
	`).get.objs;
	console.timeEnd(label);
	
	label = `source ${table_name}`;
	console.time(label);
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
		if (geomProp.hasOwnProperty('coordinates')) {
			features = formatJson.readFeatures(geomProp);
		}
		else {
			if (geomProp.constructor == ArrayBuffer) {
				geomProp = new Uint8Array(geomProp);
			}
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
	
	// For information only, save details of original projection (SRS)
	vectorSource.setProperties({origProjection: tableDataProjection});
	console.timeEnd(label);
	
	return vectorSource;
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

function init_sql() {
	let pragmas = `
		PRAGMA foreign_keys = 1;
		PRAGMA recursive_triggers = 1;`;
	let gpkg = `
		SELECT
			EnableGpkgAmphibiousMode(),
			AutoGPKGStart(),
			--enablegpkgmode(),
			--AutoGPKGStop(),
			''
			WHERE EXISTS (
				SELECT 1
				FROM sqlite_schema
				WHERE name LIKE 'gpkg_contents'
			);`;
	let init = `
		SELECT initspatialmetadatafull(1);
		SELECT PROJ_SetDatabasePath('/proj/proj.db'); -- set proj.db path
		`;
	return pragmas + gpkg + init;
}

async function spl_db() {
	const spl = await SPL(
		{
			autoGeoJSON: 0 ? false : {
				precision: 6,
				options: 0,
			},
		},
		[],
	);
	//console.log('spl loaded');
	
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
			.read(init_sql(true));
	//console.log('db loaded', db);
	
	return db;
}

function fetchAll(urls, method='text', options={}) {
	return Promise.all(
		urls.map(url => fetch(url)
			.then(r => r[method]())
			.then(data => ({ data, url, ...options }))
			.catch(error => ({ error, url, ...options }))
		)
	)
}

async function spl_loadgpkg(gpkgUrl, fileName) {
	const spl = await SPL(
		{
			autoGeoJSON: 0 ? false : {
				precision: 6,
				options: 0,
			},
		},
		[],
	);
	//console.log('spl loaded');
	
	let gpkgArrayBuffer, projdbArrayBuffer;
	const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString();
	console.time('fetching gpkgs');
	let urls = [projdbUrl];
	if (gpkgUrl && fileName) {
		urls.push(gpkgUrl);
	}
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
	console.timeEnd('fetching gpkgs');
	
	let db = spl
		.mount('proj', [
			{ name: 'proj.db', data: projdbArrayBuffer }
		]);
	if (gpkgUrl && fileName) {
		await db.mount('data', [
			{ name: fileName, data: gpkgArrayBuffer }
		]);
	}
	db = 
	//spl.db()
	//	.load(`file:data/${fileName}?immutable=1`)
	spl.db(gpkgArrayBuffer)
		.read(init_sql());
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
			CASE WHEN organization IS NULL THEN
			'EPSG:'||cast(gpkg_contents.srs_id as text)
			ELSE
			organization||':'||organization_coordsys_id
			END
			AS srs_id,
			min_x, min_y, max_x, max_y, 
			gpkg_geometry_columns.column_name as geometry_column_name,
			geometry_type_name
		FROM gpkg_contents
		INNER JOIN gpkg_geometry_columns
			ON gpkg_contents.table_name=gpkg_geometry_columns.table_name
		LEFT OUTER JOIN gpkg_spatial_ref_sys
			ON gpkg_spatial_ref_sys.srs_id=gpkg_contents.srs_id
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
		let tableDataProjection = tableInfo.srs_id;
		
		tableInfo.vectorSource = await build_source(db, tableInfo, displayProjection);
		if (table_name in sldsFromGpkg) {
			tableInfo.style = sldsFromGpkg[table_name];
		}
	}
	
	return featureTable;
}

function extent_feature(tableInfo) {
	return {
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
}

function extent_layer(tableInfo, displayProjection) {
	let table_name = tableInfo.table_name;
	let tableDataProjection = tableInfo.srs_id;
	const extentObject = extent_feature(tableInfo);
console.log(
	'extents',
	extentObject.geometry.coordinates[0],
	tableInfo.vectorSource.getExtent()
);
	const formatJson = new ol.format.GeoJSON({
			dataProjection: tableDataProjection,
			featureProjection: displayProjection,
		});
	const extentSource = new ol.source.Vector({
		features: formatJson.readFeatures(extentObject),
	});
	extentSource.setProperties({
		origProjection: tableDataProjection
	});
	
	const extentLayer = new ol.layer.Vector({
		title: `extent ${table_name}`,
		source: extentSource,
	});
	
	if ('style' in tableInfo) {
		applySLD(extentLayer, tableInfo.style);
	}
	return extentLayer;
}

function osm_layer() {
	let sourceOSM = new ol.source.OSM({
		tileLoadFunction: function(imageTile, src) {
			imageTile.getImage().src = src;
		}
	});
	sourceOSM.set({
		origProjection: sourceOSM.projection.code,
	});
	return new ol.layer.Tile({
		title: 'base layer (OSM)',
		source: sourceOSM,
	});
}

function build_map(target='map') {
	// Create Map canvas and View
	return new ol.Map({
		target: target,
		layers: [],
	});
}

async function gpkg_layers(db, displayProjection) {
	let vectorLayers = [];
	// For each table, extract geometry and other properties
	let featureTable = await read_gpkg(db, displayProjection);
	// (Note: becomes OpenLayers-specific from here)
	for (let tableInfo of featureTable) {
		let table_name = tableInfo.table_name;
		let tableDataProjection = tableInfo.srs_id;
		
		let label = `layer ${table_name}`;
		console.time(label);
		const vectorLayer = new ol.layer.Vector({
			title: table_name,
			source: tableInfo.vectorSource,
			//style: colorStyle(),
		});
		console.timeEnd(label);
		
		if ('style' in tableInfo) {
			applySLD(vectorLayer, tableInfo.style);
		}
		vectorLayers.push(vectorLayer);
		vectorLayers.push(extent_layer(tableInfo, displayProjection));
	}
	
	return vectorLayers;
}

function lines_features(data) {
	let segments = data.features;
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
	let linesFeatures = {};
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
		linesFeatures[branch] = features;
	}
	return linesFeatures;
}

function handleLines({data, projection, map, displayProjection}) {
	let linesFeatures = lines_features(data);
	const formatJson = new ol.format.GeoJSON({
		featureProjection: displayProjection,
	});
	let linesProjection = projection;
	for (let [branch, features] of Object.entries(linesFeatures)) {
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

function handleStations({data, projection, map, displayProjection}) {
	const formatJson = new ol.format.GeoJSON({
		featureProjection: displayProjection,
	});
	const vectorSource = new ol.source.Vector({
		features: formatJson.readFeatures(data),
	});
	vectorSource.setProperties({origProjection: projection});
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
		let projection = 
			(response.data?.crs?.properties?.name) || 'CRS:84';
		files[response.data.name] = {...response, projection};
	}
	handleLines(files.tfl_lines);
	handleStations(files.tfl_stations);
}

//const url = 'https://data.london.gov.uk/download/london_boroughs/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/london_boroughs.gpkg'
const url = new URL('./test/files/dbs/london.gpkg', window.location.href).toString();
//const url = new URL('./test/files/dbs/Natural_Earth_QGIS_layers_and_styles.gpkg', window.location.href).toString();
// Map View Projection
const displayProjection = 'EPSG:3857';


async function london_gpkg(map) {
	let db = await spl_loadgpkg(url, 'london_boroughs.gpkg');
	let layers = await gpkg_layers(db, displayProjection);
	for (let layer of layers) {
		map.addLayer(layer);
	}
	
	let jsonUrls = [
		'tfl_lines.json',
		'tfl_stations.json',
	].map(file => new URL(`./test/files/dbs/${file}`, window.location.href).toString());
	await fetchAll(jsonUrls, 'json', {map, displayProjection}).then(handleJson);
	
	return db;
}

let map = build_map('map');
map.addLayer(osm_layer());

//let db = await london_gpkg(map);
let db = await spl_db();


show_map(map, displayProjection, "#hit-tolerance");

let sqlConsole = new SQLQuery('div#sqlQuery', db, undefined, map);
sqlConsole.addSnippets({
	spatiaLiteVersion: `
		SELECT spatialite_version()`,
	projVersion: `
		SELECT proj_version()`,
	gpkg_contents: `
		SELECT *
		FROM gpkg_contents`,
	transform_point: `
		with icons as $(pinpng)
		select 
		--aswkt (
		st_transform(
		st_transform(
		MakePoint (-22562.401432422717, 6730934.887787993, 3857)
		, 27700)
		, 3857)
		--)
		as feature,
		flatstyle
		from icons
		`,
	gpkg_spatial_ref_sys: `
		select *
		from gpkg_spatial_ref_sys;`,
});
