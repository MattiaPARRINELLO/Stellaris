// ===== Theme Toggle System =====
const initTheme = () => {
    const savedTheme = localStorage.getItem('stellaris-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Priority: saved preference > system preference > light
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    return theme;
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('stellaris-theme', newTheme);
    
    return newTheme;
};

// Initialize theme immediately
let currentTheme = initTheme();

// Theme toggle buttons (support multiple toggles on admin & landing)
const themeToggles = document.querySelectorAll('.theme-toggle');
if (themeToggles.length) {
    themeToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            currentTheme = toggleTheme();
        });
    });
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('stellaris-theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
});

// ===== Parallax effect for premium feel =====
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            const scrolled = window.pageYOffset;
            const heroVisual = document.querySelector('.hero-visual');
            const orbs = document.querySelectorAll('.orb');
            
            if (heroVisual && scrolled < window.innerHeight) {
                heroVisual.style.transform = `translateY(${scrolled * 0.3}px)`;
            }
            
            orbs.forEach((orb, index) => {
                orb.style.transform = `translate(${Math.sin(scrolled * 0.001 + index) * 20}px, ${scrolled * (0.1 + index * 0.05)}px)`;
            });
            
            // Update scroll progress bar
            const bar = document.querySelector('.scroll-progress-bar');
            if (bar) {
                const doc = document.documentElement;
                const scrollTop = doc.scrollTop || window.pageYOffset;
                const h = doc.scrollHeight - doc.clientHeight;
                const pct = h > 0 ? Math.min(100, Math.max(0, (scrollTop / h) * 100)) : 0;
                bar.style.width = pct + '%';
            }

            ticking = false;
        });
        ticking = true;
    }
});

// Mobile Menu
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const mobileOverlay = document.querySelector('.mobile-menu-overlay');

const isMobile = () => window.innerWidth <= 768;

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('active');
        if (mobileOverlay) {
            mobileOverlay.classList.toggle('active');
        }
    });

    // Close menu when overlay is clicked
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
            navLinks.classList.remove('open');
            hamburger.classList.remove('active');
            mobileOverlay.classList.remove('active');
        });
    }

    // Close menu when a link is clicked (mobile only)
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile()) {
                navLinks.classList.remove('open');
                hamburger.classList.remove('active');
                if (mobileOverlay) {
                    mobileOverlay.classList.remove('active');
                }
            }
        });
    });

    // Ensure menu resets on resize to desktop
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            navLinks.classList.remove('open');
            hamburger.classList.remove('active');
            if (mobileOverlay) {
                mobileOverlay.classList.remove('active');
            }
        }
    });
}

// Highlight active nav link based on section in view
const setupActiveNav = () => {
    const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    if (!links.length) return;
    const map = new Map();
    links.forEach(l => {
        const id = l.getAttribute('href').slice(1);
        const sec = document.getElementById(id);
        if (sec) map.set(sec, l);
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const link = map.get(entry.target);
            if (!link) return;
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                links.forEach(a => a.classList.remove('active'));
                link.classList.add('active');
            }
        });
    }, { threshold: [0.5], rootMargin: '0px 0px -20% 0px' });

    map.forEach((_, sec) => observer.observe(sec));
};

// ===== Booking Form Handler + Visual Slot Picker =====
const bookingForm = document.getElementById('bookingForm');
const slotSelect = document.getElementById('slotSelect');
const slotHelp = document.getElementById('slotHelp');
const submitBtn = bookingForm ? bookingForm.querySelector('button[type="submit"]') : null;

// Slot data cache
let allSlotDays = [];
let selectedDate = null;
let selectedSlotStart = null;
let weekOffset = 0;

const DAY_NAMES_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

async function loadSlotsData() {
    try {
        const now = new Date();
        const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const params = new URLSearchParams({
            from: now.toISOString(),
            to: to.toISOString()
        });
        const resp = await fetch(`/api/slots?${params.toString()}&grouped=1`);
        if (!resp.ok) throw new Error('slots_failed');
        const data = await resp.json();
        allSlotDays = data.days || [];
        renderDatePicker();
        if (slotHelp) slotHelp.textContent = allSlotDays.length
            ? 'Sélectionnez une date puis un horaire'
            : 'Aucun créneau disponible pour le moment';
    } catch (_) {
        allSlotDays = [];
        renderDatePicker();
        if (slotHelp) slotHelp.textContent = 'Impossible de charger les créneaux. Réessayez plus tard.';
    }
}

