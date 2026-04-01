function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function wrapTemplate({ title, preheader, bodyHtml }) {
    // Inline styles for wide email-client compatibility
    const primary = '#3b82f6';
    const bg = '#ffffff';
    const text = '#111827';
    const muted = '#6b7280';
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
    <div style="max-width:720px;margin:0 auto;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${bg};border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(2,6,23,0.08);">
        <tr>
          <td style="padding:18px 20px;background:linear-gradient(90deg, ${primary}, #7c3aed);color:#fff;">
            <h1 style="margin:0;font-size:18px;line-height:1.1">${escapeHtml(title)}</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:0.9">${escapeHtml(preheader || '')}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px;color:${text};font-size:15px;line-height:1.5;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 20px;border-top:1px solid #eef2ff;color:${muted};font-size:13px;">
            <small>Stellaris Conseil — www.stellarisconseil.fr</small>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}

function adminNotificationHtml(booking, slotLabel) {
    const name = escapeHtml(booking.name);
    const company = escapeHtml(booking.company || '-');
    const phone = escapeHtml(booking.phone || '-');
    const sector = escapeHtml(booking.sector || '-');
    const note = escapeHtml(booking.description || '');
    const body = `
      <p>Nouvelle demande de créneau reçue.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:12px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:600;width:140px;color:#374151">Nom</td><td style="padding:8px 0">${name}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;color:#374151">Email</td><td style="padding:8px 0">${escapeHtml(booking.email)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;color:#374151">Téléphone</td><td style="padding:8px 0">${phone}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;color:#374151">Société</td><td style="padding:8px 0">${company}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;color:#374151">Secteur</td><td style="padding:8px 0">${sector}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;color:#374151">Créneau</td><td style="padding:8px 0">${escapeHtml(slotLabel)}</td></tr>
      </table>
      ${note ? `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:6px;color:#374151"><strong>Message client :</strong><div style="margin-top:6px;white-space:pre-wrap">${note}</div></div>` : ''}
      <p style="margin-top:14px;color:#374151">Merci de confirmer ce créneau dans l'interface admin.</p>
    `;
    return wrapTemplate({ title: 'Nouvelle demande de créneau', preheader: `Demande de ${booking.name}`, bodyHtml: body });
}

function clientConfirmationHtml(booking, slotLabel) {
    const name = escapeHtml(booking.name);
    const body = `
      <p>Bonjour ${name},</p>
      <p>Nous avons bien reçu votre demande de rendez‑vous.</p>
      <p style="margin-top:12px;"><strong>Créneau demandé :</strong><br/>${escapeHtml(slotLabel)}</p>
      <p style="margin-top:12px;">Notre équipe va vérifier la disponibilité et vous enverra une confirmation rapidement.</p>
      <p style="margin-top:16px">Cordialement,<br/>Stellaris Conseil</p>
    `;
    return wrapTemplate({ title: 'Votre demande de rendez-vous', preheader: 'Nous avons bien reçu votre demande', bodyHtml: body });
}

function bookingConfirmedHtml(booking, slotLabel) {
    const name = escapeHtml(booking.name);
    const body = `
      <p>Bonjour ${name},</p>
      <p>Votre rendez‑vous est confirmé.</p>
      <p style="margin-top:12px;"><strong>Créneau :</strong><br/>${escapeHtml(slotLabel)}</p>
      <p style="margin-top:12px;">Merci et à bientôt.</p>
    `;
    return wrapTemplate({ title: 'Rendez-vous confirmé', preheader: 'Votre rendez-vous est confirmé', bodyHtml: body });
}

function genericWrappedMessageHtml(subject, message) {
    const body = `<div style="white-space:pre-wrap">${escapeHtml(message)}</div>`;
    return wrapTemplate({ title: subject, preheader: subject, bodyHtml: body });
}

module.exports = {
    adminNotificationHtml,
    clientConfirmationHtml,
    bookingConfirmedHtml,
    genericWrappedMessageHtml
};
