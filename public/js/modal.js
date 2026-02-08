import { createElement } from './utils.js';

const modalStack = [];

export function openModal(title, renderBody, { footer, onClose, wide } = {}) {
  const overlay = createElement('div', { className: 'modal-overlay' });
  const modal = createElement('div', { className: `modal${wide ? ' wide' : ''}` });

  const header = createElement('div', { className: 'modal-header' }, [
    createElement('h2', { textContent: title }),
    createElement('button', { className: 'modal-close', textContent: '\u00d7', onClick: () => closeModal(handle) }),
  ]);

  const body = createElement('div', { className: 'modal-body' });

  modal.appendChild(header);
  modal.appendChild(body);

  if (footer) {
    const foot = createElement('div', { className: 'modal-footer' });
    footer(foot);
    modal.appendChild(foot);
  }

  overlay.appendChild(modal);
  // Click outside does NOT close — only close button or Escape

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  const handle = {
    overlay,
    body,
    close: () => closeModal(handle),
    onClose,
  };

  modalStack.push(handle);
  renderBody(body, handle);
  return handle;
}

export function closeModal(handle) {
  if (!handle) {
    if (modalStack.length === 0) return;
    handle = modalStack[modalStack.length - 1];
  }

  const idx = modalStack.indexOf(handle);
  if (idx !== -1) modalStack.splice(idx, 1);

  handle.overlay.classList.remove('active');
  setTimeout(() => handle.overlay.remove(), 200);

  if (handle.onClose) handle.onClose();
}

export function closeAllModals() {
  while (modalStack.length > 0) {
    closeModal(modalStack[modalStack.length - 1]);
  }
}

// Escape key closes top modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length > 0) {
    closeModal(modalStack[modalStack.length - 1]);
  }
});
