// Клаб рулетка: клиент (без сборки, чистый JS)
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('ru-RU');
const fmtDate = (s) => { const d = new Date(s.replace(' ', 'T') + 'Z'); return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const ddmm = (s) => s.slice(8, 10) + '.' + s.slice(5, 7);
const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; };

const S = { token: null, me: null, config: { spinCost: 30, currency: 'ККоин' }, prizes: [], dailyShown: false, spinning: false };
try { S.token = localStorage.getItem('lr_token'); } catch {}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token) { setToken(null); S.me = null; route(); }
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}
function setToken(t) { S.token = t; try { t ? localStorage.setItem('lr_token', t) : localStorage.removeItem('lr_token'); } catch {} }

let toastTimer;
function toast(msg, lime = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (lime ? ' lime' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
}

// ---------- иконки интерфейса ----------
const UI = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 8l4 4-4 4M14 12H4"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  wheel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9l2 2 4-4M8 16h8"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/></svg>',
  clover: '<svg viewBox="0 0 100 100"><path d="M50 8C56 44 56 44 92 50 56 56 56 56 50 92 44 56 44 56 8 50 44 44 44 44 50 8Z" fill="#fecc00"/></svg>',
  triangle: '<svg viewBox="0 0 44 38"><defs><linearGradient id="tri" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#e6b200"/></linearGradient></defs><path d="M22 3 L41 34 Q42 36 39 36 H5 Q2 36 3 34 Z" fill="url(#tri)" stroke="#d4a200" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  spinIc: (lime) => `<svg class="spin-ic" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${lime ? '#fecc00' : '#d7d9de'}"/><path d="M16 16 L16 3 A13 13 0 0 1 28 12Z M16 16 L28 20 A13 13 0 0 1 20 28.5Z M16 16 L12 28.5 A13 13 0 0 1 3.5 20Z M16 16 L4 12 A13 13 0 0 1 12 3.5Z" fill="${lime ? '#cc9a00' : '#a7abb5'}"/></svg>`,
};

const balanceEl = (chip = false) => `<span class="balance ${chip ? 'chip' : ''}" data-balance>${coinMini()}<span>${fmt(S.me?.balance ?? 0)}</span></span>`;
// баланс плавно «докручивается» до нового значения
function refreshBalance(value = S.me?.balance) {
  document.querySelectorAll('[data-balance]').forEach((box) => {
    const el = box.querySelector('span:last-child') || box.querySelector('span');
    const from = Number(String(el.textContent).replace(/\D/g, '')) || 0;
    if (from === value || REDUCED) { el.textContent = fmt(value); return; }
    box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
    const t0 = performance.now(), dur = 600;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- навигация ----------
const NAV = [
  ['', 'рулетка', UI.wheel], ['tasks', 'задания', UI.tasks], ['shop', 'магазин', UI.shop], ['rating', 'рейтинг', UI.cup], ['profile', 'кабинет', UI.user],
];
function renderNav(cur) {
  const nav = $('#nav');
  nav.hidden = !S.me;
  nav.classList.toggle('wide', cur === 'admin');
  nav.innerHTML = NAV.map(([h, label, ic]) => `<button data-go="${h}" class="${(cur === h || (cur === 'prizes' && h === 'shop')) ? 'on' : ''}"><span class="nav-ic">${ic}</span>${label}</button>`).join('');
}
const go = (h) => { location.hash = '#/' + h; };
document.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.dataset.go); } });

// порядок страниц задаёт направление анимации перехода
const ORDER = ['', 'tasks', 'shop', 'prizes', 'rating', 'profile', 'admin'];
let lastPage = null, routeSeq = 0;
async function animateTo(page, render) {
  const app = $('#app');
  const seq = ++routeSeq;
  const a = ORDER.indexOf(page), b = ORDER.indexOf(lastPage);
  const dir = lastPage === null || a < 0 || b < 0 || a === b ? 0 : Math.sign(a - b);
  const setShift = (k) => {
    app.style.setProperty('--dx', dir ? k * dir * 28 + 'px' : '0px');
    app.style.setProperty('--dy', dir ? '0px' : '10px');
  };
  if (!REDUCED && app.firstElementChild && lastPage !== null) {
    setShift(-1); app.classList.remove('entering'); app.classList.add('leaving');
    await sleep(140);
    if (seq !== routeSeq) return;
  }
  lastPage = page;
  app.classList.remove('leaving', 'entering');
  window.scrollTo(0, 0);
  render();
  setShift(1); void app.offsetWidth; app.classList.add('entering');
}

