require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const { PUBLIC_DIR, DATA_DIR, BOOKINGS_PATH, SCHEDULE_PATH, BLOCKED_SLOTS_PATH, PORT } = require('./config');
const { logInfo, logError } = require('./utils/logger');

// Routes
const healthRoutes = require('./routes/health');
const slotsRoutes = require('./routes/slots');
const bookingsRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Ensure data files exist
async function ensureDataFiles() {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BOOKINGS_PATH)) {
        await fsp.writeFile(BOOKINGS_PATH, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(SCHEDULE_PATH)) {
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
                sun: []
            },
            exceptions: {}
        };
        await fsp.writeFile(SCHEDULE_PATH, JSON.stringify(defaultSchedule, null, 2));
    }
    if (!fs.existsSync(BLOCKED_SLOTS_PATH)) {
        await fsp.writeFile(BLOCKED_SLOTS_PATH, JSON.stringify([], null, 2));
    }
}

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/admin', adminRoutes);

// Serve static files (front)
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Fallback to index.html for root
app.get('/', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Serve admin.html for /admin route
app.get('/admin', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// Start server
ensureDataFiles().then(() => {
    app.listen(PORT, () => {
        logInfo(`Stellaris running on http://localhost:${PORT}`);
    });
}).catch((e) => {
    logError('Failed to init data files', e);
    process.exit(1);
});
