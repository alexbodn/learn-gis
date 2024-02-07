
const lights_local = new URL('./test/files/dbs/lights.zip', window.location.href).toString();
let url = lights_local;

function makeLightsLayer(db, mount) {
	return db.exec(
		'SELECT ImportZipSHP(?, ?, ?, ?, ?)', [
		'/data/lights.zip', 'lights', 'lights', 'UTF-8', 4326
	]);
}

window.userData = [
	{
		mountpoint: 'data',
		filename: 'lights.zip',
		isdb: false,
		url,
		method: 'blob',
		onData: makeLightsLayer,
	},
];

window.extraSnippets = {
	lightsTest: {
		query: `
			select 
			asgeojson(geometry, 15, 2) as feature
			from lights
			limit 10`,
		spatial: false,
	}
};
