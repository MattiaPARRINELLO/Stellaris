const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

// Test data directory
const testDataDir = path.join(__dirname, 'test-data-bookings');
const BOOKINGS_PATH = path.join(testDataDir, 'bookings.json');
const SCHEDULE_PATH = path.join(testDataDir, 'schedule.json');
const BLOCKED_PATH = path.join(testDataDir, 'blockedSlots.json');
const ORIGINAL_ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL;

// Mock config to use test data dir
jest.mock('../src/config', () => {
  const pathInMock = require('path');
  return {
    BOOKINGS_PATH: pathInMock.join(__dirname, 'test-data-bookings', 'bookings.json'),
    SCHEDULE_PATH: pathInMock.join(__dirname, 'test-data-bookings', 'schedule.json'),
    BLOCKED_SLOTS_PATH: pathInMock.join(__dirname, 'test-data-bookings', 'blockedSlots.json'),
    MIN_NOTICE_HOURS: 5,
    DATA_DIR: pathInMock.join(__dirname, 'test-data-bookings'),
  };
});

// Mock mail to avoid sending real emails
jest.mock('../src/services/mail', () => ({
  sendMail: jest.fn(),
}));

const defaultSchedule = {
  timezone: 'Europe/Paris',
  slotDurationMinutes: 30,
  maxBookingsPerSlot: 1,
  days: {
    mon: [{ start: '09:00', end: '18:00' }],
    tue: [{ start: '09:00', end: '18:00' }],
    wed: [{ start: '09:00', end: '18:00' }],
    thu: [{ start: '09:00', end: '18:00' }],
    fri: [{ start: '09:00', end: '18:00' }],
    sat: [],
    sun: [],
  },
  exceptions: {},
};

function getNextWeekdaySlot(hoursAhead = 48) {
  // Find a valid weekday slot at least hoursAhead from now
  let dt = DateTime.now().setZone('Europe/Paris').plus({ hours: hoursAhead }).startOf('hour');
  // Move to 10:00 if outside business hours
  if (dt.hour < 9) dt = dt.set({ hour: 10, minute: 0 });
  if (dt.hour >= 18) dt = dt.plus({ days: 1 }).set({ hour: 10, minute: 0 });
  // Skip weekends
  while (dt.weekday === 6 || dt.weekday === 7) {
    dt = dt.plus({ days: 1 });
  }
  // Align to 30-min slot boundary
  dt = dt.set({ minute: dt.minute >= 30 ? 30 : 0, second: 0, millisecond: 0 });
  return dt.toISO();
}

