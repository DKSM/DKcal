import { $, showToast } from './utils.js';
import { api } from './api.js';

export async function checkAuth() {
  try {
    const data = await api.get('/api/me');
    if (data.authenticated) return data;
    return null;
  } catch {
    return null;
  }
}

export function initAuth(onSuccess) {
  const screen = $('#login-screen');
  const form = $('#login-form');
  const errorEl = $('#login-error');

  screen.style.display = 'flex';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const inputs = form.querySelectorAll('input');
    const username = inputs[0].value;
    const password = inputs[1].value;

    try {
      await api.post('/api/login', { username, password });
      screen.style.display = 'none';
      onSuccess();
    } catch (err) {
      errorEl.textContent = err.message || 'Mot de passe incorrect';
    }
  });
}

export async function logout() {
  try {
    await api.post('/api/logout');
  } catch { /* ignore */ }
  window.location.reload();
}
