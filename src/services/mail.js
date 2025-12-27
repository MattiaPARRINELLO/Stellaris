const nodemailer = require('nodemailer');

let mailTransport = null;

function getMailTransport() {
    if (mailTransport !== null) return mailTransport;
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    mailTransport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user ? { user, pass } : undefined
    });
    return mailTransport;
}

async function sendMail(options) {
    const transport = getMailTransport();
    if (!transport) {
        console.log('[mail] SMTP non configuré, mail ignoré', options);
        return;
    }
    const from = process.env.SMTP_FROM || 'no-reply@stellaris.local';
    try {
        await transport.sendMail(Object.assign({ from }, options));
    } catch (e) {
        console.error('[mail] envoi échoué', e);
    }
}

module.exports = { sendMail };
