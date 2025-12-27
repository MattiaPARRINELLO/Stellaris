// Admin JS: interface sécurisée et user-friendly
const adminKeyInput = document.getElementById('adminKey');
const btnAuthenticate = document.getElementById('btnAuthenticate');
const authStatus = document.getElementById('authStatus');
const statusBadge = document.getElementById('statusBadge');
const alertContainer = document.getElementById('alertContainer');
const confirmationModal = document.getElementById('confirmationModal');
const btnConfirmAction = document.getElementById('btnConfirmAction');

let currentSchedule = null;
let allBookings = [];
let isAuthenticated = false;
let authTimeout = null;
let confirmCallback = null;

const DAYS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MIN_KEY_LENGTH = 4;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 mins

function adminFetch(path, opts = {}) {
    const key = adminKeyInput.value || '';
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (key) headers['x-admin-key'] = key;
    return fetch(path, Object.assign({ headers }, opts));
}

function showAlert(type, message) {
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = message;
    alertContainer.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

async function authenticate() {
    const key = adminKeyInput.value.trim();

    if (!key) {
        showAlert('error', 'Veuillez entrer une clé');
        return;
    }

    if (key.length < MIN_KEY_LENGTH) {
        showAlert('error', `La clé doit contenir au moins ${MIN_KEY_LENGTH} caractères`);
        return;
    }

    try {
        console.log('[admin] authenticate attempt');
        const res = await adminFetch('/api/admin/schedule');
        if (!res.ok) {
            console.warn('[admin] authenticate failed');
            statusBadge.classList.remove('active');
            showAlert('error', 'Clé d\'accès invalide');
            return;
        }

        isAuthenticated = true;
        statusBadge.classList.add('active');
        authStatus.textContent = '✓ Authentifié';
        adminKeyInput.disabled = true;
        btnAuthenticate.disabled = true;
        showAlert('success', 'Connecté avec succès');

        // Session timeout
        clearTimeout(authTimeout);
        authTimeout = setTimeout(logoutSession, SESSION_TIMEOUT);

        console.log('[admin] authenticated, loading data');
        await loadAllData();
    } catch (e) {
        console.error('[admin] authenticate error', e);
        statusBadge.classList.remove('active');
        showAlert('error', 'Erreur de connexion');
    }
}

function logoutSession() {
    isAuthenticated = false;
    adminKeyInput.value = '';
    adminKeyInput.disabled = false;
    btnAuthenticate.disabled = false;
    statusBadge.classList.remove('active');
    authStatus.textContent = 'Session expirée';
    showAlert('info', 'Session expirée (30 min). Veuillez vous reconnecter.');
}

async function loadAllData() {
    if (!isAuthenticated) {
        showAlert('error', 'Veuillez d\'abord vous authentifier');
        return;
    }
    try {
        console.log('[admin] load all data');
        await Promise.all([loadSchedule(), loadBookings(), loadSlots()]);
        loadOverviewStats();
    } catch (e) {
        console.error('[admin] loadAllData error', e);
        showAlert('error', 'Erreur lors du chargement des données');
    }
}

async function loadSchedule() {
    try {
        console.log('[admin] load schedule');
        const res = await adminFetch('/api/admin/schedule');
        if (!res.ok) throw new Error('unauthorized');
        currentSchedule = await res.json();
        renderPlanningEditor();
        updateSettingsUI();
    } catch (e) {
        console.error('[admin] loadSchedule error', e);
        showAlert('error', 'Erreur de chargement du planning');
    }
}

async function loadBookings() {
    try {
        console.log('[admin] load bookings');
        const res = await adminFetch('/api/bookings');
        if (!res.ok) throw new Error('unauthorized');
        const data = await res.json();
        allBookings = Array.isArray(data) ? data : (data.bookings || []);
        renderBookings(allBookings);
    } catch (e) {
        console.error('[admin] loadBookings error', e);
        showAlert('error', 'Erreur de chargement des réservations');
    }
}

async function loadSlots() {
    try {
        console.log('[admin] load slots');
        // Admin: voir les slots sans restriction de 5h
        const res = await adminFetch('/api/admin/slots?grouped=1');
        if (!res.ok) throw new Error('error');
        const data = await res.json();
        // Normalise la forme de réponse (ancienne clé days vs. map directe)
        const slotsByDate = Array.isArray(data?.days)
            ? data.days.reduce((acc, day) => {
                acc[day.date] = day.slots || [];
                return acc;
            }, {})
            : (data.days || data || {});
        renderSlots(slotsByDate);
        populateAdminCreateSelect(slotsByDate);

        // Charger la liste des créneaux bloqués
        await loadBlockedSlots();
    } catch (e) {
        console.error('[admin] loadSlots error', e);
        showAlert('error', 'Erreur de chargement des créneaux');
    }
}
async function loadBlockedSlots() {
    try {
        const res = await adminFetch('/api/admin/slots/blocked');
        if (!res.ok) throw new Error('error');
        const data = await res.json();
        renderBlockedSlots(data.blocked || []);
    } catch (e) {
        // silencieux pour éviter du bruit si aucun fichier
    }
}

function renderBlockedSlots(list) {
    const container = document.getElementById('blockedSlotsContainer');
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary)">Aucun créneau bloqué.</p>';
        return;
    }
    container.innerHTML = '';
    const tfDay = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
    const tfTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
    for (const start of list) {
        const startDt = new Date(start);
        const card = document.createElement('div');
        card.className = 'slot-card';
        card.innerHTML = `<h5>${tfDay.format(startDt)}</h5><p>${tfTime.format(startDt)}</p><p style="color:#ff6b6b">Bloqué</p><button class="btn-icon btn-restore" data-start="${start}" title="Remettre ce créneau">♻️</button>`;
        const btn = card.querySelector('.btn-restore');
        btn.addEventListener('click', () => unblockSlot(start));
        container.appendChild(card);
    }
}

