
const london_remote = 'https://data.london.gov.uk/download/london_boroughs/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/london_boroughs.gpkg';
const london_local = new URL('./test/files/dbs/london.gpkg', window.location.href).toString();
const london_view = [[51.505, -0.09], 16];

let url = london_local;

function lines_features(data) {
	let segments = data.features;
	let index = segments.reduce((a, b) => {a[b.properties.id] = b; return a;}, {});
	let features = {
		inactive: {},
		regular: {},
		special: {},
	};
	let branchColors = {
		inactive: 'blue',
		regular: 'red',
		special: 'white',
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
				properties: {
					name: line,
					style: {
						color: branchColors[branch]
					},
					flatstyle: {
						'stroke-color': branchColors[branch]
					},
				},
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

function makeLinesLayers(db, mount) {
	let linesFeatures = lines_features(mount.data);
	mount.layers = Object.entries(linesFeatures)
		.map(entry => {
			let [branch, lines] = entry;
			return makeLayerGroup(
				lines, `tfl_lines ${branch}`);
		});
}

function makeStationsLayer(db, mount) {
	let layer = makeLayerJSON('tfl_stations');
	mount.layers = [layer];
	addJSON(layer, mount.data);
}

//let styles = {};

window.userData = [
	{
		mountpoint: 'data',
		filename: 'london_boroughs.gpkg',
		isdb: true,
		url,
		method: 'arrayBuffer',
	},
	{
		mountpoint: 'tfl_lines',
		//filename: 'tfl_lines.json',
		url: new URL('./test/files/dbs/tfl_lines.json', window.location.href).toString(),
		method: 'json',
		onFetch: makeLinesLayers,
	},
	{
		mountpoint: 'tfl_stations',
		//filename: 'tfl_stations.json',
		url: new URL('./test/files/dbs/tfl_stations.json', window.location.href).toString(),
		method: 'json',
		onFetch: makeStationsLayer,
	},
];

