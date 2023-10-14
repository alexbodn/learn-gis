	
	import SPL from './dist/index.js';

	const spl = await SPL();
	
	console.log('spl loaded');
	//const url = 'https://data.london.gov.uk/download/london_boroughs/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/london_boroughs.gpkg'
	const url = new URL('./test/files/dbs/london.gpkg', window.location.href).toString();
	//const url = new URL('./test/files/dbs/Natural_Earth_QGIS_layers_and_styles.gpkg', window.location.href).toString();
	console.log(url);
	
	const gpkgArrayBuffer = await fetch(url)
		.then(response => {
			return response.arrayBuffer();
		})
		.catch(error => {console.error(error)})
		;
	console.log('london fetched', gpkgArrayBuffer);
	
	const db = await spl.db(gpkgArrayBuffer)
		.exec("SELECT InitSpatialMetaData();")
		.exec("SELECT EnableGpkgAmphibiousMode();")
		.exec("SELECT AutoGPKGStart();")
		//.exec("SELECT AutoGPKGStop();")
		;
	window.sqlConsole = new SQLQuery('div#sqlQuery', db, 'sqlConsole');
	window.sqlConsole.addSnippets({
		gpkg_extensions: `
		SELECT *
		FROM gpkg_extensions;`,
		gpkg_contents: `
		SELECT *
		FROM gpkg_contents`,
		transformed_extent: `
		SELECT
			min_x, min_y, max_x, max_y, srs_id, 
			st_transform(makepoint(min_x, min_y), srs_id, 4326) as minp,
			makepoint(max_x, max_y) as maxp
		FROM gpkg_contents
		WHERE data_type='features'`,
	});
	console.log('db loaded');
	
	// Initial map view [xmin, ymin, xmax, ymax]
	const initialMapExtent = [-20000000, 3000000, 20000000, 12000000];
	// Map View Projection
	const displayProjection = 'EPSG:3857';
	
	// Data and associated SLD styles loaded both from GPKG
	var dataFromGpkg = {};
	var sldsFromGpkg = {};
	
	// Extract all feature tables, SRS IDs and their geometry types
	// Note the following fields are not extracted:
	//	 gpkg_contents.identifier - title (QGIS: same as table_name)
	//	 gpkg_contents.description - human readable (QGIS: blank)
	//	 gpkg_geometry_columns.geometry_type_name
	//	 - e.g. LINESTRING (but info also embedded in each feature)
	let featureTableNames = await db.exec(`
		SELECT
			gpkg_contents.table_name, 
			cast(gpkg_contents.srs_id as text) as srs_id,
			min_x, min_y, max_x, max_y, 
			gpkg_geometry_columns.column_name as geometry_column_name
		FROM gpkg_contents
		INNER JOIN gpkg_geometry_columns
			ON gpkg_contents.table_name=gpkg_geometry_columns.table_name
		WHERE gpkg_contents.data_type='features'
	`).get.objs;
	
	let layerExtent = await db.exec(`
		SELECT min(min_x), min(min_y), max(max_x), max(max_y)
		FROM gpkg_contents
		WHERE data_type='features'
	`).get.first;
	console.log(layerExtent);
	
	// Use Proj4js to define EPSG:27700 Projection (British National Grid)
	// (parameters from https://epsg.io/27700)
	proj4.defs(
		await db.exec(`
			SELECT organization||':'||organization_coordsys_id as srs, definition
			FROM gpkg_spatial_ref_sys
			WHERE organization<>'NONE'
		`).get.rows
	);
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
	
	let [min_x, min_y, max_x, max_y] = 
		ol.proj.transformExtent(layerExtent, 'EPSG:27700', displayProjection);
	const extentObject = {
		'type': 'Feature',
		'geometry': {
			'type': 'Polygon',
			'coordinates': [
				[
					[min_x, min_y],
					[max_x, min_y],
					[max_x, max_y],
					[min_x, max_y],
					[min_x, min_y],
				],
			],
		},
	};
	const extentSource = new ol.source.Vector({
		features: new ol.format.GeoJSON().readFeatures(extentObject),
	});
	const extentLayer = new ol.layer.Vector({
		title: 'extent',
		source: extentSource,
	});
	map.addLayer(extentLayer);
	
	// For each table, extract geometry and other properties
	// (Note: becomes OpenLayers-specific from here)
	var formatWKB = new ol.format.WKB();
	for (let table of featureTableNames) {
		let features;
		let table_name = table.table_name;
		let tableDataProjection = 'EPSG:' + table.srs_id;
		// Check if we have a definition for the data projection (SRS)
		if (!ol.proj.get(tableDataProjection)) {
			throw new Error("Missing data projection [" +
				tableDataProjection + '] for table "' + table_name +
				'" - can be added beforehand with ol/proj/proj4');
		}
		
		let vectorSource = new ol.source.Vector();
		let geometry_column_name = table.geometry_column_name;
		let allProperties = await db.exec(`
			SELECT *
			FROM [${table_name}]
		`).get.objs;
		for (let properties of allProperties) {
			// Extract properties & geometry for a single feature
			let geomProp = properties[geometry_column_name];
			delete properties[geometry_column_name];
			if (geomProp && typeof geomProp === 'object' && geomProp.constructor === Object) {
				features = [
					new ol.Feature({
						geometry: new ol.geom[geomProp.type](geomProp.coordinates)
							.transform(tableDataProjection, displayProjection),
						//labelPoint: new Point(labelCoords),
						//	.transform(tableDataProjection, displayProjection),
						//name: 'My Polygon',
					})
				];
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
		dataFromGpkg[table_name] = vectorSource;
		
		const orange = 'orange';
		const dim_orange = ol.color.asString(
			ol.color.asArray(orange).slice(0, 3).concat(0.3));
		let style = new ol.style.Style({
			stroke: new ol.style.Stroke({
				color: orange,
				width: 1,
			}),
			fill: new ol.style.Fill({
				color: dim_orange,
			}),
			image: new ol.style.Circle({
				fill: new ol.style.Fill({
					color: dim_orange,
				}),
				radius: 6,
				stroke: new ol.style.Stroke({
					color: orange,
					width: 1,
				}),
			}),
		});
		const vectorLayer = new ol.layer.Vector({
			title: table_name,
			source: vectorSource,
			//style: style,
		});
		if (table_name in sldsFromGpkg) {
			applySLD(vectorLayer, sldsFromGpkg[table_name]);
		}
		map.addLayer(vectorLayer);
	}
	
	let mapView = new ol.View({
		projection: displayProjection,
		maxZoom: 28,
		minZoom: 1
	});
	let allLayers = map.getLayers();
	let extent = ol.extent.createEmpty();
	allLayers.forEach(layer => {
		try {
			let source = layer.getSource();
			ol.extent.extend(extent, source.getExtent());
		}
		catch (err) {
			let title;
			try {
				title = source.getTitle();
			}
			catch (titleErr) {
				title = 'Missing title';
			}
			console.log('layer without extent', title, err);
		}
	});
//	map.getView().fit(extent, map.getSize());
	console.log(extent, map.getSize());
	mapView.fit(extent, {
		size: map.getSize(),
		padding: [0, 0, 0, 0],
		constrainResolution: false,
	});
	map.setView(mapView);
	
	let layerSwitcher = new ol.control.LayerSwitcher({
		tipLabel: 'Légende' // Optional label for button
	});
	map.addControl(layerSwitcher);

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
