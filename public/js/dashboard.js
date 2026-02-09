import { $, createElement, formatDate, todayStr, addDays, showToast } from './utils.js';
import { api } from './api.js';
import { openAddConsumption, openTempItemForm } from './consumption.js';
import { openItemsModal, openItemForm } from './items.js';
import { openStatsModal } from './stats.js';
import { loadProfile, getProfile, openProfileModal, adjustCal } from './profile.js';
import { openModal } from './modal.js';
import { logout } from './auth.js';

function displayUnit(unitType) {
  if (unitType === 'unit') return 'unité';
  return unitType;
}

let currentDate = todayStr();
let currentDay = null;

export async function initDashboard() {
  const dashboard = $('#dashboard');
  dashboard.classList.add('active');

  bindDateNav();
  bindWeightInput();
  bindActionButtons();
  bindProfileButton();
  await loadProfile();
  await loadDay(currentDate);
}

function bindDateNav() {
  $('#date-prev').addEventListener('click', () => changeDate(-1));
  $('#date-next').addEventListener('click', () => changeDate(1));
  $('#date-label').addEventListener('click', () => {
    const input = createElement('input', { type: 'date', value: currentDate });
    input.addEventListener('change', () => {
      if (input.value) {
        currentDate = input.value;
        loadDay(currentDate);
      }
    });
    input.showPicker();
  });
}

function autoSizeWeightInput(input) {
  const len = (input.value || input.placeholder).length;
  input.style.width = Math.max(2, len) + 'ch';
}

function bindWeightInput() {
  const input = $('#weight-input');
  autoSizeWeightInput(input);
  let saveTimer;
  input.addEventListener('input', () => {
    autoSizeWeightInput(input);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const val = input.value ? parseFloat(input.value) : null;
      try {
        await api.put(`/api/day/${currentDate}`, { weight: val });
        showToast('Poids sauvegarde');
      } catch (err) {
        showToast(err.message, true);
      }
    }, 800);
  });
}

function bindActionButtons() {
  $('#btn-add').addEventListener('click', () => {
    openAddConsumption(currentDate, () => loadDay(currentDate));
  });
  $('#btn-items').addEventListener('click', () => {
    openItemsModal(() => loadDay(currentDate));
  });
  $('#btn-stats').addEventListener('click', () => {
    openStatsModal();
  });
  $('#btn-logout').addEventListener('click', logout);
}

function bindProfileButton() {
  $('#btn-profile').addEventListener('click', () => {
    openProfileModal(() => renderDay());
  });
}

function changeDate(offset) {
  currentDate = addDays(currentDate, offset);
  loadDay(currentDate);
}

export async function loadDay(dateStr) {
  currentDate = dateStr;
  try {
    currentDay = await api.get(`/api/day/${dateStr}`);
  } catch {
    currentDay = { date: dateStr, weight: null, entries: [], totals: { kcal: 0, protein: 0, fat: 0, carbs: 0 } };
  }
  renderDay();
}

