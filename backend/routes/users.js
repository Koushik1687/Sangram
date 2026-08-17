/* ==========================================================================
   routes/users.js — customer accounts: register, login (email/password or
   Google), current profile.
   Tokens are signed with the same JWT secret as admin tokens but carry
   role: 'customer' so the two auth middlewares never overlap.
   ========================================================================== */
import { createRoute, z } from '@hono/zod-openapi'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { get, query, run } from '../db/database.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'
import { googleConfigured, verifyGoogleToken } from '../services/google.js'
import { storeImage } from '../services/images.js'
import {
  createApp, CustomerAuthResponse, CustomerLoginInput, CustomerPasswordInput,
  CustomerPhotoInput, CustomerProfileUpdateInput, CustomerRegisterInput,
  CustomerSchema, ErrorSchema, GoogleLoginInput, SuccessSchema,
} from './schemas.js'

const router = createApp()
const JWT_SECRET = process.env.JWT_SECRET || 'srisangram_secret'

function customerToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' },
  )
}

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Customers'],
  summary: 'Create a customer account and return a JWT',
  request: {
    body: { content: { 'application/json': { schema: CustomerRegisterInput } } },
  },
  responses: {
    200: { description: 'Account created', content: { 'application/json': { schema: CustomerAuthResponse } } },
    400: { description: 'Invalid input / email already registered', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Customers'],
  summary: 'Customer login — email + password, returns a JWT',
  request: {
    body: { content: { 'application/json': { schema: CustomerLoginInput } } },
  },
  responses: {
    200: { description: 'Login successful', content: { 'application/json': { schema: CustomerAuthResponse } } },
    401: { description: 'Invalid credentials', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const googleRoute = createRoute({
  method: 'post',
  path: '/google',
  tags: ['Customers'],
  summary: 'Sign in or register with Google — verifies a Google ID token and returns a customer JWT',
  request: {
    body: { content: { 'application/json': { schema: GoogleLoginInput } } },
  },
  responses: {
    200: { description: 'Signed in', content: { 'application/json': { schema: CustomerAuthResponse } } },
    500: { description: 'Google sign-in not configured', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Google verification failed', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Customers'],
  summary: 'Get the current customer profile',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  responses: {
    200: { description: 'Customer profile', content: { 'application/json': { schema: CustomerSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const updateRoute = createRoute({
  method: 'put',
  path: '/me',
  tags: ['Customers'],
  summary: 'Update the current customer profile (name, phone, age, zodiac sign)',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  request: {
    body: { content: { 'application/json': { schema: CustomerProfileUpdateInput } } },
  },
  responses: {
    200: { description: 'Updated profile', content: { 'application/json': { schema: CustomerSchema } } },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const photoRoute = createRoute({
  method: 'post',
  path: '/me/photo',
  tags: ['Customers'],
  summary: 'Upload the customer profile photo',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  request: {
    body: { content: { 'multipart/form-data': { schema: CustomerPhotoInput } } },
  },
  responses: {
    200: { description: 'Updated profile', content: { 'application/json': { schema: CustomerSchema } } },
    400: { description: 'No image file provided', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const passwordRoute = createRoute({
  method: 'post',
  path: '/me/password',
  tags: ['Customers'],
  summary: 'Change the customer password',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  request: {
    body: { content: { 'application/json': { schema: CustomerPasswordInput } } },
  },
  responses: {
    200: { description: 'Password changed', content: { 'application/json': { schema: ErrorSchema } } },
    400: { description: 'Wrong current password / weak new password', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const bookingsRoute = createRoute({
  method: 'get',
  path: '/me/bookings',
  tags: ['Customers'],
  summary: 'List the current customer appointments (matched by phone or email)',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  responses: {
    200: {
      description: 'Customer bookings',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.number(),
            client_name: z.string(),
            service: z.string(),
            chamber_name: z.string().nullable().optional(),
            booking_date: z.string(),
            time_slot: z.string(),
            status: z.string().optional(),
            created_at: z.string().optional(),
          }).passthrough()),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Customers'],
  summary: 'List all registered clients with profile details (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  responses: {
    200: {
      description: 'Clients',
      content: { 'application/json': { schema: z.array(CustomerSchema.passthrough()) } },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Customers'],
  summary: 'Delete a client account and their orders (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } },
    404: { description: 'Client not found', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(listRoute, async (c) => {
  const users = await query(`
    SELECT u.id, u.name, u.email, u.phone, u.photo_url, u.age, u.zodiac_sign, u.created_at
    FROM users u ORDER BY u.created_at DESC
  `)
  const orders = await query('SELECT * FROM orders')
  const items = await query('SELECT * FROM order_items')
  const bookings = await query(`
    SELECT b.id, b.client_name, b.phone, b.email, b.service, b.booking_date,
           b.time_slot, b.status, b.created_at, c.name AS chamber_name
    FROM bookings b LEFT JOIN chambers c ON b.chamber_id = c.id
  `)

  return c.json(users.map((u) => {
    const usrOrders = orders
      .filter((o) => o.user_id === u.id)
      .map((o) => ({ ...o, items: items.filter((it) => it.order_id === o.id) }))
    const usrBookings = bookings.filter((b) =>
      (b.email && b.email !== '' && b.email.toLowerCase() === u.email.toLowerCase())
      || (b.phone && b.phone !== '' && b.phone === u.phone))
    return {
      ...u,
      order_count: usrOrders.length,
      booking_count: usrBookings.length,
      orders: usrOrders,
      bookings: usrBookings,
    }
  }))
})

router.openapi(deleteRouteDef, async (c) => {
  const id = Number(c.req.param('id'))
  const user = await get('SELECT id FROM users WHERE id=?', [id])
  if (!user) return c.json({ error: 'Client not found' }, 404)

  /* Remove dependent rows first (orders reference the user via FK). */
  await run('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id=?)', [id])
  await run('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id=?)', [id])
  await run('DELETE FROM orders WHERE user_id=?', [id])
  await run('DELETE FROM users WHERE id=?', [id])
  return c.json({ success: true })
})

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    photo_url: u.photo_url || null, age: u.age ?? null, zodiac_sign: u.zodiac_sign || null,
    created_at: u.created_at,
  }
}

router.openapi(googleRoute, async (c) => {
  const { credential } = c.req.valid('json')

  /* Google already verified this email (ID tokens are signed by Google). */
  let profile
  try {
    profile = await verifyGoogleToken(credential)
  } catch (err) {
    if (!googleConfigured()) {
      return c.json({ error: 'Google sign-in is not configured on the server' }, 500)
    }
    console.error('[google] token verification failed:', err.message || err)
    return c.json({ error: 'Google sign-in failed. Please try again.' }, 401)
  }

  const email = profile.email.toLowerCase()
  let user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE lower(email) = ?', [email])

  if (!user) {
    /* New customer — create the account. A random password hash keeps the row
       consistent with password-based accounts (the user can set a password
       later from the account page). */
    const hash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10)
    const r = await run(
      'INSERT INTO users (name, email, phone, password_hash, photo_url) VALUES (?, ?, ?, ?, ?)',
      [profile.name || email.split('@')[0], email, '', hash, profile.picture || ''],
    )
    user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [r.lastInsertRowid])
  }

  return c.json({ token: customerToken(user), user: publicUser(user) })
})

router.openapi(registerRoute, async (c) => {
  const { name, email, phone, password } = c.req.valid('json')

  const existing = await get('SELECT id FROM users WHERE lower(email) = lower(?)', [email])
  if (existing) return c.json({ error: 'An account with this email already exists' }, 400)

  const hash = bcrypt.hashSync(password, 10)
  const r = await run('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
    [name, email.toLowerCase(), phone || '', hash])

  const user = publicUser(await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [r.lastInsertRowid]))
  return c.json({ token: customerToken(user), user })
})

router.openapi(loginRoute, async (c) => {
  const { email, password } = c.req.valid('json')
  const user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE lower(email) = lower(?)', [email])
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }
  return c.json({ token: customerToken(user), user: publicUser(user) })
})

router.openapi(meRoute, async (c) => {
  const { id } = c.get('user')
  const user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [id])
  if (!user) return c.json({ error: 'Account not found' }, 401)
  return c.json(publicUser(user))
})

router.openapi(updateRoute, async (c) => {
  const { id } = c.get('user')
  const user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [id])
  if (!user) return c.json({ error: 'Account not found' }, 401)

  const { name, phone, age, zodiac_sign } = c.req.valid('json')
  const next = {
    name: name ?? user.name,
    phone: phone ?? user.phone ?? '',
    age: age === undefined ? user.age : age,
    zodiac_sign: zodiac_sign === undefined ? user.zodiac_sign : zodiac_sign,
  }
  await run('UPDATE users SET name=?, phone=?, age=?, zodiac_sign=? WHERE id=?',
    [next.name, next.phone, next.age, next.zodiac_sign, id])

  return c.json(publicUser(await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [id])))
})

router.openapi(photoRoute, async (c) => {
  const { id } = c.get('user')
  const user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [id])
  if (!user) return c.json({ error: 'Account not found' }, 401)

  const { photo } = c.req.valid('form')
  if (!photo || typeof photo === 'string' || !photo.name) {
    return c.json({ error: 'No image file provided' }, 400)
  }

  await storeImage({ table: 'users', id, file: photo })

  return c.json(publicUser(await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [id])))
})

router.openapi(passwordRoute, async (c) => {
  const { id } = c.get('user')
  const user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [id])
  if (!user) return c.json({ error: 'Account not found' }, 401)

  const { current_password, new_password } = c.req.valid('json')
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return c.json({ error: 'Current password is incorrect' }, 400)
  }
  await run('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(new_password, 10), id])
  return c.json({ success: true })
})

router.openapi(bookingsRoute, async (c) => {
  const { id } = c.get('user')
  const user = await get('SELECT id, name, email, phone, password_hash, photo_url, age, zodiac_sign, created_at FROM users WHERE id = ?', [id])
  if (!user) return c.json({ error: 'Account not found' }, 401)

  const phone = (user.phone || '').trim()
  const email = (user.email || '').trim().toLowerCase()
  return c.json(
    await query(`
      SELECT b.id, b.client_name, b.service, b.booking_date, b.time_slot,
             b.status, b.created_at, c.name AS chamber_name
      FROM bookings b
      LEFT JOIN chambers c ON b.chamber_id = c.id
      WHERE (b.email != '' AND lower(b.email) = ?)
         OR (b.phone != '' AND b.phone = ?)
      ORDER BY b.booking_date DESC, b.time_slot DESC
    `, [email, phone]),
  )
})

export default router