function getWeekDays(offset) {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push(d);
    }
    return days;
}

function dateToISO(d) {
    return d.toISOString().split('T')[0];
}

function renderDatePicker() {
    const container = document.getElementById('datePickerDays');
    const label = document.getElementById('datePickerLabel');
    const prevBtn = document.getElementById('datePrevWeek');
    if (!container || !label) return;

    const weekDays = getWeekDays(weekOffset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build a map of available dates
    const availableDates = new Map();
    for (const day of allSlotDays) {
        availableDates.set(day.date, day.slots.length);
    }

    // Label: month range
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    if (firstDay.getMonth() === lastDay.getMonth()) {
        label.textContent = `${firstDay.getDate()} – ${lastDay.getDate()} ${MONTH_NAMES[firstDay.getMonth()]} ${firstDay.getFullYear()}`;
    } else {
        label.textContent = `${firstDay.getDate()} ${MONTH_NAMES[firstDay.getMonth()].substring(0, 3)} – ${lastDay.getDate()} ${MONTH_NAMES[lastDay.getMonth()].substring(0, 3)} ${lastDay.getFullYear()}`;
    }

    // Disable prev if first week contains today
    if (prevBtn) prevBtn.disabled = weekOffset <= 0;

    container.innerHTML = '';
    for (const d of weekDays) {
        const iso = dateToISO(d);
        const slotCount = availableDates.get(iso) || 0;
        const isPast = d < today;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'date-day-btn';
        if (selectedDate === iso) btn.classList.add('selected');
        if (isPast || slotCount === 0) {
            btn.disabled = true;
            btn.classList.add('empty');
        }
        btn.innerHTML = `
            <span class="day-name">${DAY_NAMES_SHORT[d.getDay()]}</span>
            <span class="day-num">${d.getDate()}</span>
            <span class="day-slots-count">${slotCount > 0 ? slotCount + ' dispo' : '—'}</span>
        `;
        btn.addEventListener('click', () => {
            selectedDate = iso;
            selectedSlotStart = null;
            if (slotSelect) slotSelect.value = '';
            renderDatePicker();
            renderTimeSlots(iso);
        });
        container.appendChild(btn);
    }
}

function renderTimeSlots(dateISO) {
    const container = document.getElementById('timeSlots');
    if (!container) return;

    const dayData = allSlotDays.find(d => d.date === dateISO);
    if (!dayData || dayData.slots.length === 0) {
        container.innerHTML = '<p class="time-slots-placeholder">Aucun créneau disponible ce jour</p>';
        return;
    }

    const tf = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const grid = document.createElement('div');
    grid.className = 'time-slots-grid';

    for (const s of dayData.slots) {
        const start = new Date(s.start);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'time-slot-btn';
        if (selectedSlotStart === s.start) btn.classList.add('selected');
        btn.textContent = tf.format(start);
        btn.addEventListener('click', () => {
            selectedSlotStart = s.start;
            if (slotSelect) {
                // Ensure option exists
                let opt = slotSelect.querySelector(`option[value="${CSS.escape(s.start)}"]`);
                if (!opt) {
                    opt = document.createElement('option');
                    opt.value = s.start;
                    slotSelect.appendChild(opt);
                }
                slotSelect.value = s.start;
            }
            // Update all time buttons
            grid.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
        grid.appendChild(btn);
    }

    container.innerHTML = '';
    container.appendChild(grid);
}

// Week navigation
document.getElementById('datePrevWeek')?.addEventListener('click', () => {
    if (weekOffset > 0) {
        weekOffset--;
        renderDatePicker();
    }
});
document.getElementById('dateNextWeek')?.addEventListener('click', () => {
    weekOffset++;
    renderDatePicker();
});

// Build recap before submission
function buildRecap() {
    const recap = document.getElementById('bookingRecap');
    if (!recap) return;

    const name = document.getElementById('name')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    const company = document.getElementById('company')?.value || '';
    const sector = document.getElementById('sector');
    const sectorLabel = sector ? (sector.options[sector.selectedIndex]?.text || '') : '';

    let slotLabel = '—';
    if (selectedSlotStart) {
        const start = new Date(selectedSlotStart);
        const df = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const tf = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
        slotLabel = `${df.format(start)} à ${tf.format(start)}`;
    }

    recap.innerHTML = `
        <div class="recap-row"><span class="recap-label">Nom</span><span class="recap-value">${escapeHtmlPublic(name)}</span></div>
        <div class="recap-row"><span class="recap-label">Email</span><span class="recap-value">${escapeHtmlPublic(email)}</span></div>
        <div class="recap-row"><span class="recap-label">Téléphone</span><span class="recap-value">${escapeHtmlPublic(phone)}</span></div>
        <div class="recap-row"><span class="recap-label">Entreprise</span><span class="recap-value">${escapeHtmlPublic(company)}</span></div>
        <div class="recap-row"><span class="recap-label">Secteur</span><span class="recap-value">${escapeHtmlPublic(sectorLabel)}</span></div>
        <div class="recap-slot"><i class="fas fa-calendar-check"></i> ${escapeHtmlPublic(slotLabel)}</div>
    `;
}

function escapeHtmlPublic(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// Load slots on startup
loadSlotsData();

if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            company: document.getElementById('company').value,
            phone: document.getElementById('phone').value,
            sector: document.getElementById('sector').value,
            description: document.getElementById('description').value,
        };

        const selected = slotSelect ? slotSelect.value : '';
        if (!selected) {
            showNotification('error', 'Veuillez sélectionner un créneau.');
            return;
        }
        formData.slotStart = selected;

        // Disable submit during request
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
        }

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response && response.ok) {
                showNotification('success', 'Demande envoyée ! Vous recevrez un email de confirmation.');
                bookingForm.reset();
                selectedDate = null;
                selectedSlotStart = null;
                weekOffset = 0;
                // Reload slots to reflect decreased availability
                loadSlotsData();
                // Reset form to step 1
                const steps = bookingForm.querySelectorAll('.form-step');
                const dots = bookingForm.querySelectorAll('.form-progress-dot');
                steps.forEach(s => s.classList.remove('active'));
                dots.forEach(d => { d.classList.remove('active', 'completed'); });
                if (steps[0]) steps[0].classList.add('active');
                if (dots[0]) dots[0].classList.add('active');
            } else if (response.status === 409) {
                showNotification('error', 'Ce créneau vient d\'être pris. Veuillez en choisir un autre.');
                loadSlotsData();
            } else {
                const data = await response.json().catch(() => ({}));
                showNotification('error', data.error === 'slot_too_soon'
                    ? 'Ce créneau est trop proche. Veuillez en choisir un plus tard.'
                    : 'Une erreur est survenue. Veuillez réessayer.');
            }
        } catch (error) {
            showNotification('error', 'Erreur de connexion. Veuillez réessayer.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Confirmer le rendez-vous';
            }
        }
    });
}

