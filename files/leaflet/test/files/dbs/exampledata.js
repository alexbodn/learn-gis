(function() {

  const emojiIcon = L.divIcon({
    //html0: '<i class="fa fa-map-marker fa-4x"></i>',
    html: '<div>😹</div>',
    iconSize: [20, 20],
    className: 'myDivIcon'
  });


  var basemaps = {
    /*openTopoMap: L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }),*/
	openTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
	}),
	osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	})
    /*osm: L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    })*/
  };

  var groups = {
    cities: new L.LayerGroup(),
    restaurants: new L.LayerGroup(),
    dogs: new L.LayerGroup(),
    cats: new L.LayerGroup()
  };

  L.marker([39.61, -105.02], {icon: emojiIcon}).bindPopup('Littleton, CO.').addTo(groups.cities);
  L.marker([39.74, -104.99], {icon: emojiIcon}).bindPopup('Denver, CO.').addTo(groups.cities);
  L.marker([39.73, -104.8], {icon: emojiIcon}).bindPopup('Aurora, CO.').addTo(groups.cities);
  L.marker([39.77, -105.23], {icon: emojiIcon}).bindPopup('Golden, CO.').addTo(groups.cities);

  L.marker([39.69, -104.85], {icon: emojiIcon}).bindPopup('A restaurant').addTo(groups.restaurants);
  L.marker([39.69, -105.12], {icon: emojiIcon}).bindPopup('A restaurant').addTo(groups.restaurants);

  L.marker([39.79, -104.95], {icon: emojiIcon}).bindPopup('A dog').addTo(groups.dogs);
  L.marker([39.79, -105.22], {icon: emojiIcon}).bindPopup('A dog').addTo(groups.dogs);

  L.marker([39.59, -104.75], {icon: emojiIcon}).bindPopup('A cat').addTo(groups.cats);
  L.marker([39.59, -105.02], {icon: emojiIcon}).bindPopup('A cat').addTo(groups.cats);

  window.ExampleData = {
    LayerGroups: groups,
    Basemaps: basemaps
  };

}());