// Клаб рулетка: сервер (Express + встроенный SQLite из Node 22)
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'roulette.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// ---------- схема ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_daily TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('bonus','promo','item')),
  value INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT 'gift',
  weight INTEGER NOT NULL DEFAULT 10,
  stock INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS wins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prize_id INTEGER,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT 'gift',
  code TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  cost INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS shop_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT 'gift',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  icon TEXT NOT NULL DEFAULT 'gift',
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('spins','purchases','streak','manual')),
  target INTEGER NOT NULL DEFAULT 1,
  reward INTEGER NOT NULL,
  icon TEXT NOT NULL DEFAULT 'star',
  deadline TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS task_claims (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'claimed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, task_id)
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const DEFAULT_SETTINGS = {
  spin_cost: '30',
  start_balance: '100',
  daily_rewards: '5,5,15,10,10,15,30',
  period_start: '2026-10-26',
  period_days: '14',
  brand: 'клаб рулетка',
  currency: 'ККоин',
};
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
}
const setting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value ?? DEFAULT_SETTINGS[k];

// ---------- утилиты ----------
const ID_OFFSET = 2500000; // публичный ID = id + смещение, чтобы номера выглядели «по-взрослому»
const publicId = (id) => ID_OFFSET + id;
const hash = (pass, salt) => crypto.scryptSync(pass, salt, 32).toString('hex');
const today = () => new Date().toISOString().slice(0, 10);
const genCode = (prefix) => prefix + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
function addBalance(userId, amount, reason) {
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO ledger (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, amount, reason);
}
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function currentPeriod() {
  const start = new Date(setting('period_start') + 'T00:00:00Z').getTime();
  const len = Number(setting('period_days')) * 86400000;
  const n = Math.max(0, Math.floor((Date.now() - start) / len));
  const from = new Date(start + n * len);
  const to = new Date(start + (n + 1) * len);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
const rankTitle = (place, spins) => {
  if (!spins) return 'новичок рулетки';
  if (place === 1) return 'чемпион рулетки';
  if (place === 2) return 'эксперт рулетки';
  if (place === 3) return 'мастер рулетки';
  return 'любитель рулетки';
};

// ---------- начальные данные ----------
function seed() {
  if (!db.prepare('SELECT 1 FROM users WHERE is_admin = 1').get()) {
    const salt = crypto.randomBytes(8).toString('hex');
    const pass = process.env.ADMIN_PASSWORD || 'admin123';
    db.prepare('INSERT INTO users (login, name, pass_hash, salt, balance, is_admin) VALUES (?,?,?,?,?,1)')
      .run('admin', 'Администратор', hash(pass, salt), salt, 1000);
  }
  if (!db.prepare('SELECT 1 FROM prizes').get()) {
    const p = db.prepare('INSERT INTO prizes (title, subtitle, kind, value, icon, weight, stock) VALUES (?,?,?,?,?,?,?)');
    p.run('+30 ККоин', 'на покупки в магазине', 'bonus', 30, 'coin', 40, 500);
    p.run('+50 ККоин', 'на покупки в магазине', 'bonus', 50, 'coin', 25, 300);
    p.run('+100 ККоин', 'на покупки в магазине', 'bonus', 100, 'coins', 8, 100);
    p.run('скидка −15%', 'промокод на онлайн-покупку', 'promo', 15, 'ticket', 15, 200);
    p.run('скидка −20%', 'на всю коллекцию', 'promo', 20, 'percent', 8, 100);
    p.run('подарочный набор', 'заберите в точке выдачи', 'item', 0, 'gift', 3, 20);
    p.run('беспроводные наушники', 'главный приз', 'item', 0, 'headphones', 1, 3);
  }
  if (!db.prepare('SELECT 1 FROM shop_items').get()) {
    const s = db.prepare('INSERT INTO shop_items (title, description, price, stock, icon) VALUES (?,?,?,?,?)');
    s.run('скидка −5%', 'промокод на любую покупку', 30, 999, 'ticket');
    s.run('скидка −10%', 'промокод на любую покупку', 60, 999, 'ticket');
    s.run('скидка −15%', 'промокод на любую покупку', 100, 500, 'percent');
    s.run('скидка −20%', 'промокод на любую покупку', 150, 300, 'percent');
    s.run('скидка −25%', 'промокод на одну позицию', 220, 200, 'percent');
    s.run('скидка −30%', 'промокод на одну позицию', 300, 100, 'percent');
  }
  if (!db.prepare('SELECT 1 FROM tasks').get()) {
    const t = db.prepare('INSERT INTO tasks (title, description, type, target, reward, icon, deadline) VALUES (?,?,?,?,?,?,?)');
    t.run('первый спин', 'Покрутите рулетку один раз.', 'spins', 1, 10, 'star', null);
    t.run('разогрев', 'Сделайте 5 спинов.', 'spins', 5, 20, 'flower', '2026-11-30');
    t.run('марафонец', 'Сделайте 20 спинов.', 'spins', 20, 50, 'cup', '2026-11-30');
    t.run('первая покупка', 'Купите что-нибудь в магазине за ККоин.', 'purchases', 1, 15, 'bag', '2026-11-30');
    t.run('три дня подряд', 'Заходите и забирайте награду за вход 3 дня подряд.', 'streak', 3, 20, 'heart', null);
    t.run('покупка в магазине от 3 000 ₽', 'Покажите чек администратору, и он подтвердит задание.', 'manual', 1, 20, 'receipt', '2026-11-30');
  }
}
seed();

// ---------- приложение ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = token && db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
  if (!user) return res.status(401).json({ error: 'Войдите в аккаунт' });
  req.user = user; req.token = token; next();
}
const admin = (req, res, next) => (req.user.is_admin ? next() : res.status(403).json({ error: 'Только для администратора' }));
const wrap = (fn) => (req, res) => {
  try { res.json(fn(req, res)); }
  catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Ошибка сервера' }); if (!e.status) console.error(e); }
};

function newSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

function userStats(userId) {
  const { from, to } = currentPeriod();
  const total = db.prepare('SELECT COUNT(*) c FROM wins WHERE user_id = ?').get(userId).c;
  const current = db.prepare('SELECT COUNT(*) c FROM wins WHERE user_id = ? AND date(created_at) >= ? AND date(created_at) < ?').get(userId, from, to).c;
  const purchases = db.prepare('SELECT COUNT(*) c FROM orders WHERE user_id = ?').get(userId).c;
  return { total, current, past: total - current, purchases };
}
function leaderboard(limit = 50) {
  const { from, to } = currentPeriod();
  return db.prepare(`SELECT u.id, u.name, COUNT(w.id) spins FROM wins w JOIN users u ON u.id = w.user_id
    WHERE date(w.created_at) >= ? AND date(w.created_at) < ? GROUP BY u.id ORDER BY spins DESC, MIN(w.id) ASC LIMIT ?`)
    .all(from, to, limit)
    .map((r, i) => ({ place: i + 1, id: publicId(r.id), name: r.name, spins: r.spins, title: rankTitle(i + 1, r.spins) }));
}
function me(user) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const stats = userStats(u.id);
  const board = leaderboard(1000);
  const mine = board.find((r) => r.id === publicId(u.id));
  const d = dailyState(u);
  return {
    id: publicId(u.id), login: u.login, name: u.name, balance: u.balance, isAdmin: !!u.is_admin,
    stats, title: mine ? mine.title : 'новичок рулетки', place: mine?.place || null, period: currentPeriod(), daily: d,
  };
}
function dailyState(u) {
  const rewards = setting('daily_rewards').split(',').map(Number);
  const t = today();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const claimedToday = u.last_daily === t;
  let streak = u.streak;
  let missed = false;
  if (!claimedToday && u.last_daily !== yesterday) { if (u.last_daily) missed = true; streak = 0; }
  if (!claimedToday && streak >= rewards.length) streak = 0; // цикл из 7 дней начинается заново
  const day = claimedToday ? streak : streak + 1; // какой день «текущий»
  return { rewards, streak, day, claimedToday, missed };
}