describe('Bookings Routes', () => {
  let app;
  let sendMailMock;

  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Reset data files
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(defaultSchedule, null, 2));
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify([], null, 2));
    fs.writeFileSync(BLOCKED_PATH, JSON.stringify([], null, 2));

    // Clear module cache to get fresh routes
    jest.resetModules();
    sendMailMock = require('../src/services/mail').sendMail;
    sendMailMock.mockClear();
    process.env.ADMIN_NOTIFY_EMAIL = '';
    const bookingsRoutes = require('../src/routes/bookings');
    app = express();
    app.use(express.json());
    app.use('/api/bookings', bookingsRoutes);
  });

  afterAll(() => {
    process.env.ADMIN_NOTIFY_EMAIL = ORIGINAL_ADMIN_NOTIFY_EMAIL;
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('POST /api/bookings - Validation', () => {
    test('rejette si champs requis manquants (aucun champ)', async () => {
      const res = await request(app).post('/api/bookings').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_fields');
    });

    test('rejette si name manquant', async () => {
      const res = await request(app).post('/api/bookings').send({
        email: 'test@test.com', phone: '0612345678', sector: 'tech',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_fields');
    });

    test('rejette si email manquant', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', phone: '0612345678', sector: 'tech',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_fields');
    });

    test('rejette si phone manquant', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'john@test.com', sector: 'tech',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_fields');
    });

    test('rejette si sector manquant', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'john@test.com', phone: '0612345678',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_fields');
    });

    test('rejette un email invalide', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'not-an-email', phone: '0612345678', sector: 'tech',
        slotStart: getNextWeekdaySlot(),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_email');
    });

    test('rejette un téléphone invalide', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'john@test.com', phone: '12', sector: 'tech',
        slotStart: getNextWeekdaySlot(),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_phone');
    });

    test('accepte un email valide', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'john@enterprise.com', phone: '0612345678', sector: 'tech',
        slotStart: getNextWeekdaySlot(),
      });
      // Should be 201 (created) or 409 (slot issue) but not 400 for email
      expect(res.body.error).not.toBe('invalid_email');
    });

    test('accepte différents formats de téléphone', async () => {
      const phones = ['+33612345678', '06 12 34 56 78', '06-12-34-56-78', '(06)12345678'];
      for (const phone of phones) {
        const res = await request(app).post('/api/bookings').send({
          name: 'John', email: 'john@test.com', phone, sector: 'tech',
          slotStart: getNextWeekdaySlot(),
        });
        expect(res.body.error).not.toBe('invalid_phone');
      }
    });

    test('rejette un slotStart invalide', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'john@test.com', phone: '0612345678', sector: 'tech',
        slotStart: 'not-a-date',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_slot');
    });

    test('rejette un slotStart manquant', async () => {
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'john@test.com', phone: '0612345678', sector: 'tech',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_slot');
    });

    test('rejette un créneau trop proche (< 5h)', async () => {
      const soonSlot = DateTime.now().setZone('Europe/Paris').plus({ hours: 1 }).toISO();
      const res = await request(app).post('/api/bookings').send({
        name: 'John', email: 'john@test.com', phone: '0612345678', sector: 'tech',
        slotStart: soonSlot,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('slot_too_soon');
      expect(res.body.minNoticeHours).toBe(5);
    });
  });

  describe('POST /api/bookings - Création réussie', () => {
    test('crée une réservation avec statut pending', async () => {
      const slotStart = getNextWeekdaySlot();
      const res = await request(app).post('/api/bookings').send({
        name: 'Jean Dupont', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', company: 'ACME', slotStart,
      });
      expect(res.status).toBe(201);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.id).toBeDefined();
      expect(res.body.booking.cancelToken).toBeDefined();
      expect(res.body.booking.status).toBe('pending');
    });

    test('la réservation est persistée dans le fichier', async () => {
      const slotStart = getNextWeekdaySlot();
      await request(app).post('/api/bookings').send({
        name: 'Jean', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', slotStart,
      });

      const bookings = JSON.parse(fs.readFileSync(BOOKINGS_PATH, 'utf8'));
      expect(bookings).toHaveLength(1);
      expect(bookings[0].name).toBe('Jean');
      expect(bookings[0].status).toBe('pending');
      expect(bookings[0].cancelToken).toBeDefined();
    });

    test('rejette une double réservation sur le même créneau (maxBookingsPerSlot=1)', async () => {
      const slotStart = getNextWeekdaySlot();

      const res1 = await request(app).post('/api/bookings').send({
        name: 'Jean', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', slotStart,
      });
      expect(res1.status).toBe(201);

      const res2 = await request(app).post('/api/bookings').send({
        name: 'Marie', email: 'marie@test.com', phone: '0698765432',
        sector: 'retail', slotStart,
      });
      expect(res2.status).toBe(409);
      expect(res2.body.error).toBe('slot_unavailable');
    });

    test('rejette un créneau bloqué', async () => {
      const slotStart = getNextWeekdaySlot();
      // Block the slot
      fs.writeFileSync(BLOCKED_PATH, JSON.stringify([slotStart]));

      const res = await request(app).post('/api/bookings').send({
        name: 'Jean', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', slotStart,
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('slot_unavailable');
    });
  });

  describe('POST /api/bookings - Emails automatiques', () => {
    test('envoie un email admin depuis le planning + un email de confirmation client', async () => {
      const scheduleWithEmail = {
        ...defaultSchedule,
        adminNotifyEmail: 'admin@stellaris.test',
      };
      fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(scheduleWithEmail, null, 2));

      const slotStart = getNextWeekdaySlot();
      const res = await request(app).post('/api/bookings').send({
        name: 'Jean Dupont',
        email: 'client@test.com',
        phone: '0612345678',
        sector: 'industrie',
        slotStart,
      });

      expect(res.status).toBe(201);
      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: 'admin@stellaris.test',
        subject: 'Nouvelle demande de créneau',
      }));
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: 'client@test.com',
        subject: 'Votre demande de rendez-vous a bien été reçue',
      }));
    });

    test('utilise ADMIN_NOTIFY_EMAIL comme fallback si le planning ne définit pas adminNotifyEmail', async () => {
      process.env.ADMIN_NOTIFY_EMAIL = 'fallback-admin@stellaris.test';
      const slotStart = getNextWeekdaySlot();

      const res = await request(app).post('/api/bookings').send({
        name: 'Marie',
        email: 'marie@test.com',
        phone: '0698765432',
        sector: 'retail',
        slotStart,
      });

      expect(res.status).toBe(201);
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: 'fallback-admin@stellaris.test',
        subject: 'Nouvelle demande de créneau',
      }));
    });
  });

  describe('POST /api/bookings/:id/cancel', () => {
    test('annule une réservation avec le bon cancelToken', async () => {
      const slotStart = getNextWeekdaySlot();
      const createRes = await request(app).post('/api/bookings').send({
        name: 'Jean', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', slotStart,
      });
      const { id, cancelToken } = createRes.body.booking;

      const cancelRes = await request(app)
        .post(`/api/bookings/${id}/cancel`)
        .send({ cancelToken });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.booking.status).toBe('cancelled');
    });

    test('rejette sans cancelToken', async () => {
      const res = await request(app)
        .post('/api/bookings/some-id/cancel')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_cancel_token');
    });

    test('rejette avec un mauvais cancelToken', async () => {
      const slotStart = getNextWeekdaySlot();
      const createRes = await request(app).post('/api/bookings').send({
        name: 'Jean', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', slotStart,
      });
      const { id } = createRes.body.booking;

      const res = await request(app)
        .post(`/api/bookings/${id}/cancel`)
        .send({ cancelToken: 'wrong-token' });
      expect(res.status).toBe(404);
    });

    test('annulation idempotente (déjà annulée)', async () => {
      const slotStart = getNextWeekdaySlot();
      const createRes = await request(app).post('/api/bookings').send({
        name: 'Jean', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', slotStart,
      });
      const { id, cancelToken } = createRes.body.booking;

      await request(app).post(`/api/bookings/${id}/cancel`).send({ cancelToken });
      const res2 = await request(app).post(`/api/bookings/${id}/cancel`).send({ cancelToken });
      expect(res2.status).toBe(200);
      expect(res2.body.booking.status).toBe('cancelled');
    });
  });

  describe('GET /api/bookings/:id', () => {
    test('retourne le statut avec un token valide', async () => {
      const slotStart = getNextWeekdaySlot();
      const createRes = await request(app).post('/api/bookings').send({
        name: 'Jean', email: 'jean@test.com', phone: '0612345678',
        sector: 'industrie', slotStart,
      });
      const { id, cancelToken } = createRes.body.booking;

      const res = await request(app).get(`/api/bookings/${id}?token=${cancelToken}`);
      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('pending');
      expect(res.body.booking.name).toBe('Jean');
    });

    test('rejette sans token', async () => {
      const res = await request(app).get('/api/bookings/some-id');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_token');
    });

    test('rejette avec un mauvais token', async () => {
      const res = await request(app).get('/api/bookings/some-id?token=wrong');
      expect(res.status).toBe(404);
    });
  });
});
