# DKcal

Application web personnelle de suivi nutritionnel quotidien avec estimation IA.

## Concept

DKcal permet de suivre ses apports caloriques et macronutriments (protéines, lipides, glucides) au jour le jour. On crée un catalogue d'aliments avec leurs valeurs nutritionnelles, puis on les ajoute à sa journée avec la quantité consommée. L'application calcule automatiquement les totaux et affiche le déficit ou surplus par rapport à son objectif de maintien.

Une IA (via Groq) peut estimer les valeurs nutritionnelles d'un aliment à partir d'une description libre, ce qui accélère la saisie.

## Fonctionnalités

### Suivi quotidien
- Ajout de consommations avec quantité et unité (g, ml, unité)
- Saisie du poids du jour
- Navigation par date (flèches, date picker)
- Affichage des totaux : calories, protéines, lipides, glucides
- Barre de progression visuelle vers l'objectif de maintien

### Catalogue d'aliments (3 modes)
- **Pour 100g/100ml** : valeurs nutritionnelles de base, quantité en grammes ou millilitres
- **Par unité** : valeurs par portion (un oeuf, un biscuit, etc.)
- **Composite** : recettes composées d'autres aliments, avec calcul récursif des macros et mise à jour en cascade

### Aliments temporaires
- Entrées ponctuelles sans créer d'aliment permanent (restaurant, snack, etc.)
- Saisie manuelle ou estimation IA
- Description sauvegardée pour modification ultérieure

### Estimation IA
- Estimation des valeurs nutritionnelles via l'API Groq
- Priorité à la description libre, fallback sur le nom
- Gestion des aliments cuits vs crus, produits de marque, recettes multi-ingrédients
- Phrases d'attente humoristiques avec animation arc-en-ciel pendant le chargement
- Trois actions sur le résultat : remplacer tout, compléter les champs vides, annuler

### Profil et objectifs
- Calcul du métabolisme basal (formule Mifflin-St Jeor) à partir du sexe, âge et poids
- Niveau d'activité : sédentaire, léger, modéré, actif, très actif, ou personnalisé
- Calcul automatique des calories de maintien (BMR x multiplicateur d'activité)
- Ajustement calorique visuel (%) pour compenser une tendance à sous/surestimer

### Statistiques
- Graphiques (Chart.js) : calories, protéines, lipides, glucides, poids
- Moyennes mobiles sur 7 jours et tendance linéaire du poids
- Périodes : 7j, 30j, 90j, 1 an, personnalisée
- Résumé chiffré : moyennes, poids min/max, delta, jours trackés

### Multi-utilisateur
- Comptes avec authentification par mot de passe (bcrypt)
- Sessions persistantes (30 jours)
- Données isolées par utilisateur
- Gestion des comptes via CLI (`dkcal.sh useradd/passwd/userdel/userlist/purge`)

### Responsive
- Interface adaptée desktop, tablette et mobile (375px+)
- Labels macros abrégés sur petit écran (P/L/G)
- Boutons et cibles tactiles adaptés

## Installation

```bash
npm install
cp .env.example .env
```

Configurer `.env` :
- `SESSION_SECRET` : clé de session (requis en production)
- `GROQ_API_KEY` : clé API Groq (requis pour l'estimation IA)
- `PORT` : port du serveur (défaut : 3001)

## Lancement

```bash
# Développement (auto-reload)
npm run dev

# Production
./dkcal.sh start       # Démarrer le serveur
./dkcal.sh stop        # Arrêter le serveur
./dkcal.sh restart     # Redémarrer le serveur
./dkcal.sh logs        # Afficher les logs en continu
./dkcal.sh status      # État du serveur
```

## Gestion des utilisateurs

```bash
./dkcal.sh useradd <id>   # Créer un utilisateur (mot de passe demandé interactivement)
./dkcal.sh passwd <id>    # Changer le mot de passe d'un utilisateur
./dkcal.sh userdel <id>   # Supprimer un utilisateur et toutes ses données
./dkcal.sh userlist       # Lister tous les utilisateurs
./dkcal.sh purge <id>     # Supprimer les données d'un utilisateur (garde le compte)
```

Lors de la création du premier utilisateur, si des données existantes sont détectées dans `data/users/default/`, une migration est proposée.

## Stack

Node.js + Express, HTML/CSS/JS vanilla, Chart.js, stockage JSON fichier, API Groq (estimation IA).
