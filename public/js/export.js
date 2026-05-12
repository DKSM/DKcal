import { createElement, todayStr, addDays } from './utils.js';
import { openModal } from './modal.js';

const RANGES = [
  { d: 7, lbl: '7 jours' },
  { d: 14, lbl: '14 jours' },
  { d: 30, lbl: '30 jours' },
  { d: 60, lbl: '60 jours' },
  { d: 90, lbl: '90 jours' },
  { d: 180, lbl: '6 mois' },
  { d: 365, lbl: '1 an' },
  { custom: true, lbl: 'Personnalisé' },
];

function formatHuman(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function openExportModal() {
  openModal('Exporter un rapport', (body, handle) => {
    let selectedDays = 30;
    let customMode = false;
    let customFrom = addDays(todayStr(), -29);
    let customTo = todayStr();

    body.appendChild(createElement('p', {
      style: 'color: var(--text-muted); font-size: 0.85rem; margin-bottom: 10px;',
      textContent: "Sélectionne la période, ouvre le rapport puis utilise le bouton « Imprimer / Enregistrer en PDF » en haut à droite.",
    }));

    const tabs = createElement('div', { className: 'export-range-tabs' });
    const customRow = createElement('div', { className: 'export-custom-row' });
    customRow.style.display = 'none';

    const rangeButtons = [];
    for (const r of RANGES) {
      const isActive = r.custom ? customMode : (!customMode && r.d === selectedDays);
      const btn = createElement('button', {
        className: `period-btn${isActive ? ' active' : ''}`,
        type: 'button',
        textContent: r.lbl,
        onClick: () => {
          if (r.custom) {
            customMode = true;
            customRow.style.display = 'flex';
          } else {
            customMode = false;
            selectedDays = r.d;
            customRow.style.display = 'none';
          }
          rangeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        },
      });
      rangeButtons.push(btn);
      tabs.appendChild(btn);
    }
    body.appendChild(tabs);

    const fromInput = createElement('input', {
      className: 'input', type: 'date', value: customFrom,
      onChange: (e) => {
        customFrom = e.target.value;
        if (customFrom > customTo) {
          customTo = customFrom;
          toInput.value = customTo;
        }
      },
    });
    const toInput = createElement('input', {
      className: 'input', type: 'date', value: customTo,
      onChange: (e) => {
        customTo = e.target.value;
        if (customTo < customFrom) {
          customFrom = customTo;
          fromInput.value = customFrom;
        }
      },
    });
    customRow.appendChild(createElement('span', { textContent: 'Du', style: 'font-size: 0.85rem; color: var(--text-muted);' }));
    customRow.appendChild(fromInput);
    customRow.appendChild(createElement('span', { textContent: 'au', style: 'font-size: 0.85rem; color: var(--text-muted);' }));
    customRow.appendChild(toInput);
    body.appendChild(customRow);

    const openBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Ouvrir le rapport',
      style: 'width: 100%; margin-top: 16px;',
      onClick: () => {
        let from, to;
        if (customMode) {
          from = customFrom;
          to = customTo;
        } else {
          to = todayStr();
          from = addDays(to, -(selectedDays - 1));
        }
        window.open(`/export/print?from=${from}&to=${to}`, '_blank');
        handle.close();
      },
    });
    body.appendChild(openBtn);
  });
}