async function route() {
  const page = location.hash.replace(/^#\/?/, '').split('?')[0];
  const app = $('#app');
  if (!S.token) { renderNav(); return animateTo('auth', () => { app.classList.remove('wide'); renderAuth(); }); }
  if (!S.me) {
    try { S.me = await api('/me'); } catch { return; }
  }
  closeSheet(true);
  const pages = { '': renderRoulette, tasks: renderTasks, shop: renderShop, prizes: renderPrizes, rating: renderRating, profile: renderProfile, admin: renderAdmin };
  const key = pages[page] ? page : '';
  renderNav(key);
  animateTo(key, () => { app.classList.toggle('wide', key === 'admin'); pages[key](); });
}
window.addEventListener('hashchange', route);

// ---------- вход / регистрация ----------
function renderAuth(mode = 'login') {
  const reg = mode === 'register';
  $('#app').innerHTML = `
  <section class="auth">
    <div class="auth-hero">
      <div class="art">${icon('coin')}</div>
      <div class="logo-word">клаб<br>рулетка</div>
    </div>
    <form class="auth-form" id="auth-form" novalidate>
      <h2 class="h-display" style="margin-bottom:4px">${reg ? 'регистрация' : 'вход'}</h2>
      <p class="hint">${reg ? `Создайте аккаунт и получите приветственный бонус в ${esc(S.config.currency)} на первые спины.` : 'Войдите, чтобы крутить рулетку, копить ККоин и тратить их в магазине.'}</p>
      ${reg ? '<label class="field"><span>Имя</span><input name="name" autocomplete="nickname" maxlength="40" placeholder="Как к вам обращаться"></label>' : ''}
      <label class="field"><span>Логин</span><input name="login" autocomplete="username" required placeholder="например, anna_k"></label>
      <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required placeholder="не короче 6 символов"></label>
      <p class="error" id="auth-err"></p>
      <button class="btn-lime" type="submit">${reg ? 'создать аккаунт' : 'войти'}</button>
      <p class="switch-link">${reg ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?'} <button type="button" id="auth-switch">${reg ? 'Войти' : 'Зарегистрироваться'}</button></p>
    </form>
  </section>`;
  $('#auth-switch').onclick = () => renderAuth(reg ? 'login' : 'register');
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api(reg ? '/register' : '/login', { method: 'POST', body });
      setToken(r.token); S.me = null; S.dailyShown = false;
      if (location.hash && location.hash !== '#/') go(''); else route();
    } catch (err) { $('#auth-err').textContent = err.message; }
  };
}

