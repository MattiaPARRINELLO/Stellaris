# Stellaris - Backend de prise de rendez-vous

Application web pour la gestion des rendez-vous (Stellaris Conseil).

## 📁 Structure du projet

```
Stellaris/
├── src/                      # Code serveur Node.js
│   ├── server.js             # Point d'entrée principal
│   ├── config.js             # Configuration (paths, constantes)
│   ├── middleware/
│   │   └── auth.js           # Middleware d'authentification admin
│   ├── routes/
│   │   ├── health.js         # Route /api/health
│   │   ├── slots.js          # Routes /api/slots/*
│   │   ├── bookings.js       # Routes /api/bookings
│   │   └── admin.js          # Routes /api/admin/*
│   ├── services/
│   │   ├── schedule.js       # Logique métier créneaux/planning
│   │   ├── mail.js           # Service d'envoi d'emails
│   │   └── fileQueue.js      # Queue d'écriture fichier
│   └── utils/
│       ├── logger.js         # Logger centralisé
│       └── json.js           # Utilitaires lecture/écriture JSON
├── public/                   # Fichiers statiques (front)
│   ├── index.html            # Page d'accueil / landing
│   ├── admin.html            # Interface d'administration
│   ├── js/
│   │   ├── main.js           # Script principal landing
│   │   └── admin.js          # Script interface admin
│   ├── css/
│   │   ├── base.css          # Variables CSS, reset, typographie
│   │   ├── components.css    # Boutons, cartes, formulaires, effets glass
│   │   ├── layout.css        # Navigation, hero, sections, footer
│   │   ├── animations.css    # Keyframes, transitions, effets
│   │   └── mobile.css        # Media queries responsive
│   └── assets/
│       ├── logo.svg          # Logo principal
│       ├── heroIcon.svg      # Icône hero
│       └── logoNoBg.svg      # Logo sans fond
├── data/                     # Données persistantes (JSON)
│   ├── bookings.json
│   ├── schedule.json
│   └── blockedSlots.json
├── .env                      # Variables d'environnement
├── .env.example              # Exemple de configuration
├── package.json
└── README.md
```

## 🚀 Installation

```bash
npm install
cp .env.example .env
# Éditer .env avec vos paramètres
```

## ⚙️ Configuration

Variables d'environnement (`.env`) :

| Variable             | Description                     | Défaut         |
| -------------------- | ------------------------------- | -------------- |
| `PORT`               | Port du serveur                 | `3000`         |
| `ADMIN_API_KEY`      | Clé API pour l'interface admin  | `changeme`     |
| `DEBUG`              | Activer les logs de debug       | `false`        |
| `SMTP_HOST`          | Serveur SMTP                    | -              |
| `SMTP_PORT`          | Port SMTP                       | `587`          |
| `SMTP_USER`          | Utilisateur SMTP                | -              |
| `SMTP_PASS`          | Mot de passe SMTP               | -              |
| `SMTP_FROM`          | Adresse expéditeur              | `no-reply@...` |
| `ADMIN_NOTIFY_EMAIL` | Email de notification admin     | -              |

## 🏃 Démarrage

```bash
# Production
npm start

# Développement (avec rechargement automatique)
npm run dev
```

Puis ouvrir http://localhost:3000

## 📡 API Endpoints

### Public

| Méthode | Route                | Description                    |
| ------- | -------------------- | ------------------------------ |
| GET     | `/api/health`        | Health check                   |
| GET     | `/api/slots`         | Liste des créneaux disponibles |
| GET     | `/api/slots/grouped` | Créneaux groupés par jour      |
| GET     | `/api/slots/next`    | Prochain créneau disponible    |
| POST    | `/api/bookings`      | Créer une réservation          |

### Admin (nécessite `x-admin-key` header)

| Méthode | Route                             | Description               |
| ------- | --------------------------------- | ------------------------- |
| GET     | `/api/admin/schedule`             | Obtenir le planning       |
| PUT     | `/api/admin/schedule`             | Modifier le planning      |
| GET     | `/api/admin/slots`                | Liste créneaux (admin)    |
| POST    | `/api/admin/slots/block`          | Bloquer un créneau        |
| POST    | `/api/admin/slots/unblock`        | Débloquer un créneau      |
| GET     | `/api/admin/slots/blocked`        | Liste créneaux bloqués    |
| GET     | `/api/admin/bookings`             | Liste des réservations    |
| POST    | `/api/admin/bookings`             | Créer réservation (admin) |
| POST    | `/api/admin/bookings/:id/confirm` | Confirmer réservation     |
| POST    | `/api/admin/bookings/:id/reject`  | Refuser réservation       |

## 🎨 Frontend

Le frontend est une application statique HTML/CSS/JS vanilla :

- **Landing page** (`index.html`) : présentation des services, formulaire de prise de RDV
- **Admin** (`/admin`) : interface d'administration protégée par clé API

### CSS modulaire

Le CSS est découpé en 5 fichiers pour une meilleure maintenabilité :

1. `base.css` - Variables de thème (light/dark), reset, typographie
2. `components.css` - Boutons, cartes, formulaires, effets glassmorphism
3. `layout.css` - Navigation, hero, sections, footer, bottom nav mobile
4. `animations.css` - Keyframes et transitions
5. `mobile.css` - Media queries responsive

## 📝 Notes

- Les emails sont logués si SMTP n'est pas configuré (pas d'échec bloquant)
- Les créneaux peuvent être bloqués/débloqués via l'interface admin
- Les réservations peuvent être confirmées ou refusées (email client envoyé)
- Délai minimum de 5h avant un créneau pour réserver

## 📄 License

UNLICENSED - Propriétaire
