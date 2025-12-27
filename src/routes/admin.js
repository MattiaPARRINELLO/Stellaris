const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { DateTime, Interval } = require('luxon');
const { SCHEDULE_PATH, BOOKINGS_PATH, BLOCKED_SLOTS_PATH } = require('../config');
const { readJson, writeJson } = require('../utils/json');
const { logInfo, logError, logDebug } = require('../utils/logger');
const { validateSchedule, generateSlots, groupSlotsByDay } = require('../services/schedule');
const { sendMail } = require('../services/mail');
const { requireAdmin } = require('../middleware/auth');

// Apply admin middleware to all routes
router.use(requireAdmin);

// Get schedule
router.get('/schedule', async (_req, res) => {
    try {
        logDebug('admin get schedule');
        const schedule = await readJson(SCHEDULE_PATH);
        res.json(schedule);
    } catch (e) {
        logError('admin read_schedule_failed', e);
        res.status(500).json({ error: 'read_schedule_failed' });
    }
});

// Update schedule
router.put('/schedule', async (req, res) => {
    logInfo('admin put schedule', { timezone: req.body?.timezone, slotDurationMinutes: req.body?.slotDurationMinutes });
    const err = validateSchedule(req.body);
    if (err) return res.status(400).json({ error: err });
    try {
        await writeJson(SCHEDULE_PATH, req.body);
        res.json({ ok: true });
    } catch (e) {
        logError('admin write_schedule_failed', e);
        res.status(500).json({ error: 'write_schedule_failed' });
    }
});

// Block a slot
router.post('/slots/block', async (req, res) => {
    const { start } = req.body || {};
    const dt = start ? DateTime.fromISO(start) : null;
    if (!dt || !dt.isValid) return res.status(400).json({ error: 'invalid_slot_start' });
    try {
        logInfo('admin block slot', start);
        const blocked = (await readJson(BLOCKED_SLOTS_PATH)) || [];
        if (!blocked.includes(start)) blocked.push(start);
        await writeJson(BLOCKED_SLOTS_PATH, blocked);
        res.json({ ok: true });
    } catch (e) {
        logError('admin block_slot_failed', e);
        res.status(500).json({ error: 'block_slot_failed' });
    }
});

// List slots (admin, without 5h restriction)
router.get('/slots', async (req, res) => {
    try {
        const schedule = await readJson(SCHEDULE_PATH);
        const zone = schedule.timezone;
        const fromISO = req.query.from;
        const toISO = req.query.to;
        const from = fromISO ? DateTime.fromISO(fromISO, { zone }) : DateTime.now().setZone(zone);
        const to = toISO ? DateTime.fromISO(toISO, { zone }) : from.plus({ days: 14 });
        if (!from.isValid || !to.isValid || to <= from) return res.status(400).json({ error: 'invalid_range' });
        const bookings = await readJson(BOOKINGS_PATH);
        const blocked = new Set((await readJson(BLOCKED_SLOTS_PATH)) || []);
        const slots = generateSlots(Interval.fromDateTimes(from, to), schedule, bookings, blocked, DateTime.now().setZone(zone));
        const grouped = String(req.query.grouped || '').toLowerCase();
        if (grouped === '1' || grouped === 'true') {
            return res.json(groupSlotsByDay(slots, zone));
        }
        res.json({ slots });
    } catch (e) {
        res.status(500).json({ error: 'admin_slots_failed' });
    }
});

// Unblock a slot
router.post('/slots/unblock', async (req, res) => {
    const { start } = req.body || {};
    const dt = start ? DateTime.fromISO(start) : null;
    if (!dt || !dt.isValid) return res.status(400).json({ error: 'invalid_slot_start' });
    try {
        logInfo('admin unblock slot', start);
        let blocked = (await readJson(BLOCKED_SLOTS_PATH)) || [];
        blocked = blocked.filter(s => s !== start);
        await writeJson(BLOCKED_SLOTS_PATH, blocked);
        res.json({ ok: true });
    } catch (e) {
        logError('admin unblock_slot_failed', e);
        res.status(500).json({ error: 'unblock_slot_failed' });
    }
});

// List blocked slots
router.get('/slots/blocked', async (_req, res) => {
    try {
        const blocked = (await readJson(BLOCKED_SLOTS_PATH)) || [];
        res.json({ blocked });
    } catch (e) {
        res.status(500).json({ error: 'blocked_list_failed' });
    }
});

// List bookings
router.get('/bookings', async (_req, res) => {
    try {
        logDebug('admin get bookings');
        const bookings = await readJson(BOOKINGS_PATH);
        res.json({ bookings });
    } catch (e) {
        logError('bookings_read_failed', e);
        res.status(500).json({ error: 'bookings_read_failed' });
    }
});

