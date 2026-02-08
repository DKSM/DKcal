import { createElement, showToast, debounce } from './utils.js';
import { api } from './api.js';
import { openModal, closeModal } from './modal.js';

export function openItemsModal(onDone) {
  openModal('Aliments', (body, handle) => {
    let allItems = [];
    const searchInput = createElement('input', {
      className: 'input',
      placeholder: 'Rechercher...',
      type: 'text',
      style: 'margin-bottom: 12px;',
    });

    const addBtn = createElement('button', {
      className: 'btn btn-primary btn-sm',
      textContent: '+ Nouvel aliment',
      style: 'margin-bottom: 12px; width: 100%;',
      onClick: () => openItemForm(null, async () => { await loadItems(); if (onDone) onDone(); }),
    });

    const listDiv = createElement('div');
    body.appendChild(searchInput);
    body.appendChild(addBtn);
    body.appendChild(listDiv);

    async function loadItems() {
      try {
        allItems = await api.get('/api/items');
        renderList(allItems);
      } catch (err) {
        showToast(err.message, true);
      }
    }

    function renderList(items) {
      listDiv.innerHTML = '';
      if (items.length === 0) {
        listDiv.innerHTML = '<div class="empty-state">Aucun aliment</div>';
        return;
      }
      for (const item of items) {
        const computed = item.computed || {};
        const kcalStr = computed.kcal != null ? `${Math.round(computed.kcal)} kcal` : '?';
        const modeLabel = item.mode === 'per_100' ? (item.baseUnit === 'ml' ? '/100ml' : '/100g') : item.mode === 'per_unit' ? '/unité' : 'recette';

        const el = createElement('div', { className: 'item-list-entry', onClick: () => {
          openItemForm(item, async () => { await loadItems(); if (onDone) onDone(); });
        }}, [
          createElement('div', { style: 'flex: 1; min-width: 0;' }, [
            createElement('div', { className: 'entry-name', textContent: item.name }),
            createElement('div', { className: 'entry-detail', textContent: kcalStr }),
          ]),
          createElement('span', { className: 'item-mode-badge', textContent: modeLabel }),
        ]);
        listDiv.appendChild(el);
      }
    }

    const doFilter = debounce((q) => {
      if (!q) { renderList(allItems); return; }
      const filtered = allItems.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
      renderList(filtered);
    }, 200);

    searchInput.addEventListener('input', () => doFilter(searchInput.value.trim()));
    loadItems();
  });
}