function loadOverviewStats() {
    const totalBookings = allBookings.length;
    const totalSlots = slotsContainer.querySelectorAll('.slot-card').length;
    const occupancy = totalSlots > 0 ? Math.round((totalBookings / totalSlots) * 100) : 0;

    document.getElementById('statTotal').textContent = totalBookings;
    document.getElementById('statSlots').textContent = totalSlots;
    document.getElementById('statOccupancy').textContent = occupancy + '%';
}

function updateSettingsUI() {
    if (!currentSchedule) return;
    document.getElementById('settingTimezone').value = currentSchedule.timezone || 'Europe/Paris';
    document.getElementById('settingSlotDuration').value = currentSchedule.slotDurationMinutes || 30;
    document.getElementById('settingMaxBookings').value = currentSchedule.maxBookingsPerSlot || 1;
}

function renderPlanningEditor() {
    if (!currentSchedule) return;
    const container = document.getElementById('planningEditor');
    const dayLabels = { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' };

    let html = '';
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
        const ranges = currentSchedule.days[day] || [];
        html += `<div class="day-editor" data-day="${day}"><h4>${dayLabels[day]}</h4><div class="day-slots">`;
        for (let i = 0; i < ranges.length; i++) {
            const r = ranges[i];
            html += `<div class="time-slot"><input type="time" class="start-time" value="${r.start}" /><span>→</span><input type="time" class="end-time" value="${r.end}" /><button class="remove-slot" data-index="${i}">✕</button></div>`;
        }
        html += `</div><button class="add-slot-btn" data-day="${day}">+ Ajouter créneau</button></div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.add-slot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const day = e.target.dataset.day;
            if (!currentSchedule.days[day]) currentSchedule.days[day] = [];
            currentSchedule.days[day].push({ start: '09:00', end: '10:00' });
            renderPlanningEditor();
        });
    });

    container.querySelectorAll('.remove-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const editor = e.target.closest('.day-editor');
            const day = editor.dataset.day;
            const idx = +e.target.dataset.index;
            currentSchedule.days[day].splice(idx, 1);
            renderPlanningEditor();
        });
    });

    container.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('change', (e) => {
            const editor = e.target.closest('.day-editor');
            const day = editor.dataset.day;
            const index = Array.from(editor.querySelectorAll('.time-slot')).indexOf(slot);
            const start = slot.querySelector('.start-time').value;
            const end = slot.querySelector('.end-time').value;
            if (start && end && start < end && currentSchedule.days[day][index]) {
                currentSchedule.days[day][index].start = start;
                currentSchedule.days[day][index].end = end;
            }
        });
    });
}

async function savePlanning() {
    if (!isAuthenticated) {
        showAlert('error', 'Non authentifié');
        return;
    }

    // Validation
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
        for (const slot of currentSchedule.days[day] || []) {
            if (!slot.start || !slot.end || slot.start >= slot.end) {
                showAlert('error', 'Heures invalides: le début doit être avant la fin');
                return;
            }
        }
    }

    confirmAction('Enregistrer le planning ?', 'Cette action remplacera le planning existant.', async () => {
        try {
            const res = await adminFetch('/api/admin/schedule', {
                method: 'PUT',
                body: JSON.stringify(currentSchedule)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Erreur serveur');
            }
            showAlert('success', 'Planning enregistré avec succès');
        } catch (e) {
            showAlert('error', 'Erreur: ' + e.message);
        }
    });
}

function renderBookings(list) {
    console.log('[admin] render bookings', list?.length || 0);
    const container = document.getElementById('bookingsContainer');
    if (!list || list.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary)">Aucune réservation.</p>';
        return;
    }
    const table = document.createElement('table');
    table.className = 'bookings-table';
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Société</th><th>Créneau</th><th>Créée</th><th>Statut</th><th>Actions</th></tr>';
    table.appendChild(head);
    const body = document.createElement('tbody');
    for (const b of list) {
        const startDt = new Date(b.slotStart);
        const createdDt = new Date(b.createdAt);
        const status = b.status || 'pending';
        const statusLabel = status === 'confirmed' ? 'Confirmée' : status === 'rejected' ? 'Refusée' : 'En attente';
        const tr = document.createElement('tr');
        const actions = [];
        if (status === 'pending') {
            actions.push('<button class="btn btn-primary btn-confirm-booking">Confirmer</button>');
            actions.push('<button class="btn btn-secondary btn-reject-booking">Refuser</button>');
        } else {
            actions.push('<span style="color:var(--text-secondary)">—</span>');
        }
        tr.innerHTML = `
            <td>${escapeHtml(b.name)}</td>
            <td>${escapeHtml(b.email)}</td>
            <td>${escapeHtml(b.phone || '')}</td>
            <td>${escapeHtml(b.company || '')}</td>
            <td>${startDt.toLocaleString('fr-FR').substring(0, 16)}</td>
            <td>${createdDt.toLocaleString('fr-FR').substring(0, 10)}</td>
            <td>${statusLabel}</td>
            <td style="display:flex; gap:0.25rem; flex-wrap:wrap; align-items:center;">${actions.join('')}</td>
        `;
        if (status === 'pending') {
            tr.querySelector('.btn-confirm-booking').addEventListener('click', () => confirmBooking(b.id));
            tr.querySelector('.btn-reject-booking').addEventListener('click', () => rejectBooking(b.id));
        }
        body.appendChild(tr);
    }
    table.appendChild(body);
    container.innerHTML = '';
    container.appendChild(table);
}

function renderSlots(slotsByDate) {
    console.log('[admin] render slots dates', Object.keys(slotsByDate || {}).length);
    const container = document.getElementById('slotsContainer');
    if (!slotsByDate || Object.keys(slotsByDate).length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary)">Aucun créneau disponible.</p>';
        return;
    }
    container.innerHTML = '';
    for (const [date, slots] of Object.entries(slotsByDate)) {
        for (const s of slots) {
            const card = document.createElement('div');
            card.className = 'slot-card';
            const startDt = new Date(s.start);
            const endDt = new Date(s.end);
            const tf = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const badge = s.remaining > 0 ? '✓ Disponible' : 'Complet';
            card.innerHTML = `<h5>${date}</h5><p>${tf.format(startDt)} – ${tf.format(endDt)}</p><p>${badge}</p><button class="btn-icon btn-delete" data-start="${s.start}" title="Supprimer ce créneau">🗑️</button>`;
            const btn = card.querySelector('.btn-delete');
            btn.addEventListener('click', () => blockSlot(s.start));
            container.appendChild(card);
        }
    }
}

function populateAdminCreateSelect(slotsByDate) {
    console.log('[admin] populate select');
    const sel = document.getElementById('adminCreateSlot');
    if (!sel) return;
    sel.innerHTML = '';
    const tfDay = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
    const tfTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
    for (const [date, slots] of Object.entries(slotsByDate)) {
        for (const s of slots) {
            const startDt = new Date(s.start);
            const opt = document.createElement('option');
            opt.value = s.start;
            opt.textContent = `${tfDay.format(startDt)} — ${tfTime.format(startDt)} (${s.remaining}/${s.capacity})`;
            opt.disabled = s.remaining <= 0;
            sel.appendChild(opt);
        }
    }
}

document.getElementById('btnAdminCreateBooking')?.addEventListener('click', async () => {
    console.log('[admin] create booking click');
    if (!isAuthenticated) { showAlert('error', 'Veuillez vous authentifier'); return; }
    const payload = {
        name: document.getElementById('adminCreateName').value.trim(),
        email: document.getElementById('adminCreateEmail').value.trim(),
        phone: document.getElementById('adminCreatePhone').value.trim(),
        company: document.getElementById('adminCreateCompany').value.trim(),
        sector: document.getElementById('adminCreateSector').value.trim(),
        description: document.getElementById('adminCreateDesc').value.trim(),
        slotStart: document.getElementById('adminCreateSlot').value
    };
    if (!payload.name || !payload.email || !payload.phone || !payload.sector || !payload.slotStart) {
        showAlert('error', 'Champs requis manquants');
        return;
    }
    confirmAction('Créer la réservation ?', 'Un email de confirmation sera envoyé au client.', async () => {
        try {
            const res = await adminFetch('/api/admin/bookings', { method: 'POST', body: JSON.stringify(payload) });
            if (!res.ok) throw new Error('admin_create_failed');
            const data = await res.json();
            console.log('[admin] admin booking created', data?.booking?.id || null);
            if (data?.booking) allBookings.push(data.booking);
            renderBookings(allBookings);
            await loadSlots();
            showAlert('success', 'Réservation créée et confirmée');
        } catch (e) {
            console.error('[admin] admin booking create error', e);
            showAlert('error', 'Impossible de créer la réservation');
        }
    });
});

async function blockSlot(startISO) {
    console.log('[admin] block slot called with', startISO);
    if (!isAuthenticated) {
        console.warn('[admin] block slot - not authenticated');
        showAlert('error', 'Veuillez vous authentifier');
        return;
    }
    confirmAction('Supprimer ce créneau ?', 'Le créneau sera retiré des disponibilités.', async () => {
        try {
            console.log('[admin] block slot - sending request to /api/admin/slots/block');
            const res = await adminFetch('/api/admin/slots/block', {
                method: 'POST',
                body: JSON.stringify({ start: startISO })
            });
            console.log('[admin] block slot response status:', res.status);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[admin] block slot failed', res.status, err);
                throw new Error(err.error || 'block_failed');
            }
            console.log('[admin] block slot success - reloading slots');
            showAlert('success', 'Créneau supprimé');
            await loadSlots();
            loadOverviewStats();
            await loadBlockedSlots();
        } catch (e) {
            console.error('[admin] block slot error caught', e);
            showAlert('error', 'Impossible de supprimer ce créneau: ' + (e.message || 'erreur'));
        }
    });
}

async function unblockSlot(startISO) {
    console.log('[admin] unblock slot called with', startISO);
    if (!isAuthenticated) {
        console.warn('[admin] unblock slot - not authenticated');
        showAlert('error', 'Veuillez vous authentifier');
        return;
    }
    confirmAction('Remettre ce créneau ?', 'Le créneau sera à nouveau disponible.', async () => {
        try {
            console.log('[admin] unblock slot - sending request to /api/admin/slots/unblock');
            const res = await adminFetch('/api/admin/slots/unblock', {
                method: 'POST',
                body: JSON.stringify({ start: startISO })
            });
            console.log('[admin] unblock slot response status:', res.status);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[admin] unblock slot failed', res.status, err);
                throw new Error(err.error || 'unblock_failed');
            }
            console.log('[admin] unblock slot success - reloading');
            showAlert('success', 'Créneau remis');
            await loadSlots();
            loadOverviewStats();
            await loadBlockedSlots();
        } catch (e) {
            console.error('[admin] unblock slot error caught', e);
            showAlert('error', 'Impossible de remettre ce créneau: ' + (e.message || 'erreur'));
        }
    });
}

async function confirmBooking(bookingId) {
    console.log('[admin] confirm booking', bookingId);
    if (!isAuthenticated) {
        showAlert('error', 'Veuillez vous authentifier');
        return;
    }
    confirmAction('Confirmer ce créneau ?', 'Un email sera envoyé au client.', async () => {
        try {
            const res = await adminFetch(`/api/admin/bookings/${bookingId}/confirm`, { method: 'POST' });
            if (!res.ok) throw new Error('confirm_failed');
            const data = await res.json();
            if (data?.booking) {
                const idx = allBookings.findIndex(b => b.id === bookingId);
                if (idx !== -1) allBookings[idx] = data.booking;
            }
            renderBookings(allBookings);
            showAlert('success', 'Créneau confirmé et email envoyé');
        } catch (e) {
            showAlert('error', 'Impossible de confirmer ce créneau');
        }
    });
}

async function rejectBooking(bookingId) {
    console.log('[admin] reject booking', bookingId);
    if (!isAuthenticated) {
        showAlert('error', 'Veuillez vous authentifier');
        return;
    }
    const reason = prompt('Motif du refus (optionnel) ?');
    confirmAction('Refuser ce créneau ?', 'Le client sera notifié du refus.', async () => {
        try {
            const res = await adminFetch(`/api/admin/bookings/${bookingId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason: reason || undefined })
            });
            if (!res.ok) throw new Error('reject_failed');
            const data = await res.json();
            if (data?.booking) {
                const idx = allBookings.findIndex(b => b.id === bookingId);
                if (idx !== -1) allBookings[idx] = data.booking;
            }
            renderBookings(allBookings);
            showAlert('success', 'Créneau refusé et client notifié');
        } catch (e) {
            showAlert('error', 'Impossible de refuser ce créneau');
        }
    });
}

