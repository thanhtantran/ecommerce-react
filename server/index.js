const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { db, initDb } = require('./sqlite');

const APP_PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';

initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// AUTH
app.post('/api/auth/signup', (req, res) => {
  const { email, password, fullname } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  const hash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  const result = db.prepare('INSERT INTO users (email, password_hash, fullname, role, date_joined, avatar, banner, address, mobile) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(email, hash, fullname || 'User', 'USER', now, '/static/profile.jpg', '/static/profile.jpg', '', '{}');
  const id = result.lastInsertRowid.toString();
  db.prepare('INSERT INTO baskets (user_id, basket) VALUES (?, ?)').run(id, '[]');

  const token = signToken({ uid: id, email, role: 'USER' });
  return res.json({ token, user: { uid: id, email, role: 'USER', providerData: [{ providerId: 'password' }], metadata: { creationTime: now } } });
});

app.post('/api/auth/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(400).json({ message: 'Invalid email or password' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(400).json({ message: 'Invalid email or password' });
  const token = signToken({ uid: String(user.id), email: user.email, role: user.role });
  return res.json({ token, user: { uid: String(user.id), email: user.email, role: user.role, providerData: [{ providerId: 'password' }], metadata: { creationTime: user.date_joined } } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { uid } = req.user;
  const user = db.prepare('SELECT id, email, role, fullname, avatar, banner, address, mobile, date_joined FROM users WHERE id = ?').get(uid);
  if (!user) return res.status(404).json({ message: 'Not found' });
  return res.json({ user: { ...user, uid: String(user.id) } });
});

// USERS
app.get('/api/users/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const profile = db.prepare('SELECT email, role, fullname, avatar, banner, address, mobile, date_joined FROM users WHERE id = ?').get(id);
  if (!profile) return res.status(404).json({ message: 'Not found' });
  const basket = db.prepare('SELECT basket FROM baskets WHERE user_id = ?').get(id);
  return res.json({ profile: { ...profile, basket: JSON.parse(basket?.basket || '[]') } });
});

app.put('/api/users/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const { fullname, avatar, banner, address, mobile } = req.body;
  db.prepare('UPDATE users SET fullname = ?, avatar = ?, banner = ?, address = ?, mobile = ? WHERE id = ?')
    .run(fullname || '', avatar || '/static/profile.jpg', banner || '/static/profile.jpg', address || '', JSON.stringify(mobile || {}), id);
  return res.json({ ok: true });
});

app.put('/api/users/:id/basket', authMiddleware, (req, res) => {
  const id = req.params.id;
  const { basket } = req.body;
  db.prepare('UPDATE baskets SET basket = ? WHERE user_id = ?').run(JSON.stringify(basket || []), id);
  return res.json({ ok: true });
});

// PRODUCTS
app.get('/api/products', (req, res) => {
  const offset = parseInt(req.query.offset || '0', 10);
  const pageSize = parseInt(req.query.limit || '12', 10);
  const items = db.prepare('SELECT * FROM products ORDER BY id LIMIT ? OFFSET ?').all(pageSize, offset);
  const totalRow = db.prepare('SELECT COUNT(1) as c FROM products').get();
  return res.json({ products: items.map((p) => ({ ...p, imageCollection: JSON.parse(p.image_collection || '[]') })), lastKey: (offset + pageSize) < totalRow.c ? (offset + pageSize) : null, total: totalRow.c });
});

app.get('/api/products/featured', (req, res) => {
  const limit = parseInt(req.query.limit || '12', 10);
  const items = db.prepare('SELECT * FROM products WHERE is_featured = 1 ORDER BY date_added DESC LIMIT ?').all(limit);
  return res.json({ products: items.map((p) => ({ ...p, imageCollection: JSON.parse(p.image_collection || '[]') })) });
});

app.get('/api/products/recommended', (req, res) => {
  const limit = parseInt(req.query.limit || '12', 10);
  const items = db.prepare('SELECT * FROM products ORDER BY date_added DESC LIMIT ?').all(limit);
  return res.json({ products: items.map((p) => ({ ...p, imageCollection: JSON.parse(p.image_collection || '[]') })) });
});

app.get('/api/products/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const limit = parseInt(req.query.limit || '12', 10);
  const items = db.prepare('SELECT * FROM products WHERE name_lower LIKE ? ORDER BY name_lower LIMIT ?').all(`%${q}%`, limit);
  return res.json({ products: items.map((p) => ({ ...p, imageCollection: JSON.parse(p.image_collection || '[]') })) });
});

app.get('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) return res.status(404).json({ message: 'Not found' });
  return res.json({ product: { ...p, imageCollection: JSON.parse(p.image_collection || '[]') } });
});

app.post('/api/products', authMiddleware, (req, res) => {
  const p = req.body;
  const now = Date.now();
  const result = db.prepare('INSERT INTO products (name, name_lower, brand, price, max_quantity, description, is_featured, quantity, image, image_collection, date_added) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(p.name, (p.name || '').toLowerCase(), p.brand || '', p.price || 0, p.maxQuantity || 0, p.description || '', p.isFeatured ? 1 : 0, p.quantity || 0, p.image || '', JSON.stringify(p.imageCollection || []), now);
  return res.json({ id: String(result.lastInsertRowid) });
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  const p = req.body;
  db.prepare('UPDATE products SET name = ?, name_lower = ?, brand = ?, price = ?, max_quantity = ?, description = ?, is_featured = ?, quantity = ?, image = ?, image_collection = ? WHERE id = ?')
    .run(p.name, (p.name || '').toLowerCase(), p.brand || '', p.price || 0, p.maxQuantity || 0, p.description || '', p.isFeatured ? 1 : 0, p.quantity || 0, p.image || '', JSON.stringify(p.imageCollection || []), id);
  return res.json({ ok: true });
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return res.json({ ok: true });
});

// ORDERS
app.post('/api/orders', authMiddleware, (req, res) => {
  const { userId, items, amount, shipping, payment } = req.body;
  const now = Date.now();
  const result = db.prepare('INSERT INTO orders (user_id, items, amount, shipping, payment, date_created) VALUES (?,?,?,?,?,?)')
    .run(userId, JSON.stringify(items || []), amount || 0, JSON.stringify(shipping || {}), JSON.stringify(payment || {}), now);
  return res.json({ id: String(result.lastInsertRowid) });
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const userId = req.query.userId;
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY date_created DESC').all(userId);
  return res.json({ orders: rows.map((r) => ({ ...r, items: JSON.parse(r.items || '[]'), shipping: JSON.parse(r.shipping || '{}'), payment: JSON.parse(r.payment || '{}') })) });
});

app.listen(APP_PORT, () => {
  console.log(`API server running at http://localhost:${APP_PORT}`);
});