// ---------- шторка ----------
function closeSheet(instant = false) {
  const root = $('#sheet-root');
  const ov = $('#overlay', root);
  if (!ov) return;
  if (instant || REDUCED) { root.innerHTML = ''; return; }
  ov.classList.add('closing');
  setTimeout(() => { if (ov.isConnected) ov.remove(); }, 220);
}
function sheet(html, { onClose } = {}) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="overlay" id="overlay"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><button class="close" data-close aria-label="Закрыть">${UI.close}</button>${html}</div></div>`;
  const close = () => { closeSheet(); onClose && onClose(); };
  $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' || e.target.closest('[data-close]')) close(); });
  return { el: $('.sheet', root), close };
}

function dailySheet() {
  const d = S.me.daily;
  const days = d.rewards.map((r, i) => {
    const n = i + 1;
    const cls = d.claimedToday ? (n <= d.streak ? (n === d.streak ? 'now' : 'got') : '') : (n < d.day ? 'got' : n === d.day ? 'now' : '');
    return `<div class="day ${cls}">${r >= 15 ? coinMini() : ''}<b>${n}</b><span>день</span><small>+${r}</small></div>`;
  }).join('');
  const lead = d.claimedToday ? 'Награда за сегодня уже у вас. Возвращайтесь завтра, чтобы не потерять серию!'
    : d.missed ? 'Кажется, был пропуск — начните заново и соберите ещё больше ККоин!'
    : 'Заходите каждый день подряд: чем длиннее серия, тем больше награда.';
  const s = sheet(`
    <h2>награда за вход</h2>
    <p class="lead">${lead}</p>
    <div class="days">${days}</div>
    <button class="btn-lime" id="daily-btn" ${d.claimedToday ? 'disabled' : ''}>${d.claimedToday ? 'до завтра!' : `забрать +${d.rewards[d.day - 1]}`}</button>`);
  const btn = $('#daily-btn', s.el);
  if (!d.claimedToday) btn.onclick = async () => {
    btn.disabled = true;
    try {
      const reward = d.rewards[d.day - 1];
      S.me = await api('/daily', { method: 'POST' });
      refreshBalance(); s.close(); toast(`+${reward} ${S.config.currency} за вход!`, true);
      if (location.hash.includes('profile')) renderProfile();
    } catch (e) { toast(e.message); btn.disabled = false; }
  };
}

// ---------- рулетка ----------
const STEP = 150; // расстояние между карточками
function prizeHero(p) {
  if (!p) return { big: '?', pill: 'крутите!' };
  if (p.kind === 'bonus') return { big: '+' + p.value, pill: S.config.currency };
  if (p.kind === 'promo') return { big: '−' + p.value + '%', pill: p.subtitle || 'промокод' };
  return { big: '', pill: p.title };
}

async function renderRoulette() {
  const cost = S.config.spinCost;
  $('#app').innerHTML = `
  <section class="roulette silver">
    <div class="topbar">
      <button class="round-btn" data-go="profile" aria-label="Кабинет">${UI.user}</button>
      ${balanceEl()}
      <button class="round-btn" id="daily-open" aria-label="Награда за вход">${UI.clock}</button>
    </div>
    <div class="quick-links"><button data-go="prizes">все призы</button><button data-go="tasks">задания</button><button data-go="rating">рейтинг</button></div>
    <div class="hero">
      <div class="hero-glow"></div>
      ${sparkle('sp-1')}${sparkle('sp-2')}${sparkle('sp-3')}${sparkle('sp-4')}
      <div class="hero-art" id="hero-art"></div>
      <div class="hero-label"><div class="hero-title" id="hero-title"></div><div class="hero-pill" id="hero-pill"></div></div>
    </div>
    <div class="reel" id="reel">
      <div class="reel-dots" id="reel-dots"></div>
      <div class="reel-track" id="reel-track"></div>
      <div class="reel-pointer"><span class="p-dot"></span>${UI.triangle}</div>
    </div>
    <div class="spin-zone">
      <button class="btn-lime" id="spin-btn">крути за ККоин <span class="dot"></span><span class="price"><span class="clover">${UI.clover}</span>${cost}</span></button>
      <p class="legal">Нажимая на кнопку, я соглашаюсь<br>с <a href="#/profile" data-go="profile">условиями акции</a></p>
    </div>
  </section>`;
  $('#daily-open').onclick = dailySheet;

  try { S.prizes = await api('/prizes'); } catch (e) { toast(e.message); }
  const pool = S.prizes.length ? S.prizes : [{ title: 'скоро', kind: 'item', icon: 'gift', value: 0 }];
  const randPrize = () => pool[Math.floor(Math.random() * pool.length)];
  const tiles = [];
  const ensure = (n) => { while (tiles.length <= n) tiles.push(randPrize()); };
  let pos = 8; ensure(pos + 6);
  const track = $('#reel-track');
  const els = new Map();
  let shownIdx = -1;

  function draw(animateHero = true) {
    const w = track.clientWidth;
    const lo = Math.floor(pos) - 4, hi = Math.ceil(pos) + 4;
    ensure(hi);
    for (const [i, el] of els) if (i < lo || i > hi) { el.remove(); els.delete(i); }
    for (let i = Math.max(0, lo); i <= hi; i++) {
      let el = els.get(i);
      if (!el) { el = document.createElement('div'); el.className = 'tile'; el.innerHTML = icon(tiles[i].icon); track.appendChild(el); els.set(i, el); }
      const d = i - pos, ad = Math.abs(d);
      const x = w / 2 + d * STEP - el.offsetWidth / 2;
      const y = Math.pow(ad, 1.6) * 16;
      const sc = 1 - Math.min(ad * 0.07, 0.25);
      el.style.transform = `translate(${x}px, ${y}px) rotate(${d * 11}deg) scale(${sc})`;
      el.style.zIndex = String(10 - Math.round(ad));
      el.style.opacity = ad > 3.2 ? '0' : '1';
    }
    const idx = Math.round(pos);
    if (idx !== shownIdx) { shownIdx = idx; setHero(tiles[idx], animateHero); }
  }
  function setHero(p, animate) {
    const h = prizeHero(p);
    const art = $('#hero-art');
    if (!art) return;
    art.innerHTML = icon(p.icon);
    $('#hero-title').textContent = h.big;
    $('#hero-pill').textContent = h.pill;
    if (animate) { art.classList.remove('pop'); void art.offsetWidth; art.classList.add('pop'); }
  }
  // декоративные шарики под карточками
  $('#reel-dots').innerHTML = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].filter((d) => d).map((d) => {
    const ad = Math.abs(d);
    return `<i style="left:calc(50% + ${d * STEP - 5}px);top:${Math.pow(ad, 1.6) * 16 - 4}px"></i>`;
  }).join('');
  draw(false);
  window.addEventListener('resize', () => draw(false));

  const btn = $('#spin-btn');
  btn.onclick = async () => {
    if (S.spinning) return;
    if (S.me.balance < cost) { toast(`Не хватает ККоин: нужно ${cost}. Загляните в задания!`); return; }
    S.spinning = true; btn.disabled = true;
    refreshBalance(S.me.balance - cost);
    let res;
    try { res = await api('/spin', { method: 'POST' }); }
    catch (e) { toast(e.message); refreshBalance(); S.spinning = false; btn.disabled = false; return; }
    const start = pos;
    const target = Math.round(pos) + 32 + Math.floor(Math.random() * 6);
    ensure(target + 6);
    tiles[target] = { ...res.win };
    const old = els.get(target); if (old) { old.remove(); els.delete(target); }
    const dur = 5600;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    await new Promise((done) => {
      const step = (now) => {
        if (!document.body.contains(track)) return done();
        const t = Math.min(1, (now - t0) / dur);
        pos = start + (target - start) * ease(t);
        draw(false);
        t < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
    shownIdx = -1; draw(true);
    S.me = res.me; refreshBalance();
    S.spinning = false; btn.disabled = false;
    // освобождаем память: оставляем только хвост ленты
    winSheet(res.win);
  };

  if (!S.dailyShown && !S.me.daily.claimedToday) { S.dailyShown = true; setTimeout(() => { if (document.body.contains($('#spin-btn')) && !$('#overlay')) dailySheet(); }, 500); }
}

function winSheet(w) {
  const text = w.kind === 'bonus' ? `${S.config.currency[0].toUpperCase() + S.config.currency.slice(1)} уже на вашем балансе. Потратьте их на спины или в магазине.`
    : w.kind === 'promo' ? 'Промокод сохранён в личном кабинете, во вкладке «выигрыши».'
    : 'Приз закреплён за вами. Покажите этот код администратору при получении. Статус выдачи виден в кабинете.';
  const s = sheet(`
    <div class="win-art">${icon(w.icon)}</div>
    <h2 style="margin-top:8px">вы выиграли!</h2>
    <p class="lead"><b>${esc(w.title)}</b>${w.subtitle ? ' — ' + esc(w.subtitle) : ''}<br><span style="color:#555">${text}</span></p>
    ${w.code ? `<div class="win-code"><span class="code">${esc(w.code)}</span><button class="btn-ghost" id="copy-code">копировать</button></div>` : ''}
    <button class="btn-lime" data-close>крутить ещё</button>
    <p class="switch-link"><button data-go="profile" data-close>мои выигрыши</button></p>`);
  const c = $('#copy-code', s.el);
  if (c) c.onclick = () => navigator.clipboard?.writeText(w.code).then(() => toast('Код скопирован', true), () => {});
}

// ---------- задания ----------
async function renderTasks() {
  $('#app').innerHTML = `
  <section>
    <div class="page-head silver">
      <div class="topbar" style="padding:16px 0 0"><button class="plain-btn" data-go="" aria-label="Назад">${UI.back}</button>${balanceEl(true)}<span style="width:44px"></span></div>
      <div class="art">${icon('coin')}</div><div class="art-2">${icon('heart')}</div>
      <h1 class="h-display">задания</h1>
    </div>
    <ul class="list" id="tasks"><li class="empty">Загружаем…</li></ul>
  </section>`;
  let tasks;
  try { tasks = await api('/tasks'); } catch (e) { return toast(e.message); }
  const box = $('#tasks');
  if (!tasks.length) { box.innerHTML = '<li class="empty">Заданий пока нет</li>'; return; }
  box.innerHTML = tasks.map((t) => {
    const done = t.claimed;
    const deadline = t.deadline ? `до ${new Date(t.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}` : 'бессрочно';
    let action;
    if (done) action = '<span class="status done">выполнено</span>';
    else if (t.requested) action = '<span class="status pending">на проверке</span>';
    else if (t.expired) action = '<span class="status cancelled">срок истёк</span>';
    else if (t.type === 'manual') action = `<button class="btn-small" data-claim="${t.id}">я выполнил</button>`;
    else action = `<button class="btn-small" data-claim="${t.id}" ${t.canClaim ? '' : 'disabled'}>${t.canClaim ? 'забрать' : `${t.progress} / ${t.target}`}</button>`;
    const bar = t.type !== 'manual' && !done ? `<div class="progress"><i style="width:${(t.progress / t.target) * 100}%"></i></div>` : '<span></span>';
    return `<li class="task ${done ? 'done' : ''}">
      <div class="t-art">${icon(t.icon)}</div>
      <div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p></div>
      <div><span class="tag">+${t.reward} ${coinMini()}</span></div>
      <div class="t-foot">${bar}<span class="deadline">${deadline} ${UI.clock}</span>${action}</div>
    </li>`;
  }).join('');
  box.onclick = async (e) => {
    const b = e.target.closest('[data-claim]'); if (!b || b.disabled) return;
    b.disabled = true;
    try {
      const before = S.me.balance;
      S.me = await api(`/tasks/${b.dataset.claim}/claim`, { method: 'POST' });
      refreshBalance();
      toast(S.me.balance > before ? `+${S.me.balance - before} ${S.config.currency}!` : 'Отправлено на проверку', true);
      renderTasks();
    } catch (err) { toast(err.message); b.disabled = false; }
  };
}

// ---------- магазин и призы ----------
function shopHead(active) {
  return `<div class="page-head">
      <div class="topbar" style="padding:16px 0 0"><button class="plain-btn" data-go="" aria-label="Назад">${UI.back}</button>${balanceEl(true)}<span style="width:44px"></span></div>
    </div>
    <div class="tabs" style="margin-top:8px"><button data-go="shop" class="${active === 'shop' ? 'on' : ''}">магазин</button><button data-go="prizes" class="${active === 'prizes' ? 'on' : ''}">призы</button></div>`;
}
async function renderShop() {
  $('#app').innerHTML = `<section>${shopHead('shop')}<p class="hint" style="padding:16px 20px 0;margin:0">Обменивайте ${esc(S.config.currency)} на скидки. После покупки вы получите промокод, он сохранится в личном кабинете.</p><div class="grid" id="shop"></div></section>`;
  let items;
  try { items = await api('/shop'); } catch (e) { return toast(e.message); }
  const box = $('#shop');
  if (!items.length) { box.outerHTML = '<p class="empty">Магазин пока пуст</p>'; return; }
  box.innerHTML = items.map((it) => `
    <div class="card ${it.stock <= 0 ? 'out' : ''}">
      <div class="c-art">${icon(it.icon)}</div>
      <h3>${esc(it.title)}</h3><p>${esc(it.description)}</p>
      <div class="c-foot">
        <span class="stock">${it.stock > 0 ? `в наличии: <b>${fmt(it.stock)}</b>` : 'нет в наличии'}</span>
        <button class="btn-small" data-buy="${it.id}" ${it.stock <= 0 ? 'disabled' : ''}>${coinMini().replace('coin-mini', 'coin-mini" style="width:18px;height:18px;vertical-align:-4px;margin-right:4px')}${fmt(it.price)}</button>
      </div>
    </div>`).join('');
  box.onclick = (e) => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    const it = items.find((x) => x.id === Number(b.dataset.buy));
    const enough = S.me.balance >= it.price;
    const s = sheet(`
      <div class="win-art" style="width:150px;height:150px">${icon(it.icon)}</div>
      <h2 style="margin-top:8px">${esc(it.title)}</h2>
      <p class="lead">${esc(it.description)}<br>Цена: <b>${fmt(it.price)}</b> ${esc(S.config.currency)}. На балансе: <b>${fmt(S.me.balance)}</b>.</p>
      <button class="btn-lime" id="buy-ok" ${enough ? '' : 'disabled'}>${enough ? 'купить' : `не хватает ${fmt(it.price - S.me.balance)}`}</button>`);
    const ok = $('#buy-ok', s.el);
    if (enough) ok.onclick = async () => {
      ok.disabled = true;
      try {
        const r = await api(`/shop/${it.id}/buy`, { method: 'POST' });
        S.me = r.me; refreshBalance();
        s.el.innerHTML = `<div class="grab"></div>
          <div class="win-art" style="width:150px;height:150px">${icon(it.icon)}</div>
          <h2 style="margin-top:8px">покупка оформлена!</h2>
          <p class="lead">Ваш промокод на скидку. Он сохранён в личном кабинете во вкладке «покупки».</p>
          <div class="win-code"><span class="code">${esc(r.order.code)}</span></div>
          <button class="btn-lime" data-close>отлично</button>`;
        $('#overlay').addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) renderShop(); });
      } catch (err) { toast(err.message); ok.disabled = false; }
    };
  };
}
async function renderPrizes() {
  $('#app').innerHTML = `<section>${shopHead('prizes')}<p class="hint" style="padding:16px 20px 0;margin:0">Всё, что может выпасть в рулетке, и сколько осталось. Когда приз заканчивается, он больше не выпадает.</p><div class="grid" id="prizes"></div></section>`;
  try { S.prizes = await api('/prizes'); } catch (e) { return toast(e.message); }
  $('#prizes').innerHTML = S.prizes.map((p) => `
    <div class="card ${p.stock <= 0 ? 'out' : ''}">
      <div class="c-art">${icon(p.icon)}</div>
      <h3>${esc(p.title)}</h3><p>${esc(p.subtitle)}</p>
      <div class="c-foot"><span class="stock">${p.stock > 0 ? `осталось: <b>${fmt(p.stock)}</b> шт.` : 'закончился'}</span></div>
    </div>`).join('') || '<p class="empty">Призов пока нет</p>';
}

// ---------- рейтинг ----------
async function renderRating() {
  $('#app').innerHTML = `<section>
    <div class="page-head silver">
      <div class="topbar" style="padding:16px 0 0"><button class="plain-btn" data-go="" aria-label="Назад">${UI.back}</button><span></span></div>
      <div class="art">${icon('cup')}</div>
      <h1 class="h-display">рейтинг</h1>
      <div class="sub" id="period"></div>
    </div>
    <div id="board" style="padding-top:20px"><p class="empty">Загружаем…</p></div>
  </section>`;
  let r;
  try { r = await api('/leaderboard'); } catch (e) { return toast(e.message); }
  $('#period').textContent = `${ddmm(r.period.from)} – ${ddmm(r.period.to)}`;
  const deco = ['', '', '', ''];
  $('#board').innerHTML = r.rows.length ? r.rows.map((row) => `
    <div class="rank ${row.place <= 3 ? 'top' : ''} ${row.id === S.me.id ? 'me' : ''}">
      <div class="badge">${row.place <= 3 ? sparkle() : ''}<b>${row.place}</b></div>
      <div class="who"><h4>${esc(row.title)}</h4><span>${esc(row.name)} · ID ${row.id}</span></div>
      <div class="score"><b>${row.spins}</b><span>${plural(row.spins, 'спин', 'спина', 'спинов')}</span></div>
    </div>`).join('') : '<p class="empty">В этом периоде ещё никто не крутил. Станьте первым!</p>';
  void deco;
}

// ---------- личный кабинет ----------
const STATUS = { issued: 'выдан', pending: 'ожидает выдачи', delivered: 'получен', cancelled: 'отменён' };
async function renderProfile(tab = 'wins') {
  const m = S.me;
  const d = m.daily;
  $('#app').innerHTML = `<section>
    <div class="silver profile-head">
      <div class="topbar" style="padding:16px 0 0"><button class="plain-btn" data-go="" aria-label="Назад">${UI.back}</button><span class="id-chip">ID ${m.id}</span><button class="plain-btn" id="logout" aria-label="Выйти">${UI.exit}</button></div>
      <div class="avatar">${esc((m.name || m.login)[0].toUpperCase())}</div>
      <div class="period">${ddmm(m.period.from)} – ${ddmm(m.period.to)}</div>
      <h1 class="h-display">${esc(m.title)}</h1>
      <div class="name">${esc(m.name)}${m.place ? ` · ${m.place} место в рейтинге` : ''}</div>
      <div class="stats">
        <div><span>прошлые спины</span><b>${UI.spinIc(false)}${m.stats.past}</b></div>
        <div><span>текущие спины</span><b>${UI.spinIc(true)}${m.stats.current}</b></div>
        <div><span>баланс</span><b>${coinMini()}<span data-balance><span>${fmt(m.balance)}</span></span></b></div>
      </div>
    </div>
    <div class="daily-card">
      <div class="d-art">${icon('coins')}</div>
      <div><h4>награда за вход</h4><p>${d.claimedToday ? `получена · серия ${d.streak} ${plural(d.streak, 'день', 'дня', 'дней')}` : `сегодня: +${d.rewards[d.day - 1]}`}</p></div>
      <button class="btn-small" id="daily-open">${d.claimedToday ? 'смотреть' : 'забрать'}</button>
    </div>
    <div class="seg" id="seg">
      <button data-tab="wins" class="${tab === 'wins' ? 'on' : ''}">выигрыши</button>
      <button data-tab="orders" class="${tab === 'orders' ? 'on' : ''}">покупки</button>
      <button data-tab="ledger" class="${tab === 'ledger' ? 'on' : ''}">баланс</button>
    </div>
    <div id="hist"><p class="empty">Загружаем…</p></div>
    <div class="menu-list" style="margin-top:20px">
      ${m.isAdmin ? '<a href="#/admin" style="font-weight:800">⚙︎ панель администратора</a>' : ''}
      <details class="faq"><summary>вопросы и ответы</summary>
        <p><b>Как получить ККоин?</b> Награда за вход каждый день, выполнение заданий и выигрыши в рулетке.</p>
        <p><b>Сколько стоит спин?</b> ${S.config.spinCost} ${esc(S.config.currency)}.</p>
        <p><b>Где мой приз?</b> Бонусы сразу на балансе. Промокоды и коды призов во вкладке «выигрыши». Физические призы выдаёт администратор по коду.</p></details>
      <details class="faq"><summary>условия акции</summary>
        <p>Каждый приз имеет ограниченное количество. Когда приз заканчивается, он исключается из розыгрыша. Результат спина определяется на сервере случайным образом с учётом шансов призов. Лаймики не обмениваются на деньги. Организатор вправе изменить условия акции.</p></details>
    </div>
  </section>`;
  $('#logout').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch {} setToken(null); S.me = null; go(''); route(); };
  $('#daily-open').onclick = dailySheet;
  $('#seg').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) renderProfile(b.dataset.tab); };
  let h;
  try { [h, S.me] = await Promise.all([api('/history'), api('/me')]); } catch (e) { return toast(e.message); }
  refreshBalance();
  const box = $('#hist');
  if (tab === 'wins') box.innerHTML = h.wins.map((w) => `
    <div class="history-item"><div class="h-art">${icon(w.icon)}</div>
      <div><h5>${esc(w.title)}</h5><small>${fmtDate(w.created_at)}${w.code ? ` · <span class="code">${esc(w.code)}</span>` : ''}</small></div>
      <span class="status ${w.status}">${STATUS[w.status] || esc(w.status)}</span></div>`).join('') || '<p class="empty">Вы ещё не крутили рулетку</p>';
  if (tab === 'orders') box.innerHTML = h.orders.map((o) => `
    <div class="history-item"><div class="h-art">${icon(o.icon)}</div>
      <div><h5>${esc(o.title)}</h5><small>${fmtDate(o.created_at)} · ${fmt(o.price)} · <span class="code">${esc(o.code)}</span></small></div>
      <span class="status ${o.status}">${STATUS[o.status] || esc(o.status)}</span></div>`).join('') || '<p class="empty">Покупок пока нет</p>';
  if (tab === 'ledger') box.innerHTML = h.ledger.map((l) => `
    <div class="history-item" style="grid-template-columns:1fr auto"><div><h5 style="font-weight:600">${esc(l.reason)}</h5><small>${fmtDate(l.created_at)}</small></div>
      <span class="amount ${l.amount > 0 ? 'plus' : 'minus'}">${l.amount > 0 ? '+' : ''}${fmt(l.amount)}</span></div>`).join('') || '<p class="empty">Операций пока нет</p>';
}

// ---------- админка ----------
const ADMIN_TABS = [['prizes', 'призы рулетки'], ['shop_items', 'магазин'], ['tasks', 'задания'], ['wins', 'выигрыши'], ['orders', 'заказы'], ['requests', 'заявки'], ['users', 'пользователи'], ['settings', 'настройки']];
const COLS = {
  prizes: [['icon', 'иконка', 'icon'], ['title', 'название'], ['subtitle', 'подпись'], ['kind', 'тип', ['bonus', 'promo', 'item']], ['value', 'значение', 'num'], ['weight', 'вес', 'num'], ['stock', 'остаток', 'num'], ['active', 'вкл', 'check']],
  shop_items: [['icon', 'иконка', 'icon'], ['title', 'название'], ['description', 'описание'], ['price', 'цена', 'num'], ['stock', 'остаток', 'num'], ['active', 'вкл', 'check']],
  tasks: [['icon', 'иконка', 'icon'], ['title', 'название'], ['description', 'описание'], ['type', 'тип', ['spins', 'purchases', 'streak', 'manual']], ['target', 'цель', 'num'], ['reward', 'награда', 'num'], ['deadline', 'до (ГГГГ-ММ-ДД)'], ['active', 'вкл', 'check']],
};
const DEFAULTS = {
  prizes: { title: 'новый приз', subtitle: '', kind: 'bonus', value: 10, icon: 'coin', weight: 10, stock: 10, active: 0 },
  shop_items: { title: 'новый товар', description: '', price: 100, stock: 10, icon: 'gift', active: 0 },
  tasks: { title: 'новое задание', description: '', type: 'spins', target: 1, reward: 10, icon: 'star', active: 0 },
};
const HINTS = {
  prizes: 'Тип: bonus — начисляет ККоин (значение = сколько), promo — выдаёт промокод на скидку (значение = % скидки), item — физический приз, ждёт выдачи администратором. Вес — относительный шанс выпадения. Остаток уменьшается с каждым выигрышем; при нуле приз перестаёт выпадать. Иконка — одно из встроенных названий (coin, coins, ticket, percent, gift, headphones, star, cup, heart, perfume, card, bag, flower, receipt) или любой эмодзи.',
  shop_items: 'Остаток уменьшается с каждой покупкой. Покупатель получает код заказа, статус выдачи меняется во вкладке «заказы».',
  tasks: 'Тип: spins — сделать N спинов, purchases — N покупок в магазине, streak — N дней подряд забирать награду за вход, manual — пользователь нажимает «я выполнил», а вы подтверждаете во вкладке «заявки».',
};

async function renderAdmin(tab = 'prizes') {
  if (!S.me.isAdmin) return go('');
  $('#app').innerHTML = `<section class="admin">
    <div style="display:flex;align-items:center;gap:10px"><button class="plain-btn" data-go="profile" aria-label="Назад">${UI.back}</button><h1 class="h-display" style="font-size:30px">админка</h1></div>
    <div class="kpis" id="kpis"></div>
    <div class="seg" id="aseg">${ADMIN_TABS.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="apanel"><p class="empty">Загружаем…</p></div>
  </section>`;
  $('#aseg').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) renderAdmin(b.dataset.tab); };
  api('/admin/stats').then((s) => {
    $('#kpis').innerHTML = [[s.users, 'пользователей'], [s.spins, 'спинов всего'], [s.orders, 'покупок'], [s.pendingWins, 'призов ждут выдачи'], [s.pendingOrders, 'заказов ждут выдачи']]
      .map(([v, l]) => `<div class="kpi"><b>${fmt(v)}</b><span>${l}</span></div>`).join('');
  }).catch(() => {});
  const panel = $('#apanel');
  try {
    if (COLS[tab]) return await adminTable(panel, tab);
    if (tab === 'wins' || tab === 'orders') return await adminDeliveries(panel, tab);
    if (tab === 'users') return await adminUsers(panel);
    if (tab === 'requests') return await adminRequests(panel);
    if (tab === 'settings') return await adminSettings(panel);
  } catch (e) { panel.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}

async function adminTable(panel, table) {
  const rows = await api('/admin/' + table);
  const cols = COLS[table];
  let chance = null;
  if (table === 'prizes') {
    const tw = rows.filter((r) => r.active && r.stock > 0).reduce((s, r) => s + r.weight, 0);
    chance = (r) => (r.active && r.stock > 0 && tw ? ((r.weight / tw) * 100).toFixed(1) + '%' : '—');
  }
  const cell = (r, [k, , type]) => {
    const v = r[k] ?? '';
    if (type === 'check') return `<input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}>`;
    if (Array.isArray(type)) return `<select data-k="${k}">${type.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    if (type === 'num') return `<input class="num ${k === 'stock' && v <= 3 ? 'low' : ''}" type="number" data-k="${k}" value="${esc(v)}">`;
    if (type === 'icon') return `<div style="display:flex;gap:6px;align-items:center"><span class="ic-cell">${icon(v)}</span><input data-k="${k}" value="${esc(v)}" style="width:110px;min-width:110px"></div>`;
    return `<input data-k="${k}" value="${esc(v)}">`;
  };
  panel.innerHTML = `<p class="hint">${HINTS[table]}</p>
    <div style="margin-bottom:12px"><button class="btn-dark" id="add-row">+ добавить</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${c[1]}</th>`).join('')}${chance ? '<th>шанс</th>' : ''}<th></th></tr></thead>
    <tbody>${rows.map((r) => `<tr data-id="${r.id}">${cols.map((c) => `<td>${cell(r, c)}</td>`).join('')}${chance ? `<td class="chance">${chance(r)}</td>` : ''}
      <td><div class="row-actions"><button class="btn-small" data-save>сохранить</button><button class="btn-ghost" data-del aria-label="Удалить">✕</button></div></td></tr>`).join('')}</tbody></table></div>`;
  $('#add-row').onclick = async () => { await api('/admin/' + table, { method: 'POST', body: DEFAULTS[table] }); toast('Добавлено. Заполните и включите строку'); adminTable(panel, table); };
  panel.querySelector('tbody').onclick = async (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const id = tr.dataset.id;
    if (e.target.closest('[data-save]')) {
      const body = {};
      tr.querySelectorAll('[data-k]').forEach((el) => {
        const col = cols.find((c) => c[0] === el.dataset.k);
        body[el.dataset.k] = col[2] === 'check' ? (el.checked ? 1 : 0) : col[2] === 'num' ? Number(el.value) : (el.value === '' && el.dataset.k === 'deadline' ? null : el.value);
      });
      try { await api(`/admin/${table}/${id}`, { method: 'PUT', body }); toast('Сохранено', true); adminTable(panel, table); } catch (err) { toast(err.message); }
    }
    if (e.target.closest('[data-del]') && confirm('Удалить строку? История выигрышей и заказов сохранится.')) {
      try { await api(`/admin/${table}/${id}`, { method: 'DELETE' }); adminTable(panel, table); } catch (err) { toast(err.message); }
    }
  };
}

async function adminDeliveries(panel, kind) {
  const rows = await api('/admin/' + kind);
  const opts = kind === 'wins' ? ['issued', 'pending', 'delivered', 'cancelled'] : ['pending', 'delivered', 'cancelled'];
  panel.innerHTML = `<p class="hint">${kind === 'wins' ? 'Все результаты спинов. Физические призы (тип item) имеют статус «ожидает выдачи», после вручения поставьте «получен».' : 'Покупки из магазина. После вручения поставьте «получен».'} Поиск по коду: Ctrl+F.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>дата</th><th>пользователь</th><th>${kind === 'wins' ? 'приз' : 'товар'}</th><th>код</th>${kind === 'orders' ? '<th>цена</th>' : ''}<th>статус</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td style="white-space:nowrap">${fmtDate(r.created_at)}</td><td>${esc(r.name)}<br><small style="color:#888">${esc(r.login)} · ID ${r.publicId}</small></td>
      <td>${esc(r.title)}</td><td>${r.code ? `<span class="code">${esc(r.code)}</span>` : '—'}</td>${kind === 'orders' ? `<td>${fmt(r.price)}</td>` : ''}
      <td><select data-id="${r.id}">${opts.map((o) => `<option value="${o}" ${o === r.status ? 'selected' : ''}>${STATUS[o]}</option>`).join('')}</select></td></tr>`).join('') || `<tr><td colspan="6" class="empty">Пока пусто</td></tr>`}
    </tbody></table></div>`;
  panel.onchange = async (e) => {
    const s = e.target.closest('select[data-id]'); if (!s) return;
    try { await api(`/admin/${kind}/${s.dataset.id}`, { method: 'PUT', body: { status: s.value } }); toast('Статус обновлён', true); } catch (err) { toast(err.message); }
  };
}

