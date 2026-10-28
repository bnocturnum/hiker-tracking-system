import { CONFIG } from './config.js';
import { clearSession, getToken } from './auth.js';
export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; }
}
/** La autorización de verdad se verifica en Flask, no en el navegador. */
export async function api(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(CONFIG.API_BASE_URL + path, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin', signal, cache: 'no-store'
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con el servidor. Verifica la API y la red.', 0);
  }
  const raw = await response.text();
  let payload;
  try { payload = raw ? JSON.parse(raw) : null; }
  catch { throw new ApiError('La API devolvió un formato distinto de JSON.', response.status); }
  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession();
      if (!location.pathname.endsWith('/login.html')) {
        location.replace('./login.html');
      }
    }
    const reason = payload?.mensaje || payload?.message || payload?.error || `Error HTTP ${response.status}`;
    throw new ApiError(String(reason), response.status);
  }
  return payload;
}
export function unwrap(payload) { return payload?.data ?? payload?.datos ?? payload; }
export function asArray(payload) {
  const value = unwrap(payload);
  if (Array.isArray(value)) return value;
  return value?.items || value?.resultados || value?.ubicaciones || value?.rutas || value?.usuarios || value?.vinculaciones || [];
}
export function query(path, params) {
  const values = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') values.set(k, String(v)); });
  return `${path}${values.size ? '?' + values.toString() : ''}`;
}
