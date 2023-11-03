/**
 * @description Create ol map
 * @param {string} id ol.Map DOM id
 * @return {ol.Map} OpenLayers map.
 */
function createMap(id, here) { // eslint-disable-line no-unused-vars
  // ==================================================
  // Create map
  // --------------------------------------------------

  const select = new ol.interaction.Select({
    condition: ol.events.condition.click,
  });
  const controls = ol.control.defaults();
  const interactions = ol.interaction.defaults().extend([select]);
  const layers = [new ol.layer.Tile({
    source: new ol.source.Stamen({layer: 'watercolor'}),
  })];
  const view = new ol.View({
    center: [-8161939, 6095025],
    zoom: 8,
  });
  const map = new ol.Map({
    controls: controls,
    interactions: interactions,
    layers: layers,
    target: id,
    view: view,
  });

  // ==================================================
  // Add data to map
  // --------------------------------------------------

  // Add polygons
  const polygons = new ol.layer.Vector({
    source: new ol.source.Vector({
      format: new ol.format.GeoJSON(),
      url: '../data/polygon-samples.geojson',
    }),
  });
  map.addLayer(polygons);

  // Add lines
  const lines = new ol.layer.Vector({
    source: new ol.source.Vector({
      format: new ol.format.GeoJSON(),
      url: '../data/line-samples.geojson',
    }),
  });
  map.addLayer(lines);

  // Add points
  const points = new ol.layer.Vector({
    source: new ol.source.Vector({
      format: new ol.format.GeoJSON(),
      url: '../data/point-samples.geojson',
    }),
  });
  map.addLayer(points);

  return map;
}
