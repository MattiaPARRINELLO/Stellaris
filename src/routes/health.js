const express = require('express');
const router = express.Router();
const { logDebug } = require('../utils/logger');

router.get('/', (_req, res) => {
    logDebug('health check');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
