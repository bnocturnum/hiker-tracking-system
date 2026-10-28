import { api } from '../api.js';
import { ENDPOINTS } from '../config.js';
import { $, message } from '../ui.js';
const form = $('#register-form');
const withoutDevice = $('#no-device');
const codeField = $('#code-field');
const codeInput = $('#codigo-vinculacion');
function syncRole() {
  codeField.hidden = withoutDevice.checked;
  codeInput.required = !withoutDevice.checked;
  if (withoutDevice.checked) codeInput.value = '';
}
withoutDevice.addEventListener('change', syncRole); syncRole();
form.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const nombre = $('#nombre').value.trim();
  const correo = $('#correo').value.trim();
  const contrasena = $('#contrasena').value;
  const confirm = $('#confirmar-contrasena').value;
  const rol = withoutDevice.checked ? 'monitor' : 'senderista';
  const codigo_vinculacion = codeInput.value.trim();
  if (contrasena.length < 8) { message('#form-message', 'La contraseña debe tener al menos 8 caracteres.', 'error'); return; }
  if (contrasena !== confirm) { message('#form-message', 'Las contraseñas no coinciden.', 'error'); return; }
  if (rol === 'senderista' && !codigo_vinculacion) { message('#form-message', 'Ingresa el código de vinculación del dispositivo.', 'error'); return; }
  const body = { nombre, correo, contrasena, rol };
  if (rol === 'senderista') body.codigo_vinculacion = codigo_vinculacion;
  submit.disabled = true; message('#form-message', '');
  try {
    await api(ENDPOINTS.register, { method: 'POST', body, auth: false });
    form.reset(); syncRole();
    message('#form-message', 'Cuenta creada. Ya puedes iniciar sesión.');
  } catch (error) { message('#form-message', error.message, 'error'); }
  finally { submit.disabled = false; }
});
