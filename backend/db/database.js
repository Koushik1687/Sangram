/* ==========================================================================
   db/database.js — SQLite initialisation using Node.js built-in sqlite module
   (available in Node >= 22.5.0 / Node 24).
   ========================================================================== */

import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.join(import.meta.dirname, '..', 'srisangram.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema();
    seedData();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      parent_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT,
      excerpt TEXT,
      content TEXT,
      featured_image TEXT,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chambers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      consultation_days TEXT,
      timing TEXT,
      phone TEXT,
      map_url TEXT
    );

    CREATE TABLE IF NOT EXISTS horoscope_custom (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zodiac_sign TEXT NOT NULL,
      reading_date TEXT NOT NULL,
      message TEXT,
      lucky_color TEXT,
      lucky_number TEXT,
      mood TEXT,
      UNIQUE(zodiac_sign, reading_date)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      service TEXT NOT NULL,
      chamber_id INTEGER,
      booking_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chamber_id) REFERENCES chambers(id)
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      role_location TEXT,
      rating INTEGER,
      message TEXT,
      is_approved INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT,
      image_url TEXT NOT NULL,
      category TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      is_read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_order_id TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      booking_id INTEGER,
      product_id INTEGER,
      order_id INTEGER,
      phonepe_transaction_id TEXT,
      response_code TEXT,
      redirect_url TEXT,
      raw_response TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percent',
      discount_value REAL NOT NULL,
      min_order_amount REAL DEFAULT 0,
      max_discount REAL,
      valid_until TEXT,
      usage_limit INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: older databases may lack the payments.order_id column.
  const paymentCols = db.prepare(`PRAGMA table_info(payments)`).all().map((c) => c.name)
  if (!paymentCols.includes('order_id')) {
    db.exec(`ALTER TABLE payments ADD COLUMN order_id INTEGER`)
  }

  // Migration: orders may lack the updated_at column used by the paid-state flow.
  const orderCols = db.prepare(`PRAGMA table_info(orders)`).all().map((c) => c.name)
  if (!orderCols.includes('updated_at')) {
    db.exec(`ALTER TABLE orders ADD COLUMN updated_at TEXT`)
  }

  // Migration: orders may lack the coupon fields used by the discount flow.
  if (!orderCols.includes('discount')) {
    db.exec(`ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0`)
  }
  if (!orderCols.includes('coupon_code')) {
    db.exec(`ALTER TABLE orders ADD COLUMN coupon_code TEXT`)
  }

  // Migration: orders may lack the shipping fee applied at checkout.
  if (!orderCols.includes('shipping_fee')) {
    db.exec(`ALTER TABLE orders ADD COLUMN shipping_fee REAL DEFAULT 0`)
  }

  // Migration: users may lack the client-profile fields used by the account page.
  const userCols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name)
  if (!userCols.includes('photo_url')) {
    db.exec(`ALTER TABLE users ADD COLUMN photo_url TEXT`)
  }
  if (!userCols.includes('age')) {
    db.exec(`ALTER TABLE users ADD COLUMN age INTEGER`)
  }
  if (!userCols.includes('zodiac_sign')) {
    db.exec(`ALTER TABLE users ADD COLUMN zodiac_sign TEXT`)
  }

  // Migration: products may lack the stock field (NULL = unlimited stock).
  const productCols = db.prepare(`PRAGMA table_info(products)`).all().map((c) => c.name)
  if (!productCols.includes('stock')) {
    db.exec(`ALTER TABLE products ADD COLUMN stock INTEGER`)
  }
  if (!productCols.includes('low_stock_threshold')) {
    db.exec(`ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER`)
  }
  if (!productCols.includes('low_stock_alerted')) {
    db.exec(`ALTER TABLE products ADD COLUMN low_stock_alerted INTEGER DEFAULT 0`)
  }
}

