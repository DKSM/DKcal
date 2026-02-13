import { createElement, showToast, debounce, compressImage } from './utils.js';
import { api } from './api.js';
import { openModal, closeModal } from './modal.js';
import { adjustCal } from './profile.js';

export const LOADING_PHRASES = [
  'Je mets l\'eau à bouillir',
  'Je cherche les ingrédients',
  'Je goûte pour vérifier',
  'Je regarde l\'étiquette',
  'Je pèse tout ça',
  'Un peu de sel, un peu de math',
  'Je consulte mes notes',
  'Je fais chauffer la calculatrice',
  'Je compte les calories une par une',
  'Je demande au chef',
  'Analyse en cuisine',
  'Je mélange les chiffres',
  'C\'est presque prêt',
  'Je vérifie la recette',
  'Laisse-moi réfléchir',
  'J\'épluche les données',
  'Je touille les macros',
  'Patience, ça mijote',
  'Je sors la balance',
  'Conversion en cours',
  'Je lis les petits caractères',
  'Un soupçon de protéines',
  'Je fais les comptes',
  'Hmm, intéressant',
  'Je dose les lipides',
  'Calcul au gramme près',
  'J\'analyse la composition',
  'Je fouille dans ma base',
  'Ça sent bon les données',
  'Encore un petit instant',
];

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
        const kcalStr = computed.kcal != null ? `${adjustCal(Math.round(computed.kcal))} kcal` : '';
        const modeLabel = item.mode === 'per_100' ? (item.baseUnit === 'ml' ? '/100ml' : '/100g') : item.mode === 'per_unit' ? '/unité' : 'recette';

        const el = createElement('div', { className: 'item-list-entry', onClick: () => {
          openItemForm(item, async () => { await loadItems(); if (onDone) onDone(); });
        }}, [
          createElement('div', { className: 'item-list-info' }, [
            createElement('span', { className: 'item-list-name', textContent: item.name }),
            createElement('span', { className: 'item-list-kcal', textContent: kcalStr }),
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

export function showHintPopup() {
  const overlay = createElement('div', { className: 'hint-popup-overlay' });
  const popup = createElement('div', { className: 'hint-popup' });

  popup.innerHTML = `
    <h3>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 014 12.7V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.3A7 7 0 0112 2z"/></svg>
      Optimiser l'estimation IA
    </h3>
    <p>Si une <strong>description</strong> est remplie, c'est elle seule qui pilote l'IA. Sinon, l'IA se base sur le <strong>nom</strong>.</p>
    <p><strong>Pourquoi utiliser la description ?</strong></p>
    <p>Le nom est souvent trop vague (\u00ab\u00a0Skittles Lidl\u00a0\u00bb). La description permet de pr\u00e9ciser exactement ce que l'IA doit estimer : quantit\u00e9, poids, marque, pr\u00e9paration.</p>
    <p><strong>Exemples :</strong></p>
    <div class="hint-example"><strong>Nom :</strong> Caf\u00e9 au lait<br><strong>Description :</strong> 1 tasse : 150ml caf\u00e9, 50ml lait demi-\u00e9cr\u00e9m\u00e9, 2 sucres</div>
    <div class="hint-example"><strong>Nom :</strong> Skittles Lidl<br><strong>Description :</strong> 1 skittle = 0.8 grammes</div>
    <div class="hint-example"><strong>Nom :</strong> Lasagnes maison<br><strong>Description :</strong> 1 part (350g) : 3 feuilles de p\u00e2te, 150g bolognaise, 80g b\u00e9chamel, 30g gruy\u00e8re</div>
    <p class="hint-note">Sans description, l'IA se d\u00e9brouille avec le nom seul \u2014 \u00e7a marche pour les produits connus, mais la description donne des r\u00e9sultats bien plus pr\u00e9cis.</p>
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

    // Resolve component names if missing
    if (components.length > 0 && components.some(c => !c.itemName)) {
      api.get('/api/items').then(items => {
        const map = new Map(items.map(i => [i.id, i.name]));
        for (const c of components) {
          if (!c.itemName && map.has(c.itemId)) c.itemName = map.get(c.itemId);
        }
        const compsDiv = document.getElementById('components-list');
        if (compsDiv) compsDiv.dispatchEvent(new Event('refresh'));
      }).catch(() => {});
    }

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

    // AI estimate
    let pendingEstimate = null;
    let phraseInterval = null;
    let estimateContext = { messages: [] };

    const estimateBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm estimate-btn-text',
      textContent: 'Estimation avec l\'IA',
      onClick: () => doEstimate(),
    });

    const fileInput = createElement('input', { type: 'file', accept: 'image/*', style: 'display: none;' });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) doEstimateImage(fileInput.files[0]);
      fileInput.value = '';
    });

    const cameraBtn = createElement('button', {
      className: 'btn btn-secondary btn-sm estimate-btn-camera',
      innerHTML: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
      title: 'Estimer depuis une photo',
      onClick: () => fileInput.click(),
    });

    const estimateRow = createElement('div', { className: 'estimate-btn-group', style: 'margin-bottom: 12px;' });
    estimateRow.appendChild(estimateBtn);
    estimateRow.appendChild(cameraBtn);
    estimateRow.appendChild(fileInput);
    body.insertBefore(estimateRow, panelContainer);

    const estimateResultRow = createElement('div', {
      style: 'display: none; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; padding: 8px 12px; background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);',
    });
    body.insertBefore(estimateResultRow, panelContainer);

    function resetEstimate() {
      pendingEstimate = null;
      if (phraseInterval) { clearInterval(phraseInterval); phraseInterval = null; }
      estimateResultRow.style.display = 'none';
      estimateBtn.classList.remove('btn-loading');
      estimateBtn.textContent = 'Estimation avec l\'IA';
      estimateBtn.disabled = false;
    }

    handle.onClose = resetEstimate;

    function startLoadingPhrases() {
      estimateBtn.textContent = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
      phraseInterval = setInterval(() => {
        estimateBtn.textContent = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
      }, 2000);
    }

    function applyEstimate(result) {
      const suffix = currentTab === 'per_unit' ? '-unit' : '-100';
      const ki = panelContainer.querySelector(`#item-kcal${suffix}`);
      const pi = panelContainer.querySelector(`#item-protein${suffix}`);
      const fi = panelContainer.querySelector(`#item-fat${suffix}`);
      const ci = panelContainer.querySelector(`#item-carbs${suffix}`);
      if (ki) ki.value = result.kcal;
      if (pi && result.protein != null) pi.value = result.protein;
      if (fi && result.fat != null) fi.value = result.fat;
      if (ci && result.carbs != null) ci.value = result.carbs;
      resetEstimate();
      showToast('Valeurs appliquées');
    }

    function showEstimateResult(result) {
      pendingEstimate = result;
      // Build context for chat
      const desc = descInput.value.trim();
      const text = nameInput.value.trim();
      const unit = currentTab === 'per_unit' ? 'portion' : currentTab === 'per_100ml' ? '100ml' : '100g';
      const unitLabels = { '100g': 'pour 100g de', '100ml': 'pour 100ml de', 'portion': 'Donne les valeurs nutritionnelles de' };
      const primary = desc || text;
      const nameCtx = desc && text ? ` (produit : "${text}")` : '';
      estimateContext = {
        messages: [
          { role: 'user', content: `${unitLabels[unit]} "${primary}"${nameCtx}` },
          { role: 'assistant', content: JSON.stringify({ kcal: result.kcal, protein: result.protein, fat: result.fat, carbs: result.carbs, summary: result.summary, details: result.details }) },
        ],
      };
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
      const actionBtns = createElement('div', { style: 'margin-left: auto; display: flex; gap: 6px; flex-shrink: 0;' });
      actionBtns.appendChild(createElement('button', {
        className: 'btn btn-sm',
        style: 'background: var(--success); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;',
        textContent: '\u2713',
        title: 'Remplacer toutes les valeurs par celles de l\'IA',
        onClick: () => applyEstimate(result),
      }));
      actionBtns.appendChild(createElement('button', {
        className: 'btn btn-sm',
        style: 'background: var(--accent); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;',
        textContent: '\u270e',
        title: 'Compléter uniquement les champs vides ou à zéro',
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
      actionBtns.appendChild(createElement('button', {
        className: 'btn btn-sm',
        style: 'background: var(--danger); color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;',
        textContent: '\u2717',
        title: 'Annuler l\'estimation',
        onClick: () => resetEstimate(),
      }));
      estimateResultRow.appendChild(actionBtns);
      if (result.summary) {
        const summaryWrap = createElement('div', {
          className: 'estimate-summary-wrap',
        });
        const summaryText = createElement('span', {
          className: 'estimate-summary-text',
          textContent: result.summary,
        });
        summaryWrap.appendChild(summaryText);
        summaryWrap.appendChild(createElement('span', {
          className: 'estimate-see-more',
          textContent: ' Voir plus',
          onClick: () => showEstimateChat(estimateContext, applyEstimate),
        }));
        estimateResultRow.appendChild(summaryWrap);
      }
    }

    async function doEstimate() {
      const desc = descInput.value.trim();
      const text = nameInput.value.trim();
      if (!desc && !text) { showToast('Remplis au moins le nom ou la description', true); return; }

      const unit = currentTab === 'per_unit' ? 'portion' : currentTab === 'per_100ml' ? '100ml' : '100g';
      estimateBtn.disabled = true;
      estimateBtn.classList.add('btn-loading');
      startLoadingPhrases();

      try {
        const params = new URLSearchParams({ unit });
        if (desc) params.set('desc', desc);
        if (text) params.set('q', text);
        const result = await api.get(`/api/estimate?${params}`);
        showEstimateResult(result);
      } catch (err) {
        showToast(err.message, true);
        resetEstimate();
      }
    }

    async function doEstimateImage(file) {
      estimateBtn.disabled = true;
      estimateBtn.classList.add('btn-loading');
      startLoadingPhrases();

      try {
        const image = await compressImage(file);
        const unit = currentTab === 'per_unit' ? 'portion' : currentTab === 'per_100ml' ? '100ml' : '100g';
        const result = await api.post('/api/estimate-image', { image, unit, name: nameInput.value.trim() });
        showEstimateResult(result);
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
      compsDiv.addEventListener('refresh', () => renderComponents());

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

export function showEstimateChat(context, onApply) {
  const overlay = createElement('div', { className: 'hint-popup-overlay' });
  const popup = createElement('div', { className: 'hint-popup estimate-chat-popup' });

  // Header with close X
  const headerRow = createElement('div', { className: 'estimate-chat-header' });
  headerRow.appendChild(createElement('h3', {
    innerHTML: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Discussion avec l\'IA',
  }));
  headerRow.appendChild(createElement('button', {
    className: 'estimate-chat-close',
    innerHTML: '&times;',
    onClick: () => closeChat(),
  }));
  popup.appendChild(headerRow);

  const messagesDiv = createElement('div', { className: 'estimate-chat-messages' });
  popup.appendChild(messagesDiv);

  const messages = [...context.messages];
  let sendCount = messages.slice(2).filter(m => m.role === 'user').length;
  let selectedResult = null;
  let selectedIdx = -1;

  function closeChat() {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 200);
  }

  function selectResult(parsed, idx) {
    selectedResult = parsed;
    selectedIdx = idx;
    updateFooter();
    messagesDiv.querySelectorAll('.estimate-chat-msg.selected').forEach(el => el.classList.remove('selected'));
    const allMsgs = messagesDiv.querySelectorAll('.estimate-chat-msg');
    const domIdx = idx - 1;
    if (allMsgs[domIdx]) allMsgs[domIdx].classList.add('selected');
  }

  // Footer with selected values + Valider
  const footerDiv = createElement('div', { className: 'estimate-chat-footer' });
  footerDiv.style.display = 'none';

  function updateFooter() {
    if (!selectedResult) { footerDiv.style.display = 'none'; return; }
    footerDiv.innerHTML = '';
    footerDiv.style.display = 'flex';
    const macros = createElement('div', { className: 'estimate-chat-footer-macros' });
    macros.innerHTML = `<span style="color:var(--accent);font-weight:700">${selectedResult.kcal} kcal</span> · <span style="color:var(--protein-color)">P: ${selectedResult.protein}g</span> · <span style="color:var(--warning)">L: ${selectedResult.fat}g</span> · <span style="color:var(--success)">G: ${selectedResult.carbs}g</span>`;
    footerDiv.appendChild(macros);
    footerDiv.appendChild(createElement('button', {
      className: 'btn btn-primary btn-sm',
      textContent: 'Valider',
      onClick: () => { onApply(selectedResult); closeChat(); },
    }));
  }

  function formatPlainText(text) {
    // Escape HTML, then apply simple markdown formatting
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<span class="chat-list-item">$1</span>')
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s<,)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function renderMessages() {
    messagesDiv.innerHTML = '';

    for (let i = 1; i < messages.length; i++) {
      const msg = messages[i];
      const msgDiv = createElement('div', {
        className: `estimate-chat-msg ${msg.role}${i === selectedIdx ? ' selected' : ''}`,
      });

      if (msg.role === 'assistant') {
        let parsed;
        try { parsed = JSON.parse(msg.content); } catch { parsed = null; }

        if (parsed && parsed.kcal != null) {
          const macroLine = createElement('div', { className: 'estimate-chat-macros' });
          macroLine.innerHTML = `<span style="color:var(--accent);font-weight:700">${parsed.kcal} kcal</span> · <span style="color:var(--protein-color)">P: ${parsed.protein}g</span> · <span style="color:var(--warning)">L: ${parsed.fat}g</span> · <span style="color:var(--success)">G: ${parsed.carbs}g</span>`;
          msgDiv.appendChild(macroLine);

          if (parsed.summary) {
            msgDiv.appendChild(createElement('div', {
              className: 'estimate-chat-summary',
              textContent: parsed.summary,
            }));
          }

          if (parsed.details) {
            const detailsEl = createElement('div', { className: 'estimate-chat-details' });
            detailsEl.innerHTML = formatPlainText(parsed.details);
            msgDiv.appendChild(detailsEl);
          }

          const idx = i;
          msgDiv.appendChild(createElement('button', {
            className: 'btn btn-sm estimate-chat-apply',
            textContent: `Appliquer ${parsed.kcal} kcal`,
            onClick: () => selectResult(parsed, idx),
          }));
        } else {
          // Plain text response (explanation, detail, etc.)
          const textEl = createElement('div', { className: 'estimate-chat-text' });
          textEl.innerHTML = formatPlainText(msg.content);
          msgDiv.appendChild(textEl);
        }
      } else {
        msgDiv.appendChild(createElement('span', { textContent: msg.content }));
      }

      messagesDiv.appendChild(msgDiv);
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  renderMessages();

  // Input row
  const inputRow = createElement('div', { className: 'estimate-chat-input-row' });
  const chatInput = createElement('input', {
    className: 'input',
    placeholder: 'Corriger ou préciser...',
    type: 'text',
  });
  const sendBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    textContent: 'Envoyer',
    onClick: () => sendMessage(),
  });
  inputRow.appendChild(chatInput);
  inputRow.appendChild(sendBtn);
  popup.appendChild(inputRow);

  const limitInfo = createElement('div', {
    className: 'estimate-chat-limit',
    textContent: `${sendCount}/50 messages`,
  });
  popup.appendChild(limitInfo);

  popup.appendChild(footerDiv);

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    if (sendCount >= 50) {
      showToast('Limite de 50 messages atteinte', true);
      return;
    }

    messages.push({ role: 'user', content: text });
    sendCount++;
    chatInput.value = '';
    renderMessages();

    // Loading indicator
    const loadingDiv = createElement('div', {
      className: 'estimate-chat-msg assistant estimate-chat-loading',
      innerHTML: '<div class="typing-dots"><span></span><span></span><span></span></div>',
    });
    messagesDiv.appendChild(loadingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    chatInput.disabled = true;
    sendBtn.disabled = true;

    try {
      const compressed = messages.map(m => {
        if (m.role === 'assistant') {
          try {
            const p = JSON.parse(m.content);
            if (p.details) {
              const { details, ...rest } = p;
              return { role: 'assistant', content: JSON.stringify(rest) };
            }
          } catch {}
        }
        return m;
      });

      const result = await api.post('/api/estimate-chat', { messages: compressed });
      let responseContent;
      if (result.text) {
        // Plain text response (explanation, detail, question answer)
        responseContent = result.text;
      } else {
        // JSON response with nutrition values
        responseContent = JSON.stringify({
          kcal: result.kcal, protein: result.protein,
          fat: result.fat, carbs: result.carbs, summary: result.summary,
          details: result.details,
        });
      }
      messages.push({ role: 'assistant', content: responseContent });
      context.messages = [...messages];
      renderMessages();
      limitInfo.textContent = `${sendCount}/50 messages`;
    } catch (err) {
      messages.pop();
      sendCount--;
      showToast(err.message, true);
      renderMessages();
    } finally {
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeChat();
  });

  chatInput.focus();
}
