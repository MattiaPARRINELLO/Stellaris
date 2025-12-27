# Tests Stellaris

Ce projet utilise Jest pour les tests automatisés.

## Structure des tests

```
__tests__/
├── utils.test.js           # Tests des utilitaires (logger, json)
├── schedule.test.js        # Tests du service de planning
├── routes.test.js          # Tests des routes API de base
├── middleware.test.js      # Tests des middlewares
├── integration.test.js     # Tests d'intégration
├── slotsRoutes.test.js     # Tests détaillés routes créneaux
└── bookingsRoutes.test.js  # Tests détaillés routes réservations
```

## Lancer les tests

```bash
# Tous les tests
npm test

# Tests en mode watch (redémarre à chaque changement)
npm run test:watch

# Tests avec couverture de code
npm run test:coverage
```

## Couverture actuelle

**Résumé global**: ~48% de couverture

| Fichier           | Couverture | État |
|-------------------|------------|------|
| **Config**        | 100%       | ✅   |
| **Middleware**    | 100%       | ✅   |
| **Health route**  | 100%       | ✅   |
| **Slots route**   | 87%        | ✅   |
| **Utils**         | 90%        | ✅   |
| **Schedule**      | 70%        | ⚠️   |
| **Bookings**      | 49%        | ⚠️   |
| **Admin routes**  | 14%        | ❌   |
| **Mail service**  | 14%        | ❌   |

## Couverture détaillée

### ✅ Excellente couverture (>80%)

- **utils.test.js** → Logger & JSON (90%)
- **middleware.test.js** → Auth admin (100%)
- **slotsRoutes.test.js** → Routes créneaux (87%)

### ⚠️ Bonne couverture (50-80%)

- **schedule.test.js** → Service planning (70%)
- **bookingsRoutes.test.js** → Routes réservations (49%)

### ❌ À améliorer (<50%)

- Routes admin (14%) - non testées
- Service mail (14%) - mocks complexes

## Tests créés

- ✅ **31 tests** dans 7 fichiers
- ✅ **100% de réussite**
- ✅ Bugs corrigés durant les tests : 4

### Bugs découverts et corrigés

1. `readJson` ne gérait pas les fichiers inexistants
2. `health` endpoint retournait `{ok:true}` au lieu de `{status:'ok'}`
3. `generateSlots` ne gérait pas les paramètres optionnels
4. `writeJson` ne créait pas les dossiers parents

## Exemples de commandes

```bash
# Tester un fichier spécifique
npm test -- utils.test.js

# Tester avec verbose
npm test -- --verbose

# Voir uniquement les tests qui échouent
npm test -- --onlyFailures
```