function renderDay() {
  // Date label
  $('#date-label').textContent = formatDate(currentDate);

  // Totals
  $('#total-kcal').textContent = adjustCal(Math.round(currentDay.totals.kcal)).toLocaleString();
  $('#total-protein').textContent = Math.round(currentDay.totals.protein);
  $('#total-fat').textContent = Math.round(currentDay.totals.fat || 0);
  $('#total-carbs').textContent = Math.round(currentDay.totals.carbs || 0);

  // Weight
  const weightInput = $('#weight-input');
  weightInput.value = currentDay.weight || '';
  autoSizeWeightInput(weightInput);

  // Entry count badge
  const countEl = $('#entry-count');
  if (countEl) countEl.textContent = currentDay.entries.length;

  // Entries
  const list = $('#consumption-list');
  list.innerHTML = '';

  if (currentDay.entries.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        Aucune consommation
      </div>`;
    updateDeficitDisplay();
    return;
  }

  for (const entry of currentDay.entries) {
    const macroSpans = [
      createElement('span', { className: 'macro-p', innerHTML: `<span class="macro-label-full">Protéines : </span><span class="macro-label-short">P:</span>${entry.protein ?? 0}g` }),
      createElement('span', { className: 'macro-l', innerHTML: `<span class="macro-label-full">Lipides : </span><span class="macro-label-short">L:</span>${entry.fat ?? 0}g` }),
      createElement('span', { className: 'macro-g', innerHTML: `<span class="macro-label-full">Glucides : </span><span class="macro-label-short">G:</span>${entry.carbs ?? 0}g` }),
    ];

    const editBtn = createElement('button', {
      className: 'entry-edit',
      innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    });
    editBtn.addEventListener('click', (e) => {
      if (entry.temporary) {
        editTempEntry(entry);
      } else {
        showEntryEditPopup(entry, editBtn);
      }
    });

    const item = createElement('div', { className: 'entry-item' }, [
      createElement('span', { className: 'entry-time', textContent: entry.time || '' }),
      createElement('div', { className: 'entry-info' }, [
        createElement('span', { className: 'entry-name', textContent: entry.itemName || 'Unknown' }),
        createElement('span', { className: 'entry-qty-inline', textContent: `(${entry.qty} ${displayUnit(entry.unitType)})` }),
      ]),
      createElement('div', { className: 'entry-nutrition' }, [
        createElement('span', { className: 'entry-kcal', textContent: `${adjustCal(Math.round(entry.kcal))} kcal` }),
        createElement('span', { className: 'entry-macros' }, macroSpans),
      ]),
      editBtn,
      createElement('button', {
        className: 'entry-delete',
        innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        onClick: () => removeEntry(entry.id),
      }),
    ]);
    list.appendChild(item);
  }
  updateDeficitDisplay();
}

function updateDeficitDisplay() {
  const profile = getProfile();
  const maintenance = profile.maintenanceCalories;
  const barFill = $('#deficit-bar-fill');
  const deficitText = $('#deficit-text');
  const goalCursor = $('#deficit-goal-cursor');

  if (!maintenance) {
    barFill.style.width = '0%';
    deficitText.textContent = '';
    deficitText.innerHTML = '<span class="deficit-hint">Configurer profil</span>';
    const hint = deficitText.querySelector('.deficit-hint');
    if (hint) hint.addEventListener('click', () => openProfileModal(() => updateDeficitDisplay()));
    goalCursor.style.display = 'none';
    return;
  }

  const consumed = currentDay ? adjustCal(Math.round(currentDay.totals.kcal)) : 0;
  const deficitGoal = profile.deficitGoal || 0;
  const goalTarget = deficitGoal > 0 ? maintenance - deficitGoal : 0;
  const pct = Math.round((consumed / maintenance) * 100);

  // Bar fill width
  barFill.style.width = `${Math.min(pct, 100)}%`;
  barFill.className = 'deficit-bar-fill';
  barFill.style.removeProperty('--glow-size');

  // Reset inline background from previous render
  barFill.style.removeProperty('background');

  if (deficitGoal > 0) {
    // With deficit goal: progressive green → orange → red between goal and maintenance
    const goalPct = (goalTarget / maintenance) * 100;
    goalCursor.style.display = 'block';
    goalCursor.style.left = `${goalPct}%`;

    if (pct > 100) {
      barFill.classList.add('over-glow');
      barFill.style.width = '100%';
      const overPct = Math.min((consumed - maintenance) / maintenance, 0.5);
      const glowSize = Math.round(4 + overPct * 20);
      barFill.style.setProperty('--glow-size', `${glowSize}px`);
    } else if (consumed > goalTarget) {
      // Interpolate hue: green (145) → red (0) as consumed goes from goalTarget to maintenance
      const ratio = Math.min((consumed - goalTarget) / (maintenance - goalTarget), 1);
      const hue = Math.round(145 * (1 - ratio));
      barFill.style.background = `hsl(${hue}, 70%, 50%)`;
    }
    // else: stays green (default CSS)
  } else {
    // No deficit goal: original behavior
    goalCursor.style.display = 'none';
    if (pct > 100) {
      barFill.classList.add('over');
      barFill.style.width = '100%';
    } else if (pct > 75) {
      barFill.classList.add('warning');
    }
  }

  const diff = consumed - maintenance;
  const sign = diff > 0 ? '+' : '\u2212';
  const diffClass = diff > 0 ? 'deficit-remaining over' : 'deficit-remaining';
  deficitText.innerHTML = `${consumed} / ${maintenance} kcal <span class="${diffClass}">(${sign}${Math.abs(diff)})</span>`;
}

function editTempEntry(entry) {
  openTempItemForm(currentDate, () => loadDay(currentDate), entry);
}

async function editItem(itemId) {
  try {
    const items = await api.get('/api/items');
    const item = items.find(i => i.id === itemId);
    if (!item) { showToast('Aliment introuvable', true); return; }
    openItemForm(item, () => loadDay(currentDate));
  } catch (err) {
    showToast(err.message, true);
  }
}

function showEntryEditPopup(entry, buttonEl) {
  document.querySelectorAll('.entry-edit-popup').forEach(p => p.remove());

  const popup = createElement('div', { className: 'entry-edit-popup' }, [
    createElement('button', {
      className: 'entry-edit-option',
      textContent: 'Modifier la quantité',
      onClick: () => { popup.remove(); editEntryQty(entry); },
    }),
    createElement('button', {
      className: 'entry-edit-option',
      textContent: 'Modifier l\'aliment',
      onClick: () => { popup.remove(); editItem(entry.itemId); },
    }),
  ]);

  document.body.appendChild(popup);
  const rect = buttonEl.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 4}px`;
  popup.style.right = `${window.innerWidth - rect.right}px`;

  const closePopup = (e) => {
    if (!popup.contains(e.target) && e.target !== buttonEl) {
      popup.remove();
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 0);
}

function editEntryQty(entry) {
  openModal('Modifier la quantité', (body, handle) => {
    body.appendChild(createElement('div', {
      style: 'margin-bottom: 12px; font-weight: 600; color: var(--accent);',
      textContent: entry.itemName || 'Unknown',
    }));

    const qtyRow = createElement('div', { className: 'form-row' });
    const qtyInput = createElement('input', {
      className: 'input', type: 'number', value: String(entry.qty),
      min: '0.1', step: 'any',
    });
    const unitSelect = createElement('select', { className: 'input' });
    for (const u of ['g', 'ml', 'unit']) {
      const opt = createElement('option', { value: u, textContent: u === 'unit' ? 'unité' : u });
      if (u === entry.unitType) opt.selected = true;
      unitSelect.appendChild(opt);
    }
    qtyRow.appendChild(qtyInput);
    qtyRow.appendChild(unitSelect);
    body.appendChild(qtyRow);

    body.appendChild(createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Enregistrer',
      style: 'width: 100%; margin-top: 12px;',
      onClick: async () => {
        const qty = parseFloat(qtyInput.value);
        if (!qty || qty <= 0) { showToast('Quantité invalide', true); return; }
        try {
          currentDay = await api.put(`/api/day/${currentDate}`, {
            updateEntry: { id: entry.id, qty, unitType: unitSelect.value },
          });
          handle.close();
          renderDay();
          showToast('Quantité modifiée');
        } catch (err) {
          showToast(err.message, true);
        }
      },
    }));

    qtyInput.focus();
    qtyInput.select();
  });
}

async function removeEntry(entryId) {
  try {
    currentDay = await api.put(`/api/day/${currentDate}`, { removeEntryId: entryId });
    renderDay();
  } catch (err) {
    showToast(err.message, true);
  }
}
