/* ==========================================================================
   services/shipping.js — flat-rate shipping config shared by the public
   /api/shipping endpoint and order creation (the server is the source of
   truth — the client only mirrors this for display).
   ========================================================================== */

/** Shipping config: flat fee, waived on orders at/above free_shipping_min. */
export function getShippingConfig() {
  return {
    fee: Number(process.env.SHIPPING_FEE) || 0,
    free_shipping_min: Number(process.env.FREE_SHIPPING_MIN) || 0,
  }
}

/** Shipping fee for a cart subtotal (before coupons). 0 when free shipping applies. */
export function computeShippingFee(subtotal) {
  const { fee, free_shipping_min } = getShippingConfig()
  if (fee <= 0) return 0
  if (free_shipping_min > 0 && subtotal >= free_shipping_min) return 0
  return fee
}
