
const { GeoPackageAPI, setSqljsWasmLocateFile } = window.GeoPackage;

const geoPackageMap = 
	L.map('geopackage-map')
	.setView(...(viewOptions || [[38.6258, -90.189933], 14]));
// need to load this web assembly module to interact with database in browser.
const sqljsWasmLocateFile = file => './lib/' + file;


setSqljsWasmLocateFile(sqljsWasmLocateFile);

const loaded = geoPackage => {
console.log('loaded');
	// Now you can operate on the GeoPackage
	// Get the tile table names
	const tileTableNames = geoPackage.getTileTables();
	for (const tileTable of tileTableNames) {
console.log(tileTable);
		const tileDao = geoPackage.getTileDao(tileTable); // We know we have one tile layer, loop if you have more.
		const maxZoom = tileDao.maxWebMapZoom;
		const minZoom = tileDao.minWebMapZoom;
		const tableLayer = new L.GridLayer({noWrap: true, minZoom, maxZoom});
		tableLayer.createTile = function(tilePoint, done) {
			const canvas = L.DomUtil.create('canvas', 'leaflet-tile');
			const size = this.getTileSize();
			canvas.width = size.x;
			canvas.height = size.y;
			let error = null;
			setTimeout(function() {
				console.time('Draw tile ' + tilePoint.x + ', ' + tilePoint.y + ' zoom: ' + tilePoint.z);
				geoPackage
					.xyzTile(tileTable, tilePoint.x, tilePoint.y, tilePoint.z, size.x, size.y, canvas)
					.catch(err => {
						error = err;
					})
					.finally(() => {
						console.timeEnd('Draw tile ' + tilePoint.x + ', ' + tilePoint.y + ' zoom: ' + tilePoint.z);
						done(error, canvas);
					});
			}, 0);
			return canvas;
		};
		console.log(geoPackageMap);
		console.log(geoPackageMap.getCenter());
		console.log(geoPackageMap.getBounds());
		geoPackageMap.addLayer(tableLayer);
		tableLayer.bringToFront();
	}
	
	const featureTableNames = geoPackage.getFeatureTables();
		featureTableNames.forEach(featureTable => {
//console.log('featureTable: ' + featureTable);
			
			// Configure the icons that we want to use to style our data
			const pizzaIcon = L.icon({
				iconUrl: './data/pizza.png',
				shadowUrl: './data/shadow.png',
				iconSize: [32, 40],
				shadowSize: [32, 38],
				iconAnchor: [16, 40],
				shadowAnchor: [12, 32],
				popupAnchor: [0, -64],
			});
			
			const poiIcon = L.icon({
				iconUrl: './data/poi.png',
				shadowUrl: './data/shadow.png',
				iconSize: [32, 40],
				shadowSize: [32, 38],
				iconAnchor: [16, 40],
				shadowAnchor: [12, 32],
				popupAnchor: [0, -64],
			});
			const geojsonLayer = L.geoJson([], {
				style: function(feature) {
					return {
						color: '#000',
						weight: 2,
						opacity: 1,
						fillColor: '#093',
					};
				},
				onEachFeature: function(feature, layer) {
					layer.bindPopup('<div>' + feature.properties.name + '</div>');
					if (feature.properties.table_name == 'Pizza') {
						// eslint-disable-next-line @typescript-eslint/no-use-before-define
						layer.setIcon(pizzaIcon);
					} else if (feature.properties.table_name == 'PointsOfInterest') {
						// eslint-disable-next-line @typescript-eslint/no-use-before-define
						layer.setIcon(poiIcon);
					}
				}
			}).addTo(geoPackageMap);
			const featureDao = geoPackage.getFeatureDao(featureTable);
			const info = geoPackage.getInfoForTable(featureDao);
			// query for all features
			const iterator = featureDao.queryForEach();
			for (const row of iterator) {
				const feature = featureDao.getRow(row);
				const geometry = feature.geometry;
				if (geometry) {
					// Make the information into something we can display on the map with leaflet
					const geom = geometry.geometry;
					const geoJson = geom.toGeoJSON();
					geoJson.properties = {};
					geoJson.properties['table_name'] = featureTable;
					
					// map the values from the feature table into GeoJSON properties we can use to style the map and show a popup
					for (const key in feature.values) {
						if (feature.values.hasOwnProperty(key) && key != feature.geometryColumn.name) {
							const column = info.columnMap[key];
							geoJson.properties[column.displayName] = feature.values[key];
						}
					}
					// eslint-disable-next-line @typescript-eslint/no-use-before-define
					geojsonLayer.addData(geoJson);
				}
			}
		}
	);
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

//const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString();
let mountUrls = [
//	{url: projdbUrl, point: 'proj', filename: 'proj.db', method: 'arrayBuffer'}
];
/*
const gpkgUrl = 'https://data.london.gov.uk/download/london_boroughs/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/london_boroughs.gpkg';
const fileName = 'london_boroughs.gpkg';
mountUrls.push({url: gpkgUrl, point: 'data', filename: fileName, method: 'arrayBuffer'});
*/
mountUrls.push({url: './data/StLouis.gpkg', point: 'data', filename: 'StLouis.gpkg', method: 'arrayBuffer'});

fetchMounts(mountUrls).then(mounts => {
	const uInt8Array = new Uint8Array(mounts.data.data);
	GeoPackageAPI.open(uInt8Array).then(loaded);
});

function loadData() {
	// setup poi icon
	const poiIcon = L.icon({
		iconUrl: './data/poi.png',
		shadowUrl: './data/shadow.png',
		iconSize: [32, 40],
		shadowSize: [32, 38],
		iconAnchor: [16, 40],
		shadowAnchor: [12, 32],
		popupAnchor: [0, -64],
	});

	// create Leaflet GeoPackage Tile Layer
	const tileLayer = new L.geoPackageTileLayer({
		geoPackageUrl: './data/StLouis.gpkg',
		layerName: 'tiles',
		sqlJsWasmLocateFile: sqljsWasmLocateFile
	})
	geoPackageMap.addLayer(tileLayer);
	tileLayer.bringToFront();


	// create Leaflet GeoPackage Feature Layers
	const layers = ['Pizza', 'PointsOfInterest'];
	layers.forEach(layerName => {
		const featureLayer = L.geoPackageFeatureLayer([], {
			geoPackageUrl: './data/StLouis.gpkg',
			layerName: layerName,
			sqlJsWasmLocateFile: sqljsWasmLocateFile,
			style: { color: '#00F', weight: 2, opacity: 1, fillColor: '#093', fillOpacity: 0.25 },
			pointToLayer: (feature, latlng) => L.marker(latlng, { icon: poiIcon }),
		});
		geoPackageMap.addLayer(featureLayer);
	});
}

//loadData();



  /**
   * Get the map zoom level
   * @param tileDao
   * @param tileMatrixSet tile matrix set
   * @param tileMatrix tile matrix
   * @return map zoom level
   */
  /*
  public static getMapZoomWithTileMatrixSetAndTileMatrix(
    tileDao: TileDao,
    tileMatrixSet: TileMatrixSet,
    tileMatrix: TileMatrix,
  ): number {
    const boundingBox = tileDao
      .getGeoPackage()
      .getTileMatrixSetDao()
      .getBoundingBoxWithProjection(tileMatrixSet, Projections.getWebMercatorProjection());
    let zoom = TileDaoUtils.getMapZoom(
      boundingBox.getMinLongitude(),
      boundingBox.getMaxLongitude(),
      tileMatrix.getMatrixWidth(),
    );
    if (
      Projections.getUnits(tileDao.getGeoPackage().getTileMatrixSetDao().getProjection(tileMatrixSet).toString()) !==
      'degrees'
    ) {
      zoom = Math.min(
        zoom,
        TileDaoUtils.getMapZoom(
          boundingBox.getMinLatitude(),
          boundingBox.getMaxLatitude(),
          tileMatrix.getMatrixHeight(),
        ),
      );
    }
    return zoom;
  }
  */

  /**
   * Get the map zoom level
   * @param min min bounds
   * @param max max bounds
   * @param matrixLength matrix length
   * @return zoom level
   */
  /*
  private static getMapZoom(min: number, max: number, matrixLength: number): number {
    return Math.round(
      Math.log((2 * ProjectionConstants.WEB_MERCATOR_HALF_WORLD_WIDTH) / ((max - min) / matrixLength)) / Math.log(2),
    );
  }
  */
