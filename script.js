const root = document.documentElement;

// ---------- helpers ----------
const throttle = (fn, wait = 150) => {
  let timer = null;
  return (...args) => {
    if (timer) return;
    timer = window.setTimeout(() => {
      fn(...args);
      timer = null;
    }, wait);
  };
};

const detectDevice = width => {
  if (width < 641) return 'phone';
  if (width < 1025) return 'tablet';
  return 'desktop';
};

const applyDeviceFlag = () => {
  const current = root.dataset.device;
  const next = detectDevice(window.innerWidth);
  if (current !== next) {
    root.dataset.device = next;
  }
};

applyDeviceFlag();
window.addEventListener('resize', throttle(applyDeviceFlag, 200));
window.addEventListener('orientationchange', applyDeviceFlag);

// ---------- navigation ----------
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

burger?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});

const anchorLinks = document.querySelectorAll('a[href^="#"]');
anchorLinks.forEach(link => {
  link.addEventListener('click', event => {
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
    const el = document.querySelector(id);
    if (el) {
      event.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nav?.classList.remove('open');
      burger?.setAttribute('aria-expanded', 'false');
    }
  });
});

// ---------- scroll animations ----------
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

// ---------- hero CTA ----------
const requestReel = document.getElementById('requestReel');
requestReel?.addEventListener('click', () => {
  const contactSection = document.getElementById('contact');
  contactSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- lead router ----------
const STORAGE_KEYS = {
  admin: 'coai::adminInbox',
  crm: 'coai::crmQueue',
  email: 'coai::emailQueue',
  replies: 'coai::quickReplies'
};

const REQUEST_LABELS = {
  project: 'Проект',
  collab: 'Коллаборация',
  press: 'Медиа / пресса'
};

const supportsStorage = (() => {
  try {
    const test = '__coai__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return true;
  } catch (err) {
    console.warn('LocalStorage недоступно — данные панели не сохраняются', err);
    return false;
  }
})();

const readQueue = key => {
  if (!supportsStorage) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    return [];
  } catch (error) {
    console.error('Не удалось прочитать очередь', key, error);
    return [];
  }
};

const writeQueue = (key, list) => {
  if (!supportsStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('lead-storage-changed', { detail: { key } }));
  } catch (error) {
    console.error('Не удалось сохранить очередь', key, error);
  }
};

const limitQueue = list => list.slice(0, 25);

const LeadRouter = {
  EMAIL_ADDRESS: 'operations@coai.team',
  routeLead: async lead => {
    const tasks = [
      LeadRouter.sendToEmail(lead),
      LeadRouter.sendToCrm(lead),
      LeadRouter.sendToAdmin(lead)
    ];
    const results = await Promise.allSettled(tasks);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
      throw new Error('Маршрутизация заявки завершилась с ошибкой');
    }
  },
  sendToEmail: async lead => {
    const queue = readQueue(STORAGE_KEYS.email);
    queue.unshift({
      id: `mail-${lead.id}`,
      to: LeadRouter.EMAIL_ADDRESS,
      subject: `CoAI :: ${lead.typeLabel}`,
      preview: lead.message.slice(0, 140),
      createdAt: lead.createdAt
    });
    writeQueue(STORAGE_KEYS.email, limitQueue(queue));
  },
  sendToCrm: async lead => {
    const queue = readQueue(STORAGE_KEYS.crm);
    queue.unshift({
      id: `crm-${lead.id}`,
      name: lead.name,
      email: lead.email,
      type: lead.typeLabel,
      status: 'Новая',
      note: lead.message,
      createdAt: lead.createdAt
    });
    writeQueue(STORAGE_KEYS.crm, limitQueue(queue));
  },
  sendToAdmin: async lead => {
    const queue = readQueue(STORAGE_KEYS.admin);
    queue.unshift({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      type: lead.typeLabel,
      message: lead.message,
      status: 'Новая',
      createdAt: lead.createdAt
    });
    writeQueue(STORAGE_KEYS.admin, limitQueue(queue));
  },
  getQueue: channel => {
    const key = STORAGE_KEYS[channel];
    if (!key) return [];
    return readQueue(key);
  },
  removeFromQueue: (channel, id) => {
    const key = STORAGE_KEYS[channel];
    if (!key) return;
    const queue = readQueue(key).filter(entry => entry.id !== id);
    writeQueue(key, queue);
  },
  advanceCrm: id => {
    const key = STORAGE_KEYS.crm;
    const queue = readQueue(key);
    const item = queue.find(entry => entry.id === id);
    if (!item) return;
    const STATES = ['Новая', 'В работе', 'Завершена'];
    const currentIndex = STATES.indexOf(item.status);
    const next = STATES[(currentIndex + 1) % STATES.length];
    item.status = next;
    writeQueue(key, queue);
  }
};

