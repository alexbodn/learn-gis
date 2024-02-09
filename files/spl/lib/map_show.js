
function resource_url(url, currentScript) {
	if (url && url.slice(0, 4).toLowerCase() != 'http') {
		url = new URL(url, currentScript).toString();
	}
	return url;
}

class DisplayDriver{
	
	static resources(currentScript) {
		let jsAll = Promise.resolve();
		for (let js of this.resource_urls.js) {
			jsAll = jsAll.then(() => {
				return jsLoad(resource_url(js, currentScript));
			});
		}
		
		let cssAll = Promise.resolve();
		for (let css of this.resource_urls.css) {
			cssAll = cssAll.then(() => {
				cssLoad(resource_url(css, currentScript));
			});
		}
		
		return [jsAll, cssAll];
	}
	

osm_layer() {
	let osm = this.tile_layer(
		'base layer (OSM)',
		'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});
	return osm;
}

bw_layer() {
	return this.tile_layer(
		'bw osm',
		'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png', {
		maxZoom: 16,
		attribution: `
			&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>
			&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>
			&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>
		`
	});
}

};
