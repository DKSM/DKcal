import { $, createElement, showToast } from './utils.js';
import { api } from './api.js';
import { openModal } from './modal.js';

export function initAdmin(authData) {
  const btnAdmin = $('#btn-admin');
  const btnExit = $('#btn-exit-spectator');

  if (authData.isAdmin) {
    btnAdmin.style.display = '';
    btnAdmin.addEventListener('click', () => openAdminModal());
  }

  if (authData.impersonating) {
    btnExit.style.display = '';
    btnExit.addEventListener('click', async () => {
      try {
        await api.post('/api/admin/exit-impersonate');
        window.location.reload();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }
}

async function openAdminModal() {
  openModal('Administration', async (body) => {
    // Create user form
    const createSection = createElement('div', { className: 'admin-create-section' });
    const createTitle = createElement('h3', {
      className: 'admin-section-title',
      textContent: 'Nouvel utilisateur',
    });
    const createForm = createElement('div', { className: 'admin-create-form' });
    const usernameInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: 'Identifiant',
    });
    const passwordInput = createElement('input', {
      className: 'input',
      type: 'password',
      placeholder: 'Mot de passe',
    });
    const createBtn = createElement('button', {
      className: 'btn btn-primary btn-sm',
      textContent: 'Créer',
    });
    createForm.appendChild(usernameInput);
    createForm.appendChild(passwordInput);
    createForm.appendChild(createBtn);
    createSection.appendChild(createTitle);
    createSection.appendChild(createForm);
    body.appendChild(createSection);

    // User list
    const listTitle = createElement('h3', {
      className: 'admin-section-title',
      textContent: 'Utilisateurs',
    });
    body.appendChild(listTitle);

    const listContainer = createElement('div', { className: 'admin-user-list' });
    body.appendChild(listContainer);

    async function loadUsers() {
      try {
        const users = await api.get('/api/admin/users');
        listContainer.innerHTML = '';
        for (const user of users) {
          listContainer.appendChild(renderUserItem(user, loadUsers));
        }
      } catch (err) {
        listContainer.innerHTML = '';
        listContainer.appendChild(createElement('p', {
          className: 'admin-error',
          textContent: err.message,
        }));
      }
    }

    createBtn.addEventListener('click', async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        showToast('Identifiant et mot de passe requis', true);
        return;
      }
      try {
        await api.post('/api/admin/users', { username, password });
        usernameInput.value = '';
        passwordInput.value = '';
        showToast('Utilisateur créé');
        await loadUsers();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    await loadUsers();
  });
}

function renderUserItem(user, refreshFn) {
  const item = createElement('div', { className: 'admin-user-item' });

  const info = createElement('div', { className: 'admin-user-info' });
  info.appendChild(createElement('span', {
    className: 'admin-user-name',
    textContent: user.username,
  }));
  if (user.created) {
    const date = new Date(user.created);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    info.appendChild(createElement('span', {
      className: 'admin-user-date',
      textContent: dateStr,
    }));
  }
  item.appendChild(info);

  const actions = createElement('div', { className: 'admin-user-actions' });

  // Password change
  const pwdBtn = createElement('button', {
    className: 'admin-action-btn',
    title: 'Changer le mot de passe',
    innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
  });
  pwdBtn.addEventListener('click', () => {
    togglePasswordForm(item, user, refreshFn);
  });

  // Spectator mode
  const spectateBtn = createElement('button', {
    className: 'admin-action-btn admin-action-spectate',
    title: 'Mode spectateur',
    innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  });
  spectateBtn.addEventListener('click', async () => {
    try {
      await api.post('/api/admin/impersonate', { userId: user.id });
      window.location.reload();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // Delete
  const deleteBtn = createElement('button', {
    className: 'admin-action-btn admin-action-delete',
    title: 'Supprimer',
    innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  });
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Supprimer l'utilisateur "${user.username}" ?`)) return;
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      showToast('Utilisateur supprimé');
      await refreshFn();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  actions.appendChild(pwdBtn);
  actions.appendChild(spectateBtn);
  actions.appendChild(deleteBtn);
  item.appendChild(actions);

  return item;
}

function togglePasswordForm(itemEl, user, refreshFn) {
  const existing = itemEl.querySelector('.admin-pwd-form');
  if (existing) {
    existing.remove();
    return;
  }

  const form = createElement('div', { className: 'admin-pwd-form' });
  const input = createElement('input', {
    className: 'input input-sm',
    type: 'password',
    placeholder: 'Nouveau mot de passe',
  });
  const saveBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    textContent: 'OK',
  });
  saveBtn.addEventListener('click', async () => {
    const password = input.value;
    if (!password || password.length < 3) {
      showToast('Mot de passe trop court', true);
      return;
    }
    try {
      await api.put(`/api/admin/users/${user.id}`, { password });
      showToast('Mot de passe modifié');
      form.remove();
    } catch (err) {
      showToast(err.message, true);
    }
  });
  form.appendChild(input);
  form.appendChild(saveBtn);
  itemEl.appendChild(form);
  input.focus();
}
