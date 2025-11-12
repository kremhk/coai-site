// Navigation toggle
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

burger?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});

// Smooth anchors
const anchorLinks = document.querySelectorAll('a[href^="#"]');
anchorLinks.forEach(link => {
  link.addEventListener('click', event => {
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
    const el = document.querySelector(id);
    if (el) {
      event.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nav.classList.remove('open');
      burger?.setAttribute('aria-expanded', 'false');
    }
  });
});

// Animated reveal
const animated = document.querySelectorAll('[data-animate]');
if ('IntersectionObserver' in window && animated.length) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10%', threshold: 0.18 });
  animated.forEach(el => observer.observe(el));
} else {
  animated.forEach(el => el.classList.add('is-visible'));
}

// Hero CTA shortcut
const requestReel = document.getElementById('requestReel');
requestReel?.addEventListener('click', () => {
  const contactSection = document.getElementById('contact');
  contactSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Dynamic year
const yearNode = document.getElementById('year');
if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

// Contact form -> mailto fallback
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const name = (data.get('name') || '').toString().trim();
    const email = (data.get('email') || '').toString().trim();
    const type = (data.get('request-type') || '').toString();
    const message = (data.get('message') || '').toString().trim();

    const subject = encodeURIComponent(`Запрос с сайта CoAI — ${type}`);
    const body = encodeURIComponent(`Имя: ${name}\nEmail: ${email}\nФормат: ${type}\n\n${message}`);
    window.location.href = `mailto:wemmzzit@gmail.com?subject=${subject}&body=${body}`;
  });
}

// Admin form placeholder handler
const adminForm = document.getElementById('adminForm');
if (adminForm) {
  adminForm.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(adminForm);
    const login = (data.get('admin-login') || '').toString().trim();
    const note = (data.get('admin-note') || '').toString().trim();

    const subject = encodeURIComponent('Администрирование сайта CoAI');
    const body = encodeURIComponent(`Логин: ${login}\n\n${note}`);
    window.location.href = `mailto:wemmzzit@gmail.com?subject=${subject}&body=${body}`;
  });
}
