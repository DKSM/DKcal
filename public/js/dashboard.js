import { $, createElement, formatDate, todayStr, addDays, showToast } from './utils.js';
import { api } from './api.js';
import { openAddConsumption } from './consumption.js';
import { openItemsModal, openItemForm } from './items.js';
import { openStatsModal } from './stats.js';
import { logout } from './auth.js';

let currentDate = todayStr();
let currentDay = null;

export async function initDashboard() {
  const dashboard = $('#dashboard');
  dashboard.classList.add('active');

  bindDateNav();
  bindWeightInput();
  bindActionButtons();
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

function bindWeightInput() {
  const input = $('#weight-input');
  let saveTimer;
  input.addEventListener('input', () => {
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
  $('#total-kcal').textContent = Math.round(currentDay.totals.kcal).toLocaleString();
  $('#total-protein').textContent = Math.round(currentDay.totals.protein);
  $('#total-fat').textContent = Math.round(currentDay.totals.fat || 0);
  $('#total-carbs').textContent = Math.round(currentDay.totals.carbs || 0);

  // Weight
  const weightInput = $('#weight-input');
  weightInput.value = currentDay.weight || '';

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
    return;
  }

  for (const entry of currentDay.entries) {
    const macroSpans = [
      createElement('span', { className: 'macro-p', innerHTML: `Protéines : ${entry.protein ?? 0}g` }),
      createElement('span', { className: 'macro-l', innerHTML: `Lipides : ${entry.fat ?? 0}g` }),
      createElement('span', { className: 'macro-g', innerHTML: `Glucides : ${entry.carbs ?? 0}g` }),
    ];

    const item = createElement('div', { className: 'entry-item' }, [
      createElement('span', { className: 'entry-time', textContent: entry.time || '' }),
      createElement('div', { className: 'entry-info' }, [
        createElement('div', { className: 'entry-name', textContent: entry.itemName || 'Unknown' }),
        createElement('div', { className: 'entry-detail', textContent: `${entry.qty} ${entry.unitType}` }),
      ]),
      createElement('div', { className: 'entry-nutrition' }, [
        createElement('span', { className: 'entry-kcal', textContent: `${Math.round(entry.kcal)} kcal` }),
        createElement('span', { className: 'entry-macros' }, macroSpans),
      ]),
      createElement('button', {
        className: 'entry-edit',
        innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
        onClick: () => editItem(entry.itemId),
      }),
      createElement('button', {
        className: 'entry-delete',
        innerHTML: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        onClick: () => removeEntry(entry.id),
      }),
    ]);
    list.appendChild(item);
  }
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

async function removeEntry(entryId) {
  try {
    currentDay = await api.put(`/api/day/${currentDate}`, { removeEntryId: entryId });
    renderDay();
  } catch (err) {
    showToast(err.message, true);
  }
}
