const { DateTime, Interval } = require('luxon');
const { MIN_NOTICE_HOURS } = require('../config');

function dayKeyFromWeekday(weekday) {
    const map = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun' };
    return map[weekday];
}

function validateSchedule(payload) {
    if (!payload || typeof payload !== 'object') return 'payload invalide';
    const { timezone, slotDurationMinutes, maxBookingsPerSlot, days, exceptions } = payload;
    if (!timezone || typeof timezone !== 'string') return 'timezone manquante';
    if (!slotDurationMinutes || slotDurationMinutes <= 0) return 'slotDurationMinutes invalide';
    if (!maxBookingsPerSlot || maxBookingsPerSlot <= 0) return 'maxBookingsPerSlot invalide';
    if (!days || typeof days !== 'object') return 'days manquant';
    const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (const k of keys) {
        if (!Array.isArray(days[k])) return `days.${k} doit être une liste d'intervalles`;
        for (const itv of days[k]) {
            if (!itv.start || !itv.end) return `intervalle invalide pour ${k}`;
        }
    }
    if (exceptions && typeof exceptions !== 'object') return 'exceptions invalide';
    return null;
}

function buildDayIntervals(date, schedule) {
    const dKey = dayKeyFromWeekday(date.weekday);
    const iso = date.toISODate();
    const ex = schedule.exceptions && Object.prototype.hasOwnProperty.call(schedule.exceptions, iso)
        ? schedule.exceptions[iso]
        : null;
    const ranges = ex !== null ? ex : schedule.days[dKey] || [];
    const intervals = [];
    for (const r of ranges) {
        const start = DateTime.fromISO(`${iso}T${r.start}`, { zone: schedule.timezone });
        const end = DateTime.fromISO(`${iso}T${r.end}`, { zone: schedule.timezone });
        if (end > start) intervals.push(Interval.fromDateTimes(start, end));
    }
    return intervals;
}

function generateSlots(range, schedule, existingBookings = [], blockedSet = new Set(), minStartOverride = null) {
    const slots = [];
    const step = { minutes: schedule.slotDurationMinutes };
    const now = DateTime.now().setZone(schedule.timezone);
    const minStart = minStartOverride || now.plus({ hours: MIN_NOTICE_HOURS });
    const byDate = new Map();
    for (const b of existingBookings) {
        const dt = DateTime.fromISO(b.slotStart, { zone: schedule.timezone });
        const key = dt.toISO();
        byDate.set(key, (byDate.get(key) || 0) + 1);
    }

    let cursor = range.start.startOf('day');
    const endDay = range.end.endOf('day');
    while (cursor <= endDay) {
        const dayIntervals = buildDayIntervals(cursor, schedule);
        for (const itv of dayIntervals) {
            let t = itv.start;
            const remainder = (t.minute % schedule.slotDurationMinutes);
            if (remainder !== 0) {
                t = t.plus({ minutes: schedule.slotDurationMinutes - remainder }).startOf('minute');
            }
            while (t < itv.end) {
                const slotEnd = t.plus(step);
                if (slotEnd > itv.end) break;
                if (t >= minStart && t >= range.start && slotEnd <= range.end) {
                    const key = t.toISO();
                    if (blockedSet.has(key)) {
                        t = t.plus(step);
                        continue;
                    }
                    const booked = byDate.get(key) || 0;
                    const remaining = Math.max(schedule.maxBookingsPerSlot - booked, 0);
                    if (remaining > 0) {
                        slots.push({
                            start: t.toISO(),
                            end: slotEnd.toISO(),
                            capacity: schedule.maxBookingsPerSlot,
                            remaining
                        });
                    }
                }
                t = t.plus(step);
            }
        }
        cursor = cursor.plus({ days: 1 });
    }
    slots.sort((a, b) => (a.start < b.start ? -1 : 1));
    return slots;
}

function groupSlotsByDay(slots, timezone) {
    const byDate = new Map();
    for (const s of slots) {
        const d = DateTime.fromISO(s.start, { zone: timezone }).toISODate();
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d).push(s);
    }
    const days = Array.from(byDate.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, list]) => ({ date, slots: list }));
    return { days };
}

module.exports = {
    validateSchedule,
    buildDayIntervals,
    generateSlots,
    groupSlotsByDay,
    dayKeyFromWeekday
};
