import SPL from './dist/index.js';

class GPKGConsole {
	db = null;
	dataFromGpkg = {};
	sldsFromGpkg = {};
	
	sql_featureTable = `
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
		`;
		
	sql_projections = `
		SELECT organization||':'||organization_coordsys_id as srs, definition
		FROM gpkg_spatial_ref_sys
		WHERE organization<>'NONE'
		`;
		
	sql_hasLayerStyles = `
		SELECT count(*)
		FROM gpkg_contents
		WHERE table_name='layer_styles'
		`;
		
	sql_layerStyles = `
		SELECT f_table_name, styleSLD
		FROM layer_styles
		`;
		
	constructor(url) {
		this.url = url;
		if (!/^https?:\/\/.+/.test(url)) {
			this.url = new URL(url, window.location.href).toString();
		}
	}
	
	async db_init() {
		const spl = await SPL();
		console.log('spl loaded');
	
		const gpkgArrayBuffer = await fetch(this.url)
			.then(response => {
				return response.arrayBuffer();
			})
			.catch(error => {console.error(error)})
			;
		console.log('gpkg fetched', gpkgArrayBuffer);
		
		this.db = await spl.db(gpkgArrayBuffer)
			.exec("SELECT InitSpatialMetaData();")
			.exec("SELECT EnableGpkgAmphibiousMode();")
			.exec("SELECT AutoGPKGStart();")
			//.exec("SELECT AutoGPKGStop();")
			;
		console.log('spl db initialized');
		await this.db_parse();
	}
	
	async data_source() {
		// Extract all feature tables, SRS IDs and their geometry types
		// Note the following fields are not extracted:
		//	 gpkg_contents.identifier - title (QGIS: same as table_name)
		//	 gpkg_contents.description - human readable (QGIS: blank)
		//	 gpkg_geometry_columns.geometry_type_name
		//	 - e.g. LINESTRING (but info also embedded in each feature)
		this.featureTable = await this.db.exec(this.sql_featureTable).get.objs;
		// Use Proj4js to define EPSG:27700 Projection (British National Grid)
		// (parameters from https://epsg.io/27700)
		proj4.defs(
			await this.db.exec(this.sql_projections).get.rows
		);
		// Make non-built-in projections defined in proj4 available in OpenLayers.
		// (must be done before GeoPackages are loaded)
		ol.proj.proj4.register(proj4);
		
		// Extract SLD styles for each layer (if styles included in the gpkg)
		let hasLayerStyles = await this.db.exec(this.sql_hasLayerStyles).get.first;
		//console.log(hasLayerStyles);
		if (hasLayerStyles) {
			let layerStyles = await this.db.exec(this.sql_layerStyles).get.objs;
			for (let row of layerStyles) {
				this.sldsFromGpkg[row.f_table_name] = row.styleSLD;
			}
		}
	}
	
	async build_layer(tableInfo, displayProjection) {
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
		let allProperties = await this.db.exec(`
			SELECT *
			FROM [${table_name}]
		`).get.objs;
		let features;
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
		this.dataFromGpkg[table_name] = vectorSource;
		
		return vectorSource;
	}
	
	async build_map(target='map', displayProjection='EPSG:3857') {
		await this.db_init();
		// Create Map canvas and View
		let map = new ol.Map({
			target: target,
			renderer: 'canvas',
			layers: [
				new ol.layer.Tile({
					title: 'base layer (OSM)',
					source: new ol.source.OSM()
				}),
			],
		});
		
		for (let tableInfo of this.featureTable) {
			let table_name = tableInfo.table_name;
			let tableDataProjection = 'EPSG:' + tableInfo.srs_id;
			
			let vectorSource = await this.build_layer(tableInfo, displayProjection);
			
			const layerExtent = [
				tableInfo.min_x,
				tableInfo.min_y,
				tableInfo.max_x,
				tableInfo.max_y,
			];
			const [min_x, min_y, max_x, max_y] =
				ol.proj.transformExtent(
					layerExtent, tableDataProjection, displayProjection);
			const extentObject = {
				type: 'Feature',
				geometry: {
					type: 'Polygon',
					coordinates: [
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
				title: `extent ${table_name}`,
				source: extentSource,
			});
			
			const vectorLayer = new ol.layer.Vector({
				title: table_name,
				source: vectorSource,
				//style: colorStyle(),
			});
			if (table_name in this.sldsFromGpkg) {
				applySLD(extentLayer, this.sldsFromGpkg[table_name]);
				applySLD(vectorLayer, this.sldsFromGpkg[table_name]);
			}
			map.addLayer(extentLayer);
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
			if (!layer.isVisible(mapView)) {
				return;
			}
			try {
				let source = layer.getSource();
				ol.extent.extend(extent, source.getExtent());
			}
			catch (err) {
				console.log('layer without extent', err);
			}
		});
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
		
		map.on('singleclick', (evt) => {
			var coordinates = map.getEventCoordinate(evt.originalEvent);
			//console.log(coordinates);
			
			let target = document.getElementById('mouse-position');
			target.textContent = coordinates;
			let hit = false;
			
			map.forEachFeatureAtPixel(
				evt.pixel,
				(feature, layer) => {
					// getData(feature.getProperties());
					// getData(layer.getProperties());
					if (!feature) {
						feature = layer.getClosestFeatureToCoordinate(coordinates);
					}
					if (feature) {
						feature.setStyle(colorStyle());
						hit = true;
					}
				},
				{
					hitTolerance: 5,
				}
			);
		});
		
		function getData(data) {
			console.log(data);
			console.log(data.id);
		}
		return map;
	}
};

function colorStyle(mainColor='orange', opacity=0.3) {
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

