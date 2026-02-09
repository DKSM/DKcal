import { createElement, debounce, showToast } from './utils.js';
import { api } from './api.js';
import { openModal } from './modal.js';
import { openItemForm, showHintPopup, LOADING_PHRASES } from './items.js';
import { adjustCal } from './profile.js';

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
    searchGroup.appendChild(searchInput);
    searchGroup.appendChild(resultsDiv);
    body.appendChild(searchGroup);

    // All items list
    const suggestionsDiv = createElement('div', { className: 'form-group' });
    const suggestionsList = createElement('div', { className: 'search-results' });
    suggestionsDiv.appendChild(suggestionsList);
    body.appendChild(suggestionsDiv);

    // Temporary item button
    const tempBtn = createElement('button', {
      className: 'btn btn-secondary',
      style: 'width: 100%; margin-bottom: 4px;',
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
        if (!selectedItem) { showToast('Sélectionne un aliment', true); return; }
        if (!qtyInput.value) { showToast('Indique une quantité', true); return; }
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
        const kcalStr = computed.kcal != null ? `${adjustCal(Math.round(computed.kcal))} kcal` : '';
        const el = createElement('div', { className: 'search-result-item', onClick: () => selectItem(item) }, [
          createElement('span', { className: 'result-name', textContent: item.name }),
          createElement('span', { className: 'result-detail', textContent: kcalStr }),
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
    const nameWrap = createElement('div', { className: 'name-input-wrap' });
    const nameInput = createElement('input', {
      className: 'input',
      value: existingEntry?.itemName || '',
      placeholder: 'Ex : Plat du restaurant, Snack...',
    });
    const hintBulb = createElement('button', {
      type: 'button',
      className: 'hint-bulb',
      title: 'Astuce IA',
      innerHTML: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 014 12.7V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.3A7 7 0 0112 2z"/></svg>',
      onClick: () => showHintPopup(),
    });
    nameWrap.appendChild(nameInput);
    nameWrap.appendChild(hintBulb);
    nameGroup.appendChild(nameWrap);
    body.appendChild(nameGroup);

    // Description for AI
    const descGroup = createElement('div', { className: 'form-group' });
    descGroup.appendChild(createElement('label', { textContent: 'Description pour l\'IA (optionnel)' }));
    const descInput = createElement('textarea', {
      className: 'input',
      value: existingEntry?.description || '',
      placeholder: 'Ex : steak haché 150g, frites maison, salade verte...',
      rows: '2',
      style: 'resize: vertical; min-height: 42px;',
    });
    descGroup.appendChild(descInput);
    body.appendChild(descGroup);

    // AI estimate row
    let phraseInterval = null;
    let pendingEstimate = null;
    const estimateRow = createElement('div', { style: 'margin-bottom: 12px;' });

    const estimateBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: 'Estimation avec l\'IA',
      style: 'width: 100%;',
      onClick: () => doEstimate(),
    });
    estimateRow.appendChild(estimateBtn);
    body.appendChild(estimateRow);

    const estimateResultRow = createElement('div', {
      style: 'display: none; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; padding: 8px 12px; background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);',
    });
    body.appendChild(estimateResultRow);

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
    function startLoadingPhrases() {
      estimateBtn.textContent = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
      phraseInterval = setInterval(() => {
        estimateBtn.textContent = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
      }, 2000);
    }

    function resetEstimate() {
      pendingEstimate = null;
      if (phraseInterval) { clearInterval(phraseInterval); phraseInterval = null; }
      estimateResultRow.style.display = 'none';
      estimateBtn.classList.remove('btn-loading');
      estimateBtn.textContent = 'Estimation avec l\'IA';
      estimateBtn.disabled = false;
    }

    handle.onClose = resetEstimate;

    async function doEstimate() {
      const desc = descInput.value.trim();
      const text = nameInput.value.trim();
      if (!desc && !text) { showToast('Remplis au moins le nom ou la description', true); return; }

      estimateBtn.disabled = true;
      estimateBtn.classList.add('btn-loading');
      startLoadingPhrases();

      try {
        const params = new URLSearchParams({ unit: 'portion' });
        if (desc) params.set('desc', desc);
        if (text) params.set('q', text);
        let url = `/api/estimate?${params}`;
        const result = await api.get(url);
        pendingEstimate = result;

        clearInterval(phraseInterval);
        phraseInterval = null;
        estimateBtn.classList.remove('btn-loading');
        estimateBtn.textContent = 'Estimation avec l\'IA';
        estimateBtn.disabled = false;

        estimateResultRow.innerHTML = '';
        estimateResultRow.style.display = 'flex';
        estimateResultRow.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; font-weight: 600; color: var(--accent); white-space: nowrap;',
          textContent: `${result.kcal} kcal`,
        }));
        estimateResultRow.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; white-space: nowrap;',
          innerHTML: `<b style="color:var(--protein-color)">Protéines :</b><span style="color:var(--text-secondary)"> ${result.protein}</span>`,
        }));
        estimateResultRow.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; white-space: nowrap;',
          innerHTML: `<b style="color:var(--warning)">Lipides :</b><span style="color:var(--text-secondary)"> ${result.fat}</span>`,
        }));
        estimateResultRow.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; white-space: nowrap;',
          innerHTML: `<b style="color:var(--success)">Glucides :</b><span style="color:var(--text-secondary)"> ${result.carbs}</span>`,
        }));
        const btnGroup = createElement('div', { style: 'margin-left: auto; display: flex; gap: 6px; flex-shrink: 0;' });
        btnGroup.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--success); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;',
          textContent: '\u2713',
          title: 'Remplacer toutes les valeurs',
          onClick: () => {
            kcalInput.value = result.kcal;
            if (result.protein != null) protInput.value = result.protein;
            if (result.fat != null) fatInput.value = result.fat;
            if (result.carbs != null) carbsInput.value = result.carbs;
            resetEstimate();
            showToast('Valeurs appliquées');
          },
        }));
        btnGroup.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--accent); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;',
          textContent: '\u270e',
          title: 'Compléter uniquement les champs vides ou à zéro',
          onClick: () => {
            let count = 0;
            if ((!kcalInput.value || parseFloat(kcalInput.value) === 0)) { kcalInput.value = result.kcal; count++; }
            if ((!protInput.value || parseFloat(protInput.value) === 0) && result.protein != null) { protInput.value = result.protein; count++; }
            if ((!fatInput.value || parseFloat(fatInput.value) === 0) && result.fat != null) { fatInput.value = result.fat; count++; }
            if ((!carbsInput.value || parseFloat(carbsInput.value) === 0) && result.carbs != null) { carbsInput.value = result.carbs; count++; }
            resetEstimate();
            showToast(count > 0 ? `${count} valeur${count > 1 ? 's' : ''} complétée${count > 1 ? 's' : ''}` : 'Rien à compléter');
          },
        }));
        btnGroup.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--danger); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;',
          textContent: '\u2717',
          title: 'Annuler l\'estimation',
          onClick: () => resetEstimate(),
        }));
        estimateResultRow.appendChild(btnGroup);
      } catch (err) {
        showToast(err.message, true);
        resetEstimate();
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
                description: descInput.value.trim(),
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
                description: descInput.value.trim(),
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
