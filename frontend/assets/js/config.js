/** Contrato propuesto: adaptar estas rutas a las rutas reales de Flask. */
export const CONFIG = Object.freeze({
  API_BASE_URL: '/api',
  REFRESH_INTERVAL_MS: 30000,
  MAP_DEFAULT_ZOOM: 15,
  MAP_TILES: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_ATTRIBUTION: '&copy; OpenStreetMap contributors'
});
export const ENDPOINTS = Object.freeze({
  login: '/auth/login', register: '/auth/register', me: '/auth/me',
  myDevice: '/dispositivos/mio', routes: '/rutas',
  monitors: '/monitores', links: '/vinculaciones',
  latest: '/ubicaciones/ultima', locationHistory: '/ubicaciones/historial',
  adminUsers: '/admin/usuarios', adminSummary: '/admin/resumen',
  adminHealth: '/admin/salud'
});
export const PAGE = Object.freeze({
  login: './login.html', register: './register.html',
  dashboard: './dashboard.html', history: './history.html'
});
