/* ==========================================================================
   db/database.js — Postgres (Neon) initialisation using @neondatabase/serverless.
   The app reads its connection string from DATABASE_URL (e.g. the connection
   string shown in the Neon dashboard: postgresql://user:pass@ep-...neon.tech/...).
   ========================================================================== */

import { Pool } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

let pool

/* Resolve the Neon connection string. Vercel injects the Neon integration vars
   under several naming conventions — unprefixed (DATABASE_URL, POSTGRES_URL)
   when set manually, or prefixed with the project slug (e.g.
   sangram_DATABASE_URL, sangram_POSTGRES_URL) when created by the storage
   integration. A suffix scan accepts any of them, so the app connects no
   matter which naming convention the hosting environment uses. */
function resolveConnectionString() {
  const suffixes = [
    'DATABASE_URL',
    'POSTGRES_URL',
    'DATABASE_URL_UNPOOLED',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_PRISMA_URL',
  ]
  for (const suffix of suffixes) {
    for (const key of Object.keys(process.env)) {
      if (key === suffix || key.endsWith(`_${suffix}`)) {
        const v = process.env[key]
        if (v && typeof v === 'string' && v.trim() !== '') return v
      }
    }
  }
  return undefined
}

function getPool() {
  if (!pool) {
    const connectionString = resolveConnectionString()
    if (!connectionString) {
      throw new Error(
        'No Neon connection string found. Set one of DATABASE_URL, POSTGRES_URL, ' +
        'DATABASE_URL_UNPOOLED or POSTGRES_URL_NON_POOLING in the environment ' +
        '(backend/.env locally, Vercel → Settings → Environment Variables in production), e.g.\n' +
        'DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require',
      )
    }
    // connectionTimeoutMillis: pg defaults to 0 = wait forever. On a serverless
    // runtime a hung TCP/WebSocket connect would block the function until the
    // platform kills it, so fail fast and let initDb() retry on the next call.
    pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10000 })
  }
  return pool
}

/* Convert SQLite-style ? placeholders to Postgres $1, $2, ... */
function toPg(sql, params = []) {
  let i = 0
  const text = String(sql).replace(/\?/g, () => `$${++i}`)
  return { text, values: params }
}

/** Run a SELECT and return all rows. */
export async function query(sql, params) {
  const { text, values } = toPg(sql, params)
  const res = await getPool().query(text, values)
  return res.rows
}

/** Run a SELECT and return the first row (or null). */
export async function get(sql, params) {
  const rows = await query(sql, params)
  return rows[0] ?? null
}

/**
 * Run an INSERT/UPDATE/DELETE. Mirrors the old SQLite run() contract:
 * returns { changes, lastInsertRowid } — lastInsertRowid comes from
 * appending RETURNING id to INSERT statements.
 */
export async function run(sql, params) {
  const isInsert = /^\s*INSERT\s/i.test(sql)
  const { text, values } = toPg(isInsert ? `${sql} RETURNING id` : sql, params)
  const res = await getPool().query(text, values)
  return { changes: res.rowCount ?? 0, lastInsertRowid: res.rows?.[0]?.id ?? null }
}

/** Run a multi-statement DDL string (no parameters). */
async function exec(sql) {
  await getPool().query(sql)
}

let initPromise

/** Create the pool, build the schema and seed demo data. Safe to call multiple times.
 *  On failure the promise is reset so a later call can retry — this keeps a
 *  serverless function from being permanently wedged by a transient DB error. */
export function initDb() {
  if (!initPromise) {
    initPromise = (async () => {
      getPool() // throws a helpful error when DATABASE_URL is missing
      await initSchema()
      await seedData()
    })().catch((err) => {
      initPromise = null // allow a retry on the next call
      throw err
    })
  }
  return initPromise
}

