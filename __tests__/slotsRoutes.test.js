const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

const testDataDir = path.join(__dirname, 'test-data-slots');
const SCHEDULE_PATH = path.join(testDataDir, 'schedule.json');
const BOOKINGS_PATH = path.join(testDataDir, 'bookings.json');
const BLOCKED_PATH = path.join(testDataDir, 'blockedSlots.json');

jest.mock('../src/config', () => ({
  BOOKINGS_PATH: path.join(__dirname, 'test-data-slots', 'bookings.json'),
  SCHEDULE_PATH: path.join(__dirname, 'test-data-slots', 'schedule.json'),
  BLOCKED_SLOTS_PATH: path.join(__dirname, 'test-data-slots', 'blockedSlots.json'),
  MIN_NOTICE_HOURS: 5,
  DATA_DIR: path.join(__dirname, 'test-data-slots'),
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

describe('Slots Routes', () => {
  let app;

  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  beforeEach(() => {
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(defaultSchedule, null, 2));
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify([], null, 2));
    fs.writeFileSync(BLOCKED_PATH, JSON.stringify([], null, 2));

    jest.resetModules();
    const slotsRoutes = require('../src/routes/slots');
    app = express();
    app.use(express.json());
    app.use('/api/slots', slotsRoutes);
  });

  afterAll(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('GET /api/slots', () => {
    test('retourne un tableau de créneaux', async () => {
      const res = await request(app).get('/api/slots');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('slots');
      expect(Array.isArray(res.body.slots)).toBe(true);
    });

    test('chaque créneau a start, end, capacity, remaining', async () => {
      const res = await request(app).get('/api/slots');
      if (res.body.slots.length > 0) {
        const slot = res.body.slots[0];
        expect(slot).toHaveProperty('start');
        expect(slot).toHaveProperty('end');
        expect(slot).toHaveProperty('capacity');
        expect(slot).toHaveProperty('remaining');
        expect(slot.capacity).toBe(1);
        expect(slot.remaining).toBe(1);
      }
    });

    test('retourne format groupé avec grouped=1', async () => {
      const res = await request(app).get('/api/slots').query({ grouped: '1' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('days');
      expect(Array.isArray(res.body.days)).toBe(true);
      if (res.body.days.length > 0) {
        expect(res.body.days[0]).toHaveProperty('date');
        expect(res.body.days[0]).toHaveProperty('slots');
      }
    });

    test('retourne format groupé avec grouped=true', async () => {
      const res = await request(app).get('/api/slots').query({ grouped: 'true' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('days');
    });

    test('accepte une plage from/to personnalisée', async () => {
      const now = new Date();
      const from = now.toISOString();
      const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app).get('/api/slots').query({ from, to });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('slots');
    });

    test('rejette une plage invalide (to <= from)', async () => {
      const now = new Date();
      const res = await request(app).get('/api/slots').query({
        from: now.toISOString(),
        to: new Date(now.getTime() - 1000).toISOString(),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_range');
    });

    test('ne retourne pas les créneaux bloqués', async () => {
      // Get a slot first
      const slotsRes = await request(app).get('/api/slots');
      if (slotsRes.body.slots.length > 0) {
        const firstSlot = slotsRes.body.slots[0].start;
        // Block it
        fs.writeFileSync(BLOCKED_PATH, JSON.stringify([firstSlot]));

        jest.resetModules();
        const slotsRoutes = require('../src/routes/slots');
        const app2 = express();
        app2.use(express.json());
        app2.use('/api/slots', slotsRoutes);

        const res2 = await request(app2).get('/api/slots');
        const starts = res2.body.slots.map(s => s.start);
        expect(starts).not.toContain(firstSlot);
      }
    });
  });

  describe('GET /api/slots/grouped', () => {
    test('retourne créneaux groupés par jour', async () => {
      const res = await request(app).get('/api/slots/grouped');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('days');
      expect(Array.isArray(res.body.days)).toBe(true);
    });

    test('les jours sont triés chronologiquement', async () => {
      const res = await request(app).get('/api/slots/grouped');
      if (res.body.days.length >= 2) {
        for (let i = 1; i < res.body.days.length; i++) {
          expect(res.body.days[i].date >= res.body.days[i - 1].date).toBe(true);
        }
      }
    });
  });

  describe('GET /api/slots/next', () => {
    test('retourne le prochain créneau disponible', async () => {
      const res = await request(app).get('/api/slots/next');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('next');
      if (res.body.next) {
        expect(res.body.next).toHaveProperty('start');
        expect(res.body.next).toHaveProperty('end');
      }
    });

    test('retourne null si aucun créneau (week-end seulement)', async () => {
      // Set schedule to no days
      const emptySchedule = { ...defaultSchedule, days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } };
      fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(emptySchedule));

      jest.resetModules();
      const slotsRoutes = require('../src/routes/slots');
      const app2 = express();
      app2.use(express.json());
      app2.use('/api/slots', slotsRoutes);

      const res = await request(app2).get('/api/slots/next');
      expect(res.status).toBe(200);
      expect(res.body.next).toBeNull();
    });
  });
});