// --- аккаунт ---
app.post('/api/register', wrap((req) => {
  const login = String(req.body.login || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim() || login;
  const pass = String(req.body.password || '');
  if (!/^[a-z0-9_.@+-]{3,40}$/.test(login)) throw new HttpError(400, 'Логин: 3–40 символов, латиница, цифры, _ . @ + -');
  if (pass.length < 6) throw new HttpError(400, 'Пароль должен быть не короче 6 символов');
  if (name.length > 40) throw new HttpError(400, 'Имя слишком длинное');
  if (db.prepare('SELECT 1 FROM users WHERE login = ?').get(login)) throw new HttpError(400, 'Такой логин уже занят');
  const salt = crypto.randomBytes(8).toString('hex');
  const start = Number(setting('start_balance'));
  const id = tx(() => {
    const r = db.prepare('INSERT INTO users (login, name, pass_hash, salt) VALUES (?,?,?,?)').run(login, name, hash(pass, salt), salt);
    const uid = Number(r.lastInsertRowid);
    if (start) addBalance(uid, start, 'приветственный бонус');
    return uid;
  });
  return { token: newSession(id) };
}));
app.post('/api/login', wrap((req) => {
  const login = String(req.body.login || '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
  if (!u || hash(String(req.body.password || ''), u.salt) !== u.pass_hash) throw new HttpError(400, 'Неверный логин или пароль');
  return { token: newSession(u.id) };
}));
app.post('/api/logout', auth, wrap((req) => { db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token); return { ok: true }; }));
app.get('/api/me', auth, wrap((req) => me(req.user)));
app.get('/api/config', wrap(() => ({ spinCost: Number(setting('spin_cost')), brand: setting('brand'), currency: setting('currency') })));

// --- рулетка ---
app.get('/api/prizes', wrap(() => db.prepare('SELECT id, title, subtitle, kind, value, icon, stock FROM prizes WHERE active = 1 ORDER BY id').all()));

app.post('/api/spin', auth, wrap((req) => {
  const cost = Number(setting('spin_cost'));
  const win = tx(() => {
    const u = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    if (u.balance < cost) throw new HttpError(400, `Не хватает ККоин: нужно ${cost}`);
    const pool = db.prepare('SELECT * FROM prizes WHERE active = 1 AND stock > 0 AND weight > 0').all();
    if (!pool.length) throw new HttpError(400, 'Призы закончились. Загляните позже!');
    const totalW = pool.reduce((s, p) => s + p.weight, 0);
    let r = crypto.randomInt(totalW);
    const prize = pool.find((p) => (r -= p.weight) < 0);
    // списываем остаток приза атомарно
    const upd = db.prepare('UPDATE prizes SET stock = stock - 1 WHERE id = ? AND stock > 0').run(prize.id);
    if (!upd.changes) throw new HttpError(409, 'Приз только что закончился, попробуйте ещё раз');
    addBalance(req.user.id, -cost, 'спин рулетки');
    let code = null, status = 'issued';
    if (prize.kind === 'bonus') addBalance(req.user.id, prize.value, 'выигрыш: ' + prize.title);
    if (prize.kind === 'promo') code = genCode('LIME' + prize.value);
    if (prize.kind === 'item') { code = genCode('GIFT'); status = 'pending'; }
    const w = db.prepare(`INSERT INTO wins (user_id, prize_id, title, subtitle, kind, value, icon, code, status, cost)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, prize.id, prize.title, prize.subtitle, prize.kind, prize.value, prize.icon, code, status, cost);
    return { id: Number(w.lastInsertRowid), prizeId: prize.id, title: prize.title, subtitle: prize.subtitle, kind: prize.kind, value: prize.value, icon: prize.icon, code, status };
  });
  return { win, me: me(req.user) };
}));

app.get('/api/history', auth, wrap((req) => ({
  wins: db.prepare('SELECT * FROM wins WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(req.user.id),
  orders: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(req.user.id),
  ledger: db.prepare('SELECT * FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(req.user.id),
})));

// --- награда за вход ---
app.post('/api/daily', auth, wrap((req) => {
  tx(() => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const d = dailyState(u);
    if (d.claimedToday) throw new HttpError(400, 'Сегодня награда уже получена');
    const reward = d.rewards[d.day - 1];
    db.prepare('UPDATE users SET streak = ?, last_daily = ? WHERE id = ?').run(d.day, today(), u.id);
    addBalance(u.id, reward, `награда за вход, день ${d.day}`);
  });
  return me(req.user);
}));

// --- задания ---
function taskProgress(userId, t) {
  if (t.type === 'spins') return db.prepare('SELECT COUNT(*) c FROM wins WHERE user_id = ?').get(userId).c;
  if (t.type === 'purchases') return db.prepare('SELECT COUNT(*) c FROM orders WHERE user_id = ?').get(userId).c;
  if (t.type === 'streak') return db.prepare('SELECT streak FROM users WHERE id = ?').get(userId).streak;
  return 0;
}
app.get('/api/tasks', auth, wrap((req) => db.prepare('SELECT * FROM tasks WHERE active = 1 ORDER BY id').all().map((t) => {
  const claim = db.prepare('SELECT status FROM task_claims WHERE user_id = ? AND task_id = ?').get(req.user.id, t.id);
  const progress = Math.min(t.target, taskProgress(req.user.id, t));
  const expired = t.deadline && today() > t.deadline;
  return { ...t, progress, claimed: claim?.status === 'claimed', requested: claim?.status === 'requested', expired,
    canClaim: !claim && !expired && t.type !== 'manual' && progress >= t.target };
})));
app.post('/api/tasks/:id/claim', auth, wrap((req) => {
  tx(() => {
    const t = db.prepare('SELECT * FROM tasks WHERE id = ? AND active = 1').get(req.params.id);
    if (!t) throw new HttpError(404, 'Задание не найдено');
    if (t.deadline && today() > t.deadline) throw new HttpError(400, 'Срок задания истёк');
    if (db.prepare('SELECT 1 FROM task_claims WHERE user_id = ? AND task_id = ?').get(req.user.id, t.id)) throw new HttpError(400, 'Уже отправлено');
    if (t.type === 'manual') {
      db.prepare("INSERT INTO task_claims (user_id, task_id, status) VALUES (?, ?, 'requested')").run(req.user.id, t.id);
      return;
    }
    if (taskProgress(req.user.id, t) < t.target) throw new HttpError(400, 'Задание ещё не выполнено');
    db.prepare('INSERT INTO task_claims (user_id, task_id) VALUES (?, ?)').run(req.user.id, t.id);
    addBalance(req.user.id, t.reward, 'задание: ' + t.title);
  });
  return me(req.user);
}));

// --- рейтинг ---
app.get('/api/leaderboard', wrap(() => ({ period: currentPeriod(), rows: leaderboard(50) })));

// --- магазин ---
app.get('/api/shop', wrap(() => db.prepare('SELECT * FROM shop_items WHERE active = 1 ORDER BY price').all()));
app.post('/api/shop/:id/buy', auth, wrap((req) => {
  const order = tx(() => {
    const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND active = 1').get(req.params.id);
    if (!item) throw new HttpError(404, 'Товар не найден');
    if (item.stock <= 0) throw new HttpError(400, 'Товар закончился');
    const u = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    if (u.balance < item.price) throw new HttpError(400, `Не хватает ККоин: нужно ${item.price}`);
    db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND stock > 0').run(item.id);
    addBalance(req.user.id, -item.price, 'покупка: ' + item.title);
    const code = genCode('SALE');
    const r = db.prepare('INSERT INTO orders (user_id, item_id, title, price, icon, code) VALUES (?,?,?,?,?,?)')
      .run(req.user.id, item.id, item.title, item.price, item.icon, code);
    return { id: Number(r.lastInsertRowid), title: item.title, code };
  });
  return { order, me: me(req.user) };
}));

// ---------- админка ----------
const A = express.Router();
A.use(auth, admin);
const TABLES = {
  prizes: ['title', 'subtitle', 'kind', 'value', 'icon', 'weight', 'stock', 'active'],
  shop_items: ['title', 'description', 'price', 'stock', 'icon', 'active'],
  tasks: ['title', 'description', 'type', 'target', 'reward', 'icon', 'deadline', 'active'],
};
for (const [table, cols] of Object.entries(TABLES)) {
  A.get(`/${table}`, wrap(() => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
  A.post(`/${table}`, wrap((req) => {
    const keys = cols.filter((c) => req.body[c] !== undefined);
    const r = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => req.body[k]));
    return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(r.lastInsertRowid);
  }));
  A.put(`/${table}/:id`, wrap((req) => {
    const keys = cols.filter((c) => req.body[c] !== undefined);
    if (keys.length) db.prepare(`UPDATE ${table} SET ${keys.map((k) => k + ' = ?').join(',')} WHERE id = ?`).run(...keys.map((k) => req.body[k]), req.params.id);
    return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
  }));
  A.delete(`/${table}/:id`, wrap((req) => { db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id); return { ok: true }; }));
}
A.get('/wins', wrap(() => db.prepare(`SELECT w.*, u.login, u.name, u.id uid FROM wins w JOIN users u ON u.id = w.user_id ORDER BY w.id DESC LIMIT 500`).all()
  .map((w) => ({ ...w, publicId: publicId(w.uid) }))));
A.put('/wins/:id', wrap((req) => { db.prepare('UPDATE wins SET status = ? WHERE id = ?').run(String(req.body.status), req.params.id); return { ok: true }; }));
A.get('/orders', wrap(() => db.prepare(`SELECT o.*, u.login, u.name, u.id uid FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 500`).all()
  .map((o) => ({ ...o, publicId: publicId(o.uid) }))));
A.put('/orders/:id', wrap((req) => { db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(String(req.body.status), req.params.id); return { ok: true }; }));
A.get('/users', wrap(() => db.prepare(`SELECT u.id, u.login, u.name, u.balance, u.is_admin, u.created_at,
  (SELECT COUNT(*) FROM wins w WHERE w.user_id = u.id) spins FROM users u ORDER BY u.id DESC`).all().map((u) => ({ ...u, publicId: publicId(u.id) }))));
A.post('/users/:id/balance', wrap((req) => {
  const amount = Math.trunc(Number(req.body.amount));
  if (!amount) throw new HttpError(400, 'Укажите сумму');
  tx(() => addBalance(Number(req.params.id), amount, String(req.body.reason || 'корректировка администратором')));
  return { ok: true };
}));
A.get('/task_requests', wrap(() => db.prepare(`SELECT c.user_id, c.task_id, c.created_at, t.title, t.reward, u.login, u.name
  FROM task_claims c JOIN tasks t ON t.id = c.task_id JOIN users u ON u.id = c.user_id WHERE c.status = 'requested' ORDER BY c.created_at`).all()
  .map((r) => ({ ...r, publicId: publicId(r.user_id) }))));
A.post('/task_requests/:uid/:tid', wrap((req) => {
  tx(() => {
    const c = db.prepare("SELECT * FROM task_claims WHERE user_id = ? AND task_id = ? AND status = 'requested'").get(req.params.uid, req.params.tid);
    if (!c) throw new HttpError(404, 'Заявка не найдена');
    if (req.body.approve) {
      const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(c.task_id);
      db.prepare("UPDATE task_claims SET status = 'claimed' WHERE user_id = ? AND task_id = ?").run(c.user_id, c.task_id);
      addBalance(c.user_id, t.reward, 'задание: ' + t.title);
    } else {
      db.prepare('DELETE FROM task_claims WHERE user_id = ? AND task_id = ?').run(c.user_id, c.task_id);
    }
  });
  return { ok: true };
}));
A.get('/settings', wrap(() => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]))));
A.put('/settings', wrap((req) => {
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (req.body[k] !== undefined) db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(req.body[k]), k);
  return { ok: true };
}));
A.get('/stats', wrap(() => ({
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  spins: db.prepare('SELECT COUNT(*) c FROM wins').get().c,
  orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
  pendingWins: db.prepare("SELECT COUNT(*) c FROM wins WHERE status = 'pending'").get().c,
  pendingOrders: db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").get().c,
})));
app.use('/api/admin', A);

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Клаб рулетка: http://localhost:${PORT}`));