export function openItemForm(existingItem, onSaved) {
  const isEdit = !!existingItem?.id;
  const title = isEdit ? 'Modifier l\'aliment' : 'Nouvel aliment';

  openModal(title, (body, handle) => {
    // Internal tab: per_100g, per_100ml, per_unit, composite
    const existingTab = existingItem?.mode === 'per_100'
      ? (existingItem.baseUnit === 'ml' ? 'per_100ml' : 'per_100g')
      : (existingItem?.mode || 'per_100g');
    let currentTab = existingTab;
    let components = existingItem?.components ? [...existingItem.components] : [];

    // Name
    const nameGroup = createElement('div', { className: 'form-group' });
    nameGroup.appendChild(createElement('label', { textContent: 'Nom' }));
    const nameInput = createElement('input', {
      className: 'input',
      value: existingItem?.name || '',
      placeholder: 'Nom de l\'aliment',
    });
    nameGroup.appendChild(nameInput);
    body.appendChild(nameGroup);

    // Mode tabs
    const tabs = createElement('div', { className: 'tabs' });
    const tabDefs = [
      { id: 'per_100g', label: '100g' },
      { id: 'per_100ml', label: '100ml' },
      { id: 'per_unit', label: 'Unité' },
      { id: 'composite', label: 'Recette' },
    ];
    const tabEls = {};
    for (const t of tabDefs) {
      const tab = createElement('div', {
        className: `tab${currentTab === t.id ? ' active' : ''}`,
        textContent: t.label,
        onClick: () => switchTab(t.id),
      });
      tabEls[t.id] = tab;
      tabs.appendChild(tab);
    }
    body.appendChild(tabs);

    // Form panels
    const panelContainer = createElement('div');
    body.appendChild(panelContainer);

    // AI estimate — inline
    const estimateRow = createElement('div', {
      style: 'margin-bottom: 12px; display: flex; align-items: center; gap: 8px;',
    });
    let pendingEstimate = null;

    const estimateBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: 'Estimer (IA)',
      style: 'width: 100%; transition: width 0.2s;',
      onClick: () => doEstimate(),
    });

    const estimateResult = createElement('div', {
      style: 'display: none; flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0;',
    });

    estimateRow.appendChild(estimateBtn);
    estimateRow.appendChild(estimateResult);
    body.insertBefore(estimateRow, panelContainer);

    function resetEstimate() {
      pendingEstimate = null;
      estimateResult.style.display = 'none';
      estimateBtn.style.width = '100%';
      estimateBtn.style.flex = '';
      estimateBtn.textContent = 'Estimer (IA)';
      estimateBtn.disabled = false;
    }

    async function doEstimate() {
      const text = nameInput.value.trim();
      if (!text) { showToast('Remplis le nom d\'abord', true); return; }

      const unit = currentTab === 'per_unit' ? 'portion' : currentTab === 'per_100ml' ? '100ml' : '100g';
      estimateBtn.disabled = true;
      estimateBtn.textContent = '...';

      try {
        const result = await api.get(`/api/estimate?q=${encodeURIComponent(text)}&unit=${unit}`);
        pendingEstimate = result;

        // Shrink button, show result
        estimateBtn.style.width = 'auto';
        estimateBtn.style.flex = 'none';
        estimateBtn.textContent = 'Estimer (IA)';
        estimateBtn.disabled = false;

        estimateResult.innerHTML = '';
        estimateResult.style.display = 'flex';
        estimateResult.appendChild(createElement('span', {
          style: 'font-size: 0.85rem; font-weight: 600; color: var(--accent); white-space: nowrap;',
          textContent: `${result.kcal} kcal`,
        }));
        estimateResult.appendChild(createElement('span', {
          style: 'font-size: 0.85rem; font-weight: 600; color: var(--protein-color); white-space: nowrap;',
          textContent: `${result.protein}g`,
        }));
        estimateResult.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--success); color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; flex: none;',
          textContent: '\u2713 OK',
          onClick: () => {
            const kcalInput = panelContainer.querySelector(currentTab === 'per_unit' ? '#item-kcal-unit' : '#item-kcal-100');
            const protInput = panelContainer.querySelector(currentTab === 'per_unit' ? '#item-protein-unit' : '#item-protein-100');
            if (kcalInput) kcalInput.value = result.kcal;
            if (protInput && result.protein != null) protInput.value = result.protein;
            resetEstimate();
            showToast('Valeurs appliquées');
          },
        }));
        estimateResult.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--danger); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; flex: none;',
          textContent: '\u2717',
          onClick: () => resetEstimate(),
        }));
      } catch (err) {
        showToast(err.message, true);
        resetEstimate();
      }
    }

    function switchTab(tab) {
      currentTab = tab;
      for (const [id, el] of Object.entries(tabEls)) {
        el.className = `tab${id === tab ? ' active' : ''}`;
      }
      resetEstimate();
      renderPanel();
    }

    function renderPanel() {
      panelContainer.innerHTML = '';

      if (currentTab === 'per_100g' || currentTab === 'per_100ml') {
        const unitStr = currentTab === 'per_100ml' ? '100ml' : '100g';
        const row = createElement('div', { className: 'form-row' });
        const g1 = createElement('div', { className: 'form-group' });
        g1.appendChild(createElement('label', { textContent: `Calories /${unitStr}` }));
        g1.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-kcal-100',
          value: existingTab === currentTab ? (existingItem?.kcal_100 ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        const g2 = createElement('div', { className: 'form-group' });
        g2.appendChild(createElement('label', { textContent: `Protéines /${unitStr}` }));
        g2.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-protein-100',
          value: existingTab === currentTab ? (existingItem?.protein_100 ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        row.appendChild(g1);
        row.appendChild(g2);
        panelContainer.appendChild(row);
      }

      if (currentTab === 'per_unit') {
        const row = createElement('div', { className: 'form-row' });
        const g1 = createElement('div', { className: 'form-group' });
        g1.appendChild(createElement('label', { textContent: 'Calories /unité' }));
        g1.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-kcal-unit',
          value: existingItem?.mode === 'per_unit' ? (existingItem.kcal_unit ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        const g2 = createElement('div', { className: 'form-group' });
        g2.appendChild(createElement('label', { textContent: 'Protéines /unité' }));
        g2.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-protein-unit',
          value: existingItem?.mode === 'per_unit' ? (existingItem.protein_unit ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        row.appendChild(g1);
        row.appendChild(g2);
        panelContainer.appendChild(row);
      }

      if (currentTab === 'composite') {
        renderCompositePanel(panelContainer);
      }
    }

    function renderCompositePanel(container) {
      const compsDiv = createElement('div', { id: 'components-list' });
      container.appendChild(compsDiv);

      function renderComponents() {
        compsDiv.innerHTML = '';
        components.forEach((comp, idx) => {
          const row = createElement('div', { className: 'component-row' }, [
            createElement('span', { textContent: comp.itemName || comp.itemId.slice(0, 8), style: 'flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }),
            createElement('input', {
              className: 'input', type: 'number', style: 'width: 70px; flex: none;',
              value: comp.qty, min: '0.1', step: 'any',
              onInput: (e) => { components[idx].qty = parseFloat(e.target.value) || 0; },
            }),
            createElement('select', {
              className: 'input', style: 'width: 70px; flex: none;',
              innerHTML: `<option value="g"${comp.unitType === 'g' ? ' selected' : ''}>g</option>
                          <option value="ml"${comp.unitType === 'ml' ? ' selected' : ''}>ml</option>
                          <option value="unit"${comp.unitType === 'unit' ? ' selected' : ''}>u</option>`,
              onChange: (e) => { components[idx].unitType = e.target.value; },
            }),
            createElement('button', {
              className: 'component-remove', textContent: '\u00d7',
              onClick: () => { components.splice(idx, 1); renderComponents(); },
            }),
          ]);
          compsDiv.appendChild(row);
        });
      }

      renderComponents();

      // Add component search
      const addGroup = createElement('div', { className: 'form-group', style: 'margin-top: 8px;' });
      const addInput = createElement('input', {
        className: 'input', placeholder: 'Ajouter un composant...', type: 'text',
      });
      const addResults = createElement('div', { className: 'search-results' });
      addResults.style.display = 'none';
      addGroup.appendChild(addInput);
      addGroup.appendChild(addResults);
      container.appendChild(addGroup);

      function addComponent(item) {
        components.push({ itemId: item.id, itemName: item.name, qty: 1, unitType: item.mode === 'per_100' ? 'g' : 'unit' });
        renderComponents();
        addInput.value = '';
        addResults.style.display = 'none';
      }

      const doSearch = debounce(async (q) => {
        if (q.length < 1) { addResults.style.display = 'none'; return; }
        try {
          const items = await api.get(`/api/items?search=${encodeURIComponent(q)}`);
          addResults.innerHTML = '';
          if (items.length === 0) {
            const emptyRow = createElement('div', {
              style: 'padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;',
            }, [
              createElement('span', { textContent: 'Aucun résultat', style: 'color: var(--text-muted); font-size: 0.85rem;' }),
              createElement('button', {
                className: 'btn btn-primary btn-sm',
                textContent: '+ Créer',
                onClick: () => {
                  openItemForm({ name: q }, (newItem) => {
                    addComponent(newItem);
                  });
                },
              }),
            ]);
            addResults.appendChild(emptyRow);
            addResults.style.display = 'block';
          } else {
            for (const item of items) {
              addResults.appendChild(createElement('div', {
                className: 'search-result-item',
                onClick: () => addComponent(item),
              }, [
                createElement('div', { className: 'result-name', textContent: item.name }),
              ]));
            }
            addResults.style.display = 'block';
          }
        } catch (err) {
          showToast(err.message, true);
        }
      }, 300);

      addInput.addEventListener('input', () => doSearch(addInput.value.trim()));
    }

    // Save button
    const saveBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: isEdit ? 'Enregistrer' : 'Creer',
      style: 'width: 100%; margin-top: 16px;',
      onClick: async () => {
        const name = nameInput.value.trim();
        if (!name) { showToast('Nom requis', true); return; }

        const mode = (currentTab === 'per_100g' || currentTab === 'per_100ml') ? 'per_100' : currentTab;
        const payload = { name, mode };

        if (mode === 'per_100') {
          const kcal = panelContainer.querySelector('#item-kcal-100');
          const protein = panelContainer.querySelector('#item-protein-100');
          payload.kcal_100 = parseFloat(kcal?.value) || 0;
          payload.protein_100 = protein?.value ? parseFloat(protein.value) : null;
          payload.baseUnit = currentTab === 'per_100ml' ? 'ml' : 'g';
        } else if (mode === 'per_unit') {
          const kcal = panelContainer.querySelector('#item-kcal-unit');
          const protein = panelContainer.querySelector('#item-protein-unit');
          payload.kcal_unit = parseFloat(kcal?.value) || 0;
          payload.protein_unit = protein?.value ? parseFloat(protein.value) : null;
        } else if (mode === 'composite') {
          payload.components = components.map(c => ({
            itemId: c.itemId, qty: c.qty, unitType: c.unitType,
          }));
        }

        try {
          let result;
          if (isEdit) {
            result = await api.put(`/api/items/${existingItem.id}`, payload);
            showToast('Aliment modifie');
          } else {
            result = await api.post('/api/items', payload);
            showToast('Aliment cree');
          }
          handle.close();
          onSaved(result);
        } catch (err) {
          showToast(err.message, true);
        }
      },
    });
    body.appendChild(saveBtn);

    // Delete button
    if (isEdit) {
      const deleteBtn = createElement('button', {
        className: 'btn btn-danger btn-sm',
        textContent: 'Supprimer',
        style: 'width: 100%; margin-top: 8px;',
        onClick: async () => {
          if (!confirm('Supprimer cet aliment ?')) return;
          try {
            await api.delete(`/api/items/${existingItem.id}`);
            showToast('Aliment supprime');
            handle.close();
            onSaved();
          } catch (err) {
            showToast(err.message, true);
          }
        },
      });
      body.appendChild(deleteBtn);
    }

    renderPanel();
    nameInput.focus();
  });
}
