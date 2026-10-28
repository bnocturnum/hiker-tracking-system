import { api, asArray, query } from '../api.js';
import { ENDPOINTS } from '../config.js';
import { requireSession, initUserHeader } from '../auth.js';
import { LocationMap, coordinates } from '../map.js';
import { $, create, empty, formatDate, message, number, text } from '../ui.js';
const user = requireSession(['monitor']);
if (user) {
  initUserHeader(user);
  const params = new URLSearchParams(location.search);
  const device = params.get('dispositivo') || '';
  const map = new LocationMap('#history-map');
  $('#history-device').textContent = device || 'No seleccionado';
  $('#history-filter').addEventListener('submit', async event => { event.preventDefault(); await loadHistory(); });
  $('#history-clear').addEventListener('click', () => { $('#from-date').value = ''; $('#to-date').value = ''; loadHistory(); });
  if (!device) { message('#history-message', 'No se indicó un dispositivo. Abre el historial desde el panel de monitor.', 'warning'); empty($('#history-items'), 'Selecciona un dispositivo desde el panel de monitor.'); }
  else loadHistory();
  async function loadHistory() {
    const holder = $('#history-items');
    const from = $('#from-date').value;
    const to = $('#to-date').value;
    if (from && to && new Date(from) > new Date(to)) {
      message('#history-message', 'La fecha inicial no puede ser posterior a la fecha final.', 'error'); return;
    }
    message('#history-message', '');
    try {
      const rows = asArray(await api(query(ENDPOINTS.locationHistory, {
        dispositivo: device,
        desde: from ? new Date(from).toISOString() : '',
        hasta: to ? new Date(to).toISOString() : ''
      })));
      rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const valid = rows.filter(row => coordinates(row));
      map.setPoints(valid, { connect: true });
      text('#history-count', valid.length);
      if (!valid.length) { empty(holder, 'No hay coordenadas en el intervalo seleccionado.'); return; }
      holder.replaceChildren();
      [...valid].reverse().forEach((record, i) => {
        const point = coordinates(record);
        const item = create('div', { className: 'history-record' });
        item.append(create('span', { className: 'ordinal', textContent: String(valid.length - i) }));
        const content = create('div');
        content.append(create('strong', { className: 'mono', textContent: `${point[0].toFixed(6)}, ${point[1].toFixed(6)}` }));
        content.append(create('p', { textContent: formatDate(record.timestamp) }));
        const detail = record.altitud != null ? `Altitud: ${number(record.altitud, 1)} m` : 'Altitud no disponible';
        content.append(create('p', { textContent: detail }));
        item.append(content); holder.append(item);
      });
    } catch (e) { empty(holder, 'No se pudo recuperar el historial.'); message('#history-message', e.message, 'error'); }
  }
}
