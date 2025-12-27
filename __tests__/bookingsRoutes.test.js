const request = require('supertest');
const express = require('express');

describe('Bookings Routes - Tests simplifiés', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const bookingsRoutes = require('../src/routes/bookings');
    app.use('/api/bookings', bookingsRoutes);
  });

  describe('POST /api/bookings', () => {
    test('devrait rejeter si champs requis manquants (name)', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_fields');
    });

    test('devrait rejeter si email manquant', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ name: 'John', phone: '+33612345678', sector: 'tech' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_fields');
    });

    test('devrait rejeter si phone manquant', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ name: 'John', email: 'john@test.com', sector: 'tech' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_fields');
    });

    test('devrait rejeter si sector manquant', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({ name: 'John', email: 'john@test.com', phone: '+33612345678' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_fields');
    });

    test('devrait rejeter si slotStart invalide', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          name: 'John',
          email: 'john@test.com',
          phone: '+33612345678',
          sector: 'tech',
          slotStart: 'invalid-date'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_slot');
    });

    test('devrait rejeter si slotStart manquant', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          name: 'John',
          email: 'john@test.com',
          phone: '+33612345678',
          sector: 'tech'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_slot');
    });
  });
});
