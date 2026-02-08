import { $, showToast } from './utils.js';
import { api } from './api.js';

export async function checkAuth() {
  try {
    const data = await api.get('/api/me');
    return data.authenticated;
  } catch {
    return false;
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
    const password = form.querySelector('input').value;

    try {
      await api.post('/api/login', { password });
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