async function adminUsers(panel) {
  const rows = await api('/admin/users');
  panel.innerHTML = `<p class="hint">Чтобы списать ККоин, введите отрицательное число.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>имя / логин</th><th>баланс</th><th>спинов</th><th>регистрация</th><th>начислить</th></tr></thead><tbody>
    ${rows.map((u) => `<tr data-uid="${u.id}"><td>${u.publicId}${u.is_admin ? ' 👑' : ''}</td><td>${esc(u.name)}<br><small style="color:#888">${esc(u.login)}</small></td><td><b>${fmt(u.balance)}</b></td><td>${u.spins}</td><td>${fmtDate(u.created_at)}</td>
      <td><div class="row-actions"><input class="num" type="number" placeholder="±" data-amt><input placeholder="причина" data-reason><button class="btn-small" data-give>ок</button></div></td></tr>`).join('')}
    </tbody></table></div>`;
  panel.onclick = async (e) => {
    const b = e.target.closest('[data-give]'); if (!b) return;
    const tr = b.closest('tr');
    try {
      await api(`/admin/users/${tr.dataset.uid}/balance`, { method: 'POST', body: { amount: $('[data-amt]', tr).value, reason: $('[data-reason]', tr).value || undefined } });
      toast('Баланс изменён', true); adminUsers(panel);
    } catch (err) { toast(err.message); }
  };
}