// ---------- contact form ----------
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const statusNode = contactForm.querySelector('.form__status');
  contactForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const name = (data.get('name') || '').toString().trim();
    const email = (data.get('email') || '').toString().trim();
    const type = (data.get('request-type') || 'project').toString();
    const message = (data.get('message') || '').toString().trim();

    if (!name || !email || !message) {
      statusNode.textContent = 'Проверьте, что все поля заполнены.';
      return;
    }

    const lead = {
      id: `lead-${Date.now()}`,
      name,
      email,
      type,
      typeLabel: REQUEST_LABELS[type] ?? 'Проект',
      message,
      createdAt: new Date().toISOString()
    };

    statusNode.textContent = 'Отправляем заявку во все каналы…';
    contactForm.classList.add('is-sending');

    try {
      await LeadRouter.routeLead(lead);
      statusNode.textContent = 'Готово! Сообщение ушло на почту, в CRM и появилось в админ-панели.';
      contactForm.reset();
    } catch (error) {
      console.error(error);
      statusNode.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или напишите напрямую на hello@coai.team.';
    } finally {
      contactForm.classList.remove('is-sending');
    }
  });
}

// ---------- admin dashboard rendering ----------
const formatDate = iso => {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const adminInbox = document.getElementById('adminInbox');
const crmQueue = document.getElementById('crmQueue');
const emailQueue = document.getElementById('emailQueue');
const channelStatus = document.getElementById('channelStatus');

const toggleEmptyState = () => {
  const states = document.querySelectorAll('.empty-state[data-empty]');
  states.forEach(node => {
    const channel = node.getAttribute('data-empty');
    const queue = LeadRouter.getQueue(channel);
    if (queue && queue.length) {
      node.setAttribute('hidden', 'hidden');
    } else {
      node.removeAttribute('hidden');
    }
  });
};

const createActionButton = (label, channel, action, id) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--ghost btn--small';
  button.textContent = label;
  button.dataset.channel = channel;
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
};

const renderAdminInbox = () => {
  if (!adminInbox) return;
  const items = LeadRouter.getQueue('admin');
  adminInbox.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'inbox-item';

    const header = document.createElement('div');
    header.className = 'inbox-item__header';
    const name = document.createElement('h3');
    name.textContent = item.name;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item.type;
    header.append(name, badge);

    const meta = document.createElement('p');
    meta.className = 'inbox-item__meta';
    meta.textContent = `${item.email} · ${formatDate(item.createdAt)}`;

    const message = document.createElement('p');
    message.className = 'inbox-item__message';
    message.textContent = item.message;

    const actions = document.createElement('div');
    actions.className = 'inbox-item__actions';
    actions.append(createActionButton('Закрыть', 'admin', 'resolve', item.id));

    li.append(header, meta, message, actions);
    adminInbox.appendChild(li);
  });
};

const renderCrmQueue = () => {
  if (!crmQueue) return;
  const items = LeadRouter.getQueue('crm');
  crmQueue.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'inbox-item';

    const header = document.createElement('div');
    header.className = 'inbox-item__header';
    const name = document.createElement('h3');
    name.textContent = item.name;
    const badge = document.createElement('span');
    badge.className = 'badge badge--alt';
    badge.textContent = item.status;
    header.append(name, badge);

    const meta = document.createElement('p');
    meta.className = 'inbox-item__meta';
    meta.textContent = `${item.email} · ${item.type} · ${formatDate(item.createdAt)}`;

    const actions = document.createElement('div');
    actions.className = 'inbox-item__actions';
    if (item.note) {
      const note = document.createElement('p');
      note.className = 'inbox-item__message';
      note.textContent = item.note;
      li.append(header, meta, note);
    } else {
      li.append(header, meta);
    }
    actions.append(
      createActionButton('Изменить статус', 'crm', 'advance', item.id),
      createActionButton('Удалить', 'crm', 'resolve', item.id)
    );
    li.append(actions);
    crmQueue.appendChild(li);
  });
};

