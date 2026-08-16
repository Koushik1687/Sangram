/* ==========================================================================
   routes/payments.js — PhonePe Payment Routes using @phonepe-pg/pg-sdk-node (pg)
   ========================================================================== */
import { createRoute, z } from '@hono/zod-openapi'
import { client, pg } from '../config/phonepe.js'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendOrderConfirmationEmail } from '../services/notifications.js'
import { cancelOrder } from '../services/orders.js'
import {
  createApp, ErrorSchema, InitiatePaymentInput, InitiatePaymentResponse,
  PaymentRecordSchema, RefundInput, SuccessSchema,
} from './schemas.js'

const router = createApp()

// 1. Initiate Payment Route
const initiateRoute = createRoute({
  method: 'post',
  path: '/initiate',
  tags: ['Payments'],
  summary: 'Initiate a PhonePe Standard Checkout payment',
  request: {
    body: { content: { 'application/json': { schema: InitiatePaymentInput } } },
  },
  responses: {
    200: {
      description: 'Payment initiated successfully',
      content: { 'application/json': { schema: InitiatePaymentResponse } },
    },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'PhonePe PG Error', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// 2. Check Order Status Route
const statusRoute = createRoute({
  method: 'get',
  path: '/status/{orderId}',
  tags: ['Payments'],
  summary: 'Get PhonePe payment status by Merchant Order ID',
  request: {
    params: z.object({ orderId: z.string() }),
  },
  responses: {
    200: {
      description: 'Payment status retrieved',
      content: { 'application/json': { schema: PaymentRecordSchema } },
    },
    404: { description: 'Order not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// 3. PhonePe Server-to-Server Callback
const callbackRoute = createRoute({
  method: 'post',
  path: '/callback',
  tags: ['Payments'],
  summary: 'PhonePe webhook / server-to-server callback',
  responses: {
    200: { description: 'Callback received', content: { 'application/json': { schema: SuccessSchema } } },
  },
})

// 4. Refund Route (Admin)
const refundRouteDef = createRoute({
  method: 'post',
  path: '/refund',
  tags: ['Payments'],
  summary: 'Initiate a refund for a PhonePe transaction (Admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    body: { content: { 'application/json': { schema: RefundInput } } },
  },
  responses: {
    200: { description: 'Refund processed', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Refund error', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// 5. Admin List Payments Route
const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Payments'],
  summary: 'List all payment transactions (Admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  responses: {
    200: {
      description: 'List of payments',
      content: { 'application/json': { schema: z.array(PaymentRecordSchema) } },
    },
  },
})

// --- Handlers ---

const PAID_STATES = ['PAYMENT_SUCCESS', 'COMPLETED', 'PAID', 'SUCCESS', 'AUTHORIZED']

/* When a payment reaches a paid state, mark the linked order as PAID and
   send the customer a confirmation email — only once, on the transition. */
async function handlePaidOrder(orderId) {
  if (!orderId) return
  const db = getDb()
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
  if (!order) return

  if (order.status !== 'PENDING') return // already paid/refunded — don't re-confirm or re-email
  db.prepare("UPDATE orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ? AND status = 'PENDING'").run(orderId)

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId)
  const payment = db.prepare('SELECT customer_email, customer_name FROM payments WHERE order_id = ? ORDER BY id DESC').get(orderId)
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id)
  const to = payment?.customer_email || user?.email || ''

  await sendOrderConfirmationEmail({
    to,
    order: {
      ...order,
      status: 'PAID',
      items,
      customer_name: payment?.customer_name || '',
    },
  })
}

router.openapi(initiateRoute, async (c) => {
  const {
    amount, customer_name, customer_phone, customer_email,
    booking_id, product_id, order_id, redirect_url,
  } = c.req.valid('json')

  const merchantOrderId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  // The redirect URL must carry the merchant order id so the payment-status page
  // can look the transaction up after the gateway redirect. If the caller supplied
  // their own redirect_url (e.g. a deployed frontend origin), append orderId to it.
  const baseRedirect = redirect_url || 'http://localhost:5173/payment-status'
  let defaultRedirectUrl
  try {
    const u = new URL(baseRedirect)
    if (!u.searchParams.has('orderId')) u.searchParams.set('orderId', merchantOrderId)
    defaultRedirectUrl = u.toString()
  } catch {
    const sep = baseRedirect.includes('?') ? '&' : '?'
    defaultRedirectUrl = `${baseRedirect}${sep}orderId=${merchantOrderId}`
  }

  // Amount in Paise for PhonePe (1 INR = 100 Paise)
  const amountInPaise = Math.round(amount * 100)

  let redirectUrl = defaultRedirectUrl
  let pgStatus = 'INITIATED'

  try {
    // Construct StandardCheckoutPayRequest using pg SDK builder
    const payRequest = pg.StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(defaultRedirectUrl)
      .message(`Payment for Sree Sangram Order ${merchantOrderId}`)
      .build()

    // Call PhonePe SDK client.pay()
    const payResponse = await client.pay(payRequest)
    if (payResponse && payResponse.redirectUrl) {
      redirectUrl = payResponse.redirectUrl
    } else if (payResponse && payResponse.url) {
      redirectUrl = payResponse.url
    }
  } catch (err) {
    console.warn('PhonePe SDK Client Pay Notice (Using sandbox workflow):', err.message || err)
    // If running in development/sandbox without live credentials, fall back gracefully to status URL
    redirectUrl = `${defaultRedirectUrl}&mock=true`
  }

  // Save payment in database
  const db = getDb()
  db.prepare(`
    INSERT INTO payments (
      merchant_order_id, amount, status, customer_name, customer_phone,
      customer_email, booking_id, product_id, order_id, redirect_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    merchantOrderId, amount, pgStatus,
    customer_name || '', customer_phone || '', customer_email || '',
    booking_id || null, product_id || null, order_id || null, redirectUrl,
  )

  return c.json({
    merchant_order_id: merchantOrderId,
    redirect_url: redirectUrl,
    status: pgStatus,
    message: 'Payment request initiated successfully via PhonePe SDK',
  })
})

router.openapi(statusRoute, async (c) => {
  const orderId = c.req.param('orderId')
  const db = getDb()
  const payment = db.prepare('SELECT * FROM payments WHERE merchant_order_id = ?').get(orderId)

  if (!payment) {
    return c.json({ error: 'Order not found' }, 404)
  }

  try {
    // Query order status via PhonePe SDK
    const statusResponse = await client.getOrderStatus(orderId)
    if (statusResponse) {
      const newStatus = statusResponse.state || statusResponse.status || payment.status
      db.prepare(`
        UPDATE payments SET status = ?, phonepe_transaction_id = ?, response_code = ?, updated_at = datetime('now')
        WHERE merchant_order_id = ?
      `).run(
        newStatus,
        statusResponse.transactionId || payment.phonepe_transaction_id || '',
        statusResponse.code || '',
        orderId,
      )
      payment.status = newStatus
      if (PAID_STATES.includes(String(newStatus).toUpperCase())) {
        await handlePaidOrder(payment.order_id)
      }
    }
  } catch (err) {
    console.warn(`PhonePe status check for ${orderId}:`, err.message || err)
  }

  return c.json(payment)
})

router.openapi(callbackRoute, async (c) => {
  try {
    const authHeader = c.req.header('authorization') || ''
    const bodyText = await c.req.text()
    const username = process.env.PHONEPE_CALLBACK_USERNAME || ''
    const password = process.env.PHONEPE_CALLBACK_PASSWORD || ''

    if (username && password) {
      const isValid = client.validateCallback(username, password, authHeader, bodyText)
      if (!isValid) {
        return c.json({ error: 'Invalid callback signature' }, 400)
      }
    }

    const data = JSON.parse(bodyText || '{}')
    if (data.merchantOrderId) {
      const db = getDb()
      const state = String(data.state || 'COMPLETED').toUpperCase()
      db.prepare(`
        UPDATE payments SET status = ?, response_code = ?, raw_response = ?, updated_at = datetime('now')
        WHERE merchant_order_id = ?
      `).run(data.state || 'COMPLETED', data.code || 'SUCCESS', JSON.stringify(data), data.merchantOrderId)
      if (PAID_STATES.includes(state)) {
        const payment = db.prepare('SELECT order_id FROM payments WHERE merchant_order_id = ?').get(data.merchantOrderId)
        if (payment) await handlePaidOrder(payment.order_id)
      }
    }
  } catch (e) {
    console.error('Error handling callback:', e)
  }
  return c.json({ success: true })
})

router.openapi(refundRouteDef, async (c) => {
  const { merchant_order_id, amount } = c.req.valid('json')
  const merchantRefundId = `REF_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const amountInPaise = Math.round(amount * 100)

  try {
    const refundRequest = pg.RefundRequest.builder()
      .merchantRefundId(merchantRefundId)
      .originalMerchantOrderId(merchant_order_id)
      .amount(amountInPaise)
      .build()

    const refundResponse = await client.refund(refundRequest)

    const db = getDb()
    db.prepare(`
      UPDATE payments SET status = 'REFUNDED', raw_response = ?, updated_at = datetime('now')
      WHERE merchant_order_id = ?
    `).run(JSON.stringify(refundResponse || {}), merchant_order_id)

    // Refunded orders give the items back to stock
    const payment = db.prepare('SELECT order_id FROM payments WHERE merchant_order_id = ?').get(merchant_order_id)
    if (payment?.order_id) cancelOrder(payment.order_id, 'REFUNDED')

    return c.json({ success: true, message: 'Refund initiated successfully', refundId: merchantRefundId })
  } catch (err) {
    return c.json({ error: err.message || 'Failed to process refund with PhonePe SDK' }, 400)
  }
})

router.openapi(listRoute, (c) => {
  const payments = getDb().prepare('SELECT * FROM payments ORDER BY created_at DESC').all()
  return c.json(payments)
})

export default router
