
'use strict';

import SPL from '../dist/spl-web.js';

let autogpkg = 1;
let withgpkg = true;

const projdbUrl = new URL('./dist/proj/proj.db', window.location.href).toString();

function init_sql(projFile='/proj/proj.db') {
	let pragmas = `
		PRAGMA foreign_keys = 1;
		PRAGMA recursive_triggers = 1;`;
	let init = `
		SELECT initspatialmetadatafull(1)
		where not exists (
			SELECT 1
			FROM sqlite_schema
			WHERE name LIKE 'geometry_columns'
		)
		;
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
		and ${autogpkg}=1
		`;
	if (!withgpkg) {
		gpkg = '';
	}
	return pragmas + init + gpkg;
}

async function fetchData(urlsInfo) {
	let promises = [];
	let fetched = {};
	for (let info of urlsInfo) {
		let key = '/' + info.mountpoint;
		if (info.filename) {
			key += ('/' + info.filename);
		}
		if (info.noFetch) {
			info.data = info.url;
			info.immutable = 1;
			fetched[key] = info;
			continue;
		}
		let promise = fetch(info.url)
			.then(response => {
				let method = info.method || 'text';
				return response[method]();
			})
			.catch(error => {
				let one = {error, url, ...info};
				console.warn(error);
				return one;
			})
			.then(data => {
				let one = {
					data, ...info,
				};
				fetched[key] = one;
				//console.log(key, one);
				return one;
			})
			.catch(error => {
				let one = {error, url, ...info};
				console.warn(error);
				return one;
			})
			;
		promises.push(promise);
	}
	return Promise.all(promises).then(() => fetched);
}

async function main() {
	var userData = window.userData || [];

	const autoGeoJSON = window.autoGeoJSON || {
		precision: 15,
		options: 2,
	};
	let spl = SPL(
		{
			autoGeoJSON,
		},
		window.spl_extensions || [],
	);
	let projData = {
		url: projdbUrl,
		mountpoint: 'proj',
		filename: 'proj.db',
		method: 'arrayBuffer',
	};
	
	let fetched = fetchData([
		projData, ...userData
	]);
	Promise.all([
		spl,
		fetched,
	])
	.then((spl_fetched) => {
		[spl, fetched] = spl_fetched;
		let mounts = {};
		for (let [key, info] of Object.entries(fetched)) {
			if (info.filename) {
				if (!(info.mountpoint in mounts)) {
					mounts[info.mountpoint] = [];
				}
				let mountData = {
					data: info.data,
					name: info.filename,
				};
				mounts[info.mountpoint].push(mountData);
			}
		}
		let mountPromises = [];
		for (let [mountpoint, info] of Object.entries(mounts)) {
			let prom = spl.mount(mountpoint, info);
			mountPromises.push(prom);
		}
		return Promise.all(mountPromises);
	})
	.then(() => {
		const dbLoad = (info) => {
			if (info?.immutable) {
				let immutable = 1;
				let mountfile = info.mountpoint + '/' + info.filename;
				return spl.db()
					.load(`file:${mountfile}?immutable=${immutable}`);
			}
			else {
				let db = spl.db(info?.data);
				if (info?.onDbLoad) {
					db = info.onDbLoad(db);
				}
				else if (window.onDbLoad) {
					db = onDbLoad(db);
				}
				db = db.read(init_sql());
				if (info?.onDbInit) {
					db = info.onDbInit(db);
				}
				else if (window.onDbInit) {
					db = onDbInit(db);
				}
				return db;
			}
		};
		let dbPromises = [];
		for (let [key, info] of Object.entries(fetched)) {
			if (info.isdb) {
				let db = dbLoad(info);
				info.db = db;
				dbPromises.push(db);
			}
		}
		if (!dbPromises.length) {
			dbPromises.push(dbLoad());
		}
		return Promise.all(dbPromises);
	})
	.then(dbs => {
		for (let [key, info] of Object.entries(fetched)) {
			if ('onData' in info) {
				info.onData(dbs[0], info);
			}
		}
		if ('onData' in window) {
			onData(dbs[0], fetched);
		}
	})
	.catch(error => {
		console.log('db loading error', error);
	})
	;
}


main();

