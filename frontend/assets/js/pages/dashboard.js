import './dashboard-identifiers.js';
import { api, asArray, unwrap, query } from '../api.js';
import { ENDPOINTS, CONFIG } from '../config.js';
import { requireSession, initUserHeader } from '../auth.js';
import { LocationMap, coordinates } from '../map.js';
import { $, create, empty, formatDate, idOf, message, number, pill, setupTabs, text, toast, actionButton } from '../ui.js';
const user = requireSession(['senderista', 'monitor', 'administrador']);
if (user) start();
function start() {
  initUserHeader(user);
  text('[data-role-label]', user.rol.charAt(0).toUpperCase() + user.rol.slice(1));
  $(`#${user.rol}-dashboard`).hidden = false;
  setupTabs();
  if (user.rol === 'senderista') initSenderista();
  if (user.rol === 'monitor') initMonitor();
  if (user.rol === 'administrador') initAdmin();
}
const val = (obj, ...keys) => keys.map(k => obj?.[k]).find(x => x !== null && x !== undefined && x !== '') ?? null;
const byId = obj => idOf(obj, 'id_dispositivo', 'dispositivo_id', 'id');
function senderDeviceView(device) {
  text('#device-id', val(device, 'id_dispositivo', 'id') ?? 'Sin asignar');
  const status = $('#device-status'); status.replaceChildren(pill(val(device, 'estado') || 'Desconocido'));
  text('#device-code', val(device, 'codigo_vinculacion') || 'No disponible');
  text('#device-battery', asBattery(val(device, 'bateria_principal', 'nivel_bateria_principal')));
  text('#device-aux', asBattery(val(device, 'bateria_auxiliar', 'nivel_energia')));
  text('#device-monitor', val(device, 'monitor_vinculado', 'nombre_monitor') || 'Consulta la pestaña Monitor');
}
function asBattery(value) { return value === null ? 'No disponible' : `${number(value, 1)} %`; }
async function initSenderista() {
  const loadDevice = async () => {
    try { senderDeviceView(unwrap(await api(ENDPOINTS.myDevice))); }
    catch (e) { message('#device-message', e.message, 'error'); }
  };
  $('#refresh-device').addEventListener('click', loadDevice);
  $('#route-form').addEventListener('submit', saveRoute);
  $('#cancel-route').addEventListener('click', resetRoute);
  $('#monitor-search-form').addEventListener('submit', searchMonitor);
  $('#monitor-link-form').addEventListener('submit', sendMonitorInvite);
  await Promise.allSettled([loadDevice(), loadRoutes(), loadSenderLinks()]);
}
function resetRoute() {
  $('#route-form').reset(); $('#route-id').value = '';
  text('#route-form-title', 'Registrar ruta');
  $('#cancel-route').hidden = true;
  message('#route-message', '');
}
async function loadRoutes() {
  const holder = $('#routes-list');
  try {
    const rows = asArray(await api(ENDPOINTS.routes));
    if (!rows.length) { empty(holder, 'Todavía no hay rutas registradas.'); return; }
    holder.replaceChildren();
    rows.sort((a, b) => new Date(val(b, 'fecha_inicio') || 0) - new Date(val(a, 'fecha_inicio') || 0));
    rows.forEach(route => {
      const item = create('article', { className: 'item' });
      item.append(create('h3', { textContent: val(route, 'nombre_ruta', 'nombre') || 'Ruta sin nombre' }));
      item.append(create('p', { textContent: `Destino: ${val(route, 'destino') || 'No disponible'}` }));
      item.append(create('p', { textContent: `Inicio: ${formatDate(val(route, 'fecha_inicio'))}` }));
      item.append(pill(val(route, 'estado') || 'Sin estado'));
      const future = new Date(val(route, 'fecha_inicio')).getTime() > Date.now();
      if (future) {
        const actions = create('div', { className: 'item-actions' });
        actions.append(actionButton('Editar ruta', () => editRoute(route)));
        item.append(actions);
      }
      holder.append(item);
    });
  } catch (e) { empty(holder, 'No se pudieron recuperar las rutas.'); message('#route-message', e.message, 'error'); }
}
function toLocalInput(value) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function editRoute(route) {
  $('#route-id').value = val(route, 'id_ruta', 'id');
  $('#route-name').value = val(route, 'nombre_ruta', 'nombre') || '';
  $('#route-destination').value = val(route, 'destino') || '';
  $('#route-date').value = toLocalInput(val(route, 'fecha_inicio'));
  text('#route-form-title', 'Modificar ruta');
  $('#cancel-route').hidden = false;
  $('#route-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function saveRoute(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const id = $('#route-id').value;
  const nombre_ruta = $('#route-name').value.trim();
  const destino = $('#route-destination').value.trim();
  const fecha = $('#route-date').value;
  if (!fecha || Date.parse(fecha) <= Date.now()) {
    message('#route-message', 'La fecha de inicio debe ser futura.', 'error'); return;
  }
  submit.disabled = true; message('#route-message', '');
  try {
    const body = { nombre_ruta, destino, fecha_inicio: new Date(fecha).toISOString() };
    await api(id ? `${ENDPOINTS.routes}/${encodeURIComponent(id)}` : ENDPOINTS.routes,
      { method: id ? 'PATCH' : 'POST', body });
    toast(id ? 'Ruta actualizada.' : 'Ruta registrada.'); resetRoute(); await loadRoutes();
  } catch (e) { message('#route-message', e.message, 'error'); }
  finally { submit.disabled = false; }
}
let chosenMonitor = null;
async function searchMonitor(event) {
  event.preventDefault();
  chosenMonitor = null; $('#monitor-link-form').hidden = true;
  const identifier = $('#monitor-identifier').value.trim();
  const status = $('#monitor-search-message'); message(status, '');
  if (!identifier) { message(status, 'Ingresa el identificador del monitor.', 'error'); return; }
  try {
    const result = unwrap(await api(query(ENDPOINTS.monitors, { identificador: identifier })));
    const monitor = Array.isArray(result) ? result[0] : result?.monitor ?? result;
    if (!monitor || !val(monitor, 'id_usuario', 'id')) throw new Error('No se encontró un monitor con ese identificador.');
    chosenMonitor = monitor;
    text('#monitor-result-name', val(monitor, 'nombre') || 'Monitor');
    text('#monitor-result-email', val(monitor, 'correo') || 'Sin correo');
    $('#monitor-link-form').hidden = false;
  } catch (e) { message(status, e.message, 'error'); }
}
async function sendMonitorInvite(event) {
  event.preventDefault(); if (!chosenMonitor) return;
  const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled = true;
  try {
    await api(ENDPOINTS.links, { method: 'POST', body: { id_monitor: val(chosenMonitor, 'id_usuario', 'id') } });
    toast('Invitación enviada. El monitor debe aceptarla.');
    $('#monitor-link-form').hidden = true; chosenMonitor = null;
    $('#monitor-search-form').reset(); await loadSenderLinks();
  } catch (e) { message('#monitor-search-message', e.message, 'error'); }
  finally { submit.disabled = false; }
}
async function loadSenderLinks() {
  const holder = $('#sender-links');
  try {
    const rows = asArray(await api(ENDPOINTS.links));
    if (!rows.length) { empty(holder, 'Aún no tienes monitores asociados.'); return; }
    holder.replaceChildren();
    rows.forEach(link => {
      const id = val(link, 'id_vinculacion', 'id');
      const item = create('article', { className: 'item' });
      item.append(create('h3', { textContent: val(link, 'nombre_monitor', 'monitor_nombre', 'nombre') || `Monitor ${val(link, 'id_monitor') || ''}` }));
      item.append(create('p', { textContent: val(link, 'correo_monitor', 'correo') || 'Invitación de monitoreo' }));
      item.append(pill(val(link, 'estado') || 'Pendiente'));
      if (id != null) {
        const actions = create('div', { className: 'item-actions' });
        actions.append(actionButton('Eliminar vinculación', async () => {
          if (!confirm('¿Eliminar esta vinculación de monitoreo?')) return;
          await api(`${ENDPOINTS.links}/${encodeURIComponent(id)}`, { method: 'DELETE' });
          toast('Vinculación eliminada.'); await loadSenderLinks();
        }, 'btn-danger'));
        item.append(actions);
      }
      holder.append(item);
    });
  } catch (e) { empty(holder, 'No se pudieron cargar las vinculaciones.'); message('#links-message', e.message, 'error'); }
}

let monitorMap = null;
let monitorLinks = [];
async function initMonitor() {
  text('#monitor-own-id', val(user, 'id_usuario', 'id') ?? 'No disponible');
  monitorMap = new LocationMap('#latest-map');
  const select = $('#monitor-device-select');
  select.addEventListener('change', () => loadLatest());
  $('#refresh-latest').addEventListener('click', () => loadLatest());
  $('#refresh-monitor-links').addEventListener('click', () => loadMonitorLinks());
  await loadMonitorLinks();
  // El polling actualiza solo la última posición, nunca el historial sin que el usuario lo solicite.
  setInterval(() => { if (!document.hidden && !$('#monitor-dashboard').hidden) loadLatest(true); }, CONFIG.REFRESH_INTERVAL_MS);
}
async function loadMonitorLinks() {
  const holder = $('#monitor-links'); const invites = $('#monitor-invitations');
  const select = $('#monitor-device-select'); const previous = select.value;
  try {
    monitorLinks = asArray(await api(ENDPOINTS.links));
    const accepted = monitorLinks.filter(x => String(val(x, 'estado') || '').toLowerCase() === 'activa');
    const pending = monitorLinks.filter(x => String(val(x, 'estado') || '').toLowerCase() === 'pendiente');
    select.replaceChildren(create('option', { value: '', textContent: 'Selecciona un senderista' }));
    accepted.forEach(row => {
      const id = val(row, 'id_dispositivo', 'dispositivo_id');
      if (id != null) select.append(create('option', { value: id, textContent: val(row, 'nombre_senderista', 'senderista_nombre') || `Dispositivo ${id}` }));
    });
    if ([...select.options].some(opt => opt.value === previous)) select.value = previous;
    else if (select.options.length > 1) select.selectedIndex = 1;
    if (!accepted.length) empty(holder, 'No tienes senderistas vinculados.');
    else {
      holder.replaceChildren();
      accepted.forEach(row => {
        const id = val(row, 'id_vinculacion', 'id');
        const item = create('article', { className: 'item' });
        item.append(create('h3', { textContent: val(row, 'nombre_senderista', 'senderista_nombre') || `Senderista ${val(row, 'id_senderista') || ''}` }));
        item.append(create('p', { textContent: `Dispositivo: ${val(row, 'id_dispositivo') ?? 'No disponible'}` }));
        item.append(pill('Activa'));
        if (id != null) {
          const actions = create('div', { className: 'item-actions' });
          actions.append(actionButton('Eliminar', async () => {
            if (!confirm('¿Eliminar a este senderista de tu lista de monitoreo?')) return;
            await api(`${ENDPOINTS.links}/${encodeURIComponent(id)}`, { method: 'DELETE' });
            toast('Vinculación eliminada.'); await loadMonitorLinks();
          }, 'btn-danger'));
          item.append(actions);
        }
        holder.append(item);
      });
    }
    if (!pending.length) empty(invites, 'No hay invitaciones pendientes.');
    else {
      invites.replaceChildren();
      pending.forEach(link => {
        const id = val(link, 'id_vinculacion', 'id');
        const item = create('article', { className: 'item' });
        item.append(create('h3', { textContent: val(link, 'nombre_senderista', 'senderista_nombre') || `Senderista ${val(link, 'id_senderista') || ''}` }));
        item.append(pill('Pendiente'));
        if (id != null) {
          const actions = create('div', { className: 'item-actions' });
          actions.append(actionButton('Aceptar', () => updateInvite(id, 'aceptar'), 'btn'));
          actions.append(actionButton('Rechazar', () => updateInvite(id, 'rechazar'), 'btn-danger'));
          item.append(actions);
        }
        invites.append(item);
      });
    }
    await loadLatest();
  } catch (e) { empty(holder, 'No se pudieron cargar tus senderistas.'); empty(invites, 'No se pudieron cargar invitaciones.'); message('#monitor-links-message', e.message, 'error'); }
}
async function updateInvite(id, choice) {
  await api(`${ENDPOINTS.links}/${encodeURIComponent(id)}/${choice}`, { method: 'POST' });
  toast(choice === 'aceptar' ? 'Invitación aceptada.' : 'Invitación rechazada.');
  await loadMonitorLinks();
}
let lastRequest = 0;
async function loadLatest(silent = false) {
  const id = $('#monitor-device-select').value; const request = ++lastRequest;
  if (!id) {
    monitorMap?.setPoints([]);
    text('#monitor-name', 'Sin senderista vinculado'); text('#last-position', 'No disponible');
    text('#last-updated', 'No disponible'); text('#last-energy', 'No disponible');
    $('#history-open').hidden = true;
    if (!silent) message('#latest-message', 'Acepta una vinculación para consultar ubicaciones.');
    return;
  }
  $('#history-open').hidden = false;
  $('#history-open').href = `./history.html?dispositivo=${encodeURIComponent(id)}`;
  const entry = monitorLinks.find(x => String(val(x, 'id_dispositivo', 'dispositivo_id')) === String(id));
  text('#monitor-name', val(entry, 'nombre_senderista', 'senderista_nombre') || `Dispositivo ${id}`);
  try {
    const payload = unwrap(await api(query(ENDPOINTS.latest, { dispositivo: id })));
    if (request !== lastRequest) return;
    const loc = payload?.ubicacion ?? payload;
    const point = coordinates(loc);
    if (!point) {
      monitorMap?.setPoints([]);
      text('#last-position', 'Sin coordenadas recibidas'); text('#last-updated', 'No disponible');
      text('#last-energy', 'No disponible');
      if (!silent) message('#latest-message', 'El dispositivo aún no tiene ubicaciones registradas.');
      return;
    }
    monitorMap?.setPoints([loc]);
    text('#last-position', `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`);
    text('#last-updated', formatDate(val(loc, 'timestamp', 'fecha')));
    text('#last-energy', asBattery(val(loc, 'nivel_energia', 'bateria_auxiliar')));
    if (!silent) message('#latest-message', '');
  } catch (e) { if (request === lastRequest && !silent) message('#latest-message', e.message, 'error'); }
}
async function initAdmin() {
  $('#refresh-admin').addEventListener('click', loadAdmin);
  $('#admin-filter').addEventListener('input', renderAdminUsers);
  await loadAdmin();
}
let adminUsers = [];
async function loadAdmin() {
  const results = await Promise.allSettled([
    api(ENDPOINTS.adminUsers), api(ENDPOINTS.adminSummary), api(ENDPOINTS.adminHealth)
  ]);
  if (results[0].status === 'fulfilled') {
    adminUsers = asArray(results[0].value); renderAdminUsers();
  } else { empty($('#admin-users-placeholder'), 'No se pudieron cargar los usuarios.'); message('#admin-message', results[0].reason.message, 'error'); }
  if (results[1].status === 'fulfilled') {
    const summary = unwrap(results[1].value) || {};
    text('#admin-users-count', val(summary, 'usuarios_registrados', 'total_usuarios') ?? adminUsers.length);
    text('#admin-devices-count', val(summary, 'dispositivos_registrados', 'total_dispositivos') ?? 'No disponible');
  } else {
    text('#admin-users-count', adminUsers.length || 'No disponible');
    text('#admin-devices-count', 'No disponible');
  }
  const health = $('#admin-health');
  if (results[2].status === 'fulfilled') {
    health.replaceChildren();
    const data = unwrap(results[2].value) || {};
    const rows = Object.entries(data).filter(([, v]) => typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number');
    if (!rows.length) { empty(health, 'No hay información sobre servicios.'); return; }
    rows.forEach(([key, value]) => {
      const row = create('div', { className: 'admin-service-row' });
      row.append(create('span', { textContent: key.replaceAll('_', ' ') }));
      row.append(pill(typeof value === 'boolean' ? (value ? 'Disponible' : 'Sin servicio') : String(value)));
      health.append(row);
    });
  } else empty(health, 'La supervisión de servicios aún no está disponible.');
}
function renderAdminUsers() {
  const tbody = $('#admin-users-body'); const holder = $('#admin-users-placeholder');
  const search = $('#admin-filter').value.trim().toLocaleLowerCase('es-MX');
  tbody.replaceChildren();
  const rows = adminUsers.filter(u => [val(u, 'nombre'), val(u, 'correo'), val(u, 'rol')].some(v => String(v || '').toLowerCase().includes(search)));
  holder.hidden = rows.length > 0;
  if (!rows.length) { empty(holder, search ? 'No se encontraron usuarios.' : 'No hay usuarios registrados.'); return; }
  rows.forEach(user => {
    const tr = create('tr');
    tr.append(create('td', { textContent: val(user, 'nombre') || 'No disponible' }));
    tr.append(create('td', { textContent: val(user, 'correo') || 'No disponible' }));
    const status = create('td'); status.append(pill(val(user, 'estado') || 'Registrado')); tr.append(status);
    tr.append(create('td', { textContent: formatDate(val(user, 'fecha_registro')) }));
    tr.append(create('td', { textContent: val(user, 'rol') || 'Sin rol' }));
    tbody.append(tr);
  });
}
