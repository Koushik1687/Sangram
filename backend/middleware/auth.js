/* ==========================================================================
   middleware/auth.js — JWT verification middleware for protected routes.
   ========================================================================== */
import jwt from 'jsonwebtoken'

/* Bearer-token helper shared by both middlewares */
function readToken(c) {
  const authHeader = c.req.header('authorization')
  if (!authHeader) return null
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
}

/* Admin-only guard (used by /api/auth and the admin CRUD routes) */
export const authMiddleware = async (c, next) => {
  const token = readToken(c)
  if (!token) return c.json({ error: 'No token provided' }, 401)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'srisangram_secret')
    if (decoded.role === 'customer') {
      return c.json({ error: 'Admin access required' }, 401)
    }
    c.set('admin', decoded)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}

/* Customer-only guard (used by /api/users and /api/orders) */
export const customerAuthMiddleware = async (c, next) => {
  const token = readToken(c)
  if (!token) return c.json({ error: 'No token provided' }, 401)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'srisangram_secret')
    if (decoded.role !== 'customer') {
      return c.json({ error: 'Customer access required' }, 401)
    }
    c.set('user', decoded)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}
