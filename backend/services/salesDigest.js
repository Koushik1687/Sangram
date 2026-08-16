/* ==========================================================================
   services/salesDigest.js — daily sales summary for the admin.
   Stats are computed in the server's local timezone (the shop's market day),
   so "yesterday" is the admin's yesterday, not UTC's.
   ========================================================================== */
import { getDb } from '../db/database.js'
import { sendDailySalesDigest } from './notifications.js'

export function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Aggregate sales figures for a local calendar day (YYYY-MM-DD). */
export function buildDailyStats(dateStr) {
  const db = getDb()
  const DAY = `date(created_at, 'localtime') = ?`
  const PAID = "status IN ('PAID','COMPLETED')"

  const paid = db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE ${PAID} AND ${DAY}`).get(dateStr)
  const items = db.prepare(`
    SELECT COALESCE(SUM(oi.quantity), 0) AS c
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('PAID','COMPLETED') AND date(o.created_at, 'localtime') = ?
  `).get(dateStr)
  const top = db.prepare(`
    SELECT oi.product_name AS name, SUM(oi.quantity) AS qty, SUM(oi.price * oi.quantity) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('PAID','COMPLETED') AND date(o.created_at, 'localtime') = ?
    GROUP BY oi.product_name ORDER BY qty DESC, revenue DESC LIMIT 5
  `).all(dateStr)
  const coupons = db.prepare(`SELECT COUNT(*) AS c, COALESCE(SUM(discount), 0) AS d FROM orders WHERE ${PAID} AND discount > 0 AND ${DAY}`).get(dateStr)
  const newCustomers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE date(created_at, 'localtime') = ?`).get(dateStr)
  const cancelled = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE status IN ('CANCELLED','REFUNDED') AND ${DAY}`).get(dateStr)
  const totalOrders = db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE ${DAY}`).get(dateStr)

  return {
    date: dateStr,
    totalOrders: totalOrders.c,
    orders: paid.c,
    revenue: paid.revenue,
    avgOrder: paid.c > 0 ? Math.round(paid.revenue / paid.c) : 0,
    itemsSold: items.c,
    topProducts: top,
    couponOrders: coupons.c,
    discountTotal: coupons.d,
    newCustomers: newCustomers.c,
    cancelled: cancelled.c,
  }
}

/** Build stats for a day and email them to the admin. */
export async function runDailyDigest(dateStr) {
  const stats = buildDailyStats(dateStr)
  const sent = await sendDailySalesDigest({ date: dateStr, stats })
  return { sent, stats }
}