function confirmAction(title, message, callback) {
    console.log('[admin] confirmAction called', title);
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    confirmationModal.classList.add('active');
    console.log('[admin] confirmation modal opened');
}

function closeConfirmation() {
    console.log('[admin] closeConfirmation called');
    confirmationModal.classList.remove('active');
    confirmCallback = null;
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Navigation entre sections
document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const section = e.target.dataset.section;
        document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(section)?.classList.add('active');
    });
});

// Event listeners principaux
btnAuthenticate.addEventListener('click', authenticate);
adminKeyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') authenticate(); });

document.getElementById('btnLoadOverview')?.addEventListener('click', loadAllData);
document.getElementById('btnSavePlanning')?.addEventListener('click', savePlanning);
document.getElementById('btnReloadPlanning')?.addEventListener('click', loadSchedule);
document.getElementById('btnRefreshSlots')?.addEventListener('click', loadSlots);
document.getElementById('btnDownloadBookings')?.addEventListener('click', async () => {
    if (!isAuthenticated) { showAlert('error', 'Non authentifié'); return; }
    try {
        const res = await adminFetch('/api/bookings');
        if (!res.ok) throw new Error('unauthorized');
        downloadJSON('reservations.json', allBookings);
        showAlert('success', 'Fichier téléchargé');
    } catch (e) {
        showAlert('error', 'Impossible de télécharger');
    }
});

document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
    if (!currentSchedule) return;
    const tz = document.getElementById('settingTimezone').value;
    const duration = parseInt(document.getElementById('settingSlotDuration').value);
    const maxBookings = parseInt(document.getElementById('settingMaxBookings').value);

    if (duration < 15 || duration > 120) {
        showAlert('error', 'Durée: entre 15 et 120 minutes');
        return;
    }
    if (maxBookings < 1 || maxBookings > 10) {
        showAlert('error', 'Max réservations: entre 1 et 10');
        return;
    }

    currentSchedule.timezone = tz;
    currentSchedule.slotDurationMinutes = duration;
    currentSchedule.maxBookingsPerSlot = maxBookings;
    await savePlanning();
});

document.getElementById('searchBooking')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allBookings.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q) ||
        (b.company || '').toLowerCase().includes(q)
    );
    renderBookings(filtered);
});

btnConfirmAction.addEventListener('click', async () => {
    console.log('[admin] confirm button clicked, callback exists:', !!confirmCallback);
    const callback = confirmCallback;
    closeConfirmation();
    if (callback) {
        console.log('[admin] executing callback');
        await callback();
    }
});

// Init
adminKeyInput.setAttribute('autocomplete', 'off');
adminKeyInput.focus();
