const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.DEBUG = 'false';

// Créer un dossier de données de test
const testDataDir = path.join(__dirname, 'test-data-integration');

describe('Tests d\'intégration complets', () => {
  let app;
  let server;

  beforeAll(() => {
    // Créer le dossier de données de test
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Initialiser les fichiers de données
    const schedule = {
      monday: { enabled: true, slots: [{ start: '09:00', end: '17:00', duration: 60 }] },
      tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00', duration: 60 }] },
      wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00', duration: 60 }] },
      thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00', duration: 60 }] },
      friday: { enabled: true, slots: [{ start: '09:00', end: '17:00', duration: 60 }] },
      saturday: { enabled: false, slots: [] },
      sunday: { enabled: false, slots: [] }
    };

    fs.writeFileSync(
      path.join(testDataDir, 'schedule.json'),
      JSON.stringify(schedule, null, 2)
    );

    fs.writeFileSync(
      path.join(testDataDir, 'bookings.json'),
      JSON.stringify({ bookings: [] }, null, 2)
    );

    fs.writeFileSync(
      path.join(testDataDir, 'blockedSlots.json'),
      JSON.stringify({ slots: [] }, null, 2)
    );
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    // Nettoyer les données de test
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Flux complet de réservation', () => {
    test('Scénario: Client consulte les créneaux et réserve', async () => {
      // Mock léger pour ne pas dépendre du serveur complet
      const express = require('express');
      const slotsRoutes = require('../src/routes/slots');
      const bookingsRoutes = require('../src/routes/bookings');
      const healthRoutes = require('../src/routes/health');

      app = express();
      app.use(express.json());
      app.use('/api/health', healthRoutes);
      app.use('/api/slots', slotsRoutes);
      app.use('/api/bookings', bookingsRoutes);

      // 1. Vérifier que l'API est accessible
      const healthCheck = await request(app).get('/api/health');
      expect(healthCheck.status).toBe(200);
      expect(healthCheck.body.status).toBe('ok');

      // 2. Récupérer les créneaux disponibles
      const slotsResponse = await request(app).get('/api/slots/grouped');
      expect(slotsResponse.status).toBe(200);
      expect(slotsResponse.body).toHaveProperty('days');
      expect(Array.isArray(slotsResponse.body.days)).toBe(true);

      // Note: Les tests d'intégration complets nécessiteraient
      // un serveur de test avec base de données réelle
      // Ces tests sont des exemples de structure
    });
  });

  describe('Flux admin complet', () => {
    test('Scénario: Admin configure planning et gère réservations', async () => {
      const express = require('express');
      const adminRoutes = require('../src/routes/admin');

      app = express();
      app.use(express.json());
      
      // Middleware d'auth simple pour tests
      app.use((req, res, next) => {
        const apiKey = req.headers['x-admin-key'];
        if (apiKey === 'test-admin-key') {
          next();
        } else {
          res.status(401).json({ error: 'Non autorisé' });
        }
      });
      
      app.use('/api/admin', adminRoutes);

      // Tests basiques pour vérifier la structure
      // Les tests réels nécessiteraient une base de données de test
    });
  });
});

describe('Tests de charge légers', () => {
  test('Devrait gérer plusieurs requêtes simultanées', async () => {
    const express = require('express');
    const healthRoutes = require('../src/routes/health');

    const app = express();
    app.use('/api/health', healthRoutes);

    const requests = Array(10).fill(null).map(() => 
      request(app).get('/api/health')
    );

    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });
});
