/* ==========================================================================
   services/salesDigest.js — daily sales summary for the admin.
   Stats are computed in the server's local timezone (the shop's market day),
   so "yesterday" is the admin's yesterday, not UTC's.
   ========================================================================== */
import { get, query } from '../db/database.js'
import { sendDailySalesDigest } from './notifications.js'

export function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Aggregate sales figures for a local calendar day (YYYY-MM-DD). */
export async function buildDailyStats(dateStr) {
  // created_at is stored as UTC timestamptz; the AT TIME ZONE 'localtime' cast
  // reproduces SQLite's date(created_at, 'localtime') behaviour (the shop's day).
  const DAY = `(created_at AT TIME ZONE 'localtime')::date = $1`
  const PAID = "status IN ('PAID','COMPLETED')"

  const paid = await get(`SELECT COUNT(*) AS c, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE ${PAID} AND ${DAY}`, [dateStr])
  const items = await get(`
    SELECT COALESCE(SUM(oi.quantity), 0) AS c
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('PAID','COMPLETED') AND (o.created_at AT TIME ZONE 'localtime')::date = $1
  `, [dateStr])
  const top = await query(`
    SELECT oi.product_name AS name, SUM(oi.quantity) AS qty, SUM(oi.price * oi.quantity) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('PAID','COMPLETED') AND (o.created_at AT TIME ZONE 'localtime')::date = $1
    GROUP BY oi.product_name ORDER BY qty DESC, revenue DESC LIMIT 5
  `, [dateStr])
  const coupons = await get(`SELECT COUNT(*) AS c, COALESCE(SUM(discount), 0) AS d FROM orders WHERE ${PAID} AND discount > 0 AND ${DAY}`, [dateStr])
  const newCustomers = await get(`SELECT COUNT(*) AS c FROM users WHERE (created_at AT TIME ZONE 'localtime')::date = $1`, [dateStr])
  const cancelled = await get(`SELECT COUNT(*) AS c FROM orders WHERE status IN ('CANCELLED','REFUNDED') AND ${DAY}`, [dateStr])
  const totalOrders = await get(`SELECT COUNT(*) AS c FROM orders WHERE ${DAY}`, [dateStr])

  // pg returns COUNT/SUM as strings (bigint/numeric) — normalise to numbers.
  return {
    date: dateStr,
    totalOrders: Number(totalOrders.c),
    orders: Number(paid.c),
    revenue: Number(paid.revenue),
    avgOrder: Number(paid.c) > 0 ? Math.round(Number(paid.revenue) / Number(paid.c)) : 0,
    itemsSold: Number(items.c),
    topProducts: top.map((p) => ({ ...p, qty: Number(p.qty), revenue: Number(p.revenue) })),
    couponOrders: Number(coupons.c),
    discountTotal: Number(coupons.d),
    newCustomers: Number(newCustomers.c),
    cancelled: Number(cancelled.c),
  }
}

/** Build stats for a day and email them to the admin. */
export async function runDailyDigest(dateStr) {
  const stats = await buildDailyStats(dateStr)
  const sent = await sendDailySalesDigest({ date: dateStr, stats })
  return { sent, stats }
}
