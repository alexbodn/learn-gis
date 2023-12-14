
const fontAwesomeIcon = L.divIcon({
    //html0: '<i class="fa fa-map-marker fa-4x"></i>',
    html: '<div>😹</div>',
    iconSize: [20, 20],
    className: 'myDivIcon'
});


const pointToLayer = function(feature, latlng) {
	return new L.marker([51.5, -0.09], {icon: fontAwesomeIcon});
    return new L.CircleMarker(latlng, {
    	radius: 5, 
    	fillOpacity: 0.85
    });
};

var LeafIcon = L.Icon.extend({
    options: {
       iconSize:     [38, 95],
       shadowSize:   [50, 64],
       iconAnchor:   [22, 94],
       shadowAnchor: [4, 62],
       popupAnchor:  [-3, -76]
    }
});

var greenIcon = new LeafIcon({
    iconUrl: 'http://leafletjs.com/examples/custom-icons/leaf-green.png',
    shadowUrl: 'http://leafletjs.com/examples/custom-icons/leaf-shadow.png'
});

const onMapClick = (e) => {
	L.popup()
		.setLatLng(e.latlng)
		.setContent("You clicked the map at " + e.latlng.toString())
//		.openOn(map);
};

function onEachFeature(feature, layer) {
console.log(layer);
	if (feature?.properties?.name_greek) {
		layer.bindPopup(`<b>${feature.properties.name_greek}</b>`);
	}
	if (feature?.properties?.style) {
		//
	}
	if (!layer.options.latLngToCoords) {
		let crs;
		if (feature.crs && feature.crs.type === 'name') {
			crs = new L.Proj.CRS(feature.crs.properties.name);
		} else if (feature.crs && feature.crs.type) {
			crs = new L.Proj.CRS(feature.crs.type + ':' + feature.crs.properties.code);
		}
	
		if (crs !== undefined) {
			layer.options.latLngToCoords = function(latlng) {
				var point = L.point(latlng[0], latlng[1]);
				return crs.projection.project(point);
			};
		}
	}
	layer.on('click', onMapClick);
}

var map = L.map('map')
//.setView([44.97,-93.24], 11)
;


L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	})
.addTo(map);

// GeoJSON layer (UTM15)
proj4.defs('EPSG:26915', '+proj=utm +zone=15 +ellps=GRS80 +datum=NAD83 +units=m +no_defs');

var geojson = {
  'type': 'Feature',
  'geometry': {
    'type': 'Point',
    'coordinates': [481650, 4980105],
  },
  'properties': {
    'name': 'University of Minnesota'
  },
  'crs': {
    'type': 'name',
    'properties': {
        'name': 'urn:ogc:def:crs:EPSG::26915'
      }
    }
  };
  
L.Proj.geoJson(geojson, {
	pointToLayer,
	onEachFeature,
}).addTo(map);
show_map(map);


var map2 = L.map('map2')
//.setView([51.505, -0.09], 13)
;

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	})
.addTo(map2);

proj4.defs(
	'EPSG:27700', 
	'+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
	//'PROJCS["OSGB 1936 / British National Grid",GEOGCS["OSGB 1936",DATUM["OSGB_1936",SPHEROID["Airy 1830",6377563.396,299.3249646,AUTHORITY["EPSG","7001"]],TOWGS84[446.448,-125.157,542.06,0.15,0.247,0.842,-20.489],AUTHORITY["EPSG","6277"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4277"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",49],PARAMETER["central_meridian",-2],PARAMETER["scale_factor",0.9996012717],PARAMETER["false_easting",400000],PARAMETER["false_northing",-100000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","27700"]]'
);

var geojson = {
  'type': 'Feature',
  'geometry': {
    'type': 'Point',
    'coordinates': [524536.337988,192293.213677],
  },
  'properties': {
    'name': 'London Equestrian Center'
  },
  'crs': {
    'type': 'name',
    'properties': {
        'name': 'urn:ogc:def:crs:EPSG::27700'
      }
    }
  };

L.Proj.geoJson(geojson, {
  pointToLayer,
  onEachFeature,
}).addTo(map2);
show_map(map2);

function show_map(map) {
	L.control.scale({metric: true}).addTo(map);
	
	let bounds;
	map.eachLayer(function(layer) {
		let layerBounds = layer.getBounds ?
			layer.getBounds() : null;
		if (!bounds || !bounds.isValid()) {
			bounds = layerBounds;
		}
		else if (layerBounds && layerBounds.isValid()) {
			bounds.extend(layerBounds);
		}
	});
	if (bounds && bounds.isValid()) {
		map.fitBounds(bounds);
	}
	
//	map.on('click', onMapClick);
}
