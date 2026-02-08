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

function showHintPopup() {
  const overlay = createElement('div', { className: 'hint-popup-overlay' });
  const popup = createElement('div', { className: 'hint-popup' });

  popup.innerHTML = `
    <h3>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 014 12.7V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.3A7 7 0 0112 2z"/></svg>
      Optimiser l'estimation IA
    </h3>
    <p>L'IA utilise le <strong>Nom</strong> et la <strong>Description</strong> pour estimer les valeurs nutritionnelles. Le nom est le titre court de votre aliment. La description est l'endroit id\u00e9al pour d\u00e9tailler la composition.</p>
    <p><strong>Comment faire :</strong></p>
    <ul>
      <li>Donnez un <strong>nom court</strong> : \u00ab\u00a0Caf\u00e9 au lait\u00a0\u00bb, \u00ab\u00a0Lasagnes maison\u00a0\u00bb</li>
      <li>D\u00e9taillez dans la <strong>description</strong> : ingr\u00e9dients, quantit\u00e9s, marques, cuisson</li>
      <li>La description est <strong>sauvegard\u00e9e</strong> \u2014 pas besoin de la r\u00e9\u00e9crire \u00e0 chaque estimation</li>
    </ul>
    <p><strong>Exemple :</strong></p>
    <div class="hint-example"><strong>Nom :</strong> Caf\u00e9 au lait<br><strong>Description :</strong> 50ml lait demi-\u00e9cr\u00e9m\u00e9, 2 morceaux de sucre</div>
    <p><strong>Exemple avanc\u00e9 :</strong></p>
    <div class="hint-example"><strong>Nom :</strong> Lasagnes maison<br><strong>Description :</strong> 3 feuilles de p\u00e2te, 150g bolognaise (boeuf hach\u00e9 5%, oignon, coulis de tomate), 80g b\u00e9chamel (beurre, farine, lait entier), 30g gruy\u00e8re r\u00e2p\u00e9</div>
    <p><strong>Ce que vous pouvez pr\u00e9ciser :</strong></p>
    <ul>
      <li>La <strong>marque</strong> du produit (Danone, Kinder, Barilla...)</li>
      <li>Les <strong>quantit\u00e9s</strong> exactes (200g, 1 cuill\u00e8re \u00e0 soupe...)</li>
      <li>Le mode de <strong>pr\u00e9paration</strong> (cru, cuit, grill\u00e9, frit, vapeur...)</li>
      <li>Une <strong>recette enti\u00e8re</strong> avec tous ses ingr\u00e9dients</li>
    </ul>
    <p>Il n'y a aucune limite de d\u00e9tail. Vous pouvez d\u00e9crire un plat entier avec chaque ingr\u00e9dient et sa quantit\u00e9.</p>
    <p class="hint-note">L'estimation reste une approximation bas\u00e9e sur des moyennes nutritionnelles. Elle ne remplace pas l'\u00e9tiquette d'un produit, mais donne un ordre de grandeur fiable pour le suivi au quotidien.</p>
  `;

  const closeBtn = createElement('button', {
    className: 'hint-close',
    textContent: 'Compris',
    onClick: () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    },
  });
  popup.appendChild(closeBtn);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    }
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
    const nameWrap = createElement('div', { className: 'name-input-wrap' });
    const nameInput = createElement('input', {
      className: 'input',
      value: existingItem?.name || '',
      placeholder: 'Nom de l\'aliment',
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

    // Description (for AI)
    const descGroup = createElement('div', { className: 'form-group' });
    descGroup.appendChild(createElement('label', { textContent: 'Description pour l\'IA (optionnel)' }));
    const descInput = createElement('textarea', {
      className: 'input',
      value: existingItem?.description || '',
      placeholder: 'Ex : 50ml lait demi-\u00e9cr\u00e9m\u00e9, 2 sucres, grill\u00e9 au four...',
      rows: '2',
      style: 'resize: vertical; min-height: 42px;',
    });
    descGroup.appendChild(descInput);
    body.appendChild(descGroup);

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
        const desc = descInput.value.trim();
        let url = `/api/estimate?q=${encodeURIComponent(text)}&unit=${unit}`;
        if (desc) url += `&desc=${encodeURIComponent(desc)}`;
        const result = await api.get(url);
        pendingEstimate = result;

        // Shrink button, show result
        estimateBtn.style.width = 'auto';
        estimateBtn.style.flex = 'none';
        estimateBtn.textContent = 'Estimer (IA)';
        estimateBtn.disabled = false;

        estimateResult.innerHTML = '';
        estimateResult.style.display = 'flex';
        estimateResult.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; font-weight: 600; color: var(--accent); white-space: nowrap;',
          textContent: `${result.kcal} kcal`,
        }));
        estimateResult.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; white-space: nowrap;',
          innerHTML: `<b style="color:var(--protein-color)">Protéines</b><span style="color:var(--text-secondary)"> ${result.protein}</span>`,
        }));
        estimateResult.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; white-space: nowrap;',
          innerHTML: `<b style="color:var(--warning)">Lipides</b><span style="color:var(--text-secondary)"> ${result.fat}</span>`,
        }));
        estimateResult.appendChild(createElement('span', {
          style: 'font-size: 0.8rem; white-space: nowrap;',
          innerHTML: `<b style="color:var(--success)">Glucides</b><span style="color:var(--text-secondary)"> ${result.carbs}</span>`,
        }));
        estimateResult.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--success); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; flex: none;',
          textContent: '\u2713',
          title: 'Remplacer toutes les valeurs par celles de l\'IA',
          onClick: () => {
            const suffix = currentTab === 'per_unit' ? '-unit' : '-100';
            const kcalInput = panelContainer.querySelector(`#item-kcal${suffix}`);
            const protInput = panelContainer.querySelector(`#item-protein${suffix}`);
            const fatInput = panelContainer.querySelector(`#item-fat${suffix}`);
            const carbsInput = panelContainer.querySelector(`#item-carbs${suffix}`);
            if (kcalInput) kcalInput.value = result.kcal;
            if (protInput && result.protein != null) protInput.value = result.protein;
            if (fatInput && result.fat != null) fatInput.value = result.fat;
            if (carbsInput && result.carbs != null) carbsInput.value = result.carbs;
            resetEstimate();
            showToast('Valeurs appliquées');
          },
        }));
        estimateResult.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--accent); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; flex: none;',
          textContent: '\u270e',
          title: 'Compléter uniquement les champs vides ou à zéro, sans modifier les valeurs existantes',
          onClick: () => {
            const suffix = currentTab === 'per_unit' ? '-unit' : '-100';
            const kcalInput = panelContainer.querySelector(`#item-kcal${suffix}`);
            const protInput = panelContainer.querySelector(`#item-protein${suffix}`);
            const fatInput = panelContainer.querySelector(`#item-fat${suffix}`);
            const carbsInput = panelContainer.querySelector(`#item-carbs${suffix}`);
            let count = 0;
            if (kcalInput && (!kcalInput.value || parseFloat(kcalInput.value) === 0)) { kcalInput.value = result.kcal; count++; }
            if (protInput && (!protInput.value || parseFloat(protInput.value) === 0) && result.protein != null) { protInput.value = result.protein; count++; }
            if (fatInput && (!fatInput.value || parseFloat(fatInput.value) === 0) && result.fat != null) { fatInput.value = result.fat; count++; }
            if (carbsInput && (!carbsInput.value || parseFloat(carbsInput.value) === 0) && result.carbs != null) { carbsInput.value = result.carbs; count++; }
            resetEstimate();
            showToast(count > 0 ? `${count} valeur${count > 1 ? 's' : ''} complétée${count > 1 ? 's' : ''}` : 'Rien à compléter');
          },
        }));
        estimateResult.appendChild(createElement('button', {
          className: 'btn btn-sm',
          style: 'background: var(--danger); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; flex: none;',
          textContent: '\u2717',
          title: 'Annuler l\'estimation',
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
        const row1 = createElement('div', { className: 'form-row' });
        const g1 = createElement('div', { className: 'form-group' });
        g1.appendChild(createElement('label', { textContent: `Calories /${unitStr}` }));
        g1.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-kcal-100',
          value: existingTab === currentTab ? (existingItem?.kcal_100 ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        const g2 = createElement('div', { className: 'form-group' });
        g2.appendChild(createElement('label', { textContent: `Prot. /${unitStr}` }));
        g2.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-protein-100',
          value: existingTab === currentTab ? (existingItem?.protein_100 ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        row1.appendChild(g1);
        row1.appendChild(g2);
        panelContainer.appendChild(row1);

        const row2 = createElement('div', { className: 'form-row' });
        const g3 = createElement('div', { className: 'form-group' });
        g3.appendChild(createElement('label', { textContent: `Lipides /${unitStr}` }));
        g3.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-fat-100',
          value: existingTab === currentTab ? (existingItem?.fat_100 ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        const g4 = createElement('div', { className: 'form-group' });
        g4.appendChild(createElement('label', { textContent: `Glucides /${unitStr}` }));
        g4.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-carbs-100',
          value: existingTab === currentTab ? (existingItem?.carbs_100 ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        row2.appendChild(g3);
        row2.appendChild(g4);
        panelContainer.appendChild(row2);
      }

      if (currentTab === 'per_unit') {
        const row1 = createElement('div', { className: 'form-row' });
        const g1 = createElement('div', { className: 'form-group' });
        g1.appendChild(createElement('label', { textContent: 'Calories /unité' }));
        g1.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-kcal-unit',
          value: existingItem?.mode === 'per_unit' ? (existingItem.kcal_unit ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        const g2 = createElement('div', { className: 'form-group' });
        g2.appendChild(createElement('label', { textContent: 'Prot. /unité' }));
        g2.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-protein-unit',
          value: existingItem?.mode === 'per_unit' ? (existingItem.protein_unit ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        row1.appendChild(g1);
        row1.appendChild(g2);
        panelContainer.appendChild(row1);

        const row2 = createElement('div', { className: 'form-row' });
        const g3 = createElement('div', { className: 'form-group' });
        g3.appendChild(createElement('label', { textContent: 'Lipides /unité' }));
        g3.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-fat-unit',
          value: existingItem?.mode === 'per_unit' ? (existingItem.fat_unit ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        const g4 = createElement('div', { className: 'form-group' });
        g4.appendChild(createElement('label', { textContent: 'Glucides /unité' }));
        g4.appendChild(createElement('input', {
          className: 'input', type: 'number', id: 'item-carbs-unit',
          value: existingItem?.mode === 'per_unit' ? (existingItem.carbs_unit ?? '') : '',
          placeholder: '0', min: '0', step: 'any',
        }));
        row2.appendChild(g3);
        row2.appendChild(g4);
        panelContainer.appendChild(row2);
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
        const payload = { name, description: descInput.value.trim(), mode };

        if (mode === 'per_100') {
          payload.kcal_100 = parseFloat(panelContainer.querySelector('#item-kcal-100')?.value) || 0;
          payload.protein_100 = panelContainer.querySelector('#item-protein-100')?.value ? parseFloat(panelContainer.querySelector('#item-protein-100').value) : null;
          payload.fat_100 = panelContainer.querySelector('#item-fat-100')?.value ? parseFloat(panelContainer.querySelector('#item-fat-100').value) : null;
          payload.carbs_100 = panelContainer.querySelector('#item-carbs-100')?.value ? parseFloat(panelContainer.querySelector('#item-carbs-100').value) : null;
          payload.baseUnit = currentTab === 'per_100ml' ? 'ml' : 'g';
        } else if (mode === 'per_unit') {
          payload.kcal_unit = parseFloat(panelContainer.querySelector('#item-kcal-unit')?.value) || 0;
          payload.protein_unit = panelContainer.querySelector('#item-protein-unit')?.value ? parseFloat(panelContainer.querySelector('#item-protein-unit').value) : null;
          payload.fat_unit = panelContainer.querySelector('#item-fat-unit')?.value ? parseFloat(panelContainer.querySelector('#item-fat-unit').value) : null;
          payload.carbs_unit = panelContainer.querySelector('#item-carbs-unit')?.value ? parseFloat(panelContainer.querySelector('#item-carbs-unit').value) : null;
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
