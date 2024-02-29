
const dctour_remote = 'https://github.com/ngageoint/geopackage-js/raw/master/docs/examples/GoingOfflineWithGeoPackage/public/DCTour.gpkg';
const dctour_local = new URL('./test/files/dbs/DCTour.gpkg', window.location.href).toString();
//const dctour_local = 'http://localhost:8080/spl/test/files/dbs/DCTour.gpkg';
let url = dctour_local;
//let url = dctour_remote;
window.userData = [
	{
		mountpoint: 'data',
		filename: 'DCTour.gpkg',
		isdb: true,
		url,
		//noFetch: true,
		method: 'arrayBuffer',
		onDbLoad: (db) => {
			let res = db.read(`
				--nga gpkg have these hacks
				drop view if exists spatial_ref_sys;
				drop view if exists st_spatial_ref_sys;
				drop view if exists geometry_columns;
				drop view if exists st_geometry_columns;
			`);
			return res;
		},
	},
];
