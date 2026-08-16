/* ==========================================================================
   services/notifications.js — transactional email via MailerSend.
   When MAILERSEND_API_KEY is not configured the service runs in "disabled"
   mode: it logs a notice and returns false so development is never blocked.
   ========================================================================== */
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend'

const API_KEY = process.env.MAILERSEND_API_KEY || ''
const FROM_EMAIL = process.env.MAILERSEND_FROM_EMAIL || 'orders@srisangram.com'
const FROM_NAME = process.env.MAILERSEND_FROM_NAME || 'Sree Sangram'
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || ''

const enabled = Boolean(API_KEY)
const client = enabled ? new MailerSend({ apiKey: API_KEY }) : null

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* Branded HTML email — inline styles only (email-client safe). */
function orderHtml(order) {
  const items = (order.items || [])
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #2a2d4a;color:#a89fc4;font-size:14px;">${escapeHtml(it.product_name)} × ${it.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #2a2d4a;color:#f2ede1;font-size:14px;text-align:right;white-space:nowrap;">${fmt(Number(it.price) * it.quantity)}</td>
        </tr>`,
    )
    .join('')

  return `
  <div style="background:#0a0b14;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#12142a;border:1px solid rgba(212,175,55,.25);border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#3b2467,#1b0f3a);padding:28px 32px;text-align:center;border-bottom:1px solid rgba(212,175,55,.4);">
        <div style="font-size:13px;letter-spacing:4px;color:#e9cf7d;text-transform:uppercase;margin-bottom:8px;">Sree Sangram</div>
        <div style="color:#f2ede1;font-size:22px;font-weight:bold;">Payment received — thank you! ✦</div>
      </div>
      <div style="padding:28px 32px;">
        <p style="color:#f2ede1;font-size:15px;margin:0 0 18px;">Hello${order.customer_name ? ` ${escapeHtml(order.customer_name)}` : ''},</p>
        <p style="color:#a89fc4;font-size:14px;margin:0 0 22px;">
          Your payment for order <strong style="color:#e9cf7d;">${escapeHtml(order.order_number)}</strong> has been received.
          Your items are being prepared for dispatch.
        </p>

        <div style="background:rgba(255,255,255,.03);border:1px solid rgba(212,175,55,.18);border-radius:10px;padding:16px 20px;margin-bottom:22px;">
          <table style="width:100%;border-collapse:collapse;">
            ${items}
            ${Number(order.shipping_fee) > 0
              ? `<tr>
                <td style="padding:10px 0 0;color:#a89fc4;font-size:14px;">Shipping</td>
                <td style="padding:10px 0 0;color:#f2ede1;font-size:14px;text-align:right;white-space:nowrap;">${fmt(order.shipping_fee)}</td>
              </tr>`
              : ''}
            <tr>
              <td style="padding:14px 0 0;color:#a89fc4;font-size:14px;">Total paid</td>
              <td style="padding:14px 0 0;color:#e9cf7d;font-size:18px;font-weight:bold;text-align:right;white-space:nowrap;">${fmt(order.total)}</td>
            </tr>
          </table>
        </div>

        ${order.address ? `
        <div style="margin-bottom:22px;">
          <div style="color:#766f96;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Delivery address</div>
          <div style="color:#a89fc4;font-size:14px;">${escapeHtml(order.address)}</div>
        </div>` : ''}

        <p style="color:#a89fc4;font-size:13px;margin:0 0 6px;">Questions about your order? Reply to this email or reach us through the Sree Sangram website.</p>
        <p style="color:#766f96;font-size:12px;margin:0;">This is a transactional email for order ${escapeHtml(order.order_number)}.</p>
      </div>
    </div>
  </div>`
}

function orderText(order) {
  const lines = [
    `Sree Sangram — payment received for order ${order.order_number}.`,
    '',
    ...(order.items || []).map(
      (it) => `- ${it.product_name} × ${it.quantity}: ${fmt(Number(it.price) * it.quantity)}`,
    ),
    '',
    ...(Number(order.shipping_fee) > 0 ? [`Shipping: ${fmt(order.shipping_fee)}`] : []),
    `Total paid: ${fmt(order.total)}`,
    order.address ? `Delivery address: ${order.address}` : '',
    '',
    'Thank you for your purchase.',
  ]
  return lines.filter(Boolean).join('\n')
}

/**
 * Send the order-confirmation email.
 * @param {{to: string, order: object}} params
 * @returns {Promise<boolean>} true when sent
 */
export async function sendOrderConfirmationEmail({ to, order }) {
  if (!enabled) {
    console.log(`[notifications] order ${order.order_number} paid — email skipped (set MAILERSEND_API_KEY to enable)`)
    return false
  }
  if (!to) {
    console.log(`[notifications] order ${order.order_number} paid — email skipped (no customer email on record)`)
    return false
  }
  try {
    const emailParams = new EmailParams()
      .setFrom(new Sender(FROM_EMAIL, FROM_NAME))
      .setTo([new Recipient(to)])
      .setSubject(`Payment received for order ${order.order_number} — Sree Sangram`)
      .setHtml(orderHtml(order))
      .setText(orderText(order))

    const res = await client.email.send(emailParams)
    console.log(`[notifications] confirmation email sent to ${to} for ${order.order_number}`)
    return Boolean(res)
  } catch (err) {
    console.error(`[notifications] email failed for ${order.order_number}:`, err.message || err)
    return false
  }
}

/**
 * Alert the admin when a tracked product drops to or below its low-stock
 * threshold. Uses the same MailerSend client; skipped when unconfigured.
 * @param {{product: object, stock: number, threshold: number}} params
 * @returns {Promise<boolean>}
 */
export async function sendLowStockAlert({ product, stock, threshold }) {
  const level = stock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'
  if (!enabled) {
    console.log(`[notifications] ${level}: ${product.name} (${stock} left, threshold ${threshold}) — alert skipped (set MAILERSEND_API_KEY)`)
    return false
  }
  if (!ADMIN_EMAIL) {
    console.log(`[notifications] ${level}: ${product.name} (${stock} left, threshold ${threshold}) — alert skipped (set ADMIN_ALERT_EMAIL)`)
    return false
  }
  try {
    const emailParams = new EmailParams()
      .setFrom(new Sender(FROM_EMAIL, FROM_NAME))
      .setTo([new Recipient(ADMIN_EMAIL)])
      .setSubject(`⚠️ ${level}: ${product.name} — ${stock} left (threshold ${threshold})`)
      .setHtml(`
        <div style="background:#0a0b14;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:560px;margin:0 auto;background:#12142a;border:1px solid rgba(217,118,90,.4);border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#4a1a1a,#1b0f3a);padding:28px 32px;border-bottom:1px solid rgba(217,118,90,.5);">
              <div style="font-size:13px;letter-spacing:4px;color:#e9cf7d;text-transform:uppercase;margin-bottom:8px;">Sree Sangram · Inventory</div>
              <div style="color:#f2ede1;font-size:20px;font-weight:bold;">${level}: ${product.name}</div>
            </div>
            <div style="padding:28px 32px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#a89fc4;font-size:14px;">Units remaining</td>
                  <td style="padding:8px 0;color:${stock <= 0 ? '#d9765a' : '#e0b64a'};font-size:18px;font-weight:bold;text-align:right;">${stock}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #2a2d4a;color:#a89fc4;font-size:14px;">Alert threshold</td>
                  <td style="padding:8px 0;border-bottom:1px solid #2a2d4a;color:#f2ede1;font-size:14px;text-align:right;">${threshold}</td>
                </tr>
              </table>
              <p style="color:#a89fc4;font-size:13px;margin:18px 0 0;">Restock this item or adjust its threshold in the admin panel → Products.</p>
            </div>
          </div>
        </div>`)
      .setText(`Sree Sangram inventory: ${product.name} is ${stock <= 0 ? 'OUT OF STOCK' : 'low on stock'} (${stock} left, threshold ${threshold}). Restock in the admin panel.`)

    const res = await client.email.send(emailParams)
    console.log(`[notifications] ${level} alert sent for ${product.name} (${stock} left)`)
    return Boolean(res)
  } catch (err) {
    console.error(`[notifications] low-stock alert failed for ${product.name}:`, err.message || err)
    return false
  }
}

/**
 * Daily sales digest for the admin. Skipped when MailerSend or the admin
 * recipient is not configured.
 * @param {{date: string, stats: object}} params
 * @returns {Promise<boolean>}
 */
export async function sendDailySalesDigest({ date, stats }) {
  if (!enabled) {
    console.log(`[notifications] daily digest for ${date} skipped (set MAILERSEND_API_KEY)`)
    return false
  }
  if (!ADMIN_EMAIL) {
    console.log(`[notifications] daily digest for ${date} skipped (set ADMIN_ALERT_EMAIL)`)
    return false
  }
  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`
  const fmtDate = (s) => {
    const [y, m, d] = String(s).split('-')
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  }
  const topRows = (stats.topProducts || [])
    .map(
      (p, i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #2a2d4a;color:#a89fc4;font-size:14px;">${i + 1}. ${escapeHtml(p.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #2a2d4a;color:#f2ede1;font-size:14px;text-align:right;">${p.qty} sold</td>
        <td style="padding:8px 0;border-bottom:1px solid #2a2d4a;color:#e9cf7d;font-size:14px;text-align:right;white-space:nowrap;">${money(p.revenue)}</td>
      </tr>`,
    )
    .join('')
  const stat = (label, value) => `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #2a2d4a;color:#a89fc4;font-size:14px;">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid #2a2d4a;color:#f2ede1;font-size:15px;font-weight:bold;text-align:right;white-space:nowrap;">${value}</td>
  </tr>`

  try {
    const emailParams = new EmailParams()
      .setFrom(new Sender(FROM_EMAIL, FROM_NAME))
      .setTo([new Recipient(ADMIN_EMAIL)])
      .setSubject(`📊 Sree Sangram — sales summary for ${fmtDate(date)}`)
      .setHtml(`
        <div style="background:#0a0b14;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:600px;margin:0 auto;background:#12142a;border:1px solid rgba(212,175,55,.25);border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#3b2467,#1b0f3a);padding:28px 32px;text-align:center;border-bottom:1px solid rgba(212,175,55,.4);">
              <div style="font-size:13px;letter-spacing:4px;color:#e9cf7d;text-transform:uppercase;margin-bottom:8px;">Sree Sangram · Daily Sales</div>
              <div style="color:#f2ede1;font-size:20px;font-weight:bold;">${fmtDate(date)}</div>
            </div>
            <div style="padding:26px 32px;">
              <table style="width:100%;border-collapse:collapse;">
                ${stat('Orders placed', stats.totalOrders)}
                ${stat('Paid orders', stats.orders)}
                ${stat('Revenue', money(stats.revenue))}
                ${stat('Average order value', money(stats.avgOrder))}
                ${stat('Items sold', stats.itemsSold)}
                ${stat('New customers', stats.newCustomers)}
                ${stat(`Coupons used (${stats.couponOrders})`, money(stats.discountTotal) + ' discount')}
                ${stat('Cancelled / refunded', stats.cancelled)}
              </table>

              <div style="margin-top:20px;">
                <div style="color:#766f96;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Top sellers</div>
                <table style="width:100%;border-collapse:collapse;">
                  ${topRows || '<tr><td style="padding:8px 0;color:#a89fc4;font-size:14px;">No paid sales on this day.</td></tr>'}
                </table>
              </div>
            </div>
          </div>
        </div>`)
      .setText(`Sree Sangram daily sales for ${date}: ${stats.orders} paid orders, ${money(stats.revenue)} revenue, ${stats.itemsSold} items sold, ${stats.newCustomers} new customers.`)

    const res = await client.email.send(emailParams)
    console.log(`[notifications] daily digest sent for ${date}`)
    return Boolean(res)
  } catch (err) {
    console.error(`[notifications] daily digest failed for ${date}:`, err.message || err)
    return false
  }
}
