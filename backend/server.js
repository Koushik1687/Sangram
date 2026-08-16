/* ==========================================================================
   server.js — Sree Sangram Hono backend entry point
   ========================================================================== */
import 'dotenv/config'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { handle } from '@hono/node-server/vercel'
import { swaggerUI } from '@hono/swagger-ui'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createApp } from './routes/schemas.js'
import { initDb } from './db/database.js'

import authRoutes from './routes/auth.js'
import categoryRoutes from './routes/categories.js'
import productRoutes from './routes/products.js'
import blogRoutes from './routes/blogs.js'
import chamberRoutes from './routes/chambers.js'
import horoscopeRoutes from './routes/horoscope.js'
import bookingRoutes from './routes/bookings.js'
import testimonialRoutes from './routes/testimonials.js'
import galleryRoutes from './routes/gallery.js'
import enquiryRoutes from './routes/enquiries.js'
import paymentRoutes from './routes/payments.js'
import userRoutes from './routes/users.js'
import orderRoutes from './routes/orders.js'
import couponRoutes from './routes/coupons.js'
import notificationRoutes from './routes/notifications.js'
import shippingRoutes from './routes/shipping.js'
import imageRoutes from './routes/images.js'
import { runDailyDigest, yesterdayStr } from './services/salesDigest.js'

const app = createApp()
const PORT = process.env.PORT || 3001

// --- Middleware ---

/* Postgres (Neon) is initialised lazily — never at module load. On Vercel
   (serverless/Fluid) the runtime waits on any I/O started while the module
   loads, so opening the Neon WebSocket there hung every /api call forever.
   initDb() is also non-fatal and retryable: a DB failure returns a fast 503
   and the next request tries again (see db/database.js). */
app.use('/api/*', async (c, next) => {
  const p = c.req.path
  if (p === '/api/health' || p === '/api/spec' || p === '/api/docs') return next()
  try {
    await initDb()
  } catch (err) {
    console.error('⚠️  Database unavailable — API will retry:', err.message || err)
    return c.json({ error: 'Service temporarily unavailable', detail: err.message || String(err) }, 503)
  }
  await next()
})

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:4173'],
  credentials: true,
}))
app.use('*', async (c, next) => {
  c.header('X-Powered-By', 'Sree Sangram API')
  await next()
})

// Serve uploaded files + the committed static OpenAPI spec
app.use(
  '/uploads/*',
  serveStatic({ root: path.resolve(import.meta.dirname) }),
)
app.use('/openapi.yaml', serveStatic({ root: path.resolve(import.meta.dirname) }))

// --- Routes ---
app.route('/api/auth', authRoutes)
app.route('/api/categories', categoryRoutes)
app.route('/api/products', productRoutes)
app.route('/api/blogs', blogRoutes)
app.route('/api/chambers', chamberRoutes)
app.route('/api/horoscope', horoscopeRoutes)
app.route('/api/bookings', bookingRoutes)
app.route('/api/testimonials', testimonialRoutes)
app.route('/api/gallery', galleryRoutes)
app.route('/api/enquiries', enquiryRoutes)
app.route('/api/payments', paymentRoutes)
app.route('/api/users', userRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/coupons', couponRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/shipping', shippingRoutes)
app.route('/api/images', imageRoutes)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

// --- OpenAPI ---
app.doc('/api/spec', {
  openapi: '3.0.0',
  info: {
    title: 'Sree Sangram API',
    version: '1.0.0',
    description: 'Backend API for the Sree Sangram Vedic astrology website — bookings, horoscope overrides, shop, blog, chambers, gallery, testimonials, and enquiries. Authenticated admin endpoints require a `Bearer` token from `POST /api/auth/login`.',
  },
})
// Swagger UI renders the committed static spec (regenerate with `npm run generate:openapi`)
app.get('/api/docs', swaggerUI({ url: '/openapi.yaml' }))

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message || 'Internal server error' }, 500)
})

/* Vercel (Services on Fluid compute) imports this module as a serverless
   function. Vercel's Node runtime invokes the handler with a Node-style
   (IncomingMessage, ServerResponse) pair — NOT a Fetch `Request` — so
   exporting app.fetch directly makes Hono throw (`this.raw.headers.get is not
   a function`) and every /api call hangs until the 300s runtime timeout. The
   @hono/node-server/vercel adapter converts the IncomingMessage into a real
   Request, runs the app, and writes the Response back out. When run directly
   with `node server.js` this export is simply ignored. */
export default handle(app)

// Only start the HTTP server when run directly (not when imported by tools or
// by Vercel's serverless runtime, which sets process.env.VERCEL).
const isMain = !process.env.VERCEL && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  /* Daily sales digest scheduler — fires once per day after DAILY_DIGEST_TIME
     (local time) and emails yesterday's summary to ADMIN_ALERT_EMAIL. */
  const sentDigestDates = new Set()
  const digestTime = process.env.DAILY_DIGEST_TIME || '08:00'
  function maybeRunDailyDigest() {
    if (!process.env.MAILERSEND_API_KEY || !process.env.ADMIN_ALERT_EMAIL) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (hhmm < digestTime) return
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (sentDigestDates.has(today)) return
    sentDigestDates.add(today)
    runDailyDigest(yesterdayStr())
      .then((r) => console.log(`[digest] daily sales summary → sent=${r.sent}`))
      .catch((e) => console.error('[digest] failed:', e.message || e))
  }
  setInterval(maybeRunDailyDigest, 60_000)
  maybeRunDailyDigest()

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`✅  Sree Sangram API running on http://localhost:${info.port}`)
    console.log(`📄  OpenAPI spec:   http://localhost:${info.port}/api/spec`)
    console.log(`📄  Static spec:    http://localhost:${info.port}/openapi.yaml`)
    console.log(`🧭  Swagger UI:     http://localhost:${info.port}/api/docs`)
  })
}

export { app }
