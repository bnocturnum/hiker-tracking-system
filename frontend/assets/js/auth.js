const KEY = 'senderismo_pt2_session';
export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}
export function getToken() { return getSession()?.token || ''; }
export function getUser() { return getSession()?.user || null; }
export function setSession(token, user) {
  if (!token || !user) throw new Error('Respuesta de inicio de sesión incompleta.');
  sessionStorage.setItem(KEY, JSON.stringify({ token, user }));
}
export function clearSession() { sessionStorage.removeItem(KEY); }
export function normalizeRole(value) {
  const role = String(value || '').toLowerCase().trim();
  if (role === 'admin') return 'administrador';
  return role;
}
export function requireSession(allowedRoles = []) {
  const session = getSession();
  if (!session?.token || !session?.user) {
    window.location.replace('./login.html'); return null;
  }
  const role = normalizeRole(session.user.rol || session.user.role);
  if (allowedRoles.length && !allowedRoles.includes(role)) {
    window.location.replace('./dashboard.html'); return null;
  }
  return { ...session.user, rol: role };
}
export function initUserHeader(user) {
  const name = user?.nombre?.split(' ')[0] || 'usuario';
  const greeting = document.querySelector('[data-user-greeting]');
  if (greeting) greeting.textContent = `¡Hola, ${name}!`;
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-user-menu]');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.hidden = expanded;
    });
    document.addEventListener('click', e => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => {
    clearSession(); window.location.replace('./login.html');
  }));
}
