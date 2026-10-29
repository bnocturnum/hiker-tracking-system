/** Panel de identidades: módulo independiente para no sustituir el dashboard existente. */
import { api, unwrap } from '../api.js';
import { getUser, normalizeRole } from '../auth.js';

const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('../../css/pages/dashboard-identifiers.css', import.meta.url).href;
document.head.append(css);

function element(tag, cls = '', content = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.textContent = content;
  return e;
}
function detail(label, initial = 'No disponible') {
  const block = element('div', 'identity-detail');
  const caption = element('label', '', label);
  const value = element('strong', 'identity-value', String(initial));
  const copy = element('button', 'identity-copy', 'Copiar');
  copy.type = 'button';
  copy.disabled = !initial || initial === 'No disponible' || initial === 'Sin asignar';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(value.textContent);
      const previous = copy.textContent;
      copy.textContent = 'Copiado';
      window.setTimeout(() => { copy.textContent = previous; }, 1500);
    } catch {
      copy.textContent = 'Selecciona el dato para copiarlo';
    }
  });
  block.append(caption, value, copy);
  return {
    block,
    set(next) {
      value.textContent = next == null || next === '' ? 'Sin asignar' : String(next);
      copy.disabled = next == null || next === '';
    },
  };
}

const user = getUser();
const role = normalizeRole(user?.rol ?? user?.role);
const target = document.getElementById(`${role}-dashboard`);
if (target && (role === 'senderista' || role === 'monitor')) {
  const panel = element('section', 'identity-summary');
  panel.setAttribute('aria-label', 'Identificadores de tu cuenta');
  panel.append(element('h2', 'identity-heading', 'Identificadores de mi cuenta'));
  const userId = detail('Mi ID de usuario', user?.id_usuario ?? user?.id ?? 'Sin asignar');
  panel.append(userId.block);

  if (role === 'monitor') {
    panel.append(element('p', 'identity-note', 'Comparte tu ID de usuario con el senderista para recibir una invitación de monitoreo.'));
  } else {
    const deviceId = detail('ID de mi dispositivo', 'Sin asignar');
    const pairingCode = detail('Código de mi dispositivo', 'Sin asignar');
    panel.append(deviceId.block, pairingCode.block);
    const note = element('p', 'identity-note', 'Este código identifica tu dispositivo. No lo publiques.');
    panel.append(note);
    // Si el senderista fue registrado sin dispositivo, se le permite reclamar uno libre.
    (async () => {
      try {
        const device = unwrap(await api('/dispositivos/mio'));
        deviceId.set(device?.id_dispositivo);
        pairingCode.set(device?.codigo_vinculacion);
      } catch (error) {
        if (error.status !== 404) {
          note.textContent = `No se pudo consultar tu dispositivo: ${error.message}`;
          return;
        }
        note.textContent = 'Tu cuenta aún no tiene un dispositivo asignado. Puedes asociar uno disponible mediante su código.';
        const section = element('div', 'identity-assign');
        const form = document.createElement('form');
        const field = element('div', 'field');
        const label = element('label', '', 'Código de dispositivo disponible');
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 20;
        input.required = true;
        input.placeholder = 'Código de vinculación';
        input.id = 'claim-device-code';
        label.htmlFor = input.id;
        const submit = element('button', 'btn btn-small', 'Asociar dispositivo');
        submit.type = 'submit';
        const result = element('p', 'message');
        result.hidden = true;
        field.append(label, input);
        form.append(field, submit);
        section.append(form, result);
        panel.append(section);
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          submit.disabled = true;
          result.hidden = true;
          try {
            await api('/dispositivos/vincular', {
              method: 'POST', body: { codigo_vinculacion: input.value.trim() }
            });
            result.textContent = 'Dispositivo asociado. Actualizando...';
            result.hidden = false;
            window.location.reload();
          } catch (err) {
            result.textContent = err.message;
            result.className = 'message error';
            result.hidden = false;
            submit.disabled = false;
          }
        });
      }
    })();
  }
  target.prepend(panel);
}
