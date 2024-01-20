
'use strict';

import SPL from '../dist/index.js';

async function load_features(db, tableInfo, target_srs) {
	let tableDataProjection = tableInfo.srs_code;
	let table_name = tableInfo.table_name;
	
	let geometry_columns = tableInfo.geometry_columns;
	let label = `select ${table_name}`;
	console.time(label);
	let colnames = await db.exec(`
		SELECT name
		FROM pragma_table_info('${table_name}')
	`).get.flat;
	
	let geometryColumns = geometry_columns
		.reduce((a, b) => {
			a[b.column_name] = {
				srs_id: b.srs_id,
				srs_code: b.srs_code,
			};
			return a;
		}, {});
	
	if (!target_srs) {
		if (geometry_columns.length > 1) {
			for (let c in geometry_columns) {
				if (c > 0 && geometry_columns[c].srs_id !== geometry_columns[0].srs_id) {
					target_srs = {
						srs_code: tableInfo.srs_code,
						srs_id: tableInfo.srs_id,
					};
				}
			}
		}
		else {
			target_srs = geometry_columns[0];
		}
	}
	
	let selectColumns = colnames
		.map(name => {
			let prefix = '';
			if (
				name in geometryColumns &&
				geometryColumns[name].srs_id !== target_srs.srs_id
			) {
				prefix = `
					asgeojson(
					st_transform(
						[${name}],
						${target_srs.srs_id}
					)
					)
					as `;
			}
			return prefix + `[${name}]`;
		})
		.join(', ');
	let sqlData = await db.exec(`
		SELECT ${selectColumns}
		FROM [${table_name}]
	`).get.objs;
	console.timeEnd(label);
	
	let propertyColumns = colnames
		.filter(name => !(name in geometryColumns));
	
	let features = [];
	for (let sqlRow of sqlData) {
		for (let [column_name, srs] of Object.entries(geometryColumns)) {
			// Extract properties & geometry for a single feature
			let properties = propertyColumns
				.reduce((a, b) => {
					a[b] = sqlRow[b];
					return a;
				}, {
					origProjection: srs.srs_code
				});
			let feature = {
				type: 'Feature',
				properties: properties,
				geometry: sqlRow[column_name],
			};
			features.push(feature);
		}
	}
	let collection = {
		type: 'FeatureCollection',
		crs: {
			type: "name",
			properties: {
				name: target_srs.srs_code
			}
		},
		features: features,
	};
	
	return collection;
}