// Notification System
function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Get computed CSS variables for theme-aware colors
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--primary').trim();
    const secondary = styles.getPropertyValue('--secondary').trim();
    const shadowGlow = styles.getPropertyValue('--shadow-glow').trim();
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 8px;
        font-weight: 600;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? `
            background: linear-gradient(135deg, ${primary}, ${secondary});
            color: #ffffff;
            box-shadow: 0 8px 20px ${shadowGlow};
        ` : `
            background: linear-gradient(135deg, #ff6b6b, #ff4757);
            color: white;
            box-shadow: 0 8px 20px rgba(255, 107, 107, 0.3);
        `}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}


// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const element = document.querySelector(href);
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Unified scroll animations observer (no flickering)
const initScrollAnimations = () => {
    const observerOptions = {
        threshold: 0,
        rootMargin: '0px 0px 100px 0px'
    };

    const applyAnimation = (el) => {
        if (el.dataset.animated) return;

        // Use requestAnimationFrame to apply animation after layout is stable
        requestAnimationFrame(() => {
            el.dataset.animated = 'true';

            if (el.classList.contains('service-card')) {
                el.style.animation = 'fadeInUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards';
            } else if (el.classList.contains('stat')) {
                el.style.animation = 'fadeInUp 0.7s cubic-bezier(0.25,0.46,0.45,0.94) forwards';
            } else if (el.classList.contains('contact-item')) {
                el.style.animation = 'fadeInUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards';
            } else {
                el.style.animation = 'slideInUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards';
            }

            // Stagger children animations
            const parent = el.parentElement;
            if (parent && el.className) {
                const firstClass = el.className.split(' ')[0];
                if (firstClass && firstClass.length > 0 && firstClass !== 'animated') {
                    try {
                        const siblings = Array.from(parent.querySelectorAll(`.${firstClass}`));
                        const index = siblings.indexOf(el);
                        if (index > 0) {
                            el.style.animationDelay = `${Math.min(index * 50, 300)}ms`;
                        }
                    } catch (e) {
                        // Invalid selector, skip stagger
                    }
                }
            }
        });
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                applyAnimation(entry.target);
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all potential animated elements
    const toAnimate = document.querySelectorAll('.service-card, .contact-item, .stat, .benefits li, .glass-panel, .glass-cta');
    toAnimate.forEach(el => {
        // Check if element is in viewport at load time
        const rect = el.getBoundingClientRect();
        const isInViewport = rect.bottom > 0 && rect.top < window.innerHeight;

        if (isInViewport) {
            // Already visible, animate immediately with rAF
            applyAnimation(el);
        } else {
            // Not visible yet, observe for scroll
            revealObserver.observe(el);
        }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
} else {
    initScrollAnimations();
}

// Parallax effect on mouse move
document.addEventListener('mousemove', (e) => {
    const orbs = document.querySelectorAll('.orb');
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;

    orbs.forEach((orb, index) => {
        const moveX = (x - 0.5) * (50 + index * 20);
        const moveY = (y - 0.5) * (50 + index * 20);
        orb.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
    });
});

// Navbar animation on scroll - uses CSS variables for theme compatibility
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;

        if (scrollTop > 50) {
            navbar.classList.add('scrolled');
            navbar.style.background = 'var(--bg-navbar-scrolled)';
            navbar.style.boxShadow = '0 8px 30px var(--shadow-glow)';
        } else {
            navbar.classList.remove('scrolled');
            navbar.style.background = 'var(--bg-navbar)';
            navbar.style.boxShadow = '';
        }

        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    });
}

