const LOG_LEVEL = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const DEBUG_ENABLED = String(process.env.DEBUG || '').toLowerCase() === 'true' || LOG_LEVEL === 'debug';

function logInfo(msg, ...args) {
    console.log('[info]', msg, ...args);
}

function logError(msg, ...args) {
    console.error('[error]', msg, ...args);
}

function logWarn(msg, ...args) {
    console.warn('[warn]', msg, ...args);
}

function logDebug(msg, ...args) {
    if (DEBUG_ENABLED) console.debug('[debug]', msg, ...args);
}

module.exports = { logInfo, logError, logWarn, logDebug };
