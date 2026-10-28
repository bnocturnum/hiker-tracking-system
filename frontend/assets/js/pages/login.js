import { api, unwrap } from '../api.js';
import { ENDPOINTS } from '../config.js';
import { getSession, setSession } from '../auth.js';
import { message, $ } from '../ui.js';
if (getSession()?.token) location.replace('./dashboard.html');
const form = $('#login-form');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const correo = $('#correo').value.trim();
  const contrasena = $('#contrasena').value;
  if (!correo || !contrasena) { message('#form-message', 'Ingresa tu correo y contraseña.', 'error'); return; }
  button.disabled = true; message('#form-message', '');
  try {
    const response = unwrap(await api(ENDPOINTS.login, { method: 'POST', body: { correo, contrasena }, auth: false }));
    const token = response?.access_token ?? response?.token;
    const user = response?.usuario ?? response?.user;
    setSession(token, user);
    location.replace('./dashboard.html');
  } catch (error) { message('#form-message', error.message, 'error'); }
  finally { button.disabled = false; }
});
