/* eslint-disable class-methods-use-this */
import { LitElement, html } from 'lit-element';
import L from 'leaflet';
import HeatmapOverlay from 'leaflet-heatmap';
import GeolocatorService from '../services/geolocator-service.js';
// From https://geojson-maps.ash.ms/
import countryGeoJson from '../../assets/countrydata/country-geojson.json';
import DataEntryService from '../services/data-entry-service.js';

export default class VisualizationMap extends LitElement {
  static get properties() {
    return {
      loading: { type: Boolean },
      geoJson: { type: Object },
      map: { type: Object },

      stats: { type: Object },
      dataMappedByCountry: { type: Object },
      dataMappedByCoordinates: { type: Object },
    };
  }

  constructor() {
    super();
    this.loading = true;
    this.geoJson = null;
    this.map = null;
    this.stats = null;
  }

  firstUpdated() {
    this.getStats();
    // Make sure page has loaded before initiating the map.
    // Openstreetmap rendering goes haywire if it's not on screen when it's loaded
    setTimeout(() => {
      this.loading = false;
      this.initMap();
    }, 1500);
  }

  async getStats() {
    this.stats = await DataEntryService.getLocationBasedStats();
    this.dataMappedByCountry = Object.keys(this.stats.data.submissions).map(countryKey => ({
      countryCode: countryKey,
      count: this.stats.data.submissions[countryKey],
    }));
  }

  async initMap() {
    this.map = await this.createMainMap();
    const mainMapLayer = this.getMainMapLayer();
    mainMapLayer.addTo(this.map);

    // Commented heatmap layer out since there is no usage for it yet

    // const heatMapLayer = this.createHeatmapLayer();
    // heatMapLayer.addTo(this.map);

    const countryBasedInfoMap = this.createCountryBasedMap();
    this.geoJson = countryBasedInfoMap;
    this.geoJson.addTo(this.map);

    const layers = {
      'Submissions by country': countryBasedInfoMap,
    };
    const overlayMaps = {
      'Geographical map': mainMapLayer,
    };
    L.control.layers(layers, overlayMaps, { collapsed: false }).addTo(this.map);
  }

  async getUserCoords() {
    let coords = await GeolocatorService.getCoords().catch(() => null);
    if (coords == null) {
      coords = { latitude: 0, longitude: 0 };
    }
    return coords;
  }

  async createMainMap() {
    const coords = await this.getUserCoords();
    return L.map('visualization-map', {
      center: new L.LatLng(coords.latitude, coords.longitude),
      zoom: 4,
    });
  }

  getMainMapLayer() {
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    });
  }

  createCountryBasedMap() {
    return L.geoJSON(countryGeoJson, {
      style: feature => this.getCountryBasedMapStyle(feature),
      onEachFeature: (feature, layer) => this.onEachFeature(feature, layer),
    });
  }

  createHeatmapLayer() {
    // Example usage
    const heatmapData = [
      { label: 'Test', count: 1, lat: '60.451813', lng: '22.266630' },
      { label: 'Test num. 2', count: 5, lat: '60.169857', lng: '24.938379' },
    ];

    const mapData = {
      max: Math.max(...heatmapData.map(entry => entry.count)),
      data: heatmapData,
    };
    const cfg = {
      radius: 1,
      maxOpacity: 0.8,
      scaleRadius: true,
      useLocalExtrema: true,
      latField: 'lat',
      lngField: 'lng',
      valueField: 'count',
    };

    const heatmapLayer = new HeatmapOverlay(cfg);
    heatmapLayer.setData(mapData);
    return heatmapLayer;
  }

  static getColor(d) {
    if (d > 1000) return '#800026';
    if (d > 500) return '#BD0026';
    if (d > 200) return '#E31A1C';
    if (d > 100) return '#FC4E2A';
    if (d > 50) return '#FD8D3C';
    if (d > 20) return '#FEB24C';
    if (d > 10) return '#FED976';
    if (d > 0) return '#FFEDA0';
    return '#c8c8ce';
  }

  getCountryBasedMapStyle(feature) {
    const countryCode = feature.properties.iso_a2;
    const { dataMappedByCountry } = this;
    const countryData = dataMappedByCountry.find(cData => cData.countryCode === countryCode);
    if (countryData) {
      // eslint-disable-next-line no-param-reassign
      feature.properties.density = countryData.count;
    }
    return {
      fillColor: VisualizationMap.getColor(feature.properties.density),
      weight: 2,
      opacity: 1,
      color: '#FFFFFF',
      dashArray: '3',
      fillOpacity: 0.5,
    };
  }

  highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 5,
      dashArray: '3',
      color: '#FFFFFF',
      fillOpacity: 0.3,
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
      layer.bringToFront();
    }
  }

  resetHighLight(e) {
    this.geoJson.resetStyle(e.target);
  }

  zoomToFeature(e) {
    this.map.fitBounds(e.target.getBounds());
    const countryCode = e.target.feature.properties.iso_a2;
    const countryName = e.target.feature.properties.name;
    const CountryInfo = L.Control.extend({
      options: {
        position: 'bottomleft',
      },
      onAdd() {
        return L.DomUtil.create('div', 'country-info-container');
      },

      onRemove() {},
      setContent(countryData) {
        this.getContainer().innerHTML = `
          <p>${countryData.name}</p>
          <p>Submissions: ${countryData.count}</p>
        `;
      },
    });

    if (!this.countryInfoBox) {
      this.countryInfoBox = new CountryInfo();
      this.countryInfoBox.addTo(this.map);
    }
    const submissionsInCountry = this.getSubmissionsInCountry(countryCode);
    this.countryInfoBox.setContent({
      name: countryName,
      count: submissionsInCountry ? submissionsInCountry.count : 0,
    });
  }

  getSubmissionsInCountry(countryCode) {
    return this.dataMappedByCountry.find(cData => cData.countryCode === countryCode);
  }

  onEachFeature(feature, layer) {
    layer.on({
      mouseover: e => this.highlightFeature(e),
      mouseout: e => this.resetHighLight(e),
      click: e => this.zoomToFeature(e),
    });
  }

  render() {
    return html`
      <div class="map ${this.loading ? ' map--loading' : ''}" id="visualization-map"></div>
    `;
  }

  createRenderRoot() {
    return this;
  }

  /*

  if (d > 1000) return '#800026';
    if (d > 500) return '#BD0026';
    if (d > 200) return '#E31A1C';
    if (d > 100) return '#FC4E2A';
    if (d > 50) return '#FD8D3C';
    if (d > 20) return '#FEB24C';
    if (d > 10) return '#FED976';
    if (d > 0) return '#FFEDA0';
   */
  static getColorRangeElement() {
    const values = [1000, 500, 200, 100, 50, 20, 10, 0];
    return html`
      <div class="color-range-element">
        ${values.map(
          val => html`
            <div class="color-range-entry">
              <div
                class="color-range-box"
                style="background: ${VisualizationMap.getColor(val + 1)}"
              ></div>
              <p>> ${val}</p>
            </div>
          `,
        )}
      </div>
    `;
  }
}

if (!customElements.get('visualization-map')) {
  customElements.define('visualization-map', VisualizationMap);
}