async function adminRequests(panel) {
  const rows = await api('/admin/task_requests');
  panel.innerHTML = `<p class="hint">Заявки по заданиям с ручной проверкой.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>дата</th><th>пользователь</th><th>задание</th><th>награда</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.name)} · ID ${r.publicId}</td><td>${esc(r.title)}</td><td>+${r.reward}</td>
      <td><div class="row-actions"><button class="btn-small" data-ok="${r.user_id}/${r.task_id}">подтвердить</button><button class="btn-ghost" data-no="${r.user_id}/${r.task_id}">отклонить</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Новых заявок нет</td></tr>'}
    </tbody></table></div>`;
  panel.onclick = async (e) => {
    const b = e.target.closest('[data-ok],[data-no]'); if (!b) return;
    const key = b.dataset.ok || b.dataset.no;
    try { await api('/admin/task_requests/' + key, { method: 'POST', body: { approve: !!b.dataset.ok } }); toast('Готово', true); adminRequests(panel); } catch (err) { toast(err.message); }
  };
}

async function adminSettings(panel) {
  const s = await api('/admin/settings');
  const F = [['spin_cost', 'Стоимость спина'], ['start_balance', 'Приветственный бонус новым пользователям'], ['daily_rewards', 'Награды за вход по дням (7 чисел через запятую)'], ['period_start', 'Начало первого периода рейтинга (ГГГГ-ММ-ДД)'], ['period_days', 'Длина периода рейтинга, дней'], ['currency', 'Название валюты']];
  panel.innerHTML = `<form id="sets" style="max-width:520px">${F.map(([k, l]) => `<label class="field"><span>${l}</span><input name="${k}" value="${esc(s[k])}"></label>`).join('')}<button class="btn-lime" type="submit">сохранить</button></form>`;
  $('#sets').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); S.config = await api('/config'); toast('Настройки сохранены', true); } catch (err) { toast(err.message); }
  };
}

// ---------- старт ----------
(async () => {
  try { S.config = await api('/config'); } catch {}
  route();
})();
