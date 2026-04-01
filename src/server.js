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

// SEO: Compression gzip pour améliorer les performances
let compression;
try {
    compression = require('compression');
    app.use(compression());
    logInfo('SEO: Compression gzip activée');
} catch (_) {
    logInfo('SEO: Module compression non installé — npm install compression pour activer la compression gzip');
}

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
            adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL || '',
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

// SEO: Sitemap.xml dynamique
app.get('/sitemap.xml', (_req, res) => {
    const baseUrl = 'https://stellarisconseil.fr';
    const lastmod = new Date().toISOString().split('T')[0];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/#services</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/#about</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/#booking</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/#contact</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=86400'); // cache 1 jour
    res.send(xml);
});

// SEO: Serve static files avec headers de cache optimisés
app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: '7d',            // SEO: cache assets statiques 7 jours
    etag: true,              // SEO: ETags pour validation cache
    lastModified: true,
    setHeaders: (res, filePath) => {
        // SEO: cache plus long pour les assets immutables
        if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
            res.set('Cache-Control', 'public, max-age=604800'); // 7 jours
        } else if (filePath.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)) {
            res.set('Cache-Control', 'public, max-age=2592000'); // 30 jours
        } else if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'public, max-age=3600'); // 1 heure pour le HTML
        }
    }
}));

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
