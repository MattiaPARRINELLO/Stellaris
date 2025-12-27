const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

module.exports = {
    ROOT,
    PUBLIC_DIR,
    DATA_DIR,
    BOOKINGS_PATH: path.join(DATA_DIR, 'bookings.json'),
    SCHEDULE_PATH: path.join(DATA_DIR, 'schedule.json'),
    BLOCKED_SLOTS_PATH: path.join(DATA_DIR, 'blockedSlots.json'),
    MIN_NOTICE_HOURS: 5,
    PORT: process.env.PORT || 3000
};
