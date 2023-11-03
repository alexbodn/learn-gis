//import Map from 'ol/Map.js';
//import OSM from 'ol/source/OSM.js';
//import TileLayer from 'ol/layer/Tile.js';
//import View from 'ol/View.js';
//import {Control, defaults as defaultControls} from 'ol/control.js';

//
// Define rotate to north control.
//

class RotateNorthControl extends ol.control.Control {
  /**
   * @param {Object} [opt_options] Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement('button');
    button.innerHTML = 'N';

    const element = document.createElement('div');
    element.className = 'rotate-north ol-unselectable ol-control';
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener('click', this.handleRotateNorth.bind(this), false);
  }

  handleRotateNorth() {
    console.log(this.getMap().getView().getRotation());
    this.getMap().getView().setRotation(0);
  }
}

//
// Create map, giving it a rotate to north control.
//

const map = new ol.Map({
  //controls: defaultControls().extend([new RotateNorthControl()]),
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM(),
    }),
  ],
  target: 'map',
  view: new ol.View({
    center: [0, 0],
    zoom: 3,
    rotation: 1,
  }),
});
map.addControl(new RotateNorthControl());