// Confirm a booking
router.post('/bookings/:id/confirm', async (req, res) => {
    try {
        logInfo('admin confirm booking', req.params.id);
        const bookings = await readJson(BOOKINGS_PATH);
        const idx = bookings.findIndex(b => b.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'booking_not_found' });
        const booking = bookings[idx];
        if (booking.status === 'confirmed') return res.json({ booking });

        booking.status = 'confirmed';
        booking.confirmedAt = DateTime.now().setZone(booking.slotStart ? DateTime.fromISO(booking.slotStart).zoneName : 'UTC').toISO();
        bookings[idx] = booking;
        await writeJson(BOOKINGS_PATH, bookings);

        if (booking.email) {
            const tf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
            const body = [
                'Votre rendez-vous est confirmé !',
                '',
                `Créneau : ${tf.format(new Date(booking.slotStart))}`,
                `Secteur : ${booking.sector}`,
                '',
                'Merci et à bientôt.'
            ].join('\n');
            sendMail({ to: booking.email, subject: 'Confirmation de votre rendez-vous', text: body });
        }

        logInfo('admin confirmed', booking.id);
        res.json({ booking });
    } catch (e) {
        logError('confirm_failed', e);
        res.status(500).json({ error: 'confirm_failed' });
    }
});

// Reject a booking
router.post('/bookings/:id/reject', async (req, res) => {
    try {
        const { reason } = req.body || {};
        const bookings = await readJson(BOOKINGS_PATH);
        const idx = bookings.findIndex(b => b.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'booking_not_found' });
        const booking = bookings[idx];
        if (booking.status === 'rejected') return res.json({ booking });

        booking.status = 'rejected';
        booking.rejectedAt = DateTime.now().setZone(booking.slotStart ? DateTime.fromISO(booking.slotStart).zoneName : 'UTC').toISO();
        booking.rejectionReason = reason || null;
        bookings[idx] = booking;
        await writeJson(BOOKINGS_PATH, bookings);

        if (booking.email) {
            const tf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
            const body = [
                'Votre demande de rendez-vous a été refusée',
                '',
                `Créneau demandé : ${tf.format(new Date(booking.slotStart))}`,
                reason ? `Motif : ${reason}` : null,
                '',
                'Vous pouvez sélectionner un autre créneau depuis la page de réservation.'
            ].filter(Boolean).join('\n');
            sendMail({ to: booking.email, subject: 'Refus de votre demande de rendez-vous', text: body });
        }

        res.json({ booking });
    } catch (e) {
        res.status(500).json({ error: 'reject_failed' });
    }
});

// Create a booking (admin, allows <5h)
router.post('/bookings', async (req, res) => {
    try {
        const { name, email, company, phone, sector, description, slotStart } = req.body || {};
        if (!name || !email || !phone || !sector) return res.status(400).json({ error: 'missing_fields' });

        const schedule = await readJson(SCHEDULE_PATH);
        const zone = schedule.timezone;
        const startDT = slotStart ? DateTime.fromISO(slotStart, { zone }) : null;
        const now = DateTime.now().setZone(zone);
        if (!startDT || !startDT.isValid) return res.status(400).json({ error: 'invalid_slot' });

        const dayStart = startDT.startOf('day');
        const dayEnd = startDT.endOf('day');
        const bookings = await readJson(BOOKINGS_PATH);
        const blocked = new Set((await readJson(BLOCKED_SLOTS_PATH)) || []);
        const daySlots = generateSlots(Interval.fromDateTimes(dayStart, dayEnd), schedule, bookings, blocked, now);
        const slot = daySlots.find(s => s.start === startDT.toISO());
        if (!slot) return res.status(409).json({ error: 'slot_unavailable' });

        const booking = {
            id: uuidv4(),
            name, email, company: company || null, phone, sector, description: description || null,
            slotStart: startDT.toISO(),
            slotEnd: DateTime.fromISO(slot.start, { zone }).plus({ minutes: schedule.slotDurationMinutes }).toISO(),
            createdAt: now.toISO(),
            status: 'confirmed',
            confirmedAt: now.toISO(),
            createdBy: 'admin'
        };

        const updatedBookings = bookings.concat([booking]);
        await writeJson(BOOKINGS_PATH, updatedBookings);

        if (email) {
            const tf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
            const body = [
                'Votre rendez-vous est confirmé (ajout par l\'administrateur).',
                '',
                `Créneau : ${tf.format(startDT.toJSDate())}`,
                `Secteur : ${sector}`,
                '',
                'Merci et à bientôt.'
            ].join('\n');
            sendMail({ to: email, subject: 'Confirmation de votre rendez-vous', text: body });
        }

        res.status(201).json({ booking });
    } catch (e) {
        res.status(500).json({ error: 'admin_booking_failed' });
    }
});

module.exports = router;
