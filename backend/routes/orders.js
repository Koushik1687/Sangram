/* ==========================================================================
   routes/orders.js — customer orders: create, list, and view a single order.
   Creating an order does NOT charge the customer — the checkout flow then
   calls /api/payments/initiate (PhonePe) with the order id; the payment
   callback marks the order PAID.
   ========================================================================== */
import { createRoute, z } from '@hono/zod-openapi'
import { get, query, run } from '../db/database.js'
import { authMiddleware, customerAuthMiddleware } from '../middleware/auth.js'
import { findCoupon, computeDiscount } from '../services/coupons.js'
import { cancelOrder, maybeSendLowStockAlert } from '../services/orders.js'
import { computeShippingFee } from '../services/shipping.js'
import { createApp, ErrorSchema, OrderInput, OrderSchema, OrderStatusInput, SuccessSchema } from './schemas.js'

const router = createApp()

const createOrderRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Orders'],
  summary: 'Create an order from product ids (customer)',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  request: {
    body: { content: { 'application/json': { schema: OrderInput } } },
  },
  responses: {
    200: { description: 'Order created', content: { 'application/json': { schema: OrderSchema } } },
    400: { description: 'Invalid items', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const listOrdersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Orders'],
  summary: 'List the current customer’s orders',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  responses: {
    200: { description: 'Orders', content: { 'application/json': { schema: z.array(OrderSchema) } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const getOrderRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Orders'],
  summary: 'Get a single order with its items (customer)',
  security: [{ bearerAuth: [] }],
  middleware: [customerAuthMiddleware],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Order', content: { 'application/json': { schema: OrderSchema } } },
    404: { description: 'Order not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const listAllRoute = createRoute({
  method: 'get',
  path: '/all',
  tags: ['Orders'],
  summary: 'List all orders with payment info (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  responses: {
    200: { description: 'Orders', content: { 'application/json': { schema: z.array(OrderSchema) } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const updateStatusRoute = createRoute({
  method: 'patch',
  path: '/{id}/status',
  tags: ['Orders'],
  summary: 'Cancel or refund an order and restore its stock (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: OrderStatusInput } } },
  },
  responses: {
    200: { description: 'Status updated', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Order already finalised', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

async function withItems(order) {
  const items = await query('SELECT * FROM order_items WHERE order_id = ?', [order.id])
  return { ...order, items }
}

async function nextOrderNumber() {
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const count = Number((await get('SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE ?', [`SS-${ymd}%`])).c) + 1
  return `SS-${ymd}-${String(count).padStart(4, '0')}`
}

router.openapi(createOrderRoute, async (c) => {
  const { items, address, coupon_code } = c.req.valid('json')
  const { id: userId } = c.get('user')

  // Resolve products, snapshot name + price, and enforce stock limits
  const resolved = []
  let subtotal = 0
  for (const it of items) {
    const product = await get('SELECT * FROM products WHERE id = ? AND is_active = 1', [it.product_id])
    if (!product) return c.json({ error: `Product ${it.product_id} is not available` }, 400)
    const qty = Math.max(1, Math.min(99, it.quantity || 1))
    const stock = product.stock == null ? null : Number(product.stock)
    if (stock !== null && stock <= 0) {
      return c.json({ error: `${product.name} is currently out of stock.` }, 400)
    }
    if (stock !== null && qty > stock) {
      return c.json({ error: `Only ${stock} of ${product.name} left in stock — please reduce the quantity.` }, 400)
    }
    resolved.push({ product_id: product.id, name: product.name, price: Number(product.price), qty, stockTracked: stock !== null })
    subtotal += Number(product.price) * qty
  }

  // Apply coupon (server re-validates — the client value is never trusted)
  let discount = 0
  let appliedCode = null
  if (coupon_code) {
    const coupon = await findCoupon(coupon_code)
    if (!coupon) return c.json({ error: 'That coupon code was not found.' }, 400)
    const { discount: d, message } = computeDiscount(coupon, subtotal)
    if (d <= 0) return c.json({ error: message || 'This coupon cannot be applied' }, 400)
    discount = d
    appliedCode = coupon.code
  }
  // Shipping is computed server-side (flat fee, free above the threshold) and
  // stored on the order — the client only mirrors the rule for display.
  const shippingFee = computeShippingFee(subtotal)
  const total = subtotal - discount + shippingFee

  const orderNumber = await nextOrderNumber()
  const r = await run('INSERT INTO orders (order_number, user_id, total, discount, coupon_code, shipping_fee, status, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [orderNumber, userId, total, discount, appliedCode, shippingFee, 'PENDING', address || ''])
  if (appliedCode) {
    await run('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?', [appliedCode])
  }

  for (const it of resolved) {
    await run('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)',
      [r.lastInsertRowid, it.product_id, it.name, it.price, it.qty])
    if (it.stockTracked) {
      await run('UPDATE products SET stock = stock - ? WHERE id = ?', [it.qty, it.product_id])
      await maybeSendLowStockAlert(it.product_id)
    }
  }

  const order = await get('SELECT * FROM orders WHERE id = ?', [r.lastInsertRowid])
  return c.json(await withItems(order))
})

router.openapi(listOrdersRoute, async (c) => {
  const { id: userId } = c.get('user')
  const orders = await query('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [userId])
  return c.json(await Promise.all(orders.map(withItems)))
})

/* NOTE: /all must be registered before /{id} so Hono matches the static path. */
router.openapi(listAllRoute, async (c) => {
  const orders = await query(`
    SELECT o.*, u.name AS customer_name, u.email AS customer_email
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    ORDER BY o.id DESC
  `)
  return c.json(await Promise.all(orders.map(async (o) => ({
    ...(await withItems(o)),
    payment: (await get('SELECT merchant_order_id, amount FROM payments WHERE order_id = ? ORDER BY id DESC', [o.id])) || null,
  }))))
})

router.openapi(getOrderRoute, async (c) => {
  const { id: userId } = c.get('user')
  const order = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [c.req.param('id'), userId])
  if (!order) return c.json({ error: 'Order not found' }, 404)
  return c.json(await withItems(order))
})

router.openapi(updateStatusRoute, async (c) => {
  const { status } = c.req.valid('json')
  const ok = await cancelOrder(c.req.param('id'), status)
  if (!ok) return c.json({ error: 'Order cannot be cancelled — it may already be finalised.' }, 400)
  return c.json({ success: true })
})

export default router
