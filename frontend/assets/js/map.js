import { CONFIG } from './config.js';
import { create, empty } from './ui.js';
export function coordinates(row) {
  const lat = Number(row?.latitud ?? row?.latitude ?? row?.lat);
  const lng = Number(row?.longitud ?? row?.longitude ?? row?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
    row?.latitud === null || row?.longitud === null || row === null) return null;
  return [lat, lng];
}
export class LocationMap {
  constructor(element, { zoom = CONFIG.MAP_DEFAULT_ZOOM } = {}) {
    this.element = typeof element === 'string' ? document.querySelector(element) : element;
    this.zoom = zoom;
    this.instance = null;
    this.layer = null;
    if (!this.element) return;
    if (!window.L) {
      empty(this.element, 'El mapa requiere Leaflet. Comprueba su carga y la conexión al servidor de mapas.');
      return;
    }
    this.instance = L.map(this.element, { scrollWheelZoom: false });
    L.tileLayer(CONFIG.MAP_TILES, { attribution: CONFIG.MAP_ATTRIBUTION, maxZoom: 19 }).addTo(this.instance);
    this.layer = L.featureGroup().addTo(this.instance);
    this.instance.setView([19.5, -99.1], 5); // Vista inicial neutra: no representa la ubicación del senderista.
  }
  setPoints(rows, { connect = false } = {}) {
    if (!this.instance) return;
    this.layer.clearLayers();
    const valid = rows.map(row => ({ row, point: coordinates(row) })).filter(x => x.point);
    if (!valid.length) { this.instance.setView([19.5, -99.1], 5); return; }
    if (connect && valid.length > 1) L.polyline(valid.map(x => x.point), { color: '#636E43', weight: 4, opacity: .85 }).addTo(this.layer);
    valid.forEach(({ row, point }, i) => {
      if (!connect && i < valid.length - 1) return;
      const label = connect ? (i === 0 ? 'Inicio' : i === valid.length - 1 ? 'Última posición' : `Punto ${i + 1}`) : 'Última posición';
      L.circleMarker(point, { radius: i === valid.length - 1 ? 9 : 5, color: '#4B5936', weight: 2, fillColor: '#839158', fillOpacity: .95 })
        .bindPopup(create('div', {}, [
          create('strong', { textContent: label }), create('div', { textContent: `${point[0].toFixed(6)}, ${point[1].toFixed(6)}` })
        ])).addTo(this.layer);
    });
    this.instance.fitBounds(this.layer.getBounds().pad(.25), { maxZoom: this.zoom });
    setTimeout(() => this.instance?.invalidateSize(), 100);
  }
  destroy() { this.instance?.remove(); this.instance = null; }
}
