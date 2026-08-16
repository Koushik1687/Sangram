/* ==========================================================================
   services/coupons.js — coupon lookup + discount computation.
   Used by both POST /api/coupons/validate (live feedback at checkout) and
   order creation (authoritative server-side re-validation).
   ========================================================================== */
import { getDb } from '../db/database.js'

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase()
}

export function findCoupon(code) {
  return getDb().prepare('SELECT * FROM coupons WHERE code = ?').get(normalizeCode(code)) || null
}

/**
 * Compute the discount a valid coupon yields for a given pre-discount amount.
 * @returns {{ discount: number, message?: string }} discount is 0 when invalid
 */
export function computeDiscount(coupon, amount) {
  const now = new Date()
  const amountNum = Number(amount) || 0

  if (!coupon || coupon.is_active !== 1) return { discount: 0, message: 'This coupon is not valid.' }
  if (coupon.valid_until && new Date(`${coupon.valid_until}T23:59:59`) < now) {
    return { discount: 0, message: 'This coupon has expired.' }
  }
  if (Number(coupon.usage_limit) > 0 && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
    return { discount: 0, message: 'This coupon has reached its usage limit.' }
  }
  if (Number(coupon.min_order_amount) > 0 && amountNum < Number(coupon.min_order_amount)) {
    return {
      discount: 0,
      message: `This coupon needs a minimum order of ₹${Number(coupon.min_order_amount).toLocaleString('en-IN')}.`,
    }
  }

  let discount = 0
  if (coupon.discount_type === 'flat') {
    discount = Math.min(Number(coupon.discount_value), amountNum)
  } else {
    discount = Math.round((amountNum * Number(coupon.discount_value)) / 100)
    if (coupon.max_discount) discount = Math.min(discount, Number(coupon.max_discount))
  }
  discount = Math.max(0, Math.min(discount, amountNum))
  return { discount }
}

/**
 * Validate a code for a given amount. Returns the coupon when valid.
 * @returns {{ valid: boolean, discount: number, message?: string, coupon?: object }}
 */
export function validateCouponForAmount(code, amount) {
  const coupon = findCoupon(code)
  if (!coupon) return { valid: false, discount: 0, message: 'That coupon code was not found.' }
  const { discount, message } = computeDiscount(coupon, amount)
  if (discount <= 0) return { valid: false, discount: 0, message: message || 'This coupon cannot be used.' }
  return { valid: true, discount, coupon }
}
