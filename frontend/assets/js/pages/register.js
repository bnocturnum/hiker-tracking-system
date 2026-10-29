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
withoutDevice.addEventListener('change', syncRole);
syncRole();
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const nombres = $('#nombres').value.trim();
  const apellido_paterno = $('#apellido-paterno').value.trim();
  const apellido_materno = $('#apellido-materno').value.trim();
  const correo = $('#correo').value.trim();
  const contrasena = $('#contrasena').value;
  const confirmar = $('#confirmar-contrasena').value;
  const rol = withoutDevice.checked ? 'monitor' : 'senderista';
  const codigo_vinculacion = codeInput.value.trim();
  if (!nombres || !apellido_paterno) {
    message('#form-message', 'Ingresa tu nombre y apellido paterno.', 'error'); return;
  }
  if ([nombres, apellido_paterno, apellido_materno].filter(Boolean).join(' ').length > 100) {
    message('#form-message', 'El nombre completo no debe exceder 100 caracteres.', 'error'); return;
  }
  if (contrasena.length < 8) {
    message('#form-message', 'La contraseña debe tener al menos 8 caracteres.', 'error'); return;
  }
  if (contrasena !== confirmar) {
    message('#form-message', 'Las contraseñas no coinciden.', 'error'); return;
  }
  if (rol === 'senderista' && !codigo_vinculacion) {
    message('#form-message', 'Ingresa el código de tu dispositivo.', 'error'); return;
  }
  const body = { nombres, apellido_paterno, apellido_materno, correo, contrasena, rol };
  if (rol === 'senderista') body.codigo_vinculacion = codigo_vinculacion;
  submit.disabled = true;
  message('#form-message', '');
  try {
    await api(ENDPOINTS.register, { method: 'POST', body, auth: false });
    form.reset();
    syncRole();
    message('#form-message', 'Cuenta creada correctamente. Redirigiendo a iniciar sesión...');
    sessionStorage.setItem('pt2_registro_exitoso', 'Cuenta creada correctamente. Inicia sesión para continuar.');
    window.setTimeout(() => window.location.replace('./login.html'), 1300);
  } catch (error) {
    message('#form-message', error.message, 'error');
    submit.disabled = false;
  }
});