// Premium glow effect on form inputs - uses CSS variables for theme compatibility
document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('focus', function () {
        this.style.boxShadow = '0 0 20px var(--shadow-glow), 0 0 0 3px var(--border-color)';
        this.style.borderColor = 'var(--primary)';
        this.style.transform = 'scale(1.01)';
    });
    input.addEventListener('blur', function () {
        this.style.boxShadow = '';
        this.style.borderColor = '';
        this.style.transform = '';
    });
});

// Premium card tilt effect on hover
document.querySelectorAll('.service-card, .liquid-glass').forEach(card => {
    card.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        this.style.boxShadow = `${(x - centerX) / 10}px ${(y - centerY) / 10}px 30px rgba(0, 255, 136, 0.3)`;
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = '';
        this.style.boxShadow = '';
    });
});

// Reactive bloom following cursor on service cards
(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const cards = document.querySelectorAll('.service-card');
    cards.forEach(card => {
        let rafId = null;
        let xPerc = 50, yPerc = 50;
        const onMove = (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            xPerc = Math.max(0, Math.min(100, (x / rect.width) * 100));
            yPerc = Math.max(0, Math.min(100, (y / rect.height) * 100));
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                card.style.setProperty('--mx', xPerc.toFixed(1) + '%');
                card.style.setProperty('--my', yPerc.toFixed(1) + '%');
                rafId = null;
            });
        };
        const onLeave = () => {
            card.style.removeProperty('--mx');
            card.style.removeProperty('--my');
        };
        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerleave', onLeave);
    });
})();

