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

// Booking Form Handler + Slot loading
const bookingForm = document.getElementById('bookingForm');
const slotPicker = document.getElementById('slotPicker');
const slotSelect = document.getElementById('slotSelect');
const btnNextSlot = document.getElementById('btnNextSlot');
const slotHelp = document.getElementById('slotHelp');
const submitBtn = bookingForm ? bookingForm.querySelector('button[type="submit"]') : null;

async function loadSlotsIfAvailable() {
    try {
        const now = new Date();
        const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const params = new URLSearchParams({
            from: now.toISOString(),
            to: to.toISOString()
        });
        const resp = await fetch(`/api/slots?${params.toString()}&grouped=1`);
        if (!resp.ok) throw new Error('slots_failed');
        const data = await resp.json();
        if (!data.days || data.days.length === 0) {
            if (slotPicker) slotPicker.style.display = '';
            if (slotSelect) {
                slotSelect.innerHTML = '';
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Aucun créneau disponible pour le moment';
                opt.disabled = true;
                opt.selected = true;
                slotSelect.appendChild(opt);
            }
            if (slotHelp) slotHelp.textContent = "Agenda indisponible ou complet. Réessayez plus tard.";
            if (submitBtn) submitBtn.disabled = true;
            return;
        }
        // Populate select grouped by day
        if (slotSelect) {
            slotSelect.innerHTML = '';
            const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
            const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
            for (const day of data.days) {
                const groupLabelDate = new Date(day.date + 'T00:00:00');
                const optgroup = document.createElement('optgroup');
                optgroup.label = dayFormatter.format(groupLabelDate).replace(/\.$/, '');
                for (const s of day.slots) {
                    const start = new Date(s.start);
                    const end = new Date(s.end);
                    const opt = document.createElement('option');
                    opt.value = s.start;
                    opt.textContent = `${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
                    optgroup.appendChild(opt);
                }
                slotSelect.appendChild(optgroup);
            }
        }
        if (submitBtn) submitBtn.disabled = false;
        if (slotPicker) slotPicker.style.display = '';
    } catch (_) {
        // Backend not available: show message and disable submit
        if (slotPicker) slotPicker.style.display = '';
        if (slotSelect) {
            slotSelect.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = "Impossible de charger l'agenda";
            opt.disabled = true;
            opt.selected = true;
            slotSelect.appendChild(opt);
        }
        if (slotHelp) slotHelp.textContent = "Veuillez réessayer plus tard.";
        if (submitBtn) submitBtn.disabled = true;
    }
}

if (btnNextSlot) {
    btnNextSlot.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/slots/next');
            if (!resp.ok) throw new Error('next_failed');
            const { next } = await resp.json();
            if (next && slotSelect) {
                // If not present in list, add it first
                if (![...slotSelect.options].some(o => o.value === next.start)) {
                    const start = new Date(next.start);
                    const end = new Date(next.end);
                    const df = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
                    const tf = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const opt = document.createElement('option');
                    opt.value = next.start;
                    const day = df.format(start).replace(/\.$/, '');
                    opt.textContent = `${day} ${tf.format(start)}–${tf.format(end)} (prochain)`;
                    slotSelect.prepend(opt);
                }
                slotSelect.value = next.start;
                showNotification('success', 'Prochain créneau sélectionné.');
            } else {
                showNotification('error', 'Aucun créneau prochain disponible.');
            }
        } catch (e) {
            showNotification('error', "Impossible de récupérer le prochain créneau.");
        }
    });
}

// Load slots on startup (non-blocking)
loadSlotsIfAvailable();

if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form data
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            company: document.getElementById('company').value,
            phone: document.getElementById('phone').value,
            sector: document.getElementById('sector').value,
            description: document.getElementById('description').value,
            timestamp: new Date().toISOString()
        };

        // Slot is required now; ensure a value is selected
        const selected = slotSelect ? slotSelect.value : '';
        if (!selected) {
            showNotification('error', 'Veuillez sélectionner un créneau.');
            return;
        }
        formData.slotStart = selected;

        try {
            // Send data to server (you'll need to set up a backend)
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            }).catch(() => {
                // If server not available, store locally
                console.log('Booking data:', formData);
                return { ok: true };
            });

            if (response && response.ok) {
                // Show success message
                showNotification('success', 'Demande envoyée ! Vérifiez vos emails pour la confirmation de votre rendez-vous.');
                bookingForm.reset();

                // Log booking data for now
                console.log('Booking received:', formData);
                storeBookingLocally(formData);
                // Reload slots to reflect decreased availability
                loadSlotsIfAvailable();
            } else if (response.status === 409) {
                showNotification('error', 'Créneau indisponible. Veuillez choisir un créneau proposé.');
            } else {
                showNotification('error', 'Une erreur est survenue. Veuillez réessayer.');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('error', 'Une erreur est survenue. Veuillez réessayer.');
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

// Store bookings locally (for demo purposes)
function storeBookingLocally(booking) {
    let bookings = JSON.parse(localStorage.getItem('stellaris_bookings') || '[]');
    bookings.push(booking);
    localStorage.setItem('stellaris_bookings', JSON.stringify(bookings));
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

        // Scroll to form on mobile
        if (window.innerWidth <= 768) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Validate current step fields
    const validateStep = (stepNum) => {
        const step = form.querySelector(`.form-step[data-step="${stepNum}"]`);
        if (!step) return true;

        const requiredFields = step.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('error');
                field.style.borderColor = '#ff6b6b';
            } else {
                field.classList.remove('error');
                field.style.borderColor = '';
            }

            // Email validation
            if (field.type === 'email' && field.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(field.value)) {
                    isValid = false;
                    field.classList.add('error');
                    field.style.borderColor = '#ff6b6b';
                }
            }
        });

        if (!isValid) {
            showNotification('error', 'Veuillez remplir tous les champs obligatoires.');
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

    // Clear error styling on input
    form.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('input', () => {
            field.classList.remove('error');
            field.style.borderColor = '';
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