function seedData() {
  // Admin user
  const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
  }

  // Seed the shop taxonomy (top-level categories) on first run
  const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n
  if (catCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name) VALUES (?)')
    for (const name of ['Crystals', 'Vastu Items', 'Aura Cleansing Salt', 'Gemstones']) insertCat.run(name)
  }

  // Re-categorise legacy products into the shop taxonomy so the filters work
  db.prepare("UPDATE products SET category='Gemstones' WHERE category IN ('Gemstone','Gem stone')").run()
  db.prepare("UPDATE products SET category='Vastu Items' WHERE category IN ('Vastu','Yantra')").run()
  db.prepare("UPDATE products SET category='Crystals' WHERE category IN ('Spiritual','Crystal')").run()
  db.prepare("UPDATE products SET category='Aura Cleansing Salt' WHERE category IN ('Salt','Aura Salt')").run()

  // Shop catalogue — one row per product across the four filter categories
  const CATALOGUE = [
    // Gemstones
    ['Blue Sapphire', 'Gemstones', 4500, 'Certified Saturn gemstone set in a silver ring, weighing 5 ratti.'],
    ['Yellow Sapphire', 'Gemstones', 5200, 'Certified Jupiter gemstone set in a gold ring for prosperity and growth.'],
    ['Red Coral', 'Gemstones', 3900, 'Authentic Mars gemstone, ideal for courage, energy and leadership.'],
    ['Emerald (Panna)', 'Gemstones', 6500, 'Certified Mercury gemstone known for intelligence, speech and business growth.'],
    ['Pearl (Moti)', 'Gemstones', 2800, 'Genuine Moon gemstone that calms the mind and strengthens relationships.'],
    ['Gomed (Hessonite)', 'Gemstones', 2200, 'Rahu gemstone recommended for clarity of thought and career breakthroughs.'],
    // Crystals
    ['Rose Quartz Heart', 'Crystals', 750, 'A crystal of unconditional love that opens the heart and soothes emotions.'],
    ['Clear Quartz Point', 'Crystals', 850, 'The master healer — amplifies energy, focus and spiritual clarity.'],
    ['Amethyst Cluster', 'Crystals', 1400, 'A calming crystal that protects against negativity and aids meditation.'],
    ['Citrine Crystal', 'Crystals', 1200, 'The abundance stone — attracts prosperity, success and positivity.'],
    ['Black Tourmaline', 'Crystals', 950, 'A powerful grounding stone that repels negative energy and EMF.'],
    ['5 Mukhi Rudraksha Mala', 'Crystals', 950, 'Authentic Nepali rudraksha mala with 108 beads, sanctified and ready for prayer.'],
    // Vastu Items
    ['Vastu Compass Set', 'Vastu Items', 650, 'Premium directional guide for accurate home and workplace alignment.'],
    ['Sri Yantra', 'Vastu Items', 1800, 'An octagonal Sri Yantra designed to attract wealth and abundance.'],
    ['Brass Vastu Tortoise', 'Vastu Items', 1100, 'Symbol of stability and protection — place facing north-east for growth.'],
    ['Copper Vastu Pyramid', 'Vastu Items', 900, 'Harmonises the energy field of your home and neutralises negative zones.'],
    // Aura Cleansing Salt
    ['Himalayan Salt Lamp', 'Aura Cleansing Salt', 1600, 'Purifies the air and fills your space with a warm, calming glow.'],
    ['Aura Cleansing Bath Salt', 'Aura Cleansing Salt', 499, 'Himalayan mineral bath salt that clears energetic residue after a long day.'],
    ['Black Salt Cleansing Kit', 'Aura Cleansing Salt', 799, 'Traditional kit with black salt and instructions for space purification.'],
    ['Sea Salt Aura Spray', 'Aura Cleansing Salt', 599, 'A refreshing mist of sea salt and essential oils to cleanse your aura on the go.'],
  ]

  const insert = db.prepare('INSERT INTO products (name, category, price, description) VALUES (?, ?, ?, ?)')
  const existingNames = new Set(db.prepare('SELECT name FROM products').all().map((r) => r.name))
  for (const [name, category, price, desc] of CATALOGUE) {
    if (!existingNames.has(name)) insert.run(name, category, price, desc)
  }

  // Personal Kundali Report is a service, not a physical item — remove from shop
  db.prepare("DELETE FROM products WHERE name='Personal Kundali Report'").run()

  // Demo coupon so the discount flow can be tried immediately
  const couponExists = db.prepare('SELECT id FROM coupons WHERE code = ?').get('WELCOME10')
  if (!couponExists) {
    db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, valid_until, usage_limit)
      VALUES ('WELCOME10', 'percent', 10, 500, 500, '2027-12-31', 0)
    `).run()
  }

  // Blogs
  const { c: blogCount } = db.prepare('SELECT COUNT(*) as c FROM blogs').get();
  if (blogCount === 0) {
    const insert = db.prepare('INSERT INTO blogs (title, category, excerpt, published_at) VALUES (?, ?, ?, ?)');
    [
      ['Saturn Sade Sati: Fear is not the answer, preparation is', 'Astrology', "A practical guide to common myths and remedies related to Saturn's sade sati cycle.", '2026-07-18'],
      ['The real impact of Rahu and Ketu in kundali', 'Kundli', 'An in-depth explanation of how Rahu and Ketu influence key life areas.', '2026-07-05'],
      ['Why planetary matching matters in marriage', 'Marriage', 'A thoughtful discussion on Ashtakoot matching and its relevance in modern life.', '2026-06-22'],
    ].forEach(b => insert.run(...b));
  }

  // Chambers
  const { c: chamberCount } = db.prepare('SELECT COUNT(*) as c FROM chambers').get();
  if (chamberCount === 0) {
    const insert = db.prepare('INSERT INTO chambers (name, address, consultation_days, timing, phone) VALUES (?, ?, ?, ?, ?)');
    [
      ['Kolkata Main Chamber', 'Gariahat Road, Kolkata - 700019', 'Mon – Sat', '11:00 AM – 7:00 PM', '+91 98300 00000'],
      ['Salt Lake Chamber', 'Sector 5, Salt Lake, Kolkata - 700091', 'Tue, Thu, Sat', '12:00 PM – 6:00 PM', '+91 98300 11111'],
      ['Howrah Chamber', 'GT Road, Howrah - 711101', 'Wed, Sun', '10:00 AM – 2:00 PM', '+91 98300 22222'],
    ].forEach(c => insert.run(...c));
  }

  // Testimonials
  const { c: testiCount } = db.prepare('SELECT COUNT(*) as c FROM testimonials').get();
  if (testiCount === 0) {
    const insert = db.prepare('INSERT INTO testimonials (client_name, role_location, rating, message) VALUES (?, ?, ?, ?)');
    [
      ['Sumita Banerjee', 'Kolkata', 5, 'The guidance from Sri Sangram brought a remarkable shift in my career. The analysis was precise, thoughtful, and deeply reassuring.'],
      ['Arijit Das', 'Durgapur', 5, 'The kundali analysis was extremely detailed and accurate, and each prediction matched reality. I am deeply grateful.'],
      ['Piyali Sengupta', 'Siliguri', 5, 'I came for marriage guidance, and the insight and suggestions helped our family find direction and peace.'],
    ].forEach(t => insert.run(...t));
  }

  // Gallery
  const { c: galleryCount } = db.prepare('SELECT COUNT(*) as c FROM gallery').get();
  if (galleryCount === 0) {
    const insert = db.prepare('INSERT INTO gallery (label, image_url, category) VALUES (?, ?, ?)');
    [
      ['Seminar 2026', '/uploads/placeholder.jpg', 'Events'],
      ['Temple Visit', '/uploads/placeholder.jpg', 'Events'],
      ['Client Session', '/uploads/placeholder.jpg', 'Work'],
      ['Certificate', '/uploads/placeholder.jpg', 'Awards'],
      ['Workshop', '/uploads/placeholder.jpg', 'Events'],
      ['Award Ceremony', '/uploads/placeholder.jpg', 'Awards'],
      ['Media Interview', '/uploads/placeholder.jpg', 'Media'],
      ['Annual Puja', '/uploads/placeholder.jpg', 'Events'],
    ].forEach(g => insert.run(...g));
  }
}

export { getDb };
