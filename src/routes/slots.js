const express = require('express');
const router = express.Router();
const { DateTime, Interval } = require('luxon');
const { SCHEDULE_PATH, BOOKINGS_PATH, BLOCKED_SLOTS_PATH } = require('../config');
const { readJson } = require('../utils/json');
const { logDebug, logInfo, logError } = require('../utils/logger');
const { generateSlots, groupSlotsByDay } = require('../services/schedule');

// List available slots within a range
router.get('/', async (req, res) => {
    try {
        logDebug('slots list', req.query);
        const schedule = await readJson(SCHEDULE_PATH);
        const zone = schedule.timezone;
        const fromISO = req.query.from;
        const toISO = req.query.to;
        const from = fromISO ? DateTime.fromISO(fromISO, { zone }) : DateTime.now().setZone(zone);
        const to = toISO ? DateTime.fromISO(toISO, { zone }) : from.plus({ days: 14 });
        if (!from.isValid || !to.isValid || to <= from) return res.status(400).json({ error: 'invalid_range' });
        const bookings = await readJson(BOOKINGS_PATH);
        const blocked = new Set((await readJson(BLOCKED_SLOTS_PATH)) || []);
        const slots = generateSlots(Interval.fromDateTimes(from, to), schedule, bookings, blocked);
        const grouped = String(req.query.grouped || '').toLowerCase();
        if (grouped === '1' || grouped === 'true') {
            return res.json(groupSlotsByDay(slots, zone));
        }
        logInfo('slots generated count', slots.length);
        res.json({ slots });
    } catch (e) {
        logError('slots_failed', e);
        res.status(500).json({ error: 'slots_failed' });
    }
});

// Slots grouped by day
router.get('/grouped', async (req, res) => {
    try {
        logDebug('slots grouped', req.query);
        const schedule = await readJson(SCHEDULE_PATH);
        const zone = schedule.timezone;
        const fromISO = req.query.from;
        const toISO = req.query.to;
        const from = fromISO ? DateTime.fromISO(fromISO, { zone }) : DateTime.now().setZone(zone);
        const to = toISO ? DateTime.fromISO(toISO, { zone }) : from.plus({ days: 14 });
        if (!from.isValid || !to.isValid || to <= from) return res.status(400).json({ error: 'invalid_range' });
        const bookings = await readJson(BOOKINGS_PATH);
        const blocked = new Set((await readJson(BLOCKED_SLOTS_PATH)) || []);
        const slots = generateSlots(Interval.fromDateTimes(from, to), schedule, bookings, blocked);
        const grouped = groupSlotsByDay(slots, zone);
        logInfo('slots grouped days', grouped.days.length);
        return res.json(grouped);
    } catch (e) {
        logError('slots_grouped_failed', e);
        res.status(500).json({ error: 'slots_grouped_failed' });
    }
});

// Next available slot
router.get('/next', async (_req, res) => {
    try {
        logDebug('slots next');
        const schedule = await readJson(SCHEDULE_PATH);
        const zone = schedule.timezone;
        const from = DateTime.now().setZone(zone);
        const to = from.plus({ days: 30 });
        const bookings = await readJson(BOOKINGS_PATH);
        const blocked = new Set((await readJson(BLOCKED_SLOTS_PATH)) || []);
        const slots = generateSlots(Interval.fromDateTimes(from, to), schedule, bookings, blocked);
        const next = slots[0] || null;
        logInfo('slots next result', next?.start || null);
        res.json({ next });
    } catch (e) {
        logError('next_slot_failed', e);
        res.status(500).json({ error: 'next_slot_failed' });
    }
});

module.exports = router;