// Premium button effects avec ripple
document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-3px) scale(1.02)';
        this.style.boxShadow = '0 15px 35px rgba(0, 255, 136, 0.4), 0 5px 15px rgba(0, 255, 255, 0.2)';
    });
    button.addEventListener('mouseleave', function () {
        this.style.transform = '';
        this.style.boxShadow = '';
    });
    
    // Ripple effect on click
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            left: ${x}px;
            top: ${y}px;
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    });
});

// Ambient cursor glow follow (pointermove)
(() => {
    const glow = document.querySelector('.cursor-glow');
    if (!glow) return;
    let rafId = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;

    const move = (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            glow.style.left = targetX + 'px';
            glow.style.top = targetY + 'px';
            rafId = null;
        });
    };
    window.addEventListener('pointermove', move, { passive: true });
})();

// Magnetic effect on hero + CTA + booking buttons
(() => {
    const magnets = document.querySelectorAll('.hero .btn, .glass-cta .btn, #booking .btn');
    magnets.forEach(btn => {
        const strength = btn.closest('#booking') ? 10 : 20; // reduced for form buttons
        let rafId = null;
        const onMove = (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - (rect.left + rect.width / 2);
            const y = e.clientY - (rect.top + rect.height / 2);
            const dx = Math.max(-strength, Math.min(strength, x * 0.15));
            const dy = Math.max(-strength, Math.min(strength, y * 0.15));
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                btn.style.transform = `translate(${dx}px, ${dy}px)`;
                rafId = null;
            });
        };
        const onLeave = () => {
            btn.style.transform = '';
        };
        btn.addEventListener('pointermove', onMove);
        btn.addEventListener('pointerleave', onLeave);
    });
})();

// Smooth scroll animations pour sections
const observeSections = () => {
    const sections = document.querySelectorAll('section');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.sectioned) {
                entry.target.dataset.sectioned = 'true';
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
                sectionObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -100px 0px' });

    sections.forEach(section => sectionObserver.observe(section));
};

// Counter animation for stats (optimized with requestAnimationFrame)
const animateCounter = (element, target, suffix = '', prefix = '') => {
    const duration = 1000; // 1 seconds
    const startTime = performance.now();

    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutQuad = progress * (2 - progress);
        const current = Math.floor(target * easeOutQuad);

        element.textContent = prefix + current + suffix;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = prefix + target + suffix;
        }
    };

    requestAnimationFrame(animate);
};

const observeStats = () => {
    const stats = document.querySelectorAll('.stat h3[data-target]');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                const target = parseInt(entry.target.dataset.target);
                const text = entry.target.parentElement.querySelector('p').textContent;

                // Determine suffix and prefix based on context
                let suffix = '';
                let prefix = '';

                if (text.includes('Entreprises')) {
                    suffix = '+';
                } else if (text.includes('économies')) {
                    suffix = 'M€';
                } else if (text.includes('satisfaction')) {
                    suffix = '%';
                }

                animateCounter(entry.target, target, suffix, prefix);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3, rootMargin: '0px 0px -50px 0px' });

    stats.forEach(stat => statsObserver.observe(stat));
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        observeSections();
        observeStats();
        setupActiveNav();
        initMultiStepForm();
        initBottomNav();
    });
} else {
    observeSections();
    observeStats();
    setupActiveNav();
    initMultiStepForm();
    initBottomNav();
}