async function read_gpkg(db, target_srs) {
	// table associated SLD styles loaded from GPKG
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
			AS srs_code,
			gpkg_contents.srs_id
		FROM gpkg_contents
		LEFT OUTER JOIN gpkg_spatial_ref_sys
			ON gpkg_spatial_ref_sys.srs_id=gpkg_contents.srs_id
		WHERE gpkg_contents.data_type='features'
	`).get.objs;
	
	let featureColumns = await db.exec(`
		SELECT
			table_name,
			column_name,
			CASE WHEN organization IS NULL
			THEN
			'EPSG:'||cast(gpkg_geometry_columns.srs_id as text)
			ELSE
			organization||':'||cast(organization_coordsys_id as text)
			END
			AS srs_code,
			gpkg_geometry_columns.srs_id
		FROM gpkg_geometry_columns
		LEFT OUTER JOIN gpkg_spatial_ref_sys
			ON gpkg_spatial_ref_sys.srs_id=gpkg_geometry_columns.srs_id
	`).get.objs
		.then(objs => {
			return objs.reduce((a, b) => {
				if (!(b.table_name in a)) {
					a[b.table_name] = [];
				}
				a[b.table_name].push({
					column_name: b.column_name,
					srs_id: b.srs_id,
					srs_code: b.srs_code,
				});
				return a;
			}, {});
		});
	
	for (let tableInfo of featureTable) {
		if (tableInfo.table_name in featureColumns) {
			tableInfo.geometry_columns = featureColumns[tableInfo.table_name];
		}
	}
	
	let projections = await db.exec(`
		SELECT
			organization||':'||cast(organization_coordsys_id as text) as srs,
			definition
		FROM gpkg_spatial_ref_sys
		WHERE srs_id>0 AND srs_id NOT IN (4326, 3857);
	`).get.rows;
	//todo run this with each loaded geojson
	console.log(3333, projections);
	proj4.defs(projections);
	
	// Extract SLD styles for each layer (if styles included in the gpkg)
	let has_layer_styles = await db.exec(`
		SELECT count(*)
		FROM gpkg_contents
		WHERE table_name='layer_styles'
	`).get.first;
	//console.log('has_layer_styles', has_layer_styles);
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

		tableInfo.features = await load_features(
			db, tableInfo, target_srs);
		if (table_name in sldsFromGpkg) {
			tableInfo.style = sldsFromGpkg[table_name];
		}
	}
	
	return featureTable;
}

function init_sql(projFile) {
	let pragmas = `
		PRAGMA foreign_keys = 1;
		PRAGMA recursive_triggers = 1;`;
	let gpkg = `
		/**/
		SELECT EnableGpkgAmphibiousMode()
		WHERE getgpkgmode()=0;
		SELECT enablegpkgmode()
		WHERE GetGpkgAmphibiousMode()=0;
		/**/
		SELECT
			AutoGPKGStart(),
			--AutoGPKGStop(),
			''
			WHERE EXISTS (
				SELECT 1
				FROM sqlite_schema
				WHERE name LIKE 'gpkg_contents'
			);`;
	let init = `
		SELECT initspatialmetadatafull(1);
		SELECT PROJ_SetDatabasePath('${projFile}'); -- set proj.db path
		`;
	return pragmas + gpkg + init;
}

async function spl_db() {
	const spl = await SPL(
		{
			autoGeoJSON: 0 ? false : {
				precision: 15,
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
			.read(init_sql('/proj/proj.db'));
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

async function fetchMounts(urlsInfo) {
	let promises = [];
	let mounts = {};
	for (let info of urlsInfo) {
		let promise = fetch(info.url)
			.then(response => {
				let method = info.method || 'text';
				return response[method]();
			})
			.then(data => {
				mounts[info.point] = {data, name: info.filename};
				return {data, ...info};
			})
			.catch(error => ({error, url, ...info}))
			;
		promises.push(promise);
	}
	return Promise.all(promises).then(() => mounts);
}

async function spl_loadgpkg(gpkgUrl, fileName) {
	const spl = await SPL(
		{
			autoGeoJSON: 0 ? false : {
				//precision: 6,
				options: 0,
			},
		},
		[],
	);
	//console.log('spl loaded');
	console.time('fetching gpkgs');
	const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString();
	let mountUrls = [
		{url: projdbUrl, point: 'proj', filename: 'proj.db', method: 'arrayBuffer'}
	];
	if (gpkgUrl && fileName) {
		mountUrls.push({url: gpkgUrl, point: 'data', filename: fileName, method: 'arrayBuffer'});
	}
	let mounts = await fetchMounts(mountUrls);
	console.timeEnd('fetching gpkgs');
	console.time('mounting gpkgs');
	for (let [point, info] of Object.entries(mounts)) {
		spl.mount(point, [info]);
	}
	let db;
	
	if (fileName) {
		if (0) {
		db = await spl.db()
			.load(`file:data/${fileName}?immutable=1`)
		}
		else {
		db = await spl.db(mounts['data'].data);
		}
	}
	else {
		db = await spl.db()
	}
	console.timeEnd('mounting gpkgs');
	await db.read(init_sql('/proj/proj.db'));
	//console.log('db loaded', db);
	
	return db;
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

async function gpkg_layers(featureTable, target_srs) {
	// (Note: becomes OpenLayers-specific from here)
	// Make non-built-in projections defined in proj4 available in OpenLayers.
	// (must be done before GeoPackages are loaded)
	let vectorLayers = [];
	for (let tableInfo of featureTable) {
		let tableDataProjection = tableInfo.srs_code;
		let table_name = tableInfo.table_name;
		/**
		let vectorSource = new ol.source.Vector({
//			features: features,
		});
		vectorSource.setProperties({origProjection: tableDataProjection});
		
		let vectorLayer = new ol.layer.Vector({
			title: table_name,
			source: vectorSource,
			//style: colorStyle(),
		});
		**/
		let dataProjection = (tableInfo.features?.crs?.properties?.name) || tableDataProjection;
		let featureProjection = target_srs.srs_code;
		const projections = {
			dataProjection,
			featureProjection,
		};

		let label = `layer ${table_name}`;
		console.time(label);
		
		/**/
		let vectorLayer = makeLayerJSON(
			table_name, {
				style: colorStyle('blue'),
				sldStyle: tableInfo.style,
			}
		);
		/**/
		if (0) {
		const formatJson = new ol.format.GeoJSON({featureProjection});
		let features = formatJson.readFeatures(tableInfo.features);
		vectorLayer.getSource().addFeatures(features, {featureProjection});
		console.log(22222, dataProjection, featureProjection, tableInfo.features, features[0].getGeometry().getCoordinates());
		}
		else {
		addJSON(vectorLayer, tableInfo.features);
		}
		console.timeEnd(label);
		
		if ('style' in tableInfo) {
			//applySLD(vectorLayer, tableInfo.style);
		}
		vectorLayers.push(vectorLayer);
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
let displayProjection = {
	srs_id: 3857,
	srs_code: 'EPSG:3857',
};

async function london_gpkg(map) {
	let db = await spl_loadgpkg(url, 'london_boroughs.gpkg');
	// For each table, extract geometry and other properties
	let featureTable = await read_gpkg(
		db, /*displayProjection*/);
	let layers = await gpkg_layers(
		featureTable, displayProjection);
	for (let layer of layers) {
		map.addLayer(layer);
	}
	
	//return db;
	
	let jsonUrls = [
		'tfl_lines.json',
		'tfl_stations.json',
	].map(file => new URL(
		`./test/files/dbs/${file}`,
		window.location.href).toString());
	await fetchAll(
		jsonUrls,
		'json',
		{
			map,
			displayProjection: displayProjection.srs_code,
		}
	).then(handleJson);
	
	return db;
}

let map = build_map('map');
map.addLayer(osm_layer());

let db = await london_gpkg(map);
//let db = await spl_loadgpkg();
//let db = await spl_db();


show_map(map, displayProjection.srs_code, "#hit-tolerance");

let sqlConsole = new SQLQuery('div#sqlQuery', db, map);
