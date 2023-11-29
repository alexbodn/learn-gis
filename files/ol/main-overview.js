import Map from 'ol/Map.js';
import OSM from 'ol/source/OSM.js';
import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import {
  DragRotateAndZoom,
  defaults as defaultInteractions,
} from 'ol/interaction.js';
import {OverviewMap, defaults as defaultControls} from 'ol/control.js';

const rotateWithView = document.getElementById('rotateWithView');

const overviewMapControl = new OverviewMap({
  // see in overviewmap-custom.html to see the custom CSS used
  className: 'ol-overviewmap ol-custom-overviewmap',
  layers: [
    new TileLayer({
      source: new OSM({
        'url':
          'https://{a-c}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png' +
          '?apikey=Your API key from https://www.thunderforest.com/docs/apikeys/ here',
      }),
    }),
  ],
  collapseLabel: '\u00BB',
  label: '\u00AB',
  collapsed: false,
});

rotateWithView.addEventListener('change', function () {
  overviewMapControl.setRotateWithView(this.checked);
});

const map = new Map({
  controls: defaultControls().extend([overviewMapControl]),
  interactions: defaultInteractions().extend([new DragRotateAndZoom()]),
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
  ],
  target: 'map',
  view: new View({
    center: [500000, 6000000],
    zoom: 7,
  }),
});
