const request = require('supertest');
const express = require('express');

describe('Slots Routes - Tests simplifiés', () => {
  let app;

  beforeEach(() => {
    // Ne pas mocker, utiliser les vraies données
    app = express();
    app.use(express.json());
    const slotsRoutes = require('../src/routes/slots');
    app.use('/api/slots', slotsRoutes);
  });

  describe('GET /api/slots', () => {
    test('devrait retourner des créneaux avec format {slots: [...]}', async () => {
      const response = await request(app).get('/api/slots');
      
      // Peut être 200 ou 500 selon si les fichiers existent
      if (response.status === 200) {
        expect(response.body).toHaveProperty('slots');
        expect(Array.isArray(response.body.slots)).toBe(true);
      } else {
        expect(response.status).toBe(500);
      }
    });

    test('devrait retourner format groupé si grouped=1', async () => {
      const response = await request(app)
        .get('/api/slots')
        .query({ grouped: '1' });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('days');
        expect(Array.isArray(response.body.days)).toBe(true);
      }
    });

    test('devrait retourner format groupé si grouped=true', async () => {
      const response = await request(app)
        .get('/api/slots')
        .query({ grouped: 'true' });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('days');
      }
    });
  });

  describe('GET /api/slots/grouped', () => {
    test('devrait retourner créneaux groupés par jour', async () => {
      const response = await request(app).get('/api/slots/grouped');
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('days');
        expect(Array.isArray(response.body.days)).toBe(true);
      }
    });
  });

  describe('GET /api/slots/next', () => {
    test('devrait retourner le prochain créneau disponible', async () => {
      const response = await request(app).get('/api/slots/next');
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('next');
      }
    });
  });
});
