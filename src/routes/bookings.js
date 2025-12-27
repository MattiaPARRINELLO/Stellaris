const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { DateTime, Interval } = require('luxon');
const { SCHEDULE_PATH, BOOKINGS_PATH, BLOCKED_SLOTS_PATH, MIN_NOTICE_HOURS } = require('../config');
const { readJson, writeJson } = require('../utils/json');
const { logInfo, logError } = require('../utils/logger');
const { generateSlots } = require('../services/schedule');
const { sendMail } = require('../services/mail');

// Create a booking (public)
router.post('/', async (req, res) => {
    try {
        logInfo('public create booking', req.body?.slotStart);
        const { name, email, company, phone, sector, description, slotStart } = req.body || {};
        if (!name || !email || !phone || !sector) return res.status(400).json({ error: 'missing_fields' });

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
            name, email, company: company || null, phone, sector, description: description || null,
            slotStart: startDT.toISO(),
            slotEnd: DateTime.fromISO(slot.start, { zone }).plus({ minutes: schedule.slotDurationMinutes }).toISO(),
            createdAt: now.toISO(),
            status: 'pending',
            confirmedAt: null
        };

        const updatedBookings = bookings.concat([booking]);
        await writeJson(BOOKINGS_PATH, updatedBookings);

        const adminRecipient = process.env.ADMIN_NOTIFY_EMAIL;
        if (adminRecipient) {
            const tf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
            const body = [
                'Nouvelle demande de créneau',
                '',
                `Nom : ${name}`,
                `Email : ${email}`,
                `Téléphone : ${phone}`,
                `Société : ${company || '-'}`,
                `Secteur : ${sector}`,
                `Créneau : ${tf.format(startDT.toJSDate())}`,
                '',
                'Merci de confirmer ce créneau dans l\'admin.'
            ].join('\n');
            sendMail({ to: adminRecipient, subject: 'Nouvelle demande de créneau', text: body });
        }

        logInfo('public booking created', booking.id);
        res.status(201).json({ booking });
    } catch (e) {
        logError('booking_failed', e);
        res.status(500).json({ error: 'booking_failed' });
    }
});

module.exports = router;
