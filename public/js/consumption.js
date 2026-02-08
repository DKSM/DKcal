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

    // All items list
    const suggestionsDiv = createElement('div', { className: 'form-group' });
    const suggestionsLabel = createElement('label', { textContent: 'Tous les aliments' });
    const suggestionsList = createElement('div', { className: 'search-results' });
    suggestionsDiv.appendChild(suggestionsLabel);
    suggestionsDiv.appendChild(suggestionsList);
    body.appendChild(suggestionsDiv);

    // Temporary item button
    const tempBtn = createElement('button', {
      className: 'btn btn-secondary',
      style: 'width: 100%; margin-bottom: 12px;',
      textContent: '+ Aliment temporaire',
      onClick: () => {
        openTempItemForm(dateStr, () => {
          handle.close();
          onDone();
        });
      },
    });
    body.appendChild(tempBtn);

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

    // Load all items sorted by popularity
    (async () => {
      try {
        suggestions = await api.get('/api/suggestions');
        if (suggestions.length > 0) {
          renderResults(suggestions, suggestionsList);
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

function openTempItemForm(dateStr, onDone, existingEntry) {
  const isEdit = !!existingEntry;
  const title = isEdit ? 'Modifier l\'aliment temporaire' : 'Aliment temporaire';

  openModal(title, (body, handle) => {
    // Name
    const nameGroup = createElement('div', { className: 'form-group' });
    nameGroup.appendChild(createElement('label', { textContent: 'Nom' }));
    const nameInput = createElement('input', {
      className: 'input',
      value: existingEntry?.itemName || '',
      placeholder: 'Ex : Plat du restaurant, Snack...',
    });
    nameGroup.appendChild(nameInput);
    body.appendChild(nameGroup);

    // Description for AI
    const descGroup = createElement('div', { className: 'form-group' });
    descGroup.appendChild(createElement('label', { textContent: 'Description pour l\'IA (optionnel)' }));
    const descInput = createElement('textarea', {
      className: 'input',
      value: '',
      placeholder: 'Ex : steak haché 150g, frites maison, salade verte...',
      rows: '2',
      style: 'resize: vertical; min-height: 42px;',
    });
    descGroup.appendChild(descInput);
    body.appendChild(descGroup);

    // AI estimate row
    const estimateRow = createElement('div', {
      style: 'margin-bottom: 12px; display: flex; align-items: center; gap: 8px;',
    });

    const estimateBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: 'Estimer (IA)',
      style: 'width: 100%;',
      onClick: () => doEstimate(),
    });
    estimateRow.appendChild(estimateBtn);
    body.appendChild(estimateRow);

    // Nutrition fields
    const row1 = createElement('div', { className: 'form-row' });
    const gKcal = createElement('div', { className: 'form-group' });
    gKcal.appendChild(createElement('label', { textContent: 'Calories' }));
    const kcalInput = createElement('input', {
      className: 'input', type: 'number', placeholder: '0', min: '0', step: 'any',
      value: existingEntry?.kcal ?? '',
    });
    gKcal.appendChild(kcalInput);
    const gProt = createElement('div', { className: 'form-group' });
    gProt.appendChild(createElement('label', { textContent: 'Protéines (g)' }));
    const protInput = createElement('input', {
      className: 'input', type: 'number', placeholder: '0', min: '0', step: 'any',
      value: existingEntry?.protein ?? '',
    });
    gProt.appendChild(protInput);
    row1.appendChild(gKcal);
    row1.appendChild(gProt);
    body.appendChild(row1);

    const row2 = createElement('div', { className: 'form-row' });
    const gFat = createElement('div', { className: 'form-group' });
    gFat.appendChild(createElement('label', { textContent: 'Lipides (g)' }));
    const fatInput = createElement('input', {
      className: 'input', type: 'number', placeholder: '0', min: '0', step: 'any',
      value: existingEntry?.fat ?? '',
    });
    gFat.appendChild(fatInput);
    const gCarbs = createElement('div', { className: 'form-group' });
    gCarbs.appendChild(createElement('label', { textContent: 'Glucides (g)' }));
    const carbsInput = createElement('input', {
      className: 'input', type: 'number', placeholder: '0', min: '0', step: 'any',
      value: existingEntry?.carbs ?? '',
    });
    gCarbs.appendChild(carbsInput);
    row2.appendChild(gFat);
    row2.appendChild(gCarbs);
    body.appendChild(row2);

    // Qty + unit (only for new, not edit)
    let qtyInput, unitSelect;
    if (!isEdit) {
      const qtyGroup = createElement('div', { className: 'form-group' });
      qtyGroup.appendChild(createElement('label', { textContent: 'Quantité' }));
      const qtyRow = createElement('div', { className: 'form-row' });
      qtyInput = createElement('input', {
        className: 'input', type: 'number', placeholder: '1', min: '0.1', step: 'any', value: '1',
      });
      unitSelect = createElement('select', { className: 'input' });
      unitSelect.innerHTML = '<option value="unit">unité(s)</option><option value="g">g</option><option value="ml">ml</option>';
      qtyRow.appendChild(qtyInput);
      qtyRow.appendChild(unitSelect);
      qtyGroup.appendChild(qtyRow);
      body.appendChild(qtyGroup);
    }

    // AI estimate logic
    async function doEstimate() {
      const text = nameInput.value.trim();
      if (!text) { showToast('Remplis le nom d\'abord', true); return; }

      estimateBtn.disabled = true;
      estimateBtn.textContent = '...';

      try {
        const desc = descInput.value.trim();
        let url = `/api/estimate?q=${encodeURIComponent(text)}&unit=portion`;
        if (desc) url += `&desc=${encodeURIComponent(desc)}`;
        const result = await api.get(url);

        kcalInput.value = result.kcal;
        if (result.protein != null) protInput.value = result.protein;
        if (result.fat != null) fatInput.value = result.fat;
        if (result.carbs != null) carbsInput.value = result.carbs;

        estimateBtn.textContent = 'Estimer (IA)';
        estimateBtn.disabled = false;
        showToast('Valeurs estimées par l\'IA');
      } catch (err) {
        showToast(err.message, true);
        estimateBtn.textContent = 'Estimer (IA)';
        estimateBtn.disabled = false;
      }
    }

    // Submit
    const submitBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: isEdit ? 'Enregistrer' : 'Ajouter',
      style: 'width: 100%; margin-top: 12px;',
      onClick: async () => {
        const itemName = nameInput.value.trim() || 'Temporaire';
        const kcal = parseFloat(kcalInput.value) || 0;
        const protein = parseFloat(protInput.value) || 0;
        const fat = parseFloat(fatInput.value) || 0;
        const carbs = parseFloat(carbsInput.value) || 0;

        try {
          if (isEdit) {
            await api.put(`/api/day/${dateStr}`, {
              updateEntry: {
                id: existingEntry.id,
                itemName,
                kcal,
                protein,
                fat,
                carbs,
              },
            });
            showToast('Entrée modifiée');
          } else {
            const qty = parseFloat(qtyInput.value) || 1;
            const unitType = unitSelect.value;
            await api.put(`/api/day/${dateStr}`, {
              addEntry: {
                temporary: true,
                itemName,
                qty,
                unitType,
                kcal,
                protein,
                fat,
                carbs,
              },
            });
            showToast('Consommation ajoutée');
          }
          handle.close();
          onDone();
        } catch (err) {
          showToast(err.message, true);
        }
      },
    });
    body.appendChild(submitBtn);

    nameInput.focus();
  });
}

export { openTempItemForm };