async function initSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      parent_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT,
      excerpt TEXT,
      content TEXT,
      featured_image TEXT,
      published_at TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chambers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      consultation_days TEXT,
      timing TEXT,
      phone TEXT,
      map_url TEXT
    );

    CREATE TABLE IF NOT EXISTS horoscope_custom (
      id SERIAL PRIMARY KEY,
      zodiac_sign TEXT NOT NULL,
      reading_date TEXT NOT NULL,
      message TEXT,
      lucky_color TEXT,
      lucky_number TEXT,
      mood TEXT,
      UNIQUE(zodiac_sign, reading_date)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      client_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      service TEXT NOT NULL,
      chamber_id INTEGER,
      booking_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (chamber_id) REFERENCES chambers(id)
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id SERIAL PRIMARY KEY,
      client_name TEXT NOT NULL,
      role_location TEXT,
      rating INTEGER,
      message TEXT,
      is_approved INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id SERIAL PRIMARY KEY,
      label TEXT,
      image_url TEXT NOT NULL,
      category TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      is_read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      verify_token TEXT,
      used INTEGER DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'PENDING',
      address TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percent',
      discount_value REAL NOT NULL,
      min_order_amount REAL DEFAULT 0,
      max_discount REAL,
      valid_until TEXT,
      usage_limit INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  /* Migrations for databases created before a column existed (no-ops on fresh
     DBs). Kept as a single multi-statement exec — on serverless this whole
     init runs once per cold instance, and every extra round-trip to a cold
     Neon connection adds ~100-300ms of latency. */
  await exec(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id INTEGER;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount REAL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee REAL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS zodiac_sign TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_alerted INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data BYTEA;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_mime TEXT;
    ALTER TABLE gallery ADD COLUMN IF NOT EXISTS image_data BYTEA;
    ALTER TABLE gallery ADD COLUMN IF NOT EXISTS image_mime TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_data BYTEA;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_mime TEXT;
  `)
}

async function seedData() {
  // ---- Admin access --------------------------------------------------------
  // No default admin is ever created — there is no admin/admin123 backdoor.
  // 1. Delete any admin whose password is still the old default 'admin123'
  //    (covers databases seeded before this change, including production).
  // 2. If ADMIN_INITIAL_PASSWORD is set, create/update the admin account with
  //    that password so the owner can sign in right after deployment. Without
  //    it the site simply has no admin until one is created via the script
  //    (npm run create:admin) or this env var.
  const admins = await query('SELECT * FROM admins')
  for (const a of admins) {
    if (bcrypt.compareSync('admin123', a.password_hash)) {
      await run('DELETE FROM admins WHERE id = ?', [a.id])
      console.warn(`[seed] Removed admin "${a.username}" — the default password 'admin123' is no longer allowed`)
    }
  }

  const initialUser = process.env.ADMIN_INITIAL_USERNAME || 'admin'
  const initialPass = process.env.ADMIN_INITIAL_PASSWORD
  if (initialPass) {
    if (initialPass.length < 8) {
      console.warn('[seed] ADMIN_INITIAL_PASSWORD ignored — must be at least 8 characters')
    } else {
      const hash = bcrypt.hashSync(initialPass, 10)
      const existing = await get('SELECT id FROM admins WHERE username = ?', [initialUser])
      if (existing) {
        await run('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, existing.id])
        console.log(`[seed] Updated admin "${initialUser}" password from ADMIN_INITIAL_PASSWORD`)
      } else {
        await run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [initialUser, hash])
        console.log(`[seed] Created admin "${initialUser}" from ADMIN_INITIAL_PASSWORD`)
      }
    }
  }

  const adminCount = Number((await get('SELECT COUNT(*) AS n FROM admins')).n)
  if (adminCount === 0) {
    console.warn('[seed] No admin accounts exist. Set ADMIN_INITIAL_PASSWORD or run `npm run create:admin` to create one.')
  }

  /* Static demo content below is idempotent and only needs to run once per
     database. A marker row lets every later cold start skip the ~12 count
     checks — on serverless this seed runs once per function instance, so it
     is a big chunk of the first-request latency. */
  if (await get(`SELECT value FROM app_meta WHERE key='seeded'`)) {
    console.log('[seed] Database already seeded — skipping demo content')
    return
  }

  // Seed the shop taxonomy (top-level categories) on first run
  const catCount = Number((await get('SELECT COUNT(*) AS n FROM categories')).n)
  if (catCount === 0) {
    for (const name of ['Crystals', 'Vastu Items', 'Aura Cleansing Salt', 'Gemstones']) {
      await run('INSERT INTO categories (name) VALUES (?)', [name])
    }
  }

  // Re-categorise legacy products into the shop taxonomy so the filters work
  await run("UPDATE products SET category='Gemstones' WHERE category IN ('Gemstone','Gem stone')")
  await run("UPDATE products SET category='Vastu Items' WHERE category IN ('Vastu','Yantra')")
  await run("UPDATE products SET category='Crystals' WHERE category IN ('Spiritual','Crystal')")
  await run("UPDATE products SET category='Aura Cleansing Salt' WHERE category IN ('Salt','Aura Salt')")

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

  const existingNames = new Set((await query('SELECT name FROM products')).map((r) => r.name))
  for (const [name, category, price, desc] of CATALOGUE) {
    if (!existingNames.has(name)) {
      await run('INSERT INTO products (name, category, price, description) VALUES (?, ?, ?, ?)', [name, category, price, desc])
    }
  }

  // Personal Kundali Report is a service, not a physical item — remove from shop
  await run("DELETE FROM products WHERE name='Personal Kundali Report'")

  // Demo coupon so the discount flow can be tried immediately
  const couponExists = await get('SELECT id FROM coupons WHERE code = ?', ['WELCOME10'])
  if (!couponExists) {
    await run(`
      INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, valid_until, usage_limit)
      VALUES ('WELCOME10', 'percent', 10, 500, 500, '2027-12-31', 0)
    `)
  }

  // Blogs
  const blogCount = Number((await get('SELECT COUNT(*) AS c FROM blogs')).c)
  if (blogCount === 0) {
    const insert = (title, category, excerpt, published_at) =>
      run('INSERT INTO blogs (title, category, excerpt, published_at) VALUES (?, ?, ?, ?)', [title, category, excerpt, published_at])
    await insert('Saturn Sade Sati: Fear is not the answer, preparation is', 'Astrology', "A practical guide to common myths and remedies related to Saturn's sade sati cycle.", '2026-07-18')
    await insert('The real impact of Rahu and Ketu in kundali', 'Kundli', 'An in-depth explanation of how Rahu and Ketu influence key life areas.', '2026-07-05')
    await insert('Why planetary matching matters in marriage', 'Marriage', 'A thoughtful discussion on Ashtakoot matching and its relevance in modern life.', '2026-06-22')
  }

  // Chambers
  const chamberCount = Number((await get('SELECT COUNT(*) AS c FROM chambers')).c)
  if (chamberCount === 0) {
    const insert = (name, address, consultation_days, timing, phone) =>
      run('INSERT INTO chambers (name, address, consultation_days, timing, phone) VALUES (?, ?, ?, ?, ?)', [name, address, consultation_days, timing, phone])
    await insert('Kolkata Main Chamber', 'Gariahat Road, Kolkata - 700019', 'Mon – Sat', '11:00 AM – 7:00 PM', '+91 98300 00000')
    await insert('Salt Lake Chamber', 'Sector 5, Salt Lake, Kolkata - 700091', 'Tue, Thu, Sat', '12:00 PM – 6:00 PM', '+91 98300 11111')
    await insert('Howrah Chamber', 'GT Road, Howrah - 711101', 'Wed, Sun', '10:00 AM – 2:00 PM', '+91 98300 22222')
  }

  // Testimonials
  const testiCount = Number((await get('SELECT COUNT(*) AS c FROM testimonials')).c)
  if (testiCount === 0) {
    const insert = (client_name, role_location, rating, message) =>
      run('INSERT INTO testimonials (client_name, role_location, rating, message) VALUES (?, ?, ?, ?)', [client_name, role_location, rating, message])
    await insert('Sumita Banerjee', 'Kolkata', 5, 'The guidance from Sri Sangram brought a remarkable shift in my career. The analysis was precise, thoughtful, and deeply reassuring.')
    await insert('Arijit Das', 'Durgapur', 5, 'The kundali analysis was extremely detailed and accurate, and each prediction matched reality. I am deeply grateful.')
    await insert('Piyali Sengupta', 'Siliguri', 5, 'I came for marriage guidance, and the insight and suggestions helped our family find direction and peace.')
  }

  // Gallery
  const galleryCount = Number((await get('SELECT COUNT(*) AS c FROM gallery')).c)
  if (galleryCount === 0) {
    const insert = (label, image_url, category) =>
      run('INSERT INTO gallery (label, image_url, category) VALUES (?, ?, ?)', [label, image_url, category])
    await insert('Seminar 2026', '/uploads/placeholder.jpg', 'Events')
    await insert('Temple Visit', '/uploads/placeholder.jpg', 'Events')
    await insert('Client Session', '/uploads/placeholder.jpg', 'Work')
    await insert('Certificate', '/uploads/placeholder.jpg', 'Awards')
    await insert('Workshop', '/uploads/placeholder.jpg', 'Events')
    await insert('Award Ceremony', '/uploads/placeholder.jpg', 'Awards')
    await insert('Media Interview', '/uploads/placeholder.jpg', 'Media')
    await insert('Annual Puja', '/uploads/placeholder.jpg', 'Events')
  }

  // query(), not run() — run() appends RETURNING id, but app_meta's primary key is `key`.
  await query(`INSERT INTO app_meta (key, value) VALUES ('seeded', '1') ON CONFLICT (key) DO NOTHING`)
  console.log('[seed] Demo content seeded')
}
