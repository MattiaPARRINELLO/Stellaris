const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { DateTime, Interval } = require('luxon');
const { SCHEDULE_PATH, BOOKINGS_PATH, BLOCKED_SLOTS_PATH, MIN_NOTICE_HOURS } = require('../config');
const { readJson, writeJson } = require('../utils/json');
const { logInfo, logError } = require('../utils/logger');
const { generateSlots } = require('../services/schedule');
const { sendMail } = require('../services/mail');
const { adminNotificationHtml, clientConfirmationHtml } = require('../services/mailTemplates');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\+\-\(\)\.]{7,20}$/;

function getAdminRecipients(schedule) {
    const configured = typeof schedule?.adminNotifyEmail === 'string'
        ? schedule.adminNotifyEmail
        : (process.env.ADMIN_NOTIFY_EMAIL || '');
    return configured
        .split(',')
        .map(s => s.trim())
        .filter(s => EMAIL_REGEX.test(s));
}

// Create a booking (public)
router.post('/', async (req, res) => {
    try {
        logInfo('public create booking', req.body?.slotStart);
        const { name, email, company, phone, sector, description, slotStart } = req.body || {};
        if (!name || !email || !phone || !sector) return res.status(400).json({ error: 'missing_fields' });

        if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'invalid_email' });
        if (!PHONE_REGEX.test(phone.replace(/\s/g, ''))) return res.status(400).json({ error: 'invalid_phone' });

        const schedule = await readJson(SCHEDULE_PATH);
        const zone = schedule.timezone;
        const startDT = slotStart ? DateTime.fromISO(slotStart, { zone }) : null;
        const now = DateTime.now().setZone(zone);

        if (!startDT || !startDT.isValid) {
            return res.status(400).json({ error: 'invalid_slot' });
        }

        if (startDT.diff(now, 'hours').hours < MIN_NOTICE_HOURS) {
            return res.status(400).json({ error: 'slot_too_soon', minNoticeHours: MIN_NOTICE_HOURS });
        }

        const dayStart = startDT.startOf('day');
        const dayEnd = startDT.endOf('day');
        const bookings = await readJson(BOOKINGS_PATH);
        const blocked = new Set((await readJson(BLOCKED_SLOTS_PATH)) || []);
        const daySlots = generateSlots(Interval.fromDateTimes(dayStart, dayEnd), schedule, bookings, blocked);
        const slot = daySlots.find(s => s.start === startDT.toISO());
        if (!slot) return res.status(409).json({ error: 'slot_unavailable' });

        const booking = {
            id: uuidv4(),
            cancelToken: uuidv4(),
            name, email, company: company || null, phone, sector, description: description || null,
            slotStart: startDT.toISO(),
            slotEnd: DateTime.fromISO(slot.start, { zone }).plus({ minutes: schedule.slotDurationMinutes }).toISO(),
            createdAt: now.toISO(),
            status: 'pending',
            confirmedAt: null
        };

        const updatedBookings = bookings.concat([booking]);
        await writeJson(BOOKINGS_PATH, updatedBookings);

        const tf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
        const slotLabel = tf.format(startDT.toJSDate());
        const adminRecipients = getAdminRecipients(schedule);
        if (adminRecipients.length > 0) {
            const plain = [
                'Nouvelle demande de créneau',
                '',
                `Nom : ${name}`,
                `Email : ${email}`,
                `Téléphone : ${phone}`,
                `Société : ${company || '-'}`,
                `Secteur : ${sector}`,
                `Créneau : ${slotLabel}`,
                '',
                'Merci de confirmer ce créneau dans l\'admin.'
            ].join('\n');
            const html = adminNotificationHtml(booking, slotLabel);
            for (const recipient of adminRecipients) {
                sendMail({ to: recipient, subject: 'Nouvelle demande de créneau', text: plain, html });
            }
        }

        const clientPlain = [
            'Bonjour,',
            '',
            'Nous avons bien reçu votre demande de rendez-vous.',
            `Créneau demandé : ${slotLabel}`,
            '',
            'Notre équipe va vérifier la disponibilité et vous enverra une confirmation rapidement.',
            '',
            'Stellaris Conseil'
        ].join('\n');
        const clientHtml = clientConfirmationHtml(booking, slotLabel);
        sendMail({ to: email, subject: 'Votre demande de rendez-vous a bien été reçue', text: clientPlain, html: clientHtml });

        logInfo('public booking created', booking.id);
        res.status(201).json({ booking: { id: booking.id, cancelToken: booking.cancelToken, status: booking.status, slotStart: booking.slotStart, slotEnd: booking.slotEnd } });
    } catch (e) {
        logError('booking_failed', e);
        res.status(500).json({ error: 'booking_failed' });
    }
});

// Cancel a booking (public, using cancelToken)
router.post('/:id/cancel', async (req, res) => {
    try {
        const { cancelToken } = req.body || {};
        if (!cancelToken) return res.status(400).json({ error: 'missing_cancel_token' });

        const bookings = await readJson(BOOKINGS_PATH);
        const idx = bookings.findIndex(b => b.id === req.params.id && b.cancelToken === cancelToken);
        if (idx === -1) return res.status(404).json({ error: 'booking_not_found' });

        const booking = bookings[idx];
        if (booking.status === 'cancelled') return res.json({ booking: { id: booking.id, status: 'cancelled' } });
        if (booking.status === 'rejected') return res.status(400).json({ error: 'already_rejected' });

        booking.status = 'cancelled';
        booking.cancelledAt = DateTime.now().setZone('UTC').toISO();
        bookings[idx] = booking;
        await writeJson(BOOKINGS_PATH, bookings);

        logInfo('public booking cancelled', booking.id);
        res.json({ booking: { id: booking.id, status: 'cancelled' } });
    } catch (e) {
        logError('cancel_failed', e);
        res.status(500).json({ error: 'cancel_failed' });
    }
});

// Get booking status (public, using cancelToken for auth)
router.get('/:id', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).json({ error: 'missing_token' });

        const bookings = await readJson(BOOKINGS_PATH);
        const booking = bookings.find(b => b.id === req.params.id && b.cancelToken === token);
        if (!booking) return res.status(404).json({ error: 'booking_not_found' });

        res.json({ booking: { id: booking.id, status: booking.status, slotStart: booking.slotStart, slotEnd: booking.slotEnd, name: booking.name } });
    } catch (e) {
        logError('booking_status_failed', e);
        res.status(500).json({ error: 'status_failed' });
    }
});

module.exports = router;
