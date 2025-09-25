const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server', 'data.sqlite');
const db = new Database(dbPath);

function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      fullname TEXT,
      role TEXT,
      avatar TEXT,
      banner TEXT,
      address TEXT,
      mobile TEXT,
      date_joined INTEGER
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      name_lower TEXT,
      brand TEXT,
      price REAL,
      max_quantity INTEGER,
      description TEXT,
      is_featured INTEGER,
      quantity INTEGER,
      image TEXT,
      image_collection TEXT,
      date_added INTEGER
    );
    CREATE TABLE IF NOT EXISTS baskets (
      user_id INTEGER PRIMARY KEY,
      basket TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      items TEXT,
      amount REAL,
      shipping TEXT,
      payment TEXT,
      date_created INTEGER
    );
  `);

  // Seed products if empty
  const count = db.prepare('SELECT COUNT(1) as c FROM products').get().c;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO products (name, name_lower, brand, price, max_quantity, description, is_featured, quantity, image, image_collection, date_added) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    for (let i = 1; i <= 24; i += 1) {
      const idx = ((i % 9) + 1);
      insert.run(`Sample Product ${i}`, `sample product ${i}`, 'Sample Brand', 10 + i, 10, 'Local demo product', i % 5 === 0 ? 1 : 0, 50, `/static/salt-image-${idx}.png`, '[]', Date.now() - i * 1000 * 60 * 60);
    }
  }
}

module.exports = { db, initDb };


