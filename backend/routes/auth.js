/* ==========================================================================
   routes/auth.js
   ========================================================================== */
import { createRoute } from '@hono/zod-openapi'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/database.js'
import { createApp, ErrorSchema, LoginInput, LoginResponse } from './schemas.js'

const router = createApp()

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  summary: 'Admin login — returns a JWT bearer token',
  request: {
    body: { content: { 'application/json': { schema: LoginInput } } },
  },
  responses: {
    200: { description: 'Login successful', content: { 'application/json': { schema: LoginResponse } } },
    400: { description: 'Missing fields', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Invalid credentials', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(loginRoute, async (c) => {
  const { username, password } = c.req.valid('json')
  if (!username || !password) return c.json({ error: 'Missing fields' }, 400)

  const db = getDb()
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username)
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET || 'srisangram_secret',
    { expiresIn: '24h' },
  )
  return c.json({ token })
})

export default router
