# dkcal

Application personnelle de suivi nutritionnel.

## Installation

```bash
npm install
cp .env.example .env
# Modifier .env avec votre mot de passe et clés API
```

## Lancement

```bash
# Développement
npm run dev

# Production
./dkcal.sh start
./dkcal.sh stop
./dkcal.sh restart
./dkcal.sh logs
```

## Fonctionnalités

- Saisie quotidienne des consommations (kcal + protéines)
- Items par 100g/ml, par unité, ou composites récursifs
- Historique modifiable
- Statistiques et graphiques (7j, 30j, 90j, 1an, custom)
- Intégration FatSecret pour estimation calories
- Dashboard fixe, modales scrollables
- Thème dark (carbone + orange)

## Stack

Node.js + Express, HTML/CSS/JS vanilla, Chart.js, stockage JSON.
