/* ==========================================================================
   services/orders.js — order lifecycle helpers shared by the orders and
   payments routes. Stock is only restored for products with a tracked stock
   value (NULL stock = unlimited, nothing to restore), and only once per
   order (a CANCELLED/REFUNDED order is never re-processed).
   ========================================================================== */
import { get, query, run } from '../db/database.js'
import { sendLowStockAlert } from './notifications.js'

/* Resolve the alert threshold for a product: per-product value, else the global default. */
function alertThreshold(product) {
  if (product.low_stock_threshold != null) return Number(product.low_stock_threshold)
  return Number(process.env.LOW_STOCK_THRESHOLD || 5)
}

/**
 * Fire a low-stock alert when a tracked product drops to or below its
 * threshold. Only alerts once per drop (low_stock_alerted flag); the flag is
 * cleared again when stock is restored above the threshold.
 */
export async function maybeSendLowStockAlert(productId) {
  const product = await get('SELECT id, name, stock, low_stock_threshold, low_stock_alerted FROM products WHERE id = ?', [productId])
  if (!product || product.stock == null) return
  const threshold = alertThreshold(product)
  if (threshold <= 0) return // alerts disabled for this product
  const stock = Number(product.stock)
  if (stock > threshold) return
  if (Number(product.low_stock_alerted) === 1) return // already alerted for this drop

  await run('UPDATE products SET low_stock_alerted = 1 WHERE id = ?', [productId])
  await sendLowStockAlert({ product, stock, threshold })
}

/** Return the product quantities back to stock for an order. */
export async function restoreStock(orderId) {
  const items = await query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId])
  let restored = 0
  for (const it of items) {
    if (it.product_id == null) continue
    const r = await run('UPDATE products SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL', [it.quantity, it.product_id])
    restored += Number(r.changes || 0)
    // If stock is comfortably back above the threshold, allow a future alert
    const p = await get('SELECT stock, low_stock_threshold FROM products WHERE id = ?', [it.product_id])
    if (p && p.stock != null && Number(p.stock) > alertThreshold(p)) {
      await run('UPDATE products SET low_stock_alerted = 0 WHERE id = ?', [it.product_id])
    }
  }
  return restored
}

/**
 * Cancel or refund an order and restore its stock. No-op (returns false) when
 * the order is missing or already cancelled/refunded, so stock is never
 * restored twice.
 * @param {number|string} orderId
 * @param {'CANCELLED'|'REFUNDED'} newStatus
 */
export async function cancelOrder(orderId, newStatus = 'CANCELLED') {
  if (!orderId) return false
  const order = await get('SELECT status FROM orders WHERE id = ?', [orderId])
  if (!order) return false
  if (!['PENDING', 'PAID'].includes(order.status)) return false

  await run('UPDATE orders SET status = ?, updated_at = now() WHERE id = ?', [newStatus, orderId])
  await restoreStock(orderId)
  return true
}
