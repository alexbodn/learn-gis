
'use strict';

import SPL from '../dist/spl-web.js';

let autogpkg = 0;
let withgpkg = true;

const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString();

async function table_features(db, tableInfo, target_srs) {
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
			else if (window.autoGeoJSON === false) {
				prefix = `
					asgeojson(
					GeomFromGPB(
						[${name}]
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
					origProjection: srs//.srs_code
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

async function gpkg_read(db, target_srs) {
	let featuresTable = [];
	let tilesTable = [];
	let attributesTable = [];
	
	let isGpkg = await db.exec(`
		SELECT count(*)
		FROM sqlite_schema
		WHERE name LIKE 'gpkg_contents'
	`).get.first;
	
	if (!isGpkg) {
		return {featuresTable, tilesTable, attributesTable};
	}
	
	featuresTable = await db.exec(`
		SELECT
			gpkg_contents.table_name,
			gpkg_contents.identifier,
			gpkg_contents.description,
			CASE
				WHEN organization IS NULL
				THEN 'EPSG:'||cast(gpkg_contents.srs_id as text)
				ELSE organization||':'||organization_coordsys_id
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
			CASE
				WHEN organization IS NULL
				THEN 'EPSG:'||cast(gpkg_geometry_columns.srs_id as text)
				ELSE organization||':'||cast(organization_coordsys_id as text)
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
	
	for (let tableInfo of featuresTable) {
		if (tableInfo.table_name in featureColumns) {
			tableInfo.geometry_columns =
				featureColumns[tableInfo.table_name];
		}
	}
	
	let projections = await db.exec(`
		SELECT
			organization||':'||cast(organization_coordsys_id as text) as srs,
			definition
		FROM gpkg_spatial_ref_sys
		WHERE
			srs_id>0
			--AND srs_id NOT IN (4326, 3857)
		;
	`).get.rows;
	//todo run this with each loaded geojson
	proj4.defs(projections);
	
	// Extract SLD styles for each layer (if styles included in the gpkg)
	let has_layer_styles = await db.exec(`
		SELECT count(*)
		FROM gpkg_contents
		WHERE table_name='layer_styles'
	`).get.first;
	//console.log('has_layer_styles', has_layer_styles);
	// table associated SLD styles loaded from GPKG
	var sldsFromGpkg = {};
	if (has_layer_styles) {
	
		let layer_styles = await db.exec(`
			SELECT f_table_name, styleSLD
			FROM layer_styles
		`).get.objs;
		for (let row of layer_styles) {
			//sldsFromGpkg[row.f_table_name] = row.styleSLD;
		}
	}
	
	// For each table, extract geometry and other properties
	for (let tableInfo of featuresTable) {
		let table_name = tableInfo.table_name;
		tableInfo.features = await table_features(
			db, tableInfo, target_srs);
		if (table_name in sldsFromGpkg) {
			tableInfo.style = sldsFromGpkg[table_name];
		}
	}
	
	tilesTable = await db.exec(`
		SELECT
			gpkg_contents.table_name,
			min_zoom, max_zoom, srs_id
		FROM gpkg_contents
		INNER JOIN (
			select table_name,
			min(zoom_level) as min_zoom,
			max(zoom_level) as max_zoom
			from gpkg_tile_matrix
			group by table_name
		) as tile_matrix on tile_matrix.table_name=gpkg_contents.table_name
		WHERE data_type='tiles'
	`).get.objs;
	
	for (let tableInfo of tilesTable) {
		await raster_table(db, tableInfo);
	}
	
	return {featuresTable, tilesTable, attributesTable};
}

function init_sql(projFile='/proj/proj.db') {
	let pragmas = `
		PRAGMA foreign_keys = 1;
		PRAGMA recursive_triggers = 1;`;
	let init = `
		/*
		drop view if exists spatial_ref_sys;
		drop view if exists st_spatial_ref_sys;
		drop view if exists geometry_columns;
		drop view if exists st_geometry_columns;
		
		CREATE UNIQUE INDEX IF NOT EXISTS 
		tiles_zxy ON tiles (zoom_level, tile_column, tile_row);
		*/
		
		SELECT initspatialmetadatafull(1);
		SELECT PROJ_SetDatabasePath('${projFile}'); -- set proj.db path
		`;
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
		)
		and ${autogpkg}=1`;
	if (!withgpkg) {
		gpkg = '';
	}
	return pragmas + init + gpkg;
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
				mounts[info.mountpoint] = {data, name: info.filename};
				return {data, ...info};
			})
			.catch(error => ({error, url, ...info}))
			;
		promises.push(promise);
	}
	return Promise.all(promises).then(() => mounts);
}

async function spl_loadgpkg(gpkgUrl, fileName) {
	const autoGeoJSON =
		'autoGeoJSON' in window ? window.autoGeoJSON : {
		precision: 15,
		options: 4,
	};
	const spl = await SPL(
		{
			autoGeoJSON,
		},
		[],
	);
	console.log('spl loaded');
	console.time('fetching gpkgs');
	const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString();
	let mountUrls = [
		{url: projdbUrl, mountpoint: 'proj', filename: 'proj.db', method: 'arrayBuffer'}
	];
	if (gpkgUrl && fileName) {
		mountUrls.push({url: gpkgUrl, mountpoint: 'data', filename: fileName, method: 'arrayBuffer'});
	}
	let mounts = await fetchMounts(mountUrls);
	console.timeEnd('fetching gpkgs');
	console.time('mounting gpkgs');
	for (let [mountpoint, info] of Object.entries(mounts)) {
		spl.mount(mountpoint, [info]);
	}
	let db;
	
	if (fileName) {
		if (0) {
		db = await spl.db()
			.load(`file:data/${fileName}?immutable=1`)
		}
		if (1) {
		db = await spl.db(mounts['data'].data);
		}
	}
	else {
		db = await spl.db()
	}
	console.timeEnd('mounting gpkgs');
	await db.read(init_sql());
	//console.log('db loaded', db);
	
	return db;
}

async function gpkg_vectorLayers(featuresTable, target_srs, styles={}) {
	let layers = [];
	for (let tableInfo of featuresTable) {
		let table_name = tableInfo.table_name;
		let label = `layer ${table_name}`;
		console.time(label);
		let layer = makeLayerJSON(
			tableInfo.features,
			table_name,
			{
				sldStyle: tableInfo.style,
				style: styles[table_name]
			});
		console.timeEnd(label);
		layers.push(layer);
	}
	
	return layers;
}

//code taken from
//https://stackoverflow.com/a/62365404/4444742
function bytesArrToBase64(arr) {
	const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; // base64 alphabet
	const bin = n => n.toString(2).padStart(8,0); // convert num to 8-bit binary string
	const l = arr.length;
	let result = '';

	for(let i=0; i<=(l-1)/3; i++) {
		let c1 = i*3+1>=l; // case when "=" is on end
		let c2 = i*3+2>=l; // case when "=" is on end
		let chunk = bin(arr[3*i]) + bin(c1? 0:arr[3*i+1]) + bin(c2? 0:arr[3*i+2]);
		let r = chunk.match(/.{1,6}/g).map((x,j)=> j==3&&c2 ? '=' :(j==2&&c1 ? '=':abc[+('0b'+x)]));
		result += r.join('');
	}

	return result;
}

//code taken from
//https://stackoverflow.com/a/75439718/4444742
function getMimeTypeFromUint8Array(uint8arr) {
	const len = 4;
	//todo compare byte by byte
	if (uint8arr.length >= len) {
		let signatureArr = new Array(len);
		for (let i = 0; i < len; i++) {
			signatureArr[i] = uint8arr[i].toString(16).padStart(2, "0");
		}
		const signature = signatureArr.join('').toUpperCase();

		switch (signature) {
			case '89504E47':
				return 'image/png';
			case '47494638':
				return 'image/gif';
			case 'FFD8FFDB':
			case 'FFD8FFE0':
				return 'image/jpeg';
			default:
				return null;
		}
	}
	return null;
}

// calculate the extent of the most
// populated zoom level
// interesting what will happen at
// antimeridian
async function raster_table(db, tableInfo) {
	
	function get_lat_lng_for_number(xtile, ytile, zoom) {
		let n = Math.pow(2.0, Math.round(zoom));
		let lng = xtile / n * 360.0 - 180.0;
		let lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2.0 * ytile / n)));
		let lat = 180.0 * lat_rad / Math.PI;
		return {lat, lng};
	}
	
	const table_name = tableInfo.table_name;
	
	await db.exec(`
		select *
		from (
			select zoom_level,
				min(tile_column) as first_col,
				max(tile_row) + 1 as first_row,
				min(tile_row) as last_row,
				max(tile_column) + 1 as last_col,
				count(*) as ntiles
			from ${table_name}
			group by zoom_level
		) as group_tiles
		order by ntiles desc
		limit 1
	`, [table_name]).get.objs
	.then(objs => {
		if (!objs.length) {
			return;
		}
		let rec = objs[0];
		tableInfo.bounds = [
			get_lat_lng_for_number(rec.first_col, rec.first_row, rec.zoom_level),
			get_lat_lng_for_number(rec.last_col, rec.last_row, rec.zoom_level),
		];
		tableInfo.zoom_level = rec.zoom_level;
console.log('bounds', tableInfo.bounds, tableInfo.zoom_level);
	});
	
	await db.exec(`
		select zoom_level, tile_width, tile_height
		from gpkg_tile_matrix
		where table_name=?
	`, [table_name]).get.objs
	.then(objs => {
		tableInfo.imgSizes = objs
		.reduce((a, level) => {
			a[level.zoom_level] = {
				width: level.tile_width,
				height: level.tile_height,
			};
			return a;
		}, {});
	});
	tableInfo.fetchTile = (x, y, z) => {
		return db.exec(`
			select 
			--casttoblob(
				tile_data
			--)
			from ${table_name}
			where zoom_level=${z} and tile_column=${x} and tile_row=${y}
		`).get.first;
	};
}

async function gpkg_rasterLayers(tilesTable, target_srs) {
	let layers = [];
	let emptyCache = {};
	//code taken from
	//https://stackoverflow.com/a/70465895/4444742
	const createImage = ({width, height}) => {
		let key = `empty-${width}x${height}`;
		if (!(key in emptyCache)) {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			
			const ctx = canvas.getContext('2d');
			ctx.fillStyle = 'rgba(0, 0, 0, 0)';
			ctx.fillRect(0, 0, width, height);
			emptyCache[key] = canvas.toDataURL('image/png');
		}
		
		let img = new Image(width, height);
		img.src = emptyCache[key];
		img.crossOrigin = "anonymous";
		img.style.outline = '1px solid red';
		
		return img;
	}
	
	for (let tableInfo of tilesTable) {
		let table_name = tableInfo.table_name;
		let label = `layer ${table_name}`;
		console.time(label);
		let layer = new L.GridLayer({
			noWrap: true,
			//pane: 'overlayPane',
			minZoom: tableInfo.min_zoom,
			maxZoom: tableInfo.max_zoom,
		});
		layer.options.name = table_name;
		if (tableInfo.bounds) {
			layer.options.bounds = L.latLngBounds(...tableInfo.bounds);
		}
		layer.options.imgSizes = tableInfo.imgSizes;
		layer.options.fetchTile = tableInfo.fetchTile;
		
		function missingTile (coords, done) {
			let tile = document.createElement('div');
			tile.width = coords.x;
			tile.height = coords.y;
			tile.innerHTML = [coords.x, coords.y, coords.z].join(', ');
			tile.style.outline = '1px solid green';
			
			return tile;
		}
		
		layer.createTile = (coords, done) => {
			let timeLabel = `tile_${coords.x},${coords.y},${coords.z}`;
			console.time(timeLabel);
			let error = null;
			let img = createImage(layer.options.imgSizes[coords.z]);
			let timeRetrieve = `tile_${coords.x},${coords.y},${coords.z} retrieve`;
			console.time(timeRetrieve);
			layer.options.fetchTile(coords.x, coords.y, coords.z)
			.then(tile => {
			console.timeEnd(timeRetrieve);
				if (tile) {
					//const buff = new Uint8Array(tile);
					//let mime = getMimeTypeFromUint8Array(buff);
					let blob = new Blob([tile], //{type: mime}
						);
					let url = URL.createObjectURL(blob);
					img.src = url;
					img.onload = () => {
						//return;
						//console.log('loaded', timeLabel);
						URL.revokeObjectURL(url);
					};
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
		console.timeEnd(label);
		layers.push(layer);
		/*
layer.createTile = function (coords) {
	var tile = L.DomUtil.create('div', 'tile-hoverable');

	// Ensure that this tile will respond to pointer events,
	// by setting its CSS 'pointer-events' property programatically
	tile.style.pointerEvents = 'initial';

	// Attach some event handlers to this particular tile
	L.DomEvent.on(tile, 'mouseover', function(){
		tile.style.background = 'red';
	});
	L.DomEvent.on(tile, 'mouseout', function(){
		tile.style.background = 'transparent';
	});

	return tile;
};
		*/
	}
	
	return layers;
}

async function london_gpkg(map) {
	let db = await spl_loadgpkg(url, 'london_boroughs.gpkg');
	// For each table, extract geometry and other properties
	let {featuresTable, tilesTable} = await gpkg_read(
		db, /*displayProjection.srs_code*/);
	let maxBounds;
	let tileLayer;
	let baseLayers = await gpkg_rasterLayers(
		tilesTable, /*target_srs*/);
	for (let layer of baseLayers) {
	//console.log(layer);
		tileLayer = layer;
		map.addLayer(layer);
		layer.bringToFront();
		//maxBounds = layer.options.bounds;
	}
	let overLayers = await gpkg_vectorLayers(
		featuresTable, displayProjection, styles);
	for (let layer of overLayers) {
	//console.log(layer);
		map.addLayer(layer);
	}
	
	maxBounds = tileLayer?.options?.bounds;
	if (maxBounds) {
		console.log('yyy', maxBounds, maxBounds.isValid());
	//console.log('///', map.getCenter(), maxBounds.getCenter());
		//map.setMaxBounds(maxBounds);
		//map.fitBounds(maxBounds);
	//console.log('***', map.getCenter(), maxBounds.getCenter());
	}
	
	return db;
}


// main function

if (typeof 'styles' === 'undefined') {
	var styles = {};
}

if (typeof 'userData' === 'undefined') {
	var userData = [];
}
if (1) {
	const autoGeoJSON =
		'autoGeoJSON' in window ? window.autoGeoJSON : {
		precision: 15,
		options: 4,
	};
	const spl = await SPL(
		{
			autoGeoJSON,
		},
		[],
	);
	let projData = {
		url: projdbUrl,
		mountpoint: 'proj', 
		filename: 'proj.db', 
		method: 'arrayBuffer',
	};
	
	let fetched = await fetchMounts([projData, ...(userData || [])]);
	for (let [mountpoint, info] of Object.entries(fetched)) {
		spl.mount(mountpoint, [info]);
	}
	
	let db;
	
	if (dbMount in fetched) {
		if (0) {
		db = await spl.db()
			.load(`file:${dbMount}/${fetched[dbMount].filename}?immutable=1`)
		}
		if (1) {
		db = await spl.db(fetched[dbMount].data);
		}
	}
	else {
		db = await spl.db()
	}
	await db.read(init_sql());
	
	let {featuresTable, tilesTable} = await gpkg_read(
		db, /*displayProjection.srs_code*/);
	let baseLayers = await gpkg_rasterLayers(
		tilesTable, /*target_srs*/);
	let overLayers = await gpkg_vectorLayers(
		featuresTable, displayProjection, styles);
 	if ('onMounted' in window) {
		onMounted(db, fetched, {baseLayers, overLayers});
	}
}