const renderEmailQueue = () => {
  if (!emailQueue) return;
  const items = LeadRouter.getQueue('email');
  emailQueue.innerHTML = '';
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'inbox-item';

    const header = document.createElement('div');
    header.className = 'inbox-item__header';
    const subject = document.createElement('h3');
    subject.textContent = item.subject;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item.to;
    header.append(subject, badge);

    const meta = document.createElement('p');
    meta.className = 'inbox-item__meta';
    meta.textContent = formatDate(item.createdAt);

    const message = document.createElement('p');
    message.className = 'inbox-item__message';
    message.textContent = item.preview;

    const actions = document.createElement('div');
    actions.className = 'inbox-item__actions';
    actions.append(createActionButton('Удалить', 'email', 'resolve', item.id));

    li.append(header, meta, message, actions);
    emailQueue.appendChild(li);
  });
};

const renderChannelStatus = () => {
  if (!channelStatus) return;
  const adminCount = LeadRouter.getQueue('admin').length;
  const crmCount = LeadRouter.getQueue('crm').length;
  const emailCount = LeadRouter.getQueue('email').length;
  channelStatus.innerHTML = `
    <li><span>Админ инбокс</span><strong>${adminCount}</strong></li>
    <li><span>Flowline CRM</span><strong>${crmCount}</strong></li>
    <li><span>Почта</span><strong>${emailCount}</strong></li>
  `;
};

const renderAll = () => {
  renderAdminInbox();
  renderCrmQueue();
  renderEmailQueue();
  renderChannelStatus();
  toggleEmptyState();
};

if (adminInbox || crmQueue || emailQueue || channelStatus) {
  renderAll();
  window.addEventListener('lead-storage-changed', renderAll);
  window.addEventListener('storage', renderAll);

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    if (!action) return;
    const channel = target.getAttribute('data-channel');
    const id = target.getAttribute('data-id');
    if (!channel || !id) return;

    if (action === 'resolve') {
      LeadRouter.removeFromQueue(channel, id);
    } else if (action === 'advance' && channel === 'crm') {
      LeadRouter.advanceCrm(id);
    }
  });
}

// ---------- quick replies ----------
const quickReplyForm = document.getElementById('quickReplyForm');
const quickReplyStatus = document.getElementById('quickReplyStatus');
const quickReplyList = document.getElementById('quickReplyList');

const QuickReplies = {
  getAll: () => readQueue(STORAGE_KEYS.replies),
  save: entry => {
    const list = QuickReplies.getAll();
    list.unshift(entry);
    writeQueue(STORAGE_KEYS.replies, limitQueue(list));
  },
  remove: id => {
    const list = QuickReplies.getAll().filter(item => item.id !== id);
    writeQueue(STORAGE_KEYS.replies, list);
  }
};

const renderQuickReplies = () => {
  if (!quickReplyList) return;
  const items = QuickReplies.getAll();
  quickReplyList.innerHTML = '';
  if (!items.length) {
    quickReplyList.innerHTML = '<p class="empty-state">Сохранённых шаблонов пока нет.</p>';
    return;
  }
  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'quick-reply__item';

    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = item.title;
    const removeBtn = createActionButton('Удалить', 'replies', 'remove-reply', item.id);
    header.append(title, removeBtn);

    const body = document.createElement('pre');
    body.textContent = item.body;

    card.append(header, body);
    quickReplyList.appendChild(card);
  });
};

if (quickReplyForm) {
  renderQuickReplies();
  quickReplyForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(quickReplyForm);
    const title = (formData.get('title') || '').toString().trim();
    const body = (formData.get('body') || '').toString().trim();
    if (!title || !body) {
      quickReplyStatus.textContent = 'Заполните оба поля.';
      return;
    }
    QuickReplies.save({
      id: `reply-${Date.now()}`,
      title,
      body,
      createdAt: new Date().toISOString()
    });
    quickReplyStatus.textContent = 'Шаблон сохранён.';
    quickReplyForm.reset();
    renderQuickReplies();
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.getAttribute('data-action') === 'remove-reply') {
      const id = target.getAttribute('data-id');
      if (!id) return;
      QuickReplies.remove(id);
      renderQuickReplies();
    }
  });
}

// ---------- footer year ----------
const yearNode = document.getElementById('year');
if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}
