export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export function text(selector, value, root = document) {
  const node = typeof selector === 'string' ? $(selector, root) : selector;
  if (node) node.textContent = value ?? 'No disponible';
}
export function create(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (val == null) return;
    if (key === 'className') node.className = val;
    else if (key === 'textContent') node.textContent = String(val);
    else if (key === 'disabled') node.disabled = !!val;
    else if (key === 'value') node.value = String(val);
    else node.setAttribute(key, String(val));
  });
  (Array.isArray(children) ? children : [children]).forEach(child => {
    if (child == null) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}
export function empty(container, message) {
  container.replaceChildren(create('div', { className: 'empty', textContent: message }));
}
export function message(target, content, type = '') {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  el.textContent = content;
  el.className = `message ${type}`.trim();
  el.hidden = !content;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
}
export function toast(content, type = '') {
  const region = $('[data-toast-region]');
  if (!region) return;
  const el = create('div', { className: `toast ${type}`.trim(), textContent: content, role: 'status' });
  region.append(el);
  setTimeout(() => el.remove(), 5000);
}
export function pill(value) {
  const status = String(value || 'Sin información');
  const normalized = status.toLowerCase();
  const klass = /error|crítica|revocad|cancel|inactiv|rechazad/.test(normalized) ? 'danger' :
    /pendient|espera|solicitud/.test(normalized) ? 'pending' :
      /desconocid|sin/.test(normalized) ? 'neutral' : '';
  return create('span', { className: `pill ${klass}`, textContent: status });
}
export function number(value, digits = 2) {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) ? n.toFixed(digits) : 'No disponible';
}
export function formatDate(value) {
  if (!value) return 'No disponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
export function idOf(obj, ...keys) { return keys.map(key => obj?.[key]).find(v => v !== undefined && v !== null) ?? null; }
export function actionButton(label, callback, variant = 'btn-secondary') {
  const btn = create('button', { type: 'button', className: `btn btn-small ${variant}`, textContent: label });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try { await callback(); } catch (err) { toast(err.message || 'Ocurrió un error.', 'error'); }
    finally { btn.disabled = false; }
  });
  return btn;
}
export function setupTabs() {
  const tabs = $$('[role="tab"]');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
  }));
}
