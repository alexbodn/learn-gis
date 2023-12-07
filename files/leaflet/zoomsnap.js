
'use strict';

if (document.querySelector('#map1')) {
			let map = L.map('map1', {
			  zoomSnap: 0 // http://leafletjs.com/reference.html#map-zoomsnap
			}).setView([51.505, -0.09], 5);
			
			// add an OpenStreetMap tile layer
			L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
			  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
			}).addTo(map);
			
			let 
			  south = 40.712,
			  west = -74.227,
			  north = 40.774,
			  east = -74.125,
			  southWest = new L.LatLng(south, west),
			  northEast = new L.LatLng(north, east),
			  bounds = new L.LatLngBounds(southWest, northEast);
			//console.log(southWest, northEast);
			
			L.marker([south, west]).addTo(map);
			L.marker([north, east]).addTo(map);
			
			map.fitBounds(bounds);
			
			document.querySelector('#fit1').addEventListener('click', () => {
			  map.fitBounds(bounds);
			});
			document.querySelector('#fit2').addEventListener('click', () => {
			  map.fitBounds(bounds, {
			    padding: [50, 50]
			  });
			});
}

if (document.querySelector('#map2')) {
			let map2 = L.map('map2', {
			  zoomSnap: 0, // http://leafletjs.com/reference.html#map-zoomsnap
			})
			//.setView([0,0], 13)
			;
			
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			    maxZoom: 19,
			    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map2);
			
			let bounds;
			let marker = L.marker([51.5, -0.09])
				.addTo(map2);
			bounds = L.latLngBounds(
				marker.getLatLng(), marker.getLatLng());
			let circle = L.circle([51.508, -0.11], {
			    color: 'red',
			    fillColor: '#f03',
			    fillOpacity: 0.5,
			    radius: 500
			}).addTo(map2);
			let circleBounds = circle.getBounds()
			///bounds.extend(circleBounds);
			let polygon = L.polygon([
			    [51.509, -0.08],
			    [51.503, -0.06],
			    [51.51, -0.047]
			]).addTo(map2);
			bounds.extend(polygon.getBounds());
			map2.fitBounds(bounds);
			marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
			circle.bindPopup("I am a circle.");
			polygon.bindPopup("I am a polygon.");
			/*
			let popup = L.popup()
			    .setLatLng([51.513, -0.09])
			    .setContent("I am a standalone popup.")
			    .openOn(map2);
			const onMapClick = (e) => {
			    alert("You clicked the map at " + e.latlng);
			}
			map2.on('click', onMapClick);
			*/
			let popup = L.popup();
			const onMapClick = (e) => {
			    L.popup()
			        .setLatLng(e.latlng)
			        .setContent("You clicked the map at " + e.latlng.toString())
			        .openOn(map2);
			}
			map2.on('click', onMapClick);
}

if (document.querySelector('#map3')) {
			let map3 = L.map('map3', {
			  zoomSnap: 0, // http://leafletjs.com/reference.html#map-zoomsnap
			})
			//.setView([51.505, -0.09], 13)
			;
			
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			    maxZoom: 19,
			    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map3);
			
			function onEachFeature(feature, layer) {
			    // does this feature have a property named popupContent?
			    if (feature.properties && feature.properties.popupContent) {
			        layer.bindPopup(feature.properties.popupContent);
			    }
			}
			
			let geojsonFeature = {
			    "type": "Feature",
			    "properties": {
			        "name": "Coors Field",
			        "amenity": "Baseball Stadium",
			        "popupContent": "This is where the Rockies play!"
			    },
			    "geometry": {
			        "type": "Point",
			        "coordinates": [-104.99404, 39.75621]
			    }
			};
			
			let layer= L.geoJSON(geojsonFeature, {
			    onEachFeature: onEachFeature
			}).addTo(map3);
			let someFeatures = [{
			    "type": "Feature",
			    "properties": {
			        "name": "Coors Field",
			        "show_on_map": true
			    },
			    "geometry": {
			        "type": "Point",
			        "coordinates": [-104.99404, 39.75621]
			    }
			}, {
			    "type": "Feature",
			    "properties": {
			        "name": "Busch Field",
			        "show_on_map": false
			    },
			    "geometry": {
			        "type": "Point",
			        "coordinates": [-104.98404, 39.74621]
			    }
			}];
			
			let layer2 = L.geoJSON(someFeatures, {
			    filter: function(feature, layer) {
			        return feature.properties.show_on_map || 1;
			    }
			}).addTo(map3);
			let bounds3 = layer.getBounds();
			bounds3.extend(layer2.getBounds());
			map3.fitBounds(bounds3);
}