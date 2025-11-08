// Mobile nav
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});

// Smooth anchors
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if(!id || id === '#') return;
    const el = document.querySelector(id);
    if(el){
      e.preventDefault();
      el.scrollIntoView({behavior:'smooth', block:'start'});
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
    }
  })
});

// Year
document.getElementById('year').textContent = new Date().getFullYear();


// Contact form: mailto fallback (works locally without backend)
const form = document.getElementById('contactForm');
if(form){
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = (data.get('name')||'').toString().trim();
    const email = (data.get('email')||'').toString().trim();
    const message = (data.get('message')||'').toString().trim();

    const subject = encodeURIComponent('Сообщение с сайта CoAI');
    const body = encodeURIComponent(`Имя: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:wemmzzit@gmail.com?subject=${subject}&body=${body}`;
  });
}
