function requireAdmin(req, res, next) {
    const key = req.header('x-admin-key') || '';
    const expected = process.env.ADMIN_API_KEY || 'changeme';
    if (key !== expected) return res.status(401).json({ error: 'unauthorized' });
    next();
}

module.exports = { requireAdmin };
