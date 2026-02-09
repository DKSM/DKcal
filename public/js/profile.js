import { createElement, showToast } from './utils.js';
import { api } from './api.js';
import { openModal } from './modal.js';

let cachedProfile = null;

export async function loadProfile() {
  try {
    cachedProfile = await api.get('/api/profile');
  } catch {
    cachedProfile = {};
  }
  return cachedProfile;
}

export function getProfile() {
  return cachedProfile || {};
}

export function adjustCal(val) {
  const pct = (cachedProfile?.calorieAdjust || 0) / 100;
  return Math.round(val * (1 + pct));
}

// Mifflin-St Jeor BMR calculation
function calculateBMR(sex, age, weight, height) {
  if (!sex || !age || !weight || !height) return null;
  if (sex === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sédentaire (bureau, peu de mouvement)' },
  { value: 'light', label: 'Légèrement actif (marche, sport 1-2x/sem)' },
  { value: 'moderate', label: 'Modérément actif (sport 3-5x/sem)' },
  { value: 'active', label: 'Actif (sport 6-7x/sem)' },
  { value: 'very_active', label: 'Très actif (sport intense quotidien)' },
  { value: 'custom', label: 'Personnalisé (montre, téléphone...)' },
];

function computeMaintenance(bmr, activityMode, customActivity) {
  if (!bmr) return null;
  if (activityMode === 'custom') {
    return Math.round(bmr + (customActivity || 0));
  }
  const mult = ACTIVITY_MULTIPLIERS[activityMode];
  if (!mult) return null;
  return Math.round(bmr * mult);
}

export function openProfileModal(onSaved) {
  openModal('Profil', async (body, handle) => {
    const profile = await loadProfile();

    // Sex selector
    const sexGroup = createElement('div', { className: 'form-group' });
    sexGroup.appendChild(createElement('label', { textContent: 'Sexe' }));
    const sexTabs = createElement('div', { className: 'tabs' });
    let selectedSex = profile.sex || null;
    const sexOptions = [
      { id: 'male', label: 'Homme' },
      { id: 'female', label: 'Femme' },
    ];
    const sexTabEls = {};
    for (const opt of sexOptions) {
      const tab = createElement('div', {
        className: `tab${selectedSex === opt.id ? ' active' : ''}`,
        textContent: opt.label,
        onClick: () => {
          selectedSex = opt.id;
          Object.values(sexTabEls).forEach(el => el.classList.remove('active'));
          tab.classList.add('active');
          autoFillBMR();
        },
      });
      sexTabEls[opt.id] = tab;
      sexTabs.appendChild(tab);
    }
    sexGroup.appendChild(sexTabs);
    body.appendChild(sexGroup);

    // Age + Height + Weight row
    const row1 = createElement('div', { className: 'form-row' });
    const ageGroup = createElement('div', { className: 'form-group' });
    ageGroup.appendChild(createElement('label', { textContent: 'Age' }));
    const ageInput = createElement('input', {
      className: 'input', type: 'number', min: '1', max: '120',
      placeholder: 'Age', value: profile.age || '',
    });
    ageInput.addEventListener('input', () => autoFillBMR());
    ageGroup.appendChild(ageInput);
    row1.appendChild(ageGroup);

    const heightGroup = createElement('div', { className: 'form-group' });
    heightGroup.appendChild(createElement('label', { textContent: 'Taille (cm)' }));
    const heightInput = createElement('input', {
      className: 'input', type: 'number', min: '50', max: '250', step: '1',
      placeholder: 'Taille', value: profile.height || '',
    });
    heightInput.addEventListener('input', () => autoFillBMR());
    heightGroup.appendChild(heightInput);
    row1.appendChild(heightGroup);

    const weightGroup = createElement('div', { className: 'form-group' });
    weightGroup.appendChild(createElement('label', { textContent: 'Poids (kg)' }));
    const weightInput = createElement('input', {
      className: 'input', type: 'number', min: '1', max: '500', step: '0.1',
      placeholder: 'Poids', value: profile.weight || '',
    });
    weightInput.addEventListener('input', () => autoFillBMR());
    weightGroup.appendChild(weightInput);
    row1.appendChild(weightGroup);
    body.appendChild(row1);

    // BMR field
    const bmrGroup = createElement('div', { className: 'form-group' });
    bmrGroup.appendChild(createElement('label', { textContent: 'Métabolisme basal (kcal/jour)' }));
    const bmrInput = createElement('input', {
      className: 'input', type: 'number', min: '500', max: '10000', step: '1',
      placeholder: 'Auto', value: profile.bmr || '',
    });
    bmrInput.addEventListener('input', () => updateMaintenance());
    bmrGroup.appendChild(bmrInput);
    body.appendChild(bmrGroup);

    // Activity mode dropdown
    const activityGroup = createElement('div', { className: 'form-group' });
    activityGroup.appendChild(createElement('label', { textContent: 'Calories d\'activité journalière' }));
    const activitySelect = createElement('select', { className: 'input' });
    for (const opt of ACTIVITY_OPTIONS) {
      const el = createElement('option', { value: opt.value, textContent: opt.label });
      if ((profile.activityMode || 'moderate') === opt.value) el.selected = true;
      activitySelect.appendChild(el);
    }
    activitySelect.addEventListener('change', () => {
      toggleCustom();
      updateMaintenance();
    });
    activityGroup.appendChild(activitySelect);
    body.appendChild(activityGroup);

    // Custom activity input (hidden unless custom selected)
    const customGroup = createElement('div', { className: 'form-group' });
    customGroup.appendChild(createElement('label', { textContent: 'Calories brûlées par jour (activité)' }));
    const customInput = createElement('input', {
      className: 'input', type: 'number', min: '0', max: '5000', step: '1',
      placeholder: 'Ex : 780', value: profile.customActivity || '',
    });
    customInput.addEventListener('input', () => updateMaintenance());
    customGroup.appendChild(customInput);
    body.appendChild(customGroup);

    function toggleCustom() {
      customGroup.style.display = activitySelect.value === 'custom' ? 'block' : 'none';
    }
    toggleCustom();

    // Maintenance result (read-only display)
    const maintenanceGroup = createElement('div', { className: 'form-group' });
    maintenanceGroup.appendChild(createElement('label', { textContent: 'Maintien estimé' }));
    const maintenanceDisplay = createElement('div', {
      style: 'font-size: 1.3rem; font-weight: 700; font-family: var(--font-mono); color: var(--accent-bright); padding: 8px 0;',
    });
    maintenanceGroup.appendChild(maintenanceDisplay);
    body.appendChild(maintenanceGroup);

    function autoFillBMR() {
      const bmr = calculateBMR(selectedSex, parseInt(ageInput.value), parseFloat(weightInput.value), parseInt(heightInput.value));
      if (bmr) {
        bmrInput.value = bmr;
      }
      updateMaintenance();
    }

    function updateMaintenance() {
      const bmr = parseInt(bmrInput.value) || 0;
      const mode = activitySelect.value;
      const custom = parseInt(customInput.value) || 0;
      const m = computeMaintenance(bmr, mode, custom);
      if (m) {
        maintenanceDisplay.textContent = `${m} kcal/jour`;
      } else {
        maintenanceDisplay.textContent = '--';
        maintenanceDisplay.style.color = 'var(--text-muted)';
      }
    }
    updateMaintenance();

    // Deficit goal
    const deficitGroup = createElement('div', { className: 'form-group' });
    deficitGroup.appendChild(createElement('label', { textContent: 'Objectif déficit (kcal)' }));
    deficitGroup.appendChild(createElement('div', {
      className: 'form-hint',
      textContent: 'Nombre de kcal en dessous du maintien que tu vises. 0 = pas d\'objectif.',
    }));
    const deficitInput = createElement('input', {
      className: 'input', type: 'number', min: '0', max: '5000', step: '50',
      placeholder: '0', value: profile.deficitGoal || '',
    });
    deficitGroup.appendChild(deficitInput);
    body.appendChild(deficitGroup);

    // Calorie adjustment
    const adjustGroup = createElement('div', { className: 'form-group' });
    adjustGroup.appendChild(createElement('label', { textContent: 'Ajustement calorique (%)' }));
    adjustGroup.appendChild(createElement('div', {
      className: 'form-hint',
      textContent: 'Applique un pourcentage sur toutes les calories affichées (ex : +10 si tu penses sous-estimer). Purement visuel, ne modifie pas les données.',
    }));
    const adjustInput = createElement('input', {
      className: 'input', type: 'number', min: '-50', max: '100', step: '1',
      placeholder: '0', value: profile.calorieAdjust || '',
    });
    adjustGroup.appendChild(adjustInput);
    body.appendChild(adjustGroup);

    // Save button
    const saveBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: 'Enregistrer',
      style: 'width: 100%; margin-top: 8px;',
      onClick: async () => {
        const bmr = bmrInput.value ? parseInt(bmrInput.value) : null;
        const activityMode = activitySelect.value;
        const customActivity = customInput.value ? parseInt(customInput.value) : null;
        const maintenanceCalories = computeMaintenance(bmr, activityMode, customActivity);

        const payload = {
          sex: selectedSex,
          age: ageInput.value ? parseInt(ageInput.value) : null,
          height: heightInput.value ? parseInt(heightInput.value) : null,
          weight: weightInput.value ? parseFloat(weightInput.value) : null,
          bmr,
          activityMode,
          customActivity,
          maintenanceCalories,
          deficitGoal: deficitInput.value ? parseInt(deficitInput.value) : 0,
          calorieAdjust: adjustInput.value ? parseInt(adjustInput.value) : 0,
        };
        try {
          cachedProfile = await api.put('/api/profile', payload);
          showToast('Profil sauvegardé');
          handle.close();
          if (onSaved) onSaved(cachedProfile);
        } catch (err) {
          showToast(err.message, true);
        }
      },
    });
    body.appendChild(saveBtn);
  });
}