// ===== Multi-Step Form Handler =====
function initMultiStepForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    const steps = form.querySelectorAll('.form-step');
    const dots = form.querySelectorAll('.form-progress-dot');
    const nextBtns = form.querySelectorAll('.btn-next');
    const prevBtns = form.querySelectorAll('.btn-prev');

    let currentStep = 1;

    const showStep = (stepNum) => {
        steps.forEach(step => {
            step.classList.remove('active');
            if (parseInt(step.dataset.step) === stepNum) {
                step.classList.add('active');
            }
        });

        dots.forEach(dot => {
            const dotStep = parseInt(dot.dataset.step);
            dot.classList.remove('active', 'completed');
            if (dotStep === stepNum) {
                dot.classList.add('active');
            } else if (dotStep < stepNum) {
                dot.classList.add('completed');
            }
        });

        currentStep = stepNum;

        // Build recap when entering step 4
        if (stepNum === 4 && typeof buildRecap === 'function') {
            buildRecap();
        }

        // Scroll to form on mobile
        if (window.innerWidth <= 768) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Field-level validation helpers
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\d\s\+\-\(\)\.]{7,20}$/;

    const setFieldError = (field, hasError) => {
        const group = field.closest('.form-group');
        if (!group) return;
        if (hasError) {
            group.classList.add('has-error');
            group.classList.remove('has-success');
        } else if (field.value.trim()) {
            group.classList.remove('has-error');
            group.classList.add('has-success');
        } else {
            group.classList.remove('has-error', 'has-success');
        }
    };

    // Validate current step fields
    const validateStep = (stepNum) => {
        const step = form.querySelector(`.form-step[data-step="${stepNum}"]`);
        if (!step) return true;

        // Step 3: require slot selection
        if (stepNum === 3) {
            if (!selectedSlotStart) {
                showNotification('error', 'Veuillez sélectionner un créneau horaire.');
                return false;
            }
            return true;
        }

        const requiredFields = step.querySelectorAll('[required]');
        let isValid = true;
        let firstError = null;

        requiredFields.forEach(field => {
            // Skip checkboxes in validation (handled at submit)
            if (field.type === 'checkbox') return;

            let fieldValid = true;

            if (!field.value.trim()) {
                fieldValid = false;
            } else if (field.type === 'email' && !emailRegex.test(field.value)) {
                fieldValid = false;
                const errSpan = field.parentElement?.querySelector('.field-error');
                if (errSpan) errSpan.textContent = 'Veuillez entrer un email valide';
            } else if (field.type === 'tel' && !phoneRegex.test(field.value.replace(/\s/g, ''))) {
                fieldValid = false;
                const errSpan = field.parentElement?.querySelector('.field-error');
                if (errSpan) errSpan.textContent = 'Veuillez entrer un numéro valide';
            }

            if (!fieldValid) {
                isValid = false;
                if (!firstError) firstError = field;
            }
            setFieldError(field, !fieldValid);
        });

        if (!isValid && firstError) {
            firstError.focus();
        }

        return isValid;
    };

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = parseInt(btn.dataset.next);
            if (validateStep(currentStep)) {
                showStep(nextStep);
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = parseInt(btn.dataset.prev);
            showStep(prevStep);
        });
    });

    // Live inline validation on blur
    form.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('input', () => {
            const group = field.closest('.form-group');
            if (group) group.classList.remove('has-error');
        });

        field.addEventListener('blur', () => {
            if (!field.hasAttribute('required') || !field.value.trim()) return;
            let hasError = false;
            if (field.type === 'email' && !emailRegex.test(field.value)) hasError = true;
            if (field.type === 'tel' && !phoneRegex.test(field.value.replace(/\s/g, ''))) hasError = true;
            setFieldError(field, hasError);
        });
    });
}

// ===== Bottom Navigation Bar =====
function initBottomNav() {
    const bottomNav = document.querySelector('.bottom-nav');
    if (!bottomNav) return;

    const navItems = bottomNav.querySelectorAll('.bottom-nav-item[href]');
    const themeToggleMobile = bottomNav.querySelector('.theme-toggle-mobile');

    // Update active state based on scroll position
    const sections = ['services', 'about', 'booking', 'contact'];
    const sectionElements = sections.map(id => document.getElementById(id)).filter(Boolean);

    const updateActiveNav = () => {
        const scrollPos = window.scrollY + window.innerHeight / 3;

        let activeId = null;
        sectionElements.forEach(section => {
            if (section.offsetTop <= scrollPos) {
                activeId = section.id;
            }
        });

        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${activeId}`) {
                item.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();

    // Theme toggle for mobile
    if (themeToggleMobile) {
        themeToggleMobile.addEventListener('click', () => {
            toggleTheme();
        });
    }

    // Smooth scroll for bottom nav links
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href');
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}
