import { checkAuth, initAuth } from './auth.js';
import { initDashboard } from './dashboard.js';
import { $ } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const authenticated = await checkAuth();
  if (authenticated) {
    $('#login-screen').style.display = 'none';
    initDashboard();
  } else {
    initAuth(() => initDashboard());
  }
});
