const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

const testDataDir = path.join(__dirname, 'test-data-admin');
const SCHEDULE_PATH = path.join(testDataDir, 'schedule.json');
const BOOKINGS_PATH = path.join(testDataDir, 'bookings.json');
const BLOCKED_PATH = path.join(testDataDir, 'blockedSlots.json');
const ORIGINAL_ADMIN_API_KEY = process.env.ADMIN_API_KEY;

jest.mock('../src/config', () => {
  const pathInMock = require('path');
  return {
    BOOKINGS_PATH: pathInMock.join(__dirname, 'test-data-admin', 'bookings.json'),
    SCHEDULE_PATH: pathInMock.join(__dirname, 'test-data-admin', 'schedule.json'),
    BLOCKED_SLOTS_PATH: pathInMock.join(__dirname, 'test-data-admin', 'blockedSlots.json'),
    MIN_NOTICE_HOURS: 5,
    DATA_DIR: pathInMock.join(__dirname, 'test-data-admin'),
  };
});

jest.mock('../src/services/mail', () => ({
  sendMail: jest.fn(),
}));

const defaultSchedule = {
  timezone: 'Europe/Paris',
  slotDurationMinutes: 30,
  maxBookingsPerSlot: 1,
  adminNotifyEmail: '',
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

describe('Admin Routes', () => {
  let app;
  let sendMailMock;

  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  beforeEach(() => {
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(defaultSchedule, null, 2));
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify([], null, 2));
    fs.writeFileSync(BLOCKED_PATH, JSON.stringify([], null, 2));

    process.env.ADMIN_API_KEY = 'test-admin-key';

    jest.resetModules();
    sendMailMock = require('../src/services/mail').sendMail;
    sendMailMock.mockClear();

    const adminRoutes = require('../src/routes/admin');
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
  });

  afterAll(() => {
    process.env.ADMIN_API_KEY = ORIGINAL_ADMIN_API_KEY;
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  test('PUT /api/admin/schedule persiste adminNotifyEmail', async () => {
    const payload = {
      ...defaultSchedule,
      adminNotifyEmail: 'admin-notify@test.com',
    };

    const res = await request(app)
      .put('/api/admin/schedule')
      .set('x-admin-key', 'test-admin-key')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const saved = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
    expect(saved.adminNotifyEmail).toBe('admin-notify@test.com');
  });

  test('PUT /api/admin/schedule rejette adminNotifyEmail invalide', async () => {
    const payload = {
      ...defaultSchedule,
      adminNotifyEmail: 'email-invalide',
    };

    const res = await request(app)
      .put('/api/admin/schedule')
      .set('x-admin-key', 'test-admin-key')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('adminNotifyEmail invalide');
  });

  test('POST /api/admin/bookings/:id/send-email envoie un mail au client', async () => {
    const bookings = [{
      id: 'booking-1',
      name: 'Jean Dupont',
      email: 'jean@test.com',
      phone: '0612345678',
      sector: 'industrie',
      slotStart: new Date().toISOString(),
      slotEnd: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      status: 'pending',
    }];
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));

    const res = await request(app)
      .post('/api/admin/bookings/booking-1/send-email')
      .set('x-admin-key', 'test-admin-key')
      .send({
        subject: 'Informations sur votre rendez-vous',
        message: 'Merci de confirmer votre disponibilité.',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'jean@test.com',
      subject: 'Informations sur votre rendez-vous',
      text: 'Merci de confirmer votre disponibilité.',
    }));
  });

  test('POST /api/admin/bookings/:id/send-email rejette sujet ou message vide', async () => {
    const bookings = [{
      id: 'booking-2',
      name: 'Marie',
      email: 'marie@test.com',
      status: 'pending',
    }];
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));

    const missingSubject = await request(app)
      .post('/api/admin/bookings/booking-2/send-email')
      .set('x-admin-key', 'test-admin-key')
      .send({ message: 'Bonjour' });

    const missingMessage = await request(app)
      .post('/api/admin/bookings/booking-2/send-email')
      .set('x-admin-key', 'test-admin-key')
      .send({ subject: 'Bonjour' });

    expect(missingSubject.status).toBe(400);
    expect(missingSubject.body.error).toBe('invalid_subject');
    expect(missingMessage.status).toBe(400);
    expect(missingMessage.body.error).toBe('invalid_message');
  });

  test('POST /api/admin/bookings/:id/send-email rejette une réservation sans email valide', async () => {
    const bookings = [{
      id: 'booking-3',
      name: 'Sans Email',
      email: 'invalid-email',
      status: 'pending',
    }];
    fs.writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));

    const res = await request(app)
      .post('/api/admin/bookings/booking-3/send-email')
      .set('x-admin-key', 'test-admin-key')
      .send({ subject: 'Test', message: 'Message test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_booking_email');
  });
});
