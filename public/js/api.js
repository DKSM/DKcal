export async function apiFetch(url, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);

  if (res.status === 401) {
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const defaultMessages = {
      400: 'Requête invalide',
      401: 'Session expirée, reconnectez-vous',
      403: 'Accès interdit',
      404: 'Ressource introuvable',
      500: 'Erreur serveur',
      502: 'Service temporairement indisponible',
      503: 'Service indisponible',
    };
    const err = await res.json().catch(() => ({ error: defaultMessages[res.status] || `Erreur HTTP ${res.status}` }));
    throw new Error(err.error || defaultMessages[res.status] || `Erreur HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: (url) => apiFetch(url),
  post: (url, body) => apiFetch(url, { method: 'POST', body }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body }),
  delete: (url) => apiFetch(url, { method: 'DELETE' }),
};
