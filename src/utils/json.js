const fsp = require('fs').promises;
const { enqueue } = require('../services/fileQueue');

async function readJson(file, defaultValue = null) {
    try {
        const buf = await fsp.readFile(file, 'utf-8');
        return JSON.parse(buf || 'null');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return defaultValue;
        }
        throw err;
    }
}

async function writeJson(file, data) {
    return enqueue(file, async () => {
        const dir = require('path').dirname(file);
        await fsp.mkdir(dir, { recursive: true });
        await fsp.writeFile(file, JSON.stringify(data, null, 2));
    });
}

module.exports = { readJson, writeJson };
