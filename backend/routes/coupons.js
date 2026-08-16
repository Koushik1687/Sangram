/* ==========================================================================
   routes/coupons.js — coupon management (admin) + live validation (checkout).
   ========================================================================== */
import { createRoute, z } from '@hono/zod-openapi'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { normalizeCode, validateCouponForAmount } from '../services/coupons.js'
import {
  createApp, CouponInput, CouponSchema, ErrorSchema, SuccessSchema, ValidateCouponInput, ValidateCouponResponse,
} from './schemas.js'

const router = createApp()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Coupons'],
  summary: 'List all coupons (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: z.array(CouponSchema) } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Coupons'],
  summary: 'Create a coupon (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: CouponInput } } } },
  responses: {
    200: { description: 'Created', content: { 'application/json': { schema: CouponSchema } } },
    400: { description: 'Code already exists', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const updateRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Coupons'],
  summary: 'Update a coupon (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: CouponInput } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: SuccessSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Coupons'],
  summary: 'Delete a coupon (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const validateRoute = createRoute({
  method: 'post',
  path: '/validate',
  tags: ['Coupons'],
  summary: 'Validate a coupon code for a cart amount (checkout)',
  request: { body: { content: { 'application/json': { schema: ValidateCouponInput } } } },
  responses: {
    200: { description: 'Validation result', content: { 'application/json': { schema: ValidateCouponResponse } } },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(listRoute, (c) => {
  return c.json(getDb().prepare('SELECT * FROM coupons ORDER BY id DESC').all())
})

router.openapi(createRouteDef, (c) => {
  const v = c.req.valid('json')
  const db = getDb()
  const code = normalizeCode(v.code)
  if (db.prepare('SELECT id FROM coupons WHERE code = ?').get(code)) {
    return c.json({ error: 'A coupon with this code already exists' }, 400)
  }
  const r = db.prepare(`
    INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, valid_until, usage_limit, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code, v.discount_type, v.discount_value,
    v.min_order_amount || 0, v.max_discount || null, v.valid_until || null,
    v.usage_limit || 0, v.is_active ?? 1,
  )
  return c.json(db.prepare('SELECT * FROM coupons WHERE id = ?').get(r.lastInsertRowid))
})

router.openapi(updateRouteDef, (c) => {
  const v = c.req.valid('json')
  const db = getDb()
  db.prepare(`
    UPDATE coupons SET code=?, discount_type=?, discount_value=?, min_order_amount=?,
      max_discount=?, valid_until=?, usage_limit=?, is_active=? WHERE id=?
  `).run(
    normalizeCode(v.code), v.discount_type, v.discount_value,
    v.min_order_amount || 0, v.max_discount || null, v.valid_until || null,
    v.usage_limit || 0, v.is_active ?? 1, c.req.param('id'),
  )
  return c.json({ success: true })
})

router.openapi(deleteRouteDef, (c) => {
  getDb().prepare('DELETE FROM coupons WHERE id=?').run(c.req.param('id'))
  return c.json({ success: true })
})

router.openapi(validateRoute, (c) => {
  const { code, amount } = c.req.valid('json')
  const result = validateCouponForAmount(code, amount)
  if (result.valid) {
    return c.json({
      valid: true,
      discount: result.discount,
      message: `Coupon ${normalizeCode(code)} applied — you save ₹${result.discount.toLocaleString('en-IN')}.`,
      coupon: result.coupon,
    })
  }
  return c.json({ valid: false, discount: 0, message: result.message || 'Coupon not applicable.' })
})

export default router
