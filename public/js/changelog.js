import { $, createElement } from './utils.js';
import { openModal } from './modal.js';

// --- Changelog data (most recent first) ---
// tag: 'feature' or 'fix'
const CHANGELOG = [
  {
    version: 11,
    date: '17 février 2026',
    tag: 'fix',
    title: 'Formulaire recette nettoyé',
    description: 'En mode recette, les options d\'estimation IA (bouton, description, photo) sont maintenant masquées puisqu\'elles ne servent pas. Un texte explicatif les remplace.',
  },
  {
    version: 10,
    date: '17 février 2026',
    tag: 'fix',
    title: 'Layout mobile amélioré',
    description: 'Le menu d\'édition (crayon) ne s\'affiche plus en dehors de l\'écran sur mobile. Les boutons d\'édition et de suppression sont aussi sur la même ligne que le nom, plus compact.',
  },
  {
    version: 9,
    date: '17 février 2026',
    tag: 'feature',
    title: 'Checkboxes de consommation',
    description: 'Tu peux maintenant cocher tes consommations pour savoir ce que tu as déjà mangé. Pratique quand tu planifies tes repas à l\'avance. Une case en haut permet de tout cocher ou décocher d\'un coup.',
  },
  {
    version: 8,
    date: '17 février 2026',
    tag: 'feature',
    title: 'Répartition des macros',
    description: 'Un graphique donut dans les statistiques te montre la répartition moyenne de tes protéines, lipides et glucides en pourcentage des calories.',
  },
  {
    version: 7,
    date: '16 février 2026',
    tag: 'feature',
    title: 'Discussion avec l\'IA',
    description: 'Après une estimation, tu peux discuter avec l\'IA pour corriger ou préciser les valeurs. Décris ta recette, demande un détail par ingrédient, ou corrige une quantité — l\'IA s\'adapte.',
  },
  {
    version: 6,
    date: '15 février 2026',
    tag: 'feature',
    title: 'Estimation par photo',
    description: 'Prends en photo le tableau de valeurs nutritionnelles au dos d\'un paquet et l\'IA extrait automatiquement les calories et macros. Plus besoin de tout recopier à la main.',
  },
  {
    version: 5,
    date: '14 février 2026',
    tag: 'feature',
    title: 'Preview en temps réel',
    description: 'Quand tu modifies la quantité d\'une consommation, les calories et macros se mettent à jour en direct avant même de sauvegarder.',
  },
  {
    version: 4,
    date: '14 février 2026',
    tag: 'feature',
    title: 'Synchronisation du poids',
    description: 'Le poids que tu saisis dans le journal est maintenant automatiquement synchronisé avec ton profil. Plus besoin de le mettre à jour à deux endroits.',
  },
  {
    version: 2,
    date: '12 février 2026',
    tag: 'feature',
    title: 'Édition rapide des quantités',
    description: 'Clique sur une consommation pour modifier sa quantité ou son unité directement depuis le dashboard, sans ouvrir le formulaire complet.',
  },
  {
    version: 1,
    date: '12 février 2026',
    tag: 'feature',
    title: 'Objectif déficit',
    description: 'Définis un objectif calorique quotidien avec le slider dans ton profil. Une barre de progression sur le dashboard te montre où tu en es par rapport à ton objectif.',
  },
];

const STORAGE_KEY = 'dkcal_changelog_seen';
const CURRENT_VERSION = CHANGELOG[0].version;

function getSeenVersion() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
  } catch {
    return 0;
  }
}

function markAsSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, String(CURRENT_VERSION));
  } catch {}
}

export function hasUnseenChangelog() {
  return getSeenVersion() < CURRENT_VERSION;
}

export function initChangelog() {
  const btn = $('#btn-changelog');
  if (!btn) return;

  if (hasUnseenChangelog()) {
    btn.classList.add('rainbow-blink');
  }

  btn.addEventListener('click', () => {
    markAsSeen();
    btn.classList.remove('rainbow-blink');
    openChangelogModal();
  });
}

function openChangelogModal() {
  openModal('Nouveautés', (body) => {
    const container = createElement('div', { className: 'changelog-list' });

    for (const entry of CHANGELOG) {
      const section = createElement('div', { className: 'changelog-entry' });

      const header = createElement('div', { className: 'changelog-header' });
      const tagClass = entry.tag === 'fix' ? 'changelog-tag fix' : 'changelog-tag feature';
      const tagLabel = entry.tag === 'fix' ? 'Correction' : 'Nouveauté';
      header.appendChild(createElement('span', { className: tagClass, textContent: tagLabel }));
      header.appendChild(createElement('span', { className: 'changelog-date', textContent: entry.date }));
      section.appendChild(header);

      section.appendChild(createElement('h3', {
        className: 'changelog-title',
        textContent: entry.title,
      }));

      section.appendChild(createElement('p', {
        className: 'changelog-description',
        textContent: entry.description,
      }));

      if (entry.image) {
        section.appendChild(createElement('img', {
          className: 'changelog-image',
          src: entry.image,
          alt: entry.title,
        }));
      }

      container.appendChild(section);
    }

    body.appendChild(container);
  });
}
