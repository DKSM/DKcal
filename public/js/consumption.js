import { createElement, debounce, showToast } from './utils.js';
import { api } from './api.js';
import { openModal } from './modal.js';
import { openItemForm } from './items.js';

export function openAddConsumption(dateStr, onDone) {
  openModal('Ajouter une consommation', (body, handle) => {
    let selectedItem = null;
    let suggestions = [];

    // Search
    const searchGroup = createElement('div', { className: 'form-group' });
    const searchInput = createElement('input', {
      className: 'input',
      placeholder: 'Rechercher un aliment...',
      type: 'text',
    });
    const resultsDiv = createElement('div', { className: 'search-results' });
    resultsDiv.style.display = 'none';
    searchGroup.appendChild(createElement('label', { textContent: 'Aliment' }));
    searchGroup.appendChild(searchInput);
    searchGroup.appendChild(resultsDiv);
    body.appendChild(searchGroup);

    // Suggestions
    const suggestionsDiv = createElement('div', { className: 'form-group' });
    const suggestionsLabel = createElement('label', { textContent: 'Suggestions (14 derniers jours)' });
    const suggestionsList = createElement('div', { className: 'search-results' });
    suggestionsDiv.appendChild(suggestionsLabel);
    suggestionsDiv.appendChild(suggestionsList);
    body.appendChild(suggestionsDiv);

    // Quantity form (hidden until item selected)
    const qtyForm = createElement('div', { className: 'form-group' });
    qtyForm.style.display = 'none';

    const selectedLabel = createElement('div', {
      style: 'margin-bottom: 8px; font-weight: 600; color: var(--accent);',
    });

    const qtyRow = createElement('div', { className: 'form-row' });
    const qtyInput = createElement('input', {
      className: 'input',
      type: 'number',
      placeholder: 'Quantite',
      min: '0.1',
      step: 'any',
    });
    const unitSelect = createElement('select', { className: 'input' });

    qtyRow.appendChild(qtyInput);
    qtyRow.appendChild(unitSelect);
    qtyForm.appendChild(selectedLabel);
    qtyForm.appendChild(qtyRow);

    const addBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Ajouter',
      style: 'width: 100%; margin-top: 12px;',
      onClick: async () => {
        if (!selectedItem || !qtyInput.value) return;
        try {
          await api.put(`/api/day/${dateStr}`, {
            addEntry: {
              itemId: selectedItem.id,
              qty: parseFloat(qtyInput.value),
              unitType: unitSelect.value,
            },
          });
          handle.close();
          showToast('Consommation ajoutee');
          onDone();
        } catch (err) {
          showToast(err.message, true);
        }
      },
    });
    qtyForm.appendChild(addBtn);
    body.appendChild(qtyForm);

    function selectItem(item) {
      selectedItem = item;
      selectedLabel.textContent = item.name;
      qtyForm.style.display = 'block';
      resultsDiv.style.display = 'none';
      searchInput.value = item.name;

      // Set unit options based on mode + baseUnit
      unitSelect.innerHTML = '';
      if (item.mode === 'per_100') {
        if (item.baseUnit === 'ml') {
          unitSelect.appendChild(createElement('option', { value: 'ml', textContent: 'ml' }));
          unitSelect.appendChild(createElement('option', { value: 'g', textContent: 'g' }));
        } else {
          unitSelect.appendChild(createElement('option', { value: 'g', textContent: 'g' }));
          unitSelect.appendChild(createElement('option', { value: 'ml', textContent: 'ml' }));
        }
        qtyInput.value = '100';
      } else {
        unitSelect.appendChild(createElement('option', { value: 'unit', textContent: 'unité(s)' }));
        unitSelect.appendChild(createElement('option', { value: 'g', textContent: 'g' }));
        qtyInput.value = '1';
      }
      qtyInput.focus();
      qtyInput.select();
    }

    function renderResults(items, container, query) {
      container.innerHTML = '';
      if (items.length === 0) {
        const emptyRow = createElement('div', {
          style: 'padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;',
        }, [
          createElement('span', { textContent: 'Aucun résultat', style: 'color: var(--text-muted); font-size: 0.85rem;' }),
        ]);
        if (query) {
          emptyRow.appendChild(createElement('button', {
            className: 'btn btn-primary btn-sm',
            textContent: '+ Créer',
            onClick: () => {
              openItemForm({ name: query }, async () => {
                doSearch(searchInput.value.trim());
              });
            },
          }));
        }
        container.appendChild(emptyRow);
        container.style.display = 'block';
        return;
      }
      for (const item of items) {
        const computed = item.computed || {};
        const kcalStr = computed.kcal != null ? `${Math.round(computed.kcal)} kcal` : '';
        const freqStr = item.frequency ? `${item.frequency}x` : '';
        const detailParts = [kcalStr, freqStr].filter(Boolean).join(' · ');
        const el = createElement('div', { className: 'search-result-item', onClick: () => selectItem(item) }, [
          createElement('div', { className: 'result-name', textContent: item.name }),
          createElement('div', { className: 'result-detail', textContent: detailParts }),
        ]);
        container.appendChild(el);
      }
      container.style.display = 'block';
    }

    // Search handler
    const doSearch = debounce(async (query) => {
      if (query.length < 1) {
        resultsDiv.style.display = 'none';
        suggestionsDiv.style.display = 'block';
        return;
      }
      try {
        const items = await api.get(`/api/items?search=${encodeURIComponent(query)}`);
        suggestionsDiv.style.display = 'none';
        renderResults(items, resultsDiv, query);
      } catch (err) {
        showToast(err.message, true);
      }
    }, 300);

    searchInput.addEventListener('input', () => doSearch(searchInput.value.trim()));

    // Load suggestions
    (async () => {
      try {
        suggestions = await api.get('/api/suggestions');
        if (suggestions.length > 0) {
          // Enrich with computed values, keep frequency
          const allItems = await api.get('/api/items');
          const itemsMap = new Map(allItems.map(i => [i.id, i]));
          const enriched = suggestions.map(s => {
            const full = itemsMap.get(s.id);
            return full ? { ...full, frequency: s.frequency } : s;
          });
          renderResults(enriched, suggestionsList);
        } else {
          suggestionsDiv.style.display = 'none';
        }
      } catch {
        suggestionsDiv.style.display = 'none';
      }
    })();

    searchInput.focus();
  });
}
